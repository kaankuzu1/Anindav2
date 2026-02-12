'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Globe,
  CheckCircle,
  XCircle,
  RefreshCw,
  Copy,
  ArrowLeft,
  AlertTriangle,
  ExternalLink,
  Shield,
} from 'lucide-react';

interface DomainConfig {
  tracking_domain: string | null;
  tracking_domain_verified: boolean;
  tracking_domain_verified_at: string | null;
  dns_instructions: {
    type: string;
    name: string;
    value: string;
    ttl: number;
    instructions: string;
  } | null;
}

export default function TrackingDomainPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [config, setConfig] = useState<DomainConfig | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch current config
  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        setAccessToken(session.access_token);
      }

      // Fetch tracking domain config
      try {
        const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';
        const res = await fetch(`${apiUrl}/tracking/custom-domain`, {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        });

        if (res.ok) {
          const { data } = await res.json();
          setConfig(data);
          if (data.tracking_domain) {
            setNewDomain(data.tracking_domain);
          }
        }
      } catch (err) {
        console.error('Failed to fetch config:', err);
      }

      setLoading(false);
    }

    fetchData();
  }, [supabase, router]);

  // Set domain
  const handleSetDomain = async () => {
    if (!newDomain.trim()) {
      setError('Please enter a domain');
      return;
    }

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';
      const res = await fetch(`${apiUrl}/tracking/custom-domain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });

      const result = await res.json();

      if (res.ok) {
        setConfig(result.data);
        setSuccess(result.message);
      } else {
        setError(result.message || 'Failed to set domain');
      }
    } catch (err) {
      setError('Failed to set domain. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Verify domain
  const handleVerify = async () => {
    setError('');
    setSuccess('');
    setVerifying(true);

    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';
      const res = await fetch(`${apiUrl}/tracking/custom-domain/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await res.json();

      if (result.data.verified) {
        setConfig({
          ...config!,
          tracking_domain_verified: true,
          tracking_domain_verified_at: new Date().toISOString(),
        });
        setSuccess(result.message);
      } else {
        setError(result.message || 'Verification failed');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Remove domain
  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove your custom tracking domain?')) return;

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';
      await fetch(`${apiUrl}/tracking/custom-domain`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      setConfig({
        tracking_domain: null,
        tracking_domain_verified: false,
        tracking_domain_verified_at: null,
        dns_instructions: null,
      });
      setNewDomain('');
      setSuccess('Custom domain removed');
    } catch (err) {
      setError('Failed to remove domain');
    } finally {
      setSaving(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/settings')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </button>
        <h1 className="text-2xl font-bold text-foreground">Custom Tracking Domain</h1>
        <p className="text-muted-foreground mt-1">
          Use your own domain for tracking links to improve deliverability
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-medium text-foreground">Why use a custom tracking domain?</h3>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>Tracking pixels from shared domains often get blocked by email clients</li>
              <li>Your custom domain builds trust and improves deliverability</li>
              <li>Links appear branded: <code className="text-xs bg-muted px-1 py-0.5 rounded">track.yourcompany.com</code></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Status Card */}
      {config?.tracking_domain && (
        <div className={`rounded-xl p-4 mb-6 ${
          config.tracking_domain_verified 
            ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30'
            : 'bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30'
        }`}>
          <div className="flex items-start gap-3">
            {config.tracking_domain_verified ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-foreground">{config.tracking_domain}</h3>
                {config.tracking_domain_verified ? (
                  <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 rounded-full">
                    Verified
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 rounded-full">
                    Pending Verification
                  </span>
                )}
              </div>
              {config.tracking_domain_verified ? (
                <p className="text-sm text-muted-foreground mt-1">
                  Your tracking links are now using your custom domain.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Add the DNS record below to verify your domain.
                </p>
              )}
            </div>
            <button
              onClick={handleRemove}
              disabled={saving}
              className="text-sm text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="text-sm text-green-700 dark:text-green-300">{success}</span>
        </div>
      )}

      {/* Setup Form */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold text-foreground mb-4">
          {config?.tracking_domain ? 'Update Domain' : 'Set Up Custom Domain'}
        </h2>

        {/* Domain Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            Tracking Domain
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
              placeholder="track.yourcompany.com"
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <button
              onClick={handleSetDomain}
              disabled={saving || !newDomain.trim()}
              className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Use a subdomain like <code className="bg-muted px-1 py-0.5 rounded">track.yourcompany.com</code>
          </p>
        </div>

        {/* DNS Instructions */}
        {config?.dns_instructions && !config.tracking_domain_verified && (
          <div className="border-t border-border pt-6">
            <h3 className="font-medium text-foreground mb-3">DNS Configuration</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add this CNAME record to your DNS provider:
            </p>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block mb-1">Type</span>
                  <span className="font-mono text-foreground">{config.dns_instructions.type}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Name/Host</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-foreground">{config.dns_instructions.name}</span>
                    <button
                      onClick={() => copyToClipboard(config.dns_instructions!.name)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                      title="Copy"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Value/Target</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-foreground">{config.dns_instructions.value}</span>
                    <button
                      onClick={() => copyToClipboard(config.dns_instructions!.value)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                      title="Copy"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                DNS changes can take up to 24 hours to propagate, but usually complete within minutes.
              </p>
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {verifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Verify Domain
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Help Links */}
        <div className="mt-6 pt-6 border-t border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">DNS Provider Guides</h4>
          <div className="flex flex-wrap gap-3">
            {[
              { name: 'Cloudflare', url: 'https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/' },
              { name: 'GoDaddy', url: 'https://www.godaddy.com/help/add-a-cname-record-19236' },
              { name: 'Namecheap', url: 'https://www.namecheap.com/support/knowledgebase/article.aspx/9646/2237/how-to-create-a-cname-record-for-your-domain/' },
              { name: 'Google Domains', url: 'https://support.google.com/domains/answer/9211383' },
            ].map((provider) => (
              <a
                key={provider.name}
                href={provider.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {provider.name}
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
