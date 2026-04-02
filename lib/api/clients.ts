import axios, { AxiosInstance } from 'axios';

const isBrowser = typeof window !== 'undefined';
const API_URL = isBrowser ? '/api-proxy' : (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001');

const apiClient: AxiosInstance = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

export interface Customer {
    _id: string;
    customerId: string;
    name: string;
    location: string;
    zone?: string;
    phones: Array<{
        number: string;
        type: 'whatsapp' | 'call' | 'both';
    }>;
    personCount: number;
    isBusiness: boolean;
    isProspect: boolean;
    marketingSource?: string;
    dateToContact?: string;
    birthday?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CustomerHistory {
    _id: string;
    clientId: string;
    customerId: string;
    action: 'created' | 'updated' | 'deleted' | 'restored';
    changes: Record<string, any>;
    previousValues: Record<string, any>;
    performedBy: string;
    timestamp: string;
    ipAddress?: string;
    userAgent?: string;
    notes?: string;
}

export interface CustomerListParams {
    page?: number;
    limit?: number;
    q?: string;
    isProspect?: boolean;
    marketingSource?: string;
    birthdayMonth?: number;
    location?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

// CRUD operations
export const getCustomers = (params?: CustomerListParams) => apiClient.get<PaginatedResponse<Customer>>('/clients', { params });

export const getCustomer = (id: string) => apiClient.get<Customer>(`/clients/${id}`);

export const createCustomer = (data: Partial<Customer>) => apiClient.post<Customer>('/clients', data);

export const updateCustomer = (id: string, data: Partial<Customer>) => apiClient.patch<Customer>(`/clients/${id}`, data);

export const deleteCustomer = (id: string) => apiClient.delete(`/clients/${id}`);

// History
export const getCustomerHistory = (
    id: string,
    params?: {
        page?: number;
        limit?: number;
    },
) => apiClient.get<PaginatedResponse<CustomerHistory>>(`/clients/${id}/history`, { params });

export const getAllHistory = (params?: { page?: number; limit?: number; action?: string; performedBy?: string }) =>
    apiClient.get<PaginatedResponse<CustomerHistory>>('/clients/history/all', { params });

export const getRecentHistory = (limit: number = 10) => apiClient.get<CustomerHistory[]>('/clients/history/recent', { params: { limit } });

// Export
export const exportCustomers = (format: 'csv' | 'xlsx', params?: CustomerListParams) => {
    const queryParams = new URLSearchParams({
        ...(params as any),
        format,
    }).toString();
    return apiClient.get(`/clients/export?${queryParams}`, {
        responseType: 'blob',
    });
};

// Utility
export const generateCustomerId = (isBusiness: boolean = false) =>
    apiClient.get<{ customerId: string }>('/clients/generate-id', {
        params: { isBusiness },
    });

export const getCustomerStats = () => apiClient.get('/clients/stats/overview');
