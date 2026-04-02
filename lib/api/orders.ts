import axios, { AxiosInstance } from 'axios';

// In the browser, use same-origin proxy to avoid cross-site cookie issues on mobile.
// On the server (SSR), use the direct API URL.
const isBrowser = typeof window !== 'undefined';
const API_URL = isBrowser
    ? '/api-proxy'
    : (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001');

const apiClient: AxiosInstance = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

export type OrderType = 'subscription' | 'a-la-carte';

export type OrderStatus = 'pending' | 'registered' | 'processing' | 'ready_for_delivery' | 'out_for_delivery' | 'not_delivered' | 'delivered' | 'returned' | 'cancelled';

export interface OrderItem {
    name: string;
    quantity: number;
    category: 'ordinary' | 'special' | 'add-on' | 'package' | 'custom';
    unitPrice: number;
    color?: 'white' | 'colored';
    serviceType?: 'Wash & Iron' | 'Iron' | 'Other';
}

export interface ClothesDetail {
    category: string;
    name: string;
    quantity: number;
    color?: string;
}

export interface OperationHistoryEntry {
    modifiedAt: string;
    modifiedBy?: string;
    previousStatus?: string;
    newStatus?: string;
    note?: string;
}

export type OperationStatus = 'pending' | 'confirmed' | 'registered' | 'processing' | 'ready_for_delivery' | 'out_for_delivery' | 'not_delivered' | 'delivered' | 'returned' | 'cancelled';

export interface PickupInfo {
    date: string;
    address: string;
    city: string;
    fee?: number;
    enabled?: boolean;
    // Operation-specific fields for subscription operations
    status?: OperationStatus;
    confirmedAt?: string;
    scheduledTime?: string;
    preferredTime?: string; // Client-requested preferred time period
    clothesCount?: number;
    clothesDetails?: ClothesDetail[];
    note?: string;
    history?: OperationHistoryEntry[];
    paymentRequired?: boolean;
    pickupAgent?: string; // Agent handling pickup for this operation
    deliveryAgent?: string; // Agent handling delivery for this operation
    clientRating?: number;
    clientComment?: string;
    adminResponse?: string;
}

export interface DeliveryInfo {
    date: string;
    address: string;
    city: string;
    fee?: number;
    enabled?: boolean;
    // Operation-specific fields for subscription operations
    status?: OperationStatus;
    confirmedAt?: string;
    scheduledTime?: string;
    preferredTime?: string; // Client-requested preferred time period
    clothesCount?: number;
    clothesDetails?: ClothesDetail[];
    note?: string;
    history?: OperationHistoryEntry[];
    paymentRequired?: boolean;
    pickupAgent?: string; // Agent handling pickup for this operation
    deliveryAgent?: string; // Agent handling delivery for this operation
    clientRating?: number;
    clientComment?: string;
    adminResponse?: string;
}

export interface PaymentEntry {
    amount: number;
    paidAt: string;
    method: string; // OrangeMoney, MTNMoney, MoovMoney, Wave, Cash, Other
    reference?: string;
    note?: string;
    recordedBy?: string;
}

export interface HistoryEntry {
    modifiedAt: string;
    modifiedBy: string;
    previousStatus?: string;
    newStatus?: string;
    changes?: Record<string, any>;
    note?: string;
}

export interface SurplusItem {
    name: string;
    unitPrice: number;
    quantity: number;
    category: 'extra_count' | 'extra_draps' | 'extra_serviettes' | 'custom';
}

export interface Order {
    _id: string;
    orderId: string;
    customerId: {
        _id: string;
        name: string;
        customerId: string;
        location: string;
        phones?: Array<{ number: string }>;
    };
    type: OrderType;
    status: OrderStatus;
    totalPrice: number;
    items: OrderItem[];
    pickup: PickupInfo;
    delivery: DeliveryInfo;
    packName?: string;
    basePickupCount?: number;
    subscriptionId?: string;
    pickupNumber?: number;
    subscriptionStartDate?: string;
    subscriptionEndDate?: string;
    paymentMethod?: string;
    serviceType?: string;
    currency?: string;
    note?: string;
    pickupSchedule?: PickupInfo[];
    deliverySchedule?: DeliveryInfo[];
    subscriptionStatus?: 'active' | 'completed' | 'stopped';
    surplus?: SurplusItem[];
    surplusAmount?: number;
    payments: PaymentEntry[];
    totalPaid: number;
    paymentStatus: 'unpaid' | 'partial' | 'paid' | 'overpaid';
    history: HistoryEntry[];
    createdAt: string;
    updatedAt: string;
}

export interface OrderListParams {
    page?: number;
    limit?: number;
    type?: OrderType;
    status?: OrderStatus;
    customerId?: string;
    packName?: string;
    city?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
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

export interface Pack {
    code: string;
    price: number;
    limit: number;
    pickups: number;
    delayDays: number;
    specialItems: {
        couettes: number;
        vestes: number;
        draps_serviettes: number;
    };
    description: string;
    addOns: Array<{
        pickups: number;
        extraPrice: number;
        extraItems: number;
    }>;
}

// CRUD operations
export const getOrders = (params?: OrderListParams) => apiClient.get<PaginatedResponse<Order>>('/orders', { params });

export const getOrder = (id: string) => apiClient.get<Order>(`/orders/${id}`);

export const getOrderByOrderId = (orderId: string) => apiClient.get<Order>(`/orders/by-order-id/${orderId}`);

export const createOrder = (data: any) => apiClient.post<Order>('/orders', data);

export const updateOrder = (
    id: string,
    data: {
        status?: OrderStatus;
        note?: string;
        items?: OrderItem[];
        totalPrice?: number;
        pickup?: PickupInfo;
        delivery?: DeliveryInfo;
        packName?: string;
        subscriptionStartDate?: string;
        subscriptionEndDate?: string;
        pickupSchedule?: PickupInfo[];
        deliverySchedule?: DeliveryInfo[];
        paymentMethod?: string;
        serviceType?: string;
        currency?: string;
    }
) => apiClient.patch<Order>(`/orders/${id}`, data);

export const deleteOrder = (id: string) => apiClient.delete(`/orders/${id}`);

export const bulkDeleteOrders = (ids: string[]) => apiClient.post('/orders/bulk-delete', { ids });

// Operations
export const getAllOperations = (params?: { startDate?: string; endDate?: string }) => apiClient.get('/orders/operations', { params });

export const getDailySummary = (date?: string) => apiClient.get('/orders/operations/daily-summary', { params: { date } });

export const getOperationsByDeliveryPerson = (params?: { date?: string; startDate?: string; endDate?: string }) => apiClient.get('/orders/operations/by-delivery-person', { params });

// History
export const getOrderHistory = (id: string) => apiClient.get<HistoryEntry[]>(`/orders/${id}/history`);

// Customer orders
export const getCustomerOrders = (customerId: string, page?: number, limit?: number) =>
    apiClient.get<PaginatedResponse<Order>>(`/orders/customer/${customerId}`, {
        params: { page, limit },
    });

// Stats
export const getOrderStats = (startDate?: string, endDate?: string) =>
    apiClient.get('/orders/stats/overview', {
        params: { startDate, endDate },
    });

// Packs & Pricing
export const getPacks = () => apiClient.get<Pack[]>('/orders/packs/list');

export const getPackInfo = (packName: string) => apiClient.get<Pack>(`/orders/packs/${packName}`);

export const getALaCartePricing = () => apiClient.get('/orders/pricing/a-la-carte');

export const calculatePrice = (orderData: any) => apiClient.post('/orders/pricing/calculate', orderData);

// Payment Management
export const addPayment = (
    orderId: string,
    payment: {
        amount: number;
        method: string;
        reference?: string;
        note?: string;
    }
) => apiClient.post<Order>(`/orders/${orderId}/payments`, payment);

export const getPayments = (orderId: string) => apiClient.get<PaymentEntry[]>(`/orders/${orderId}/payments`);

export const deletePayment = (orderId: string, paymentIndex: number, reason?: string) => apiClient.delete<Order>(`/orders/${orderId}/payments/${paymentIndex}`, { data: { reason } });

// Status Management
export const updateOrderStatus = (orderId: string, status: OrderStatus, note?: string) =>
    apiClient.patch<Order>(`/orders/${orderId}/status`, {
        status,
        note,
    });

// Operation Management (for subscription orders)
export const updateOperation = (
    orderId: string,
    operationType: 'pickup' | 'delivery',
    operationIndex: number,
    data: {
        date?: string;
        scheduledTime?: string;
        status?: string;
        confirmedAt?: string;
        clothesCount?: number;
        clothesDetails?: ClothesDetail[];
        note?: string;
        pickupAgent?: string;
        deliveryAgent?: string;
    }
) => apiClient.patch<Order>(`/orders/${orderId}/operations/${operationType}/${operationIndex}`, data);

export const confirmOperation = (orderId: string, operationType: 'pickup' | 'delivery', operationIndex: number, clothesCount?: number, clothesDetails?: ClothesDetail[], note?: string) =>
    apiClient.post<Order>(`/orders/${orderId}/operations/${operationType}/${operationIndex}/confirm`, {
        clothesCount,
        clothesDetails,
        note,
    });

// Subscription Status Management
export const updateSubscriptionStatus = (orderId: string, status: 'active' | 'completed' | 'stopped', note?: string) =>
    apiClient.patch<Order>(`/orders/${orderId}/subscription-status`, { status, note });

// Recalculate Total Price
export const recalculateTotalPrice = (orderId: string) =>
    apiClient.post<{
        success: boolean;
        oldTotalPrice: number;
        newTotalPrice: number;
        difference: number;
        order: Order;
    }>(`/orders/${orderId}/recalculate-price`);

// Admin response to client feedback on an operation
export const respondToOperation = (orderId: string, operationType: 'pickup' | 'delivery', operationIndex: number, response: string) =>
    apiClient.patch<Order>(`/orders/${orderId}/operations/${operationType}/${operationIndex}/admin-response`, { response });

// Admin response to a client comment
export const respondToComment = (orderId: string, commentIndex: number, response: string) =>
    apiClient.patch<Order>(`/orders/${orderId}/comments/${commentIndex}/admin-response`, { response });

// Surplus Management
export const updateSurplus = (orderId: string, items: SurplusItem[]) => apiClient.patch<Order>(`/orders/${orderId}/surplus`, { items });

// Export
export const exportOrders = (format: 'csv' | 'xlsx', params?: OrderListParams) => {
    const queryParams = new URLSearchParams({
        ...(params as any),
        format,
    }).toString();
    return apiClient.get(`/orders/export?${queryParams}`, {
        responseType: 'blob',
    });
};

// Status configuration
export const getStatusConfig = (status: OrderStatus): { color: string; icon: string; label: string } => {
    const statusConfig: Record<OrderStatus, { color: string; icon: string; label: string }> = {
        pending: { color: 'secondary', icon: '●', label: 'En attente' },
        registered: { color: 'info', icon: '●', label: 'Enregistrement' },
        processing: { color: 'primary', icon: '●', label: 'En traitement' },
        ready_for_delivery: { color: 'warning', icon: '●', label: 'Prêt pour livraison' },
        out_for_delivery: { color: 'warning', icon: '●', label: 'En cours de livraison' },
        not_delivered: { color: 'danger', icon: '●', label: 'Pas livré' },
        delivered: { color: 'success', icon: '●', label: 'Livré' },
        returned: { color: 'danger', icon: '●', label: 'Retourné' },
        cancelled: { color: 'secondary', icon: '●', label: 'Annulé' },
    };
    return statusConfig[status] || { color: 'secondary', icon: '●', label: status };
};

// Pack type configuration
export const getPackTypeConfig = (type: OrderType, packName?: string): { color: string; label: string } => {
    if (type === 'subscription') {
        if (packName === 'ÉCLAT' || packName === 'ECLAT') {
            return { color: 'info', label: 'Éclat' };
        }
        if (packName === 'PRESTIGE') {
            return { color: 'primary', label: 'Prestige' };
        }
        return { color: 'primary', label: 'Subscription' };
    }
    return { color: 'success', label: 'Libre Service' };
};

// Get pickup orders for a subscription
export const getSubscriptionPickups = async (subscriptionId: string) => {
    return apiClient.get<Order[]>(`/orders/subscription/${subscriptionId}/pickups`);
};

// Reschedule operation (change date/time via drag & drop)
export const rescheduleOperation = (orderId: string, operationType: 'pickup' | 'delivery', operationIndex: number, newDate: string, scheduledTime?: string) =>
    apiClient.patch(`/orders/${orderId}/operations/${operationType}/${operationIndex}/reschedule`, {
        date: newDate,
        scheduledTime,
    });
