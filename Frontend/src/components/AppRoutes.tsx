import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';
import type { View, Language } from '@/types';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { AccessDenied } from '@/components/ui/AccessDenied';

// Lazy load components
const Dashboard = lazy(() => import('@/components/features').then(module => ({ default: module.Dashboard })));
const PurchaseOrders = lazy(() => import('@/components/features').then(module => ({ default: module.PurchaseOrders })));
const WorkingOrder = lazy(() => import('@/components/features').then(module => ({ default: module.WorkingOrder })));
const BOMPlanner = lazy(() => import('@/components/features').then(module => ({ default: module.BOMPlanner })));
const WIPBoard = lazy(() => import('@/components/features').then(module => ({ default: module.WIPBoard })));
const MaterialTransfer = lazy(() => import('@/components/features').then(module => ({ default: module.MaterialTransfer })));
const MaterialRequest = lazy(() => import('@/components/features').then(module => ({ default: module.MaterialRequest })));
const QCCheck = lazy(() => import('@/components/features').then(module => ({ default: module.QCCheck })));
const Inventory = lazy(() => import('@/components/features').then(module => ({ default: module.Inventory })));
const GateEntry = lazy(() => import('@/components/features').then(module => ({ default: module.GateEntry })));
const GateExit = lazy(() => import('@/components/features').then(module => ({ default: module.GateExit })));
const Settings = lazy(() => import('@/components/features').then(module => ({ default: module.Settings })));

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
  </div>
);

/** Module key → human-readable label map */
const MODULE_LABELS: Record<string, string> = {
  bom: 'BOM Planner',
  orders: 'Purchase Orders',
  'working-order': 'Working Order',
  wip: 'WIP Board',
  transfer: 'Material Transfer',
  'material-request': 'Material Request',
  qc: 'QC Check',
  inventory: 'Inventory',
  'gate-entry': 'Gate Entry',
  'gate-exit': 'Gate Exit',
};

/**
 * ModuleGuard — wraps a module page.
 * Workers without the required module in workerModules see the AccessDenied screen.
 * Non-worker roles (admin, planner, etc.) pass through freely.
 */
function ModuleGuard({ moduleKey, children }: { moduleKey: string; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);

  // Only enforce for users with the worker role
  const isWorker = user?.roles?.some((r) => r.toLowerCase() === 'worker') ?? false;
  if (!isWorker) return <>{children}</>;

  const hasAccess = user?.workerModules?.includes(moduleKey) ?? false;
  if (hasAccess) return <>{children}</>;

  return <AccessDenied moduleKey={moduleKey} moduleLabel={MODULE_LABELS[moduleKey] || moduleKey} />;
}

interface AppRoutesProps {
  language: Language;
  setCurrentView: (view: View | string, state?: any) => void;
}

export function AppRoutes({ language, setCurrentView }: AppRoutesProps) {
  const { setLanguage } = useAppStore();

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<Dashboard onNavigate={setCurrentView} language={language} />} />
        <Route path="/orders" element={<ModuleGuard moduleKey="orders"><PurchaseOrders language={language} onNavigate={setCurrentView} /></ModuleGuard>} />
        <Route path="/working-order" element={<ModuleGuard moduleKey="working-order"><WorkingOrder language={language} /></ModuleGuard>} />
        <Route path="/bom" element={<ModuleGuard moduleKey="bom"><BOMPlanner language={language} /></ModuleGuard>} />
        <Route path="/wip" element={<ModuleGuard moduleKey="wip"><WIPBoard language={language} /></ModuleGuard>} />
        <Route path="/transfer" element={<ModuleGuard moduleKey="transfer"><MaterialTransfer language={language} /></ModuleGuard>} />
        <Route path="/material-request" element={<ModuleGuard moduleKey="material-request"><MaterialRequest language={language} /></ModuleGuard>} />
        <Route path="/qc" element={<ModuleGuard moduleKey="qc"><QCCheck language={language} /></ModuleGuard>} />
        <Route path="/inventory" element={<ModuleGuard moduleKey="inventory"><Inventory language={language} /></ModuleGuard>} />
        <Route path="/gate-entry" element={<ModuleGuard moduleKey="gate-entry"><GateEntry language={language} /></ModuleGuard>} />
        <Route path="/gate-exit" element={<ModuleGuard moduleKey="gate-exit"><GateExit language={language} /></ModuleGuard>} />
        <Route path="/settings" element={<Settings language={language} onLanguageChange={setLanguage} />} />
        <Route path="*" element={<Dashboard onNavigate={setCurrentView} language={language} />} />
      </Routes>
    </Suspense>
  );
}
