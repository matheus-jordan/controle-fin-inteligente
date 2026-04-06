import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 h-14">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-primary">Fin</span>Control
        </h1>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {user && (
            <Button variant="ghost" size="icon" onClick={signOut} className="rounded-full">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
