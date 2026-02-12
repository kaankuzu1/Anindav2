'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SettingsFlipCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  gradient: string;
  bgClass: string;
  iconColorClass: string;
}

export function SettingsFlipCard({
  title,
  description,
  icon: Icon,
  href,
  gradient,
  bgClass,
  iconColorClass,
}: SettingsFlipCardProps) {
  const router = useRouter();

  return (
    <div
      role="link"
      tabIndex={0}
      className="group cursor-pointer [perspective:1000px] outline-none"
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push(href);
        }
      }}
    >
      <div className="flip-card-inner relative aspect-square">
        {/* Front face */}
        <div
          className={`flip-card-face absolute inset-0 rounded-2xl ${bgClass} border border-gray-200 dark:border-[#353b48] shadow-sm flex items-center justify-center transition-shadow group-hover:shadow-md`}
        >
          <Icon className={`w-16 h-16 ${iconColorClass}`} strokeWidth={1.5} />
        </div>

        {/* Back face */}
        <div
          className={`flip-card-face flip-card-back absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} flex flex-col items-center justify-center p-4 text-white`}
        >
          <h3 className="font-bold text-xl mb-1 text-center">{title}</h3>
          <p className="text-sm opacity-90 text-center mb-3">{description}</p>
          <ArrowRight className="w-5 h-5 opacity-75" />
        </div>
      </div>
    </div>
  );
}
