import axios from 'axios';

const isBrowser = typeof window !== 'undefined';
const API_BASE = isBrowser ? '/api-proxy' : (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001');

// Create axios instance with credentials
const apiClient = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
});

export interface Lead {
    _id: string;
    leadId: string;
    name: string;
    phones: Array<{ number: string; type: string }>;
    address: string;
    zone?: string;
    packChoice: 'douceur' | 'eclat' | 'prestige' | 'a_la_carte';
    preferredPickupDate?: string;
    additionalPickups?: number;
    birthday?: string;
    status: 'new' | 'contacted' | 'confirmed' | 'converted' | 'cancelled';
    notes?: string;
    source: string;
    contactedAt?: string;
    confirmedAt?: string;
    convertedAt?: string;
    convertedOrderId?: string;
    convertedClientId?: string;
    assignedTo?: { _id: string; name: string; email: string };
    sharedBy?: { _id: string; name: string; email: string };
    createdAt: string;
    updatedAt: string;
}

export interface LeadsResponse {
    data: Lead[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface LeadStats {
    total: number;
    byStatus: Record<string, number>;
    byPack: Record<string, number>;
    todayNew: number;
    weekConversions: number;
}

export const leadsApi = {
    getAll: async (params?: { page?: number; limit?: number; status?: string; packChoice?: string; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }): Promise<LeadsResponse> => {
        const response = await apiClient.get('/leads', { params });
        return response.data;
    },

    getOne: async (id: string): Promise<Lead> => {
        const response = await apiClient.get(`/leads/${id}`);
        return response.data.data;
    },

    create: async (data: {
        name: string;
        phones: Array<{ number: string; type?: string }>;
        address: string;
        zone?: string;
        packChoice: string;
        preferredPickupDate?: string;
        additionalPickups?: number;
        birthday?: string;
        notes?: string;
        source?: string;
    }): Promise<Lead> => {
        const response = await apiClient.post('/leads', data);
        return response.data.data;
    },

    update: async (id: string, data: Partial<Lead>): Promise<Lead> => {
        const response = await apiClient.patch(`/leads/${id}`, data);
        return response.data.data;
    },

    markContacted: async (id: string, notes?: string): Promise<Lead> => {
        const response = await apiClient.post(`/leads/${id}/contact`, { notes });
        return response.data.data;
    },

    confirmPickup: async (id: string, pickupDate: string, notes?: string): Promise<Lead> => {
        const response = await apiClient.post(`/leads/${id}/confirm-pickup`, { pickupDate, notes });
        return response.data.data;
    },

    convert: async (
        id: string,
        type?: 'subscription' | 'alc',
        notes?: string
    ): Promise<{
        lead: Lead;
        clientId: string;
    }> => {
        const response = await apiClient.post(`/leads/${id}/convert`, { type, notes });
        return response.data.data;
    },

    cancel: async (id: string, reason?: string): Promise<Lead> => {
        const response = await apiClient.post(`/leads/${id}/cancel`, { reason });
        return response.data.data;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/leads/${id}`);
    },

    getStats: async (): Promise<LeadStats> => {
        const response = await apiClient.get('/leads/stats');
        return response.data;
    },

    generateRegistrationLink: async (): Promise<{ token: string; link: string }> => {
        const response = await apiClient.post('/public/leads/registration-link', {});
        return response.data;
    },

    bulkDelete: async (ids: string[]): Promise<void> => {
        await Promise.all(ids.map((id) => apiClient.delete(`/leads/${id}`)));
    },

    getPotentialOperations: async (): Promise<Lead[]> => {
        const response = await apiClient.get('/leads/potential-operations');
        return response.data.data;
    },
};

export const PACK_LABELS: Record<
    string,
    {
        label: string;
        price: string;
        color: string;
        pickups: number;
        validity: number;
    }
> = {
    douceur: { label: 'Pack Douceur', price: '15 000 F', color: 'bg-blue-100 text-blue-800', pickups: 2, validity: 30 },
    eclat: { label: 'Pack Éclat', price: '20 000 F', color: 'bg-green-100 text-green-800', pickups: 2, validity: 30 },
    prestige: {
        label: 'Pack Prestige',
        price: '38 000 F',
        color: 'bg-purple-100 text-purple-800',
        pickups: 2,
        validity: 30,
    },
    a_la_carte: { label: 'À la carte', price: 'Variable', color: 'bg-gray-100 text-gray-800', pickups: 1, validity: 7 },
};

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    new: { label: 'Nouveau', color: 'bg-blue-500' },
    contacted: { label: 'Contacté', color: 'bg-yellow-500' },
    confirmed: { label: 'Confirmé', color: 'bg-green-500' },
    converted: { label: 'Converti', color: 'bg-primary' },
    cancelled: { label: 'Annulé', color: 'bg-red-500' },
};
