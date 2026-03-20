import { apiClient } from './client';

export interface WorkerUser {
  id: string;
  email: string;
  username: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
}

export const usersApi = {
  /** Fetch all users (admin only) */
  listUsers: async (): Promise<WorkerUser[]> => {
    return apiClient.get<WorkerUser[]>('/users/');
  },

  /** Get granted modules for a specific worker */
  getWorkerModules: async (userId: string): Promise<string[]> => {
    return apiClient.get<string[]>(`/users/${userId}/worker-modules`);
  },

  /** Replace full module list for a worker */
  replaceWorkerModules: async (userId: string, modules: string[]): Promise<string[]> => {
    return apiClient.put<string[]>(`/users/${userId}/worker-modules`, { modules });
  },

  /** Grant a single module to a worker */
  grantWorkerModule: async (userId: string, moduleKey: string): Promise<{ detail: string }> => {
    return apiClient.post<{ detail: string }>(`/users/${userId}/worker-modules/${moduleKey}`);
  },

  /** Revoke a single module from a worker */
  revokeWorkerModule: async (userId: string, moduleKey: string): Promise<{ detail: string }> => {
    return apiClient.delete<{ detail: string }>(`/users/${userId}/worker-modules/${moduleKey}`);
  },
};
