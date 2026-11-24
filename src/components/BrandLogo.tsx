import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Glowing Soundwave Icon */}
      <div className={`relative ${iconSizes[size]} rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 p-[2px] shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition duration-300`}>
        <div className="w-full h-full bg-[#090d1a] rounded-[10px] flex items-center justify-center p-1.5 overflow-hidden">
          <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
            <defs>
              <linearGradient id="logoWaveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            {/* Dynamic Soundwave Bars */}
            <rect x="4" y="11" width="3" height="10" rx="1.5" fill="url(#logoWaveGrad)" />
            <rect x="10" y="6" width="3" height="20" rx="1.5" fill="url(#logoWaveGrad)" />
            <rect x="16" y="3" width="3" height="26" rx="1.5" fill="url(#logoWaveGrad)" />
            <rect x="22" y="8" width="3" height="16" rx="1.5" fill="url(#logoWaveGrad)" />
            <rect x="28" y="12" width="3" height="8" rx="1.5" fill="url(#logoWaveGrad)" />
          </svg>
        </div>
      </div>

      {/* Typography */}
      <div className="flex items-center tracking-tight">
        <span className={`font-extrabold ${textSizes[size]} text-white tracking-tight flex items-center gap-1.5`}>
          <span>Vocal</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-cyan-400">Remover</span>
        </span>
      </div>
    </div>
  );
};
