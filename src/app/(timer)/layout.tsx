import { Toaster } from 'sonner';
import { Providers } from '@/components/Providers';

export default function TimerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="h-dvh flex flex-col bg-background">
        <main className="flex-1 flex flex-col min-h-0 px-4 pb-[env(safe-area-inset-bottom)]">
          {children}
        </main>
        <Toaster position="top-center" />
      </div>
    </Providers>
  );
}
