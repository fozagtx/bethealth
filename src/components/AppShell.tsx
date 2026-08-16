/** BetaHealth — AppShell */
import { useState } from 'react';
import type { AppView } from '@/types';
import LogoMark from './LogoMark';
import { useHealthState } from './app/useHealthState';
import AddReport from './app/AddReport';
import OverviewView from './app/OverviewView';
import PlanView from './app/PlanView';
import ReportsView from './app/ReportsView';
import ProgressView from './app/ProgressView';
import DoctorView from './app/DoctorView';

interface Props {
  initialView?: AppView;
}

const VIEWS: { id: AppView; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'reports', label: 'Reports' },
  { id: 'plan', label: 'Plan' },
  { id: 'progress', label: 'Progress' },
  { id: 'doctor', label: 'Doctor summary' },
];

export default function AppShell({ initialView = 'overview' }: Props) {
  const [view, setView] = useState<AppView>(initialView);
  const [showAdd, setShowAdd] = useState(false);
  const [state, actions] = useHealthState();

  const openAdd = () => setShowAdd(true);

  return (
    <div className="h-screen flex flex-col bg-surface print:h-auto">
      <header className="border-b border-border bg-surface-card px-6 py-4 print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <LogoMark className="w-8 h-8" />
            <h1 className="text-xl font-heading font-semibold">BetaHealth</h1>
          </a>
          <div className="text-xs text-ink-faint">Saved reports stay in your browser</div>
        </div>
      </header>

      <nav className="border-b border-border bg-surface-card print:hidden">
        <div className="max-w-6xl mx-auto px-6 overflow-x-auto">
          <div className="flex gap-1">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  view === v.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto print:overflow-visible">
        <div className="max-w-6xl mx-auto px-6 py-8 print:p-0 print:max-w-none">
          {state.loading ? (
            <div className="py-24 text-center">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <>
              {view === 'overview' && (
                <OverviewView state={state} actions={actions} onAddReport={openAdd} onGoTo={setView} />
              )}
              {view === 'reports' && <ReportsView state={state} actions={actions} onAddReport={openAdd} />}
              {view === 'plan' && <PlanView state={state} actions={actions} onAddReport={openAdd} />}
              {view === 'progress' && <ProgressView state={state} />}
              {view === 'doctor' && <DoctorView state={state} actions={actions} />}
            </>
          )}
        </div>
      </main>

      {showAdd && (
        <AddReport
          initialHeight={state.height}
          initialWeight={state.weight}
          onClose={() => setShowAdd(false)}
          onSave={async (date, metrics, height, weight) => {
            await actions.addReport(date, metrics, height, weight);
            setShowAdd(false);
            setView('overview');
          }}
        />
      )}
    </div>
  );
}
