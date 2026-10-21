import { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Download, Loader2, LogOut, Tags } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { exportMyData } from '@/lib/exportData';
import { toast } from 'sonner';

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const count = await exportMyData();
      toast.success(`Backup baixado (${count} lançamentos)`);
    } catch {
      toast.error('Não foi possível exportar os dados');
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 glass-strong border-x-0 border-t-0">
      <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-primary neon-text">Fin</span>Control
        </h1>
        <div className="flex items-center gap-1">
          {user && (
            <Button variant="ghost" size="icon" onClick={() => navigate('/categories')} className="rounded-full" title="Categorias">
              <Tags className="h-4 w-4" />
            </Button>
          )}
          {user && (
            <Button variant="ghost" size="icon" onClick={handleExport} disabled={exporting} className="rounded-full" title="Exportar meus dados">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
          )}
          <ThemeToggle />
          {user && (
            <Button variant="ghost" size="icon" onClick={signOut} className="rounded-full" title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
