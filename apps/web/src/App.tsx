import { useCallback, useState } from 'react';
import { ChildPicker } from './components/ChildPicker';
import { Dashboard } from './components/Dashboard';
import type { ChildSummary } from './types';

/**
 * Uygulama her açıldığında önce çocuk seçilir ("Bugün kim oynuyor?").
 * Seçim yalnızca bellekte tutulur; Mini App kapanıp açılınca tekrar sorulur.
 */
export function App() {
  const [selected, setSelected] = useState<{ childId: number; canSwitch: boolean } | null>(null);

  const handlePick = useCallback((child: ChildSummary, childCount: number) => {
    setSelected({ childId: child.id, canSwitch: childCount > 1 });
  }, []);

  return (
    <div className="min-h-dvh bg-linear-to-b from-sky-200 via-fuchsia-100 to-amber-100 text-slate-800">
      {selected ? (
        // key: çocuk değişince panel sıfırdan kurulsun (önceki çocuğun durumu/kutlaması taşınmasın).
        <Dashboard
          key={selected.childId}
          childId={selected.childId}
          onSwitchChild={selected.canSwitch ? () => setSelected(null) : undefined}
        />
      ) : (
        <ChildPicker onPick={handlePick} />
      )}
    </div>
  );
}
