import { api } from '../api';

export interface Pack {
    _id: string;
    code: string;
    name: string;
    price: number;
    vetements: number;
    couettes: number;
    vestes: number;
    draps_serviettes: number;
    total: number;
    validityDays: number;
    defaultPickups: number;
    defaultDeliveries: number;
    isActive: boolean;
    displayOrder: number;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreatePackDto {
    code: string;
    name: string;
    price: number;
    vetements: number;
    couettes: number;
    vestes: number;
    draps_serviettes: number;
    total: number;
    validityDays?: number;
    defaultPickups?: number;
    defaultDeliveries?: number;
    isActive?: boolean;
    displayOrder?: number;
    description?: string;
}

export interface UpdatePackDto {
    code?: string;
    name?: string;
    price?: number;
    vetements?: number;
    couettes?: number;
    vestes?: number;
    draps_serviettes?: number;
    total?: number;
    validityDays?: number;
    defaultPickups?: number;
    defaultDeliveries?: number;
    isActive?: boolean;
    displayOrder?: number;
    description?: string;
}

export interface PackSearchParams {
    q?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    includeInactive?: boolean;
}

export interface PackSearchResult {
    data: Pack[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export const getPacks = (includeInactive = false) => api.client.get<Pack[]>(`/packs`, { params: { includeInactive } });

export const searchPacks = (params: PackSearchParams) => api.client.get<PackSearchResult>('/packs/search', { params });

export const getPack = (id: string) => api.client.get<Pack>(`/packs/${id}`);

export const createPack = (data: CreatePackDto) => api.client.post<Pack>('/packs', data);

export const updatePack = (id: string, data: UpdatePackDto) => api.client.put<Pack>(`/packs/${id}`, data);

export const deletePack = (id: string) => api.client.delete(`/packs/${id}`);

export const generatePackCode = (name: string, price: number) => api.client.get<{ code: string }>('/packs/generate-code', { params: { name, price } });
