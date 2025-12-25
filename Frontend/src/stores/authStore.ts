import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, type UserResponse } from '@/lib/api/auth';
import type { ApiError } from '@/lib/api/client';

interface UserData {
  id: string;
  name: string;
  email: string;
  username: string;
  mobile: string;
  role: string;
  roles: string[];
  department: string;
  employeeId: string;
  avatar?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: UserData | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

const mapUserResponse = (apiUser: UserResponse): UserData => ({
  id: apiUser.id,
  name: apiUser.full_name,
  email: apiUser.email,
  username: apiUser.username,
  mobile: apiUser.phone || '',
  role: apiUser.roles[0] || 'Operator',
  roles: apiUser.roles,
  department: 'Production',
  employeeId: apiUser.username.toUpperCase(),
});

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      error: null,

      // Actions
      login: async (username: string, password: string, rememberMe?: boolean) => {
        set({ isLoading: true, error: null });

        try {
          // Note: rememberMe can be used to adjust token expiry on backend in future
          const response = await authApi.login({
            email_or_username: username,
            password: password,
          });

          set({
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
          });

          const userResponse = await authApi.getCurrentUser();
          const userData = mapUserResponse(userResponse);

          set({
            isAuthenticated: true,
            user: userData,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const apiError = error as ApiError;
          set({
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null,
            isLoading: false,
            error: apiError.detail || 'Login failed',
          });
          throw error;
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        
        try {
          if (refreshToken) {
            await authApi.logout(refreshToken);
          }
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null,
            isLoading: false,
            error: null,
          });
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        try {
          const response = await authApi.refreshToken(refreshToken);
          
          set({
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
          });
        } catch (error) {
          set({
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null,
          });
          throw error;
        }
      },

      fetchCurrentUser: async () => {
        try {
          const userResponse = await authApi.getCurrentUser();
          const userData = mapUserResponse(userResponse);
          
          set({ user: userData });
        } catch (error) {
          console.error('Failed to fetch user:', error);
          throw error;
        }
      },

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      setError: (error: string | null) => set({ error }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
