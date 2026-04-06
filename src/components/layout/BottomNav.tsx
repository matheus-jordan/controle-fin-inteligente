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
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 backdrop-blur-sm safe-area-bottom">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive = !item.isAction && location.pathname === item.path;
            const Icon = item.icon;

            if (item.isAction) {
              return (
                <button
                  key={item.path}
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center justify-center w-12 h-12 -mt-4 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
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
                  'flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <TransactionForm open={showAddForm} onOpenChange={setShowAddForm} />
    </>
  );
}
