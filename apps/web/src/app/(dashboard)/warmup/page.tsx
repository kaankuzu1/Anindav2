'use client';

import { useRouter } from 'next/navigation';
import { WarmupModeCard } from '@/components/warmup/warmup-mode-card';

export default function WarmupChoicePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in-down">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Choose Your Warmup Strategy
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Select the warmup mode that best fits your needs. You can manage inboxes separately for each mode.
          </p>
        </div>

        {/* Mode cards grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto stagger-children">
          <WarmupModeCard
            mode="pool"
            onSelect={() => router.push('/warmup/pool')}
          />
          <WarmupModeCard
            mode="network"
            disabled={true}
            onSelect={() => router.push('/warmup/network')}
          />
        </div>

        {/* Info section */}
        <div className="mt-16 max-w-4xl mx-auto animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4 text-center">Why Warmup Matters</h2>
            <p className="text-muted-foreground text-center mb-6">
              Email warmup gradually builds your sender reputation, ensuring your campaigns land in the inbox instead of spam.
            </p>
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">95%+</div>
                <div className="text-sm text-muted-foreground">Inbox Placement Rate</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">30 Days</div>
                <div className="text-sm text-muted-foreground">Average Warmup Time</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">100+</div>
                <div className="text-sm text-muted-foreground">Emails Per Day Target</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
