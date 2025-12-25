import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_URL = `${API_BASE_URL}/api/v1/gate-entries`;

// Get auth token from Zustand persisted storage
const getAuthToken = () => {
  try {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      return parsed.state?.accessToken || null;
    }
  } catch (error) {
    console.error('Error reading auth token:', error);
  }
  return null;
};

// Configure axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response types
export interface GateEntryMaterial {
  id?: string;
  gate_entry_id?: string;
  material_code?: string;
  material_name: string;
  quantity: number;
  uom: string;
  created_at?: string;
  updated_at?: string;
}

export interface GateEntryResponse {
  id: string;
  entry_number: string;
  entry_type: string;
  vendor: string;
  vehicle_no?: string;
  driver_name?: string;
  linked_document?: string;
  destination_department: string;
  status: string;
  remarks?: string;
  materials: GateEntryMaterial[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface GateEntryListItem {
  id: string;
  entry_number: string;
  entry_type: string;
  vendor: string;
  vehicle_no?: string;
  driver_name?: string;
  destination_department: string;
  status: string;
  linked_document?: string;
  material_count: number;
  first_material_name?: string;
  total_items?: number;
  created_at: string;
}

export interface GateEntryStats {
  total_entries: number;
  arrived: number;
  under_verification: number;
  accepted: number;
  rejected: number;
  today_entries: number;
  by_type: Record<string, number>;
  by_department: Record<string, number>;
}

export interface CreateGateEntryData {
  entry_type: string;
  vendor: string;
  vehicle_no?: string;
  driver_name?: string;
  linked_document?: string;
  destination_department: string;
  remarks?: string;
  materials: {
    material_code?: string;
    material_name: string;
    quantity: number;
    uom: string;
  }[];
}

export interface UpdateGateEntryData {
  entry_type?: string;
  vendor?: string;
  vehicle_no?: string;
  driver_name?: string;
  linked_document?: string;
  destination_department?: string;
  status?: string;
  remarks?: string;
  materials?: {
    material_code?: string;
    material_name: string;
    quantity: number;
    uom: string;
  }[];
}

// API Functions
export const gateEntryApi = {
  // List all gate entries
  async list(params?: {
    page?: number;
    limit?: number;
    status?: string;
    entry_type?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<GateEntryListItem[]> {
    const response = await api.get('/', { params });
    return response.data;
  },

  // Get gate entry statistics
  async getStats(): Promise<GateEntryStats> {
    const response = await api.get('/stats');
    return response.data;
  },

  // Get single gate entry
  async get(id: string): Promise<GateEntryResponse> {
    const response = await api.get(`/${id}`);
    return response.data;
  },

  // Create new gate entry
  async create(data: CreateGateEntryData): Promise<GateEntryResponse> {
    const response = await api.post('/', data);
    return response.data;
  },

  // Update gate entry
  async update(id: string, data: UpdateGateEntryData): Promise<GateEntryResponse> {
    const response = await api.put(`/${id}`, data);
    return response.data;
  },

  // Update gate entry status
  async updateStatus(id: string, data: {
    status: string;
    remarks?: string;
  }): Promise<GateEntryResponse> {
    const response = await api.put(`/${id}/status`, data);
    return response.data;
  },

  // Delete gate entry
  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/${id}`);
    return response.data;
  },
};
