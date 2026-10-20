import { ReactNode } from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pb-28">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
