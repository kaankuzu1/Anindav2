'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Mail, AlertCircle, CheckCircle } from 'lucide-react';

export default function ConnectInboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check for success/error from OAuth callback
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const successParam = searchParams.get('success');
    const emailParam = searchParams.get('email');

    if (errorParam) {
      // Map error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        db_error: 'Database error. Please try again.',
        oauth_failed: 'OAuth authentication failed. Please try again.',
        no_tokens: 'Failed to get access tokens. Please try again.',
        no_email: 'Could not retrieve email address from Google.',
        email_in_use: 'This email is already connected to another team.',
        missing_params: 'Invalid OAuth callback. Please try again.',
        invalid_state: 'Invalid session state. Please try again.',
        access_denied: 'Access was denied. Please grant the required permissions.',
        token_exchange_failed: 'Failed to exchange authorization code. Please try again.',
        userinfo_failed: 'Failed to get user information from Google.',
        unauthorized: 'You are not authorized for this team.',
        missing_team_id: 'Team ID is missing. Please try again.',
      };
      setError(errorMessages[errorParam] || decodeURIComponent(errorParam));
    }
    if (successParam && emailParam) {
      setSuccess(`Successfully connected ${decodeURIComponent(emailParam)}`);
    }
  }, [searchParams]);

  // Fetch user's team
  useEffect(() => {
    async function getTeam() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Get user's first team (or create one if none exists)
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .limit(1) as { data: { team_id: string }[] | null };

      if (teamMembers && teamMembers.length > 0) {
        setTeamId(teamMembers[0].team_id);
      } else {
        // Create a default team for the user
        const { data: newTeam } = await (supabase
          .from('teams') as any)
          .insert({
            name: 'My Team',
            slug: `team-${user.id.slice(0, 8)}`,
          })
          .select()
          .single();

        if (newTeam) {
          await (supabase.from('team_members') as any).insert({
            team_id: newTeam.id,
            user_id: user.id,
            role: 'owner',
          });
          setTeamId(newTeam.id);
        }
      }
    }

    getTeam();
  }, [supabase, router]);

  const handleConnectGoogle = () => {
    if (!teamId) {
      setError('Team not found. Please refresh the page.');
      return;
    }

    setLoading(true);
    setError(null);

    // Redirect to Next.js API route for OAuth
    window.location.href = `/api/auth/google?team_id=${teamId}`;
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href="/inboxes"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Inboxes
      </Link>

      <div className="bg-card rounded-xl border border-border p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Connect Email Account</h1>
          <p className="text-muted-foreground mt-2">
            Connect your Gmail account to start sending emails
          </p>
        </div>

        {/* Success message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="text-green-800 dark:text-green-300">{success}</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Provider button */}
        <div className="space-y-4">
          <button
            onClick={handleConnectGoogle}
            disabled={loading || !teamId}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-card border border-border rounded-xl hover:bg-muted/50 hover:border-muted-foreground/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="font-medium text-foreground">
              {loading ? 'Connecting...' : 'Connect Gmail'}
            </span>
          </button>
        </div>

        {/* Info section */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
          <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">What happens when you connect?</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <li>- We securely store your OAuth tokens (encrypted)</li>
            <li>- Your email is used to send campaign emails</li>
            <li>- We monitor replies and track deliverability</li>
            <li>- You can disconnect anytime from settings</li>
          </ul>
        </div>

        {/* Permissions note */}
        <p className="text-xs text-muted-foreground text-center mt-6">
          We request only the permissions needed to send emails and read replies.
          Your credentials are encrypted and never shared.
        </p>
      </div>
    </div>
  );
}
