import { apiClient } from './client';

export interface FinishedGoodCreate {
  product_id: string;
  work_order_id?: string;
  production_order_id?: string;
  quantity: number;
  unit?: string;
  location_id?: string;
  status?: string;
  quality_status?: string;
  batch_number?: string;
  manufactured_date?: string;
  expiry_date?: string;
  notes?: string;
}

export interface FinishedGood {
  id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  work_order_id?: string;
  work_order_number?: string;
  production_order_id?: string;
  production_order_number?: string;
  quantity: number;
  unit: string;
  location_id?: string;
  location_name?: string;
  status: string;
  quality_status: string;
  batch_number?: string;
  manufactured_date?: string;
  expiry_date?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DispatchCreate {
  production_order_id: string;
  product_id: string;
  quantity: number;
  unit?: string;
  dispatch_date?: string;
  customer_name?: string;
  delivery_address?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_contact?: string;
  status?: string;
  notes?: string;
  finished_good_ids: string[];
}

export interface Dispatch {
  id: string;
  dispatch_number: string;
  production_order_id: string;
  production_order_number: string;
  product_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit: string;
  dispatch_date: string;
  customer_name?: string;
  delivery_address?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_contact?: string;
  status: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface POProgress {
  production_order_id: string;
  production_order_number: string;
  product_id: string;
  product_code: string;
  product_name: string;
  ordered_quantity: number;
  quantity_completed: number;
  quantity_pending: number;
  quantity_in_fg: number;
  quantity_dispatched: number;
  quantity_reworked: number;
  quantity_scrapped: number;
  completion_percentage: number;
  dispatch_percentage: number;
  work_orders: Array<{
    id: string;
    work_order_number: string;
    quantity: number;
    quantity_completed: number;
    status: string;
  }>;
}

export const finishedGoodsApi = {
  async create(data: FinishedGoodCreate): Promise<FinishedGood> {
    return apiClient.post<FinishedGood>('/finished-goods/', data);
  },

  async list(params?: {
    page?: number;
    limit?: number;
    product_id?: string;
    status?: string;
    production_order_id?: string;
  }): Promise<FinishedGood[]> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.product_id) queryParams.append('product_id', params.product_id);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.production_order_id) queryParams.append('production_order_id', params.production_order_id);
    
    const query = queryParams.toString();
    return apiClient.get<FinishedGood[]>(`/finished-goods/${query ? '?' + query : ''}`);
  },

  async getById(id: string): Promise<FinishedGood> {
    return apiClient.get<FinishedGood>(`/finished-goods/${id}`);
  },

  async createDispatch(data: DispatchCreate): Promise<Dispatch> {
    return apiClient.post<Dispatch>('/finished-goods/dispatch', data);
  },

  async getDispatch(id: string): Promise<Dispatch> {
    return apiClient.get<Dispatch>(`/finished-goods/dispatch/${id}`);
  },

  async getPOProgress(poId: string): Promise<POProgress> {
    return apiClient.get<POProgress>(`/finished-goods/progress/${poId}`);
  },
};
