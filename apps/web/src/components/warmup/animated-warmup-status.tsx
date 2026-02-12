'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedWarmupStatusProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const WARMUP_WORDS = [
  'Toasting',
  'Simmering',
  'Kindling',
  'Percolating',
  'Brewing',
  'Sparking',
  'Stoking',
  'Thawing',
  'Defrosting',
  'Smoldering',
  'Flickering',
  'Glowing',
];

const WORD_INTERVAL = 6000; // 6 seconds

export function AnimatedWarmupStatus({
  className,
  size = 'md',
}: AnimatedWarmupStatusProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      setIsVisible(false);

      // After fade out, change word and fade in
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % WARMUP_WORDS.length);
        setIsVisible(true);
      }, 300);
    }, WORD_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const currentWord = WARMUP_WORDS[currentIndex];

  const sizeStyles = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium animate-warmup-gradient transition-opacity duration-300',
        sizeStyles[size],
        isVisible ? 'opacity-100' : 'opacity-0',
        className
      )}
    >
      {currentWord}…
    </span>
  );
}
