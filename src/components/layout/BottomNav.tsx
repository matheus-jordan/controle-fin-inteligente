import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, Plus, Landmark, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { TransactionForm } from '@/components/transactions/TransactionForm';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Início' },
  { path: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
  { path: '#add', icon: Plus, label: 'Adicionar', isAction: true },
  { path: '/debts', icon: Landmark, label: 'Dívidas' },
  { path: '/cards', icon: CreditCard, label: 'Cartões' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <>
      <nav className="fixed bottom-3 left-3 right-3 z-40 safe-area-bottom">
        <div className="glass-strong rounded-full flex items-center justify-around h-16 max-w-md mx-auto px-2 shadow-2xl">
          {navItems.map((item) => {
            const isActive = !item.isAction && location.pathname === item.path;
            const Icon = item.icon;

            if (item.isAction) {
              return (
                <button
                  key={item.path}
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground neon-ring hover:brightness-110 transition"
                  title="Adicionar"
                >
                  <Icon className="h-6 w-6" />
                </button>
              );
            }

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 py-1 px-3 rounded-full transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-medium">{item.label}</span>
                {isActive && (
                  <span className="absolute -bottom-1 h-1 w-5 rounded-full bg-[hsl(var(--glow))] shadow-[0_0_10px_hsl(var(--glow))]" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <TransactionForm open={showAddForm} onOpenChange={setShowAddForm} />
    </>
  );
}
