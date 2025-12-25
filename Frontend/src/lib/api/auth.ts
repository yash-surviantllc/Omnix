import { apiClient } from './client';

export interface LoginCredentials {
  email_or_username: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  full_name: string;
  phone?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  email: string;
  username: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  roles: string[];
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  new_password: string;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<TokenResponse> => {
    return apiClient.post<TokenResponse>('/auth/login', credentials);
  },

  register: async (data: RegisterData): Promise<UserResponse> => {
    return apiClient.post<UserResponse>('/auth/register', data);
  },

  logout: async (refreshToken: string): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>('/auth/logout', {
      refresh_token: refreshToken,
    });
  },

  refreshToken: async (refreshToken: string): Promise<TokenResponse> => {
    return apiClient.post<TokenResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    });
  },

  getCurrentUser: async (): Promise<UserResponse> => {
    return apiClient.get<UserResponse>('/auth/me');
  },

  updateProfile: async (data: {
    full_name?: string;
    phone?: string;
  }): Promise<UserResponse> => {
    return apiClient.put<UserResponse>('/auth/me', data);
  },

  changePassword: async (data: ChangePasswordData): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>('/auth/change-password', data);
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>('/auth/forgot-password', { email });
  },

  resetPassword: async (data: ResetPasswordData): Promise<{ message: string }> => {
    return apiClient.post<{ message: string }>('/auth/reset-password', data);
  },
};
