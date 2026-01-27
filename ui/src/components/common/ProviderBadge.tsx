'use client';

interface ProviderBadgeProps {
  provider: string;
  size?: 'sm' | 'md';
}

const PROVIDER_CONFIG: Record<string, { label: string; icon: string; colors: string }> = {
  zeropath: {
    label: 'ZeroPath',
    icon: '🛡️',
    colors: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  },
  sentry: {
    label: 'Sentry',
    icon: '🐛',
    colors: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
  codecov: {
    label: 'Codecov',
    icon: '📊',
    colors: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  github: {
    label: 'GitHub',
    icon: '🐙',
    colors: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  },
  linear: {
    label: 'Linear',
    icon: '📋',
    colors: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  },
};

const DEFAULT_CONFIG = {
  label: 'Unknown',
  icon: '📋',
  colors: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export function ProviderBadge({ provider, size = 'sm' }: ProviderBadgeProps) {
  const config = PROVIDER_CONFIG[provider.toLowerCase()] || {
    ...DEFAULT_CONFIG,
    label: provider,
  };

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs gap-1'
    : 'px-3 py-1 text-sm gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.colors} ${sizeClasses}`}
      title={`Provider: ${config.label}`}
    >
      <span className="flex-shrink-0">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

export function getProviderColor(provider: string): string {
  const config = PROVIDER_CONFIG[provider.toLowerCase()];
  return config?.colors || DEFAULT_CONFIG.colors;
}
