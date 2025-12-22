'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative">
        <div className={cn(
          'rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-1.5 shadow-lg',
          'ring-2 ring-violet-400/20',
          size === 'lg' && 'p-2.5'
        )}>
          <Sparkles className={cn(sizeClasses[size], 'text-white')} />
        </div>
        {/* Subtle glow effect */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 blur-xl opacity-30 -z-10" />
      </div>
      {showText && (
        <span className={cn(
          'font-bold tracking-tight',
          textSizeClasses[size]
        )}>
          Mega<span className="gradient-text">RAG</span>
        </span>
      )}
    </div>
  );
}

export default Logo;
