import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language, View } from '@/types';

interface AppState {
  language: Language;
  isChatOpen: boolean;
  currentView: View;
  isMobileMenuOpen: boolean;
  showLanguageMenu: boolean;
}

interface AppActions {
  setLanguage: (language: Language) => void;
  setChatOpen: (open: boolean) => void;
  setCurrentView: (view: View | string) => void;
  setMobileMenuOpen: (open: boolean) => void;
  setShowLanguageMenu: (show: boolean) => void;
  toggleChat: () => void;
  toggleMobileMenu: () => void;
  toggleLanguageMenu: () => void;
}

type AppStore = AppState & AppActions;

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      language: 'en' as Language,
      isChatOpen: false,
      currentView: 'dashboard' as View,
      isMobileMenuOpen: false,
      showLanguageMenu: false,

      // Actions
      setLanguage: (language: Language) => set({ language }),

      setChatOpen: (open: boolean) => set({ isChatOpen: open }),

      setCurrentView: (view: View | string) => set({
        currentView: view as View,
        isMobileMenuOpen: false, // Close mobile menu when navigating
      }),

      setMobileMenuOpen: (open: boolean) => set({ isMobileMenuOpen: open }),

      setShowLanguageMenu: (show: boolean) => set({ showLanguageMenu: show }),

      toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

      toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),

      toggleLanguageMenu: () => set((state) => ({ showLanguageMenu: !state.showLanguageMenu })),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        language: state.language,
      }),
    }
  )
);
