'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function AdminConnectInboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connecting, setConnecting] = useState<'google' | 'microsoft' | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  useEffect(() => {
    // Handle OAuth callback results
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const email = searchParams.get('email');

    if (success === 'true' && email) {
      setNotification({
        type: 'success',
        message: `Successfully connected ${decodeURIComponent(email)}`,
      });
      // Auto-redirect after showing success
      setTimeout(() => {
        router.push('/admin/inboxes?success=true&email=' + encodeURIComponent(email));
      }, 2000);
    } else if (error) {
      setNotification({
        type: 'error',
        message: decodeURIComponent(error),
      });
    }
  }, [searchParams, router]);

  const handleConnect = (provider: 'google' | 'microsoft') => {
    // Get admin token
    const token = localStorage.getItem('admin_token');
    if (!token) {
      setNotification({ type: 'error', message: 'Not authenticated. Please log in again.' });
      return;
    }

    setConnecting(provider);

    // Redirect to OAuth endpoint with token in the header
    // Since we can't pass headers in a redirect, we need to open a popup or redirect directly
    // The API endpoint uses AdminAuthGuard which checks the Authorization header
    // We'll use a form-based approach to pass the token

    const form = document.createElement('form');
    form.method = 'GET';
    form.action = `${apiUrl}/auth/admin/${provider}/connect`;

    // Add token as a hidden field (we'll need backend to accept this)
    // Actually, the OAuth flow needs the token in cookies or session
    // For now, we'll open the OAuth URL directly - the browser will handle it

    // Store token in sessionStorage so callback can verify
    sessionStorage.setItem('admin_oauth_pending', 'true');

    // Redirect to OAuth - the AdminAuthGuard on the backend will need to be updated
    // to accept token from query param for OAuth flows
    window.location.href = `${apiUrl}/auth/admin/${provider}/connect?token=${encodeURIComponent(token)}`;
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/inboxes"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-[#6b7280] hover:text-gray-700 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inboxes
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connect Admin Inbox</h1>
        <p className="text-sm text-gray-500 dark:text-[#6b7280] mt-1">
          Connect an email account to use for Network Warmup
        </p>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`flex items-center gap-3 p-4 rounded-lg mb-6 ${
          notification.type === 'success'
            ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30'
            : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          )}
          <p className={`text-sm ${
            notification.type === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
          }`}>
            {notification.message}
          </p>
          {notification.type === 'success' && (
            <span className="text-xs text-green-600 dark:text-green-500 ml-auto">Redirecting...</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
        {/* Google */}
        <button
          onClick={() => handleConnect('google')}
          disabled={connecting !== null}
          className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] hover:border-orange-300 dark:hover:border-orange-500/40 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed text-left"
        >
          {connecting === 'google' ? (
            <div className="w-12 h-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            </div>
          ) : (
            <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z"/>
                <path fill="#34A853" d="M16.0407269,18.0125889 C14.9509167,18.7163016 13.5660892,19.0909091 12,19.0909091 C8.86648613,19.0909091 6.21911939,17.076871 5.27698177,14.2678769 L1.23746264,17.3349879 C3.19279051,21.2936293 7.26500293,24 12,24 C14.9328362,24 17.7353462,22.9573905 19.834192,20.9995801 L16.0407269,18.0125889 Z"/>
                <path fill="#4A90E2" d="M19.834192,20.9995801 C22.0291676,18.9520994 23.4545455,15.903663 23.4545455,12 C23.4545455,11.2909091 23.3454545,10.5272727 23.1818182,9.81818182 L12,9.81818182 L12,14.4545455 L18.4363636,14.4545455 C18.1187732,16.013626 17.2662994,17.2212117 16.0407269,18.0125889 L19.834192,20.9995801 Z"/>
                <path fill="#FBBC05" d="M5.27698177,14.2678769 C5.03832634,13.556323 4.90909091,12.7937589 4.90909091,12 C4.90909091,11.2182781 5.03443647,10.4668121 5.26620003,9.76452941 L1.23999023,6.65002441 C0.43658717,8.26043162 0,10.0753848 0,12 C0,13.9195484 0.444780743,15.7## C1.23746264,17.3349879 L5.27698177,14.2678769 Z"/>
              </svg>
            </div>
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-orange-500 transition-colors">
            Google / Gmail
          </span>
          <span className="text-xs text-gray-500 dark:text-[#6b7280]">Connect via OAuth</span>
        </button>

        {/* Microsoft */}
        <button
          onClick={() => handleConnect('microsoft')}
          disabled={connecting !== null}
          className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-[#1a1d24] rounded-xl border border-gray-200 dark:border-[#2a2f3a] hover:border-orange-300 dark:hover:border-orange-500/40 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed text-left"
        >
          {connecting === 'microsoft' ? (
            <div className="w-12 h-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            </div>
          ) : (
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 23 23">
                <rect fill="#F25022" x="1" y="1" width="10" height="10"/>
                <rect fill="#00A4EF" x="1" y="12" width="10" height="10"/>
                <rect fill="#7FBA00" x="12" y="1" width="10" height="10"/>
                <rect fill="#FFB900" x="12" y="12" width="10" height="10"/>
              </svg>
            </div>
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-orange-500 transition-colors">
            Microsoft / Outlook
          </span>
          <span className="text-xs text-gray-500 dark:text-[#6b7280]">Connect via OAuth</span>
        </button>
      </div>

      {/* SMTP Coming Soon */}
      <div className="mt-6 max-w-xl">
        <div className="flex flex-col items-center gap-3 p-6 bg-gray-50 dark:bg-[#1a1d24]/50 rounded-xl border border-gray-200 dark:border-[#2a2f3a] border-dashed">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-500/10 rounded-full flex items-center justify-center">
            <Mail className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">SMTP / Other</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">Coming soon</span>
        </div>
      </div>
    </div>
  );
}
