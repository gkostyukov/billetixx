'use client';

import { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('Settings');
  const locale = useLocale();
  const pathname = usePathname();

  const base = `/${locale}/settings`;
  const active = pathname?.includes('/settings/trading') ? 'trading' : 'api';

  const tabClass = (key: 'api' | 'trading') =>
    `text-sm font-medium px-3 py-2 rounded-md transition-colors ${active === key
      ? 'bg-gray-700 text-white'
      : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
    }`;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">{t('settingsTitle')}</h1>
        <p className="text-gray-400 mt-2">{t('settingsSubtitle')}</p>
      </div>

      <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg p-2">
        <Link href={`${base}/api`} className={tabClass('api')}>
          {t('tabApi')}
        </Link>
        <Link href={`${base}/trading`} className={tabClass('trading')}>
          {t('tabTrading')}
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 shadow-md">
        {children}
      </div>
    </div>
  );
}
