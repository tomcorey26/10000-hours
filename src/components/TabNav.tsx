'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard', label: 'Skills' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/rankings', label: 'Rankings' },
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <div className="flex mb-4 rounded-lg bg-muted p-1">
      {TABS.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors text-center ${
            pathname.startsWith(tab.href)
              ? 'bg-background shadow-sm'
              : 'text-muted-foreground'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
