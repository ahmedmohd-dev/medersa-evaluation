import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className="flex items-center justify-center py-8 gap-2">
      <Loader2 className={`animate-spin text-emerald-600 ${sizeClasses[size]}`} />
      {text && <p className="text-sm text-slate-500">{text}</p>}
    </div>
  );
}
