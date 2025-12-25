import { ReactNode } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { MobileMenu } from './MobileMenu';
import { ChatBot } from '@/components/features';
import { MobileNav } from './MobileNav';
import type { View } from '@/types';

interface AppLayoutProps {
  children: ReactNode;
  setCurrentView: (view: View | string) => void;
}

export function AppLayout({ children, setCurrentView }: AppLayoutProps) {
  const { language, isChatOpen, isMobileMenuOpen, setChatOpen } = useAppStore();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Desktop Sidebar */}
      <Sidebar
        language={language}
        user={user}
        onLogout={handleLogout}
        setCurrentView={setCurrentView}
      />

      {/* Mobile Header */}
      <MobileHeader />

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <MobileMenu
          language={language}
          user={user}
          onLogout={handleLogout}
          setCurrentView={setCurrentView}
        />
      )}

      {/* Main Content */}
      <main className="lg:pl-64 pt-16 lg:pt-0">
        <div className="p-4 lg:p-8 pb-24 lg:pb-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav currentView="" onNavigate={setCurrentView} language={language} />

      {/* ChatBot */}
      <ChatBot
        isOpen={isChatOpen}
        onToggle={() => setChatOpen(!isChatOpen)}
        language={language}
        onNavigate={setCurrentView}
      />
    </div>
  );
}
