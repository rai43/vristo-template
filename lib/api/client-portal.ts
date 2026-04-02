import axios, { AxiosInstance } from 'axios';

const isBrowser = typeof window !== 'undefined';
const API_URL = isBrowser ? '/api-proxy' : process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

const apiClient: AxiosInstance = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

export interface ClientProfile {
    id: string;
    customerId: string;
    name: string;
    phones: { number: string; type: string }[];
    location: string;
    personCount: number;
    birthday?: string;
    createdAt?: string;
}

export interface ClothesDetail {
    category: string;
    name: string;
    quantity: number;
    color?: string;
}

export interface OperationInfo {
    date: string;
    scheduledTime?: string;
    address: string;
    city: string;
    fee?: number;
    enabled?: boolean;
    status?: string;
    confirmedAt?: string;
    clothesCount?: number;
    clothesDetails?: ClothesDetail[];
    note?: string;
    deliveryAgent?: string;
    deliveryAgentName?: string;
    paymentRequired?: boolean;
    clientRating?: number;
    clientComment?: string;
}

export interface PaymentEntry {
    amount: number;
    paidAt: string;
    method: string;
    reference?: string;
    note?: string;
}

export interface SurplusItem {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface ClientOrder {
    _id: string;
    orderId: string;
    type: 'subscription' | 'a-la-carte';
    status: string;
    packName?: string;
    totalPrice: number;
    totalPaid: number;
    paymentStatus: string;
    serviceType?: string;
    note?: string;
    pickup?: OperationInfo;
    delivery?: OperationInfo;
    pickupSchedule?: OperationInfo[];
    deliverySchedule?: OperationInfo[];
    subscriptionStatus?: string;
    subscriptionStartDate?: string;
    subscriptionEndDate?: string;
    payments?: PaymentEntry[];
    surplus?: SurplusItem[];
    surplusAmount?: number;
    basePickupCount?: number;
    items?: { name: string; unitPrice: number; quantity: number; category: string }[];
    createdAt: string;
    updatedAt: string;
    clientComments?: Array<{ text: string; operationIndex?: number; operationType?: string; createdAt?: string }>;
}

export interface PackInfo {
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
    description?: string;
}

export interface OrderPhoto {
    url: string;
    filename: string;
    type: 'articles' | 'bags' | 'defects' | 'other';
    caption?: string;
    uploadedAt: string;
    operationIndex: number;
    registrationId: string;
    totalArticles: number;
}

export interface ClientNotification {
    title: string;
    body: string;
    icon?: string;
    url?: string;
    type: 'status' | 'payment' | 'delivery' | 'pickup' | 'system' | 'rating';
    orderId?: string;
    read: boolean;
    createdAt: string;
}

export const clientPortalApi = {
    login: async (phone: string, name: string): Promise<{ ok: boolean; client: ClientProfile }> => {
        const res = await apiClient.post('/client-portal/login', { phone, name });
        return res.data;
    },

    logout: async (): Promise<void> => {
        await apiClient.post('/client-portal/logout');
    },

    getMe: async (): Promise<ClientProfile> => {
        const res = await apiClient.get('/client-portal/me');
        return res.data.data;
    },

    updateMe: async (data: Partial<Pick<ClientProfile, 'name' | 'phones' | 'location' | 'personCount' | 'birthday'>>): Promise<ClientProfile> => {
        const res = await apiClient.patch('/client-portal/me', data);
        return res.data.data;
    },

    getOrders: async (): Promise<ClientOrder[]> => {
        const res = await apiClient.get('/client-portal/orders');
        return res.data.data;
    },

    getOrder: async (id: string): Promise<ClientOrder> => {
        const res = await apiClient.get(`/client-portal/orders/${id}`);
        return res.data.data;
    },

    getOrderPhotos: async (orderId: string): Promise<OrderPhoto[]> => {
        const res = await apiClient.get(`/client-portal/orders/${orderId}/photos`);
        return res.data.data;
    },

    getPacks: async (): Promise<PackInfo[]> => {
        const res = await apiClient.get('/client-portal/packs');
        return res.data.data;
    },

    rateOperation: async (orderId: string, opType: 'pickup' | 'delivery', opIndex: number, rating: number, comment?: string) => {
        const res = await apiClient.post(`/client-portal/orders/${orderId}/rate`, { opType, opIndex, rating, comment });
        return res.data;
    },

    addComment: async (orderId: string, text: string, opIndex?: number, opType?: string) => {
        const res = await apiClient.post(`/client-portal/orders/${orderId}/comment`, { text, opIndex, opType });
        return res.data;
    },

    getComments: async (orderId: string) => {
        const res = await apiClient.get(`/client-portal/orders/${orderId}/comments`);
        return res.data.data;
    },

    requestPickup: async (orderId: string, opIndex: number, preferredTime?: string) => {
        const res = await apiClient.post(`/client-portal/orders/${orderId}/request-pickup`, { opIndex, preferredTime });
        return res.data;
    },

    requestDelivery: async (orderId: string, opIndex: number, preferredTime?: string) => {
        const res = await apiClient.post(`/client-portal/orders/${orderId}/request-delivery`, { opIndex, preferredTime });
        return res.data;
    },

    // Push notifications
    getVapidPublicKey: async (): Promise<string | null> => {
        const res = await apiClient.get('/client-portal/vapid-public-key');
        return res.data.key;
    },

    pushSubscribe: async (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) => {
        await apiClient.post('/client-portal/push-subscribe', subscription);
    },

    // In-app notifications
    getNotifications: async (limit = 50): Promise<ClientNotification[]> => {
        const res = await apiClient.get(`/client-portal/notifications?limit=${limit}`);
        return res.data.data;
    },

    markNotificationsRead: async (all?: boolean, indices?: number[]) => {
        await apiClient.post('/client-portal/notifications/read', { all, indices });
    },
};
