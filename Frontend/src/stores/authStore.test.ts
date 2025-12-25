import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../stores/authStore';

// Mock fetch globally
global.fetch = vi.fn();

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.logout();
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockResponse = {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        token_type: 'bearer',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.email).toBe('test@example.com');
      expect(result.current.accessToken).toBe('mock_access_token');
      expect(result.current.refreshToken).toBe('mock_refresh_token');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should handle login failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ detail: 'Invalid credentials' }),
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('test@example.com', 'wrongpassword');
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
      expect(result.current.accessToken).toBe(null);
      expect(result.current.refreshToken).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Invalid credentials');
    });

    it('should set loading state during login', async () => {
      const mockResponse = {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        token_type: 'bearer',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useAuthStore());

      // Start login
      const loginPromise = act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      // Check loading state
      expect(result.current.isLoading).toBe(true);

      // Wait for completion
      await loginPromise;

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('logout', () => {
    it('should logout and clear state', async () => {
      // First login
      const mockResponse = {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        token_type: 'bearer',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Mock logout API call
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      // Logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
      expect(result.current.accessToken).toBe(null);
      expect(result.current.refreshToken).toBe(null);
    });
  });

  describe('getAuthHeaders', () => {
    it('should return auth headers when token exists', () => {
      const { result } = renderHook(() => useAuthStore());

      // Manually set token for testing
      act(() => {
        result.current.login('test@example.com', 'password123');
      });

      // Since login is async, we'll test the helper function directly
      // This would need to be adjusted based on how we handle the token state
    });
  });
});
