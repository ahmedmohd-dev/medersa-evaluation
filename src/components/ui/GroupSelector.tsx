import React from 'react';

interface GroupSelectorProps {
  value: string;
  onChange: (value: string) => void;
  showAll?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function GroupSelector({ value, onChange, showAll = false, size = 'md' }: GroupSelectorProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-8 py-4 text-lg font-semibold',
  };

  return (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <button
        type="button"
        onClick={() => onChange('boys')}
        className={`${sizeClasses[size]} flex-1 sm:flex-initial justify-center flex items-center gap-1.5 rounded-xl font-semibold transition-all active:scale-[0.98] ${
          value === 'boys'
            ? 'bg-blue-600 text-white shadow-md shadow-blue-200 ring-2 ring-blue-500/30'
            : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
        }`}
      >
        <span>👦</span> <span>Boys</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('girls')}
        className={`${sizeClasses[size]} flex-1 sm:flex-initial justify-center flex items-center gap-1.5 rounded-xl font-semibold transition-all active:scale-[0.98] ${
          value === 'girls'
            ? 'bg-pink-600 text-white shadow-md shadow-pink-200 ring-2 ring-pink-500/30'
            : 'bg-white text-slate-700 border border-slate-200 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-200'
        }`}
      >
        <span>👧</span> <span>Girls</span>
      </button>
      {showAll && (
        <button
          type="button"
          onClick={() => onChange('all')}
          className={`${sizeClasses[size]} flex-1 sm:flex-initial justify-center flex items-center gap-1.5 rounded-xl font-semibold transition-all active:scale-[0.98] ${
            value === 'all'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'
          }`}
        >
          <span>📊</span> <span>All</span>
        </button>
      )}
    </div>
  );
}
