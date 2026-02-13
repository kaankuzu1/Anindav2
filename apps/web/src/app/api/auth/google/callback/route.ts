import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { encrypt } from '@aninda/shared';

function getOrigin(request: Request): string {
  const headersList = headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host');
  const proto = headersList.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getOrigin(request);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${origin}/inboxes/connect?error=${error}`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${origin}/inboxes/connect?error=missing_params`);
  }

  // Decode state
  let state: { team_id: string; user_id: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf-8'));
  } catch {
    return NextResponse.redirect(`${origin}/inboxes/connect?error=invalid_state`);
  }

  const { team_id, user_id } = state;

  if (!team_id || !user_id) {
    return NextResponse.redirect(`${origin}/inboxes/connect?error=invalid_state`);
  }

  // Exchange code for tokens using fetch (avoiding googleapis library)
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${origin}/api/auth/google/callback`;

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(`${origin}/inboxes/connect?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(`${origin}/inboxes/connect?error=no_tokens`);
    }

    // Get user email using the access token
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(`${origin}/inboxes/connect?error=userinfo_failed`);
    }

    const userInfo = await userInfoResponse.json();
    const email = userInfo.email;

    if (!email) {
      return NextResponse.redirect(`${origin}/inboxes/connect?error=no_email`);
    }

    // Use service role client to insert inbox
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Encrypt tokens before storing
    const encryptionKey = process.env.ENCRYPTION_KEY!;
    const encryptedAccessToken = encrypt(tokens.access_token, encryptionKey);
    const encryptedRefreshToken = encrypt(tokens.refresh_token, encryptionKey);

    // Check if inbox already exists (email is globally unique in schema)
    const { data: existing } = await supabase
      .from('inboxes')
      .select('id, team_id')
      .eq('email', email)
      .single();

    if (existing) {
      // Check if it belongs to this team
      if (existing.team_id !== team_id) {
        return NextResponse.redirect(`${origin}/inboxes/connect?error=email_in_use`);
      }

      // Update existing inbox with new encrypted tokens
      await supabase
        .from('inboxes')
        .update({
          oauth_access_token: encryptedAccessToken,
          oauth_refresh_token: encryptedRefreshToken,
          oauth_expires_at: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            : null,
          status: 'active',
        })
        .eq('id', existing.id);

      return NextResponse.redirect(`${origin}/inboxes?success=reconnected`);
    }

    // Create new inbox with encrypted tokens (health_score starts at 0 until warmup)
    const { data: inbox, error: insertError } = await supabase
      .from('inboxes')
      .insert({
        team_id,
        email,
        provider: 'google',
        oauth_access_token: encryptedAccessToken,
        oauth_refresh_token: encryptedRefreshToken,
        oauth_expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        status: 'active',
        health_score: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create inbox:', insertError);
      return NextResponse.redirect(`${origin}/inboxes/connect?error=db_error`);
    }

    // Create inbox settings
    await supabase.from('inbox_settings').insert({
      inbox_id: inbox.id,
      daily_send_limit: 50,
    });

    // Create warmup state
    await supabase.from('warmup_state').insert({
      inbox_id: inbox.id,
      enabled: false,
      phase: 'ramping',
      current_day: 0,
      ramp_speed: 'normal',
      target_daily_volume: 40,
      sent_today: 0,
      received_today: 0,
      replied_today: 0,
      sent_total: 0,
      received_total: 0,
      replied_total: 0,
    });

    return NextResponse.redirect(`${origin}/inboxes?success=connected`);
  } catch (err) {
    console.error('OAuth error:', err);
    return NextResponse.redirect(`${origin}/inboxes/connect?error=oauth_failed`);
  }
}
