'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tabs = [
    { href: '/settings/account', label: 'Account' },
    { href: '/settings/appearance', label: 'Appearance' },
    { href: '/settings/ai-category', label: 'AI Category' },
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-semibold text-white mb-4">Settings</h1>
        <div className="flex gap-2 border-b border-gray-700 mb-6">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2 rounded-t-md ${active ? 'bg-gray-800 text-white border border-gray-700 border-b-transparent' : 'text-gray-300 hover:text-white hover:bg-gray-800'}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
