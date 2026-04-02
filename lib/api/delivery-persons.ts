import axios, { AxiosInstance } from 'axios';

const isBrowser = typeof window !== 'undefined';
const API_URL = isBrowser ? '/api-proxy' : (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001');

const apiClient: AxiosInstance = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

export interface DeliveryPerson {
    _id: string;
    name: string;
    phone: string;
    zone?: string;
    isActive: boolean;
    isDeleted?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateDeliveryPersonDto {
    name: string;
    phone: string;
    zone?: string;
    isActive?: boolean;
}

export interface UpdateDeliveryPersonDto {
    name?: string;
    phone?: string;
    zone?: string;
    isActive?: boolean;
}

export const getDeliveryPersons = (includeInactive = false) => apiClient.get<DeliveryPerson[]>('/delivery-persons', { params: { includeInactive } });

export const getActiveDeliveryPersons = () => apiClient.get<DeliveryPerson[]>('/delivery-persons/active');

export const getDeliveryPerson = (id: string) => apiClient.get<DeliveryPerson>(`/delivery-persons/${id}`);

export const createDeliveryPerson = (data: CreateDeliveryPersonDto) => apiClient.post<DeliveryPerson>('/delivery-persons', data);

export const updateDeliveryPerson = (id: string, data: UpdateDeliveryPersonDto) => apiClient.patch<DeliveryPerson>(`/delivery-persons/${id}`, data);

export const deleteDeliveryPerson = (id: string) => apiClient.delete(`/delivery-persons/${id}`);

export interface DailyOpEntry {
    orderId: string;
    orderMongoId: string;
    opType: 'pickup' | 'delivery';
    opIndex: number;
    status: string;
    date: string;
    scheduledTime?: string;
    city: string;
    address: string;
    clothesCount: number;
    pickupAgent?: string;
    deliveryAgent?: string;
    customer: { name: string; phone: string; zone: string };
    orderType: string;
    packName?: string;
}

export interface DailyPaymentEntry {
    orderId: string;
    amount: number;
    method: string;
    paidAt: string;
    reference?: string;
    customer: string;
}

export interface AgentDailySummary {
    agentName: string;
    pickups: DailyOpEntry[];
    deliveries: DailyOpEntry[];
    payments: DailyPaymentEntry[];
    totalPickups: number;
    totalDeliveries: number;
    totalOps: number;
    completedOps: number;
    pendingOps: number;
    totalCollected: number;
    cashCollected: number;
    mobileCollected: number;
    clothesCount: number;
}

export interface DailySummaryResponse {
    date: string;
    agents: AgentDailySummary[];
    globalTotals: {
        totalOps: number;
        totalPickups: number;
        totalDeliveries: number;
        completedOps: number;
        totalCollected: number;
        cashCollected: number;
        mobileCollected: number;
        clothesCount: number;
    };
}

export const getDeliveryDailySummary = (date?: string) => apiClient.get<DailySummaryResponse>('/delivery-persons/daily-summary', { params: date ? { date } : {} });
