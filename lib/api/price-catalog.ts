import { api } from '../api';

export interface PriceCatalogItem {
    _id: string;
    itemCode: string;
    label: string;
    priceCFA: number;
    category: 'ordinary' | 'special' | 'custom';
    isActive: boolean;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreatePriceCatalogItemDto {
    itemCode?: string;
    label: string;
    priceCFA: number;
    category: 'ordinary' | 'special' | 'custom';
    isActive?: boolean;
    description?: string;
}

export interface UpdatePriceCatalogItemDto {
    itemCode?: string;
    label?: string;
    priceCFA?: number;
    category?: 'ordinary' | 'special' | 'custom';
    isActive?: boolean;
    description?: string;
}

export interface PriceCatalogSearchParams {
    q?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    includeInactive?: boolean;
}

export interface PriceCatalogSearchResult {
    data: PriceCatalogItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export const getPriceCatalogItems = (includeInactive = false) => api.client.get<PriceCatalogItem[]>(`/price-catalog`, { params: { includeInactive } });

export const searchPriceCatalog = (params: PriceCatalogSearchParams) => api.client.get<PriceCatalogSearchResult>('/price-catalog/search', { params });

export const getPriceCatalogItem = (id: string) => api.client.get<PriceCatalogItem>(`/price-catalog/${id}`);

export const createPriceCatalogItem = (data: CreatePriceCatalogItemDto) => api.client.post<PriceCatalogItem>('/price-catalog', data);

export const updatePriceCatalogItem = (id: string, data: UpdatePriceCatalogItemDto) => api.client.put<PriceCatalogItem>(`/price-catalog/${id}`, data);

export const deletePriceCatalogItem = (id: string) => api.client.delete(`/price-catalog/${id}`);
