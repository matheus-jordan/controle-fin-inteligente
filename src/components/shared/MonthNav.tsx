import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthNavProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}

export function MonthNav({ label, onPrev, onNext }: MonthNavProps) {
  return (
    <div className="glass rounded-full flex items-center justify-between p-1">
      <button onClick={onPrev} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent/60 transition-colors" title="Mês anterior">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <h2 className="font-semibold text-sm">{label.charAt(0).toUpperCase() + label.slice(1)}</h2>
      <button onClick={onNext} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent/60 transition-colors" title="Próximo mês">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
