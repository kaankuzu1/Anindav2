import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

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
  const teamId = searchParams.get('team_id');

  if (!teamId) {
    return NextResponse.redirect(`${origin}/inboxes/connect?error=missing_team_id`);
  }

  // Verify user is authenticated
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Verify user belongs to this team
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .eq('team_id', teamId)
    .single();

  if (!membership) {
    return NextResponse.redirect(`${origin}/inboxes/connect?error=unauthorized`);
  }

  // Generate Google OAuth URL manually (avoiding googleapis library)
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = `${origin}/api/auth/google/callback`;

  // Store team_id and user_id in state
  const state = Buffer.from(JSON.stringify({ team_id: teamId, user_id: user.id })).toString('base64');

  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
