import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Login } from './components/features';
import { AppLayout } from './components/layout/AppLayout';
import { AppRoutes } from './components/AppRoutes';
import { useAuthStore } from './stores/authStore';
import { useAppStore } from './stores/appStore';
import type { View } from '@/types';

const viewToPath: Record<View, string> = {
  'dashboard': '/',
  'orders': '/orders',
  'working-order': '/working-order',
  'bom': '/bom',
  'wip': '/wip',
  'transfer': '/transfer',
  'material-request': '/material-request',
  'qc': '/qc',
  'inventory': '/inventory',
  'gate-entry': '/gate-entry',
  'gate-exit': '/gate-exit',
  'settings': '/settings',
};

export default function App() {
  const navigate = useNavigate();

  // Use Zustand stores
  const { isAuthenticated, login } = useAuthStore();
  const { language, setCurrentView: setAppCurrentView } = useAppStore();
  const location = useLocation();

  // Sync URL with Store on Load/Change
  useEffect(() => {
    const path = location.pathname;
    // Find view key that matches current path
    const view = (Object.keys(viewToPath) as View[]).find(key => viewToPath[key] === path);
    if (view) {
      setAppCurrentView(view);
    }
  }, [location.pathname, setAppCurrentView]);

  const setCurrentView = (view: View | string) => {
    const path = viewToPath[view as View] || '/';
    navigate(path);
    setAppCurrentView(view);
  };

  const handleLogin = async (username: string, password: string, rememberMe?: boolean) => {
    await login(username, password, rememberMe);
  };

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return (
      <Login
        onLogin={handleLogin}
        language={language}
        onLanguageChange={(lang) => useAppStore.getState().setLanguage(lang)}
      />
    );
  }

  return (
    <AppLayout setCurrentView={setCurrentView}>
      <AppRoutes language={language} setCurrentView={setCurrentView} />
    </AppLayout>
  );
}