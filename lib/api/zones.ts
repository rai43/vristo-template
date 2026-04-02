import axios, { AxiosInstance } from 'axios';

const isBrowser = typeof window !== 'undefined';
const API_URL = isBrowser ? '/api-proxy' : (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001');

const apiClient: AxiosInstance = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

export interface Zone {
    _id: string;
    name: string;
    displayName: string;
    subscriptionFee: number;
    aLaCarteFee: number;
    isActive: boolean;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export const getZones = () => apiClient.get<Zone[]>('/zones');
export const getActiveZones = () => apiClient.get<Zone[]>('/zones/active');
export const getInactiveZones = () => apiClient.get<Zone[]>('/zones/inactive');
export const getZone = (id: string) => apiClient.get<Zone>(`/zones/${id}`);
export const createZone = (data: Omit<Zone, '_id' | 'createdAt' | 'updatedAt'>) => apiClient.post<Zone>('/zones', data);
export const updateZone = (id: string, data: Partial<Omit<Zone, '_id' | 'createdAt' | 'updatedAt'>>) => apiClient.put<Zone>(`/zones/${id}`, data);
export const deleteZone = (id: string) => apiClient.delete(`/zones/${id}`);
