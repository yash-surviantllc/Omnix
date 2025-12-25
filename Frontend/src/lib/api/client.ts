const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface ApiError {
  detail: string;
  status: number;
}

export class ApiClient {
  private baseURL: string;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  constructor(baseURL: string = API_URL) {
    this.baseURL = baseURL;
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.getAccessToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private getAccessToken(): string | null {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.accessToken || null;
      }
    } catch (error) {
      console.error('Error getting access token:', error);
    }
    return null;
  }

  private getRefreshToken(): string | null {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.refreshToken || null;
      }
    } catch (error) {
      console.error('Error getting refresh token:', error);
    }
    return null;
  }

  private async refreshAccessToken(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      
      // Update tokens in localStorage
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        parsed.state.accessToken = data.access_token;
        parsed.state.refreshToken = data.refresh_token;
        localStorage.setItem('auth-storage', JSON.stringify(parsed));
      }
    } catch (error) {
      // Clear auth state on refresh failure
      localStorage.removeItem('auth-storage');
      window.location.href = '/';
      throw error;
    }
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      // Handle 401 Unauthorized - attempt token refresh
      if (response.status === 401 && !endpoint.includes('/auth/')) {
        // Prevent multiple simultaneous refresh attempts
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          this.refreshPromise = this.refreshAccessToken()
            .finally(() => {
              this.isRefreshing = false;
              this.refreshPromise = null;
            });
        }

        // Wait for refresh to complete
        if (this.refreshPromise) {
          await this.refreshPromise;
        }

        // Retry the original request with new token
        const retryConfig: RequestInit = {
          ...options,
          headers: {
            ...this.getAuthHeaders(),
            ...options.headers,
          },
        };
        
        const retryResponse = await fetch(url, retryConfig);
        
        if (!retryResponse.ok) {
          const errorData = await retryResponse.json().catch(() => ({
            detail: retryResponse.statusText || 'An error occurred',
          }));

          throw {
            detail: errorData.detail || 'Request failed',
            status: retryResponse.status,
          } as ApiError;
        }

        const contentType = retryResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await retryResponse.json();
        }

        return {} as T;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          detail: response.statusText || 'An error occurred',
        }));

        throw {
          detail: errorData.detail || 'Request failed',
          status: response.status,
        } as ApiError;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return {} as T;
    } catch (error) {
      if ((error as ApiError).status) {
        throw error;
      }

      throw {
        detail: 'Network error. Please check your connection.',
        status: 0,
      } as ApiError;
    }
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
