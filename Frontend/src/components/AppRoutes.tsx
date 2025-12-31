import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import type { View, Language } from '@/types';
import { useAppStore } from '@/stores/appStore';

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

interface AppRoutesProps {
  language: Language;
  setCurrentView: (view: View | string) => void;
}

export function AppRoutes({ language, setCurrentView }: AppRoutesProps) {
  const { setLanguage } = useAppStore();

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<Dashboard onNavigate={setCurrentView} language={language} />} />
        <Route path="/orders" element={<PurchaseOrders language={language} />} />
        <Route path="/working-order" element={<WorkingOrder language={language} />} />
        <Route path="/bom" element={<BOMPlanner language={language} />} />
        <Route path="/wip" element={<WIPBoard language={language} />} />
        <Route path="/transfer" element={<MaterialTransfer language={language} />} />
        <Route path="/material-request" element={<MaterialRequest language={language} />} />
        <Route path="/qc" element={<QCCheck language={language} />} />
        <Route path="/inventory" element={<Inventory language={language} />} />
        <Route path="/gate-entry" element={<GateEntry language={language} />} />
        <Route path="/gate-exit" element={<GateExit language={language} />} />
        <Route path="/settings" element={<Settings language={language} onLanguageChange={setLanguage} />} />
        <Route path="*" element={<Dashboard onNavigate={setCurrentView} language={language} />} />
      </Routes>
    </Suspense>
  );
}
