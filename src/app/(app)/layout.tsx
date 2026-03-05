import { Providers } from '@/components/Providers';
import { TabNav } from '@/components/TabNav';
import { LogoutButton } from '@/components/LogoutButton';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto px-4 py-6 pb-[env(safe-area-inset-bottom)]">
          <header className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">10,000 Hours</h1>
            <LogoutButton />
          </header>
          <TabNav />
          {children}
        </div>
      </div>
    </Providers>
  );
}
