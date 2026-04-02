import axios, { AxiosInstance } from 'axios';

// Types for API responses
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

export interface Client {
    _id: string;
    customerId: string;
    name: string;
    phones: Array<{ number: string; type: string }>;
    location: string;
    personCount: number;
    isProspect: boolean;
    notes?: string;
    marketingSource?: string;
    dateToContact?: string;
    birthday?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Subscription {
    _id: string;
    clientId: Client;
    serviceType: string | { value: string; name: string };
    baseSubscriptionPriceCFA: number;
    pickupSlots: number;
    cycleStart: string;
    cycleEnd: string;
    status: string | { value: string; name: string };
    // Subscription limits for items
    sheetsCurtainsLimit: number;
    duvetsLimit: number;
    totalItemsLimit: number;
    // Payment total (included in optimized getAllPickupsAndDeliveries response)
    totalPaid?: number;
    createdAt: string;
    updatedAt: string;
}

export interface SubscriptionPickup {
    _id: string;
    subscriptionId: string;
    index: number;
    operationId: string; // Unique operation identifier
    pickupDate?: string;
    pickupStatus: string;
    deliveryDate?: string;
    deliveryStatus: string;
    // Item counts for this pickup execution
    clothesCount?: number;
    sheetsCurtainsCount?: number;
    duvetsCount?: number;
    totalItemsCount?: number;
    itemsNote?: string;
    createdAt: string;
    updatedAt: string;
}

// When populated from the backend, subscriptionId contains the Subscription object
export type SubscriptionPickupPopulated = Omit<SubscriptionPickup, 'subscriptionId'> & {
    subscriptionId: Subscription;
};

export interface Payment {
    _id: string;
    clientId: Client;
    subscriptionId?: Subscription;
    orderId?: NonSubscriptionOrder;
    amountCFA: number;
    paidAt: string;
    method: string;
    note?: string;
    isCredit?: boolean;
    isDeleted?: boolean;
    deletedAt?: string;
    createdAt: string;
    updatedAt: string;
}

// Treasury Types
export interface TreasuryAccount {
    _id: string;
    accountNumber: string;
    name: string;
    type: 'cash' | 'bank' | 'mobile_money';
    initialBalance: number;
    currentBalance: number;
    currency: string;
    status: 'active' | 'inactive' | 'closed';
    bankName?: string;
    bankAccountNumber?: string;
    mobileMoneyProvider?: string;
    mobileMoneyNumber?: string;
    description?: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}

export interface TreasuryCategory {
    _id: string;
    code: string;
    name: string;
    type: 'income' | 'expense' | 'transfer';
    description?: string;
    parentCategory?: string;
    tags: string[];
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface TreasuryTransaction {
    _id: string;
    transactionNumber: string;
    type: 'income' | 'expense' | 'transfer';
    status: 'pending' | 'confirmed' | 'cancelled' | 'reconciled';
    amount: number;
    currency: string;
    description: string;
    accountId: TreasuryAccount;
    transferAccountId?: TreasuryAccount;
    categoryId: TreasuryCategory;
    clientId?: Client;
    supplierId?: string;
    employeeId?: string;
    thirdPartyName?: string;
    paymentMethod: 'cash' | 'bank_transfer' | 'wave' | 'orange_money' | 'mtn_mobile_money' | 'moov_money' | 'check' | 'card' | 'other';
    transactionDate: string;
    referenceNumber?: string;
    receiptNumber?: string;
    notes?: string;
    tags: string[];
    reconciledWith?: string;
    reconciledAt?: string;
    reconciledBy?: string;
    subscriptionId?: string;
    paymentId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface TreasuryStats {
    totalIncome: number;
    totalExpense: number;
    totalTransfer: number;
    totalTransactions: number;
    incomeCount: number;
    expenseCount: number;
    transferCount: number;
    totalAccounts: number;
    totalBalance: number;
    activeAccounts: number;
    netCashFlow: number;
}

export interface NonSubscriptionOrder {
    _id: string;
    clientId?: Client;
    createdAt: string;
    pack15Clothes?: {
        used: boolean;
        priceCFA: number;
        quantity?: number;
        description?: string;
    };
    lineItems: Array<{
        itemCode: string;
        label: string;
        unitPriceCFA: number;
        quantity: number;
    }>;
    totalCFA: number;
    paymentId?: Payment;
    pickupDate?: string;
    deliveryDate?: string;
    status: string;
    taxCFA: number;
    deliveryCFA: number;
    discountPercent: number;
    notes?: string;
    updatedAt: string;
    // Computed payment fields
    computedPaidCFA?: number;
    computedOutstandingCFA?: number;
}

export interface PriceCatalogItem {
    _id: string;
    itemCode: string;
    label: string;
    priceCFA: number;
    isActive: boolean;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface DashboardData {
    clientStats: {
        totalClients: number;
        totalProspects: number;
        totalCustomers: number;
        totalBusinessCustomers: number;
        totalIndividualCustomers: number;
        byMarketingSource: Array<{ _id: string; count: number }>;
    };
    subscriptionStats: {
        totalSubscriptions: number;
        activeSubscriptions: number;
        endedSubscriptions: number;
        totalRevenue: number;
        byServiceType: Array<{ _id: string; count: number }>;
    };
    paymentStats: {
        totalPayments: number;
        totalAmount: number;
        outstandingAmount: number;
        subscriptionOutstanding: number;
        orderOutstanding: number;
        byMethod: Array<{ _id: string; total: number; count: number }>;
    };
    orderStats: {
        totalOrders: number;
        totalRevenue: number;
        pack15Usage: Array<{ _id: boolean; count: number }>;
    };
    revenueByWeek: {
        subscriptionRevenue: Array<{ _id: { year: number; week: number }; total: number }>;
        orderRevenue: Array<{ _id: { year: number; week: number }; total: number }>;
    };
    channelBreakdown: Array<{ _id: string; count: number }>;
    dailyRevenue: Array<{ date: string; revenue: number; count: number }>;
    monthlyRevenue: Array<{ month: string; revenue: number; count: number }>;
    revenueByCategory: Array<{ category: string; revenue: number; count: number }>;
    topProducts: Array<{ product: string; revenue: number; count: number; avgPrice: number }>;
    recentActivities: Array<{
        type: string;
        amount?: number;
        method?: string;
        serviceType?: string;
        date: string;
        clientName: string;
        description: string;
    }>;
}

// API client class
class ApiClient {
    public client: AxiosInstance;

    constructor() {
        // In the browser, use same-origin proxy to avoid cross-site cookie issues on mobile.
        // On the server (SSR), use the direct API URL.
        const isBrowser = typeof window !== 'undefined';
        const baseURL = isBrowser
            ? '/api-proxy'
            : (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001');

        this.client = axios.create({
            baseURL,
            headers: {
                'Content-Type': 'application/json',
            },
            withCredentials: true, // Important: include cookies in requests
        });

        // Add response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                // Only redirect to login for 401 errors on non-login requests
                if (error.response?.status === 401 && typeof window !== 'undefined') {
                    const currentPath = window.location.pathname;
                    // Don't redirect if we're already on the login page or if it's a login request
                    if (currentPath !== '/management/auth' && !error.config?.url?.includes('/auth/login')) {
                        window.location.href = '/management/auth';
                    }
                }
                return Promise.reject(error);
            },
        );
    }

    // Auth endpoints
    async login(
        email: string,
        password: string,
    ): Promise<{
        ok: boolean;
        id?: string;
        email: string;
        name: string;
        role: string;
        access_token?: string;
    }> {
        const response = await this.client.post('/auth/login', { email, password });
        return response.data;
    }

    async logout(): Promise<{ ok: boolean }> {
        const response = await this.client.post('/auth/logout');
        return response.data;
    }

    async getMe(): Promise<{ ok: boolean; id?: string; email: string; name: string; role: string }> {
        const response = await this.client.get('/auth/me');
        return response.data;
    }

    // Client endpoints
    async getClients(params?: {
        page?: number;
        limit?: number;
        q?: string;
        isProspect?: boolean;
        marketingSource?: string;
        birthdayMonth?: number;
        location?: string;
    }): Promise<PaginatedResponse<Client>> {
        const response = await this.client.get('/clients', { params });
        return response.data;
    }

    async getClient(id: string): Promise<Client> {
        const response = await this.client.get(`/clients/${id}`);
        return response.data;
    }

    async createClient(data: Partial<Client>): Promise<Client> {
        const response = await this.client.post('/clients', data);
        return response.data;
    }

    async updateClient(id: string, data: Partial<Client>): Promise<Client> {
        const response = await this.client.patch(`/clients/${id}`, data);
        return response.data;
    }

    async deleteClient(id: string): Promise<void> {
        await this.client.delete(`/clients/${id}`);
    }

    async getLatestClientId(): Promise<string> {
        const response = await this.client.get('/clients/latest-id');
        return response.data.customerId;
    }

    async generateUniqueCustomerId(isBusiness: boolean = false): Promise<string> {
        const response = await this.client.get(`/clients/generate-id?isBusiness=${isBusiness}`);
        return response.data.customerId;
    }

    // Subscription endpoints
    async getSubscriptions(params?: { page?: number; limit?: number; status?: string; clientId?: string; startDate?: string; endDate?: string }): Promise<PaginatedResponse<Subscription>> {
        const response = await this.client.get('/subscriptions', { params });
        return response.data;
    }

    async getSubscription(id: string): Promise<Subscription> {
        const response = await this.client.get(`/subscriptions/${id}`);
        return response.data;
    }

    async getSubscriptionLimits(id: string): Promise<{
        sheetsCurtainsRemaining: number;
        duvetsRemaining: number;
        totalItemsRemaining: number;
    }> {
        const response = await this.client.get(`/subscriptions/${id}/limits`);
        return response.data;
    }

    async getSubscriptionStats(
        startDate?: string,
        endDate?: string,
    ): Promise<{
        total: number;
        active: number;
        totalRevenue: number;
        averageRevenue: number;
        totalPaid: number;
        totalOutstanding: number;
        fullyPaidCount: number;
        partiallyPaidCount: number;
        unpaidCount: number;
    }> {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const response = await this.client.get(`/subscriptions/stats/overview?${params.toString()}`);
        return response.data;
    }

    async createSubscription(data: {
        clientId: string;
        serviceType: string;
        baseSubscriptionPriceCFA: number;
        pickupSlots: number;
        cycleStart: string;
        cycleEnd: string;
        sheetsCurtainsLimit: number;
        duvetsLimit: number;
        totalItemsLimit: number;
        pickupDates?: string[];
        deliveryDates?: string[];
    }): Promise<Subscription> {
        const response = await this.client.post('/subscriptions', data);
        return response.data;
    }

    async updateSubscriptionStatus(id: string, status: string): Promise<Subscription> {
        const response = await this.client.patch(`/subscriptions/${id}/status`, { status });
        return response.data;
    }

    async updateSubscription(
        id: string,
        data: {
            clientId: string;
            serviceType: string;
            baseSubscriptionPriceCFA: number;
            pickupSlots: number;
            cycleStart: string;
            cycleEnd: string;
            sheetsCurtainsLimit: number;
            duvetsLimit: number;
            totalItemsLimit: number;
            pickupDates?: string[];
            deliveryDates?: string[];
        },
    ): Promise<Subscription> {
        const response = await this.client.patch(`/subscriptions/${id}`, data);
        return response.data;
    }

    async deleteSubscription(id: string): Promise<void> {
        await this.client.delete(`/subscriptions/${id}`);
    }

    // Subscription pickup endpoints
    async getSubscriptionPickups(subscriptionId: string): Promise<SubscriptionPickup[]> {
        const response = await this.client.get(`/subscription-pickups/subscription/${subscriptionId}`);
        return response.data;
    }

    async updatePickup(id: string, data: Partial<SubscriptionPickup>): Promise<SubscriptionPickup> {
        const response = await this.client.patch(`/subscription-pickups/${id}`, data);
        return response.data;
    }

    async updatePickupDates(
        subscriptionId: string,
        datesData: {
            pickupDates: string[];
            deliveryDates: string[];
        },
    ): Promise<{ message: string }> {
        const response = await this.client.patch(`/subscription-pickups/subscription/${subscriptionId}/dates`, datesData);
        return response.data;
    }

    async getUpcomingPickups(days?: number): Promise<SubscriptionPickupPopulated[]> {
        const params = new URLSearchParams();
        if (days) params.append('days', days.toString());
        const response = await this.client.get(`/subscription-pickups/upcoming?${params}`);
        return response.data;
    }

    // ==================== TREASURY ENDPOINTS ====================

    // Account endpoints
    async getTreasuryAccounts(params?: { page?: number; limit?: number; type?: string; status?: string; q?: string }): Promise<PaginatedResponse<TreasuryAccount>> {
        const response = await this.client.get('/treasury/accounts', { params });
        return response.data;
    }

    async getTreasuryAccount(id: string): Promise<TreasuryAccount> {
        const response = await this.client.get(`/treasury/accounts/${id}`);
        return response.data;
    }

    async getTreasuryAccountBalances(): Promise<TreasuryAccount[]> {
        const response = await this.client.get('/treasury/accounts/balances');
        return response.data;
    }

    async createTreasuryAccount(data: {
        accountNumber: string;
        name: string;
        type: string;
        initialBalance: number;
        currency?: string;
        status?: string;
        bankName?: string;
        bankAccountNumber?: string;
        mobileMoneyProvider?: string;
        mobileMoneyNumber?: string;
        description?: string;
        tags?: string[];
    }): Promise<TreasuryAccount> {
        const response = await this.client.post('/treasury/accounts', data);
        return response.data;
    }

    // Transaction endpoints
    async getTreasuryTransactions(params?: {
        page?: number;
        limit?: number;
        type?: string;
        status?: string;
        accountId?: string;
        categoryId?: string;
        startDate?: string;
        endDate?: string;
        q?: string;
    }): Promise<PaginatedResponse<TreasuryTransaction>> {
        const response = await this.client.get('/treasury/transactions', { params });
        return response.data;
    }

    async getTreasuryTransaction(id: string): Promise<TreasuryTransaction> {
        const response = await this.client.get(`/treasury/transactions/${id}`);
        return response.data;
    }

    async createTreasuryTransaction(data: {
        type: string;
        status?: string;
        amount: number;
        currency?: string;
        description: string;
        accountId: string;
        transferAccountId?: string;
        categoryId: string;
        clientId?: string;
        supplierId?: string;
        employeeId?: string;
        thirdPartyName?: string;
        paymentMethod: string;
        transactionDate: string;
        referenceNumber?: string;
        receiptNumber?: string;
        notes?: string;
        tags?: string[];
        subscriptionId?: string;
        paymentId?: string;
    }): Promise<TreasuryTransaction> {
        const response = await this.client.post('/treasury/transactions', data);
        return response.data;
    }

    // Category endpoints
    async getTreasuryCategories(): Promise<TreasuryCategory[]> {
        const response = await this.client.get('/treasury/categories?isActive=true');
        return response.data; // Now returns array directly
    }

    async getTreasuryCategory(id: string): Promise<TreasuryCategory> {
        const response = await this.client.get(`/treasury/categories/${id}`);
        return response.data;
    }

    // Statistics endpoints
    async getTreasuryStats(startDate?: string, endDate?: string): Promise<TreasuryStats> {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const response = await this.client.get(`/treasury/stats/overview?${params.toString()}`);
        return response.data;
    }

    // Initialization endpoint
    async initializeTreasuryData(): Promise<{ message: string }> {
        const response = await this.client.post('/treasury/init');
        return response.data;
    }

    async getAllPickupsAndDeliveries(params?: {
        status?: 'pending' | 'completed' | 'all';
        type?: 'pickups' | 'deliveries' | 'all';
        startDate?: string;
        endDate?: string;
        daysAhead?: number;
        q?: string;
    }): Promise<SubscriptionPickupPopulated[]> {
        const searchParams = new URLSearchParams();
        if (params?.status) searchParams.append('status', params.status);
        if (params?.type) searchParams.append('type', params.type);
        if (params?.startDate) searchParams.append('startDate', params.startDate);
        if (params?.endDate) searchParams.append('endDate', params.endDate);
        if (params?.daysAhead) searchParams.append('daysAhead', params.daysAhead.toString());
        if (params?.q) searchParams.append('q', params.q);

        const response = await this.client.get(`/subscription-pickups/all?${searchParams}`);
        return response.data;
    }

    async getOverdueDeliveries(): Promise<SubscriptionPickupPopulated[]> {
        const response = await this.client.get('/subscription-pickups/overdue');
        return response.data;
    }

    async getOverduePickups(): Promise<SubscriptionPickupPopulated[]> {
        const response = await this.client.get('/subscription-pickups/overdue-pickups');
        return response.data;
    }

    // Payment endpoints
    async getPayments(params?: {
        page?: number;
        limit?: number;
        clientId?: string;
        subscriptionId?: string;
        orderId?: string;
        startDate?: string;
        endDate?: string;
        method?: string;
    }): Promise<PaginatedResponse<Payment>> {
        const response = await this.client.get('/payments', { params });
        return response.data;
    }

    async createPayment(data: Partial<Payment>): Promise<Payment> {
        const response = await this.client.post('/payments', data);
        return response.data;
    }

    async getOutstanding(subscriptionId: string): Promise<{ outstandingCFA: number }> {
        const response = await this.client.get(`/payments/outstanding/${subscriptionId}`);
        return response.data;
    }

    // Non-subscription orders
    async getOrders(params?: { page?: number; limit?: number; clientId?: string; startDate?: string; endDate?: string }): Promise<PaginatedResponse<NonSubscriptionOrder>> {
        const response = await this.client.get('/non-subscription-orders', { params });
        return response.data;
    }

    async getOrder(id: string): Promise<NonSubscriptionOrder> {
        const response = await this.client.get(`/non-subscription-orders/${id}`);
        return response.data;
    }

    async createOrder(data: Partial<NonSubscriptionOrder>): Promise<NonSubscriptionOrder> {
        const response = await this.client.post('/non-subscription-orders', data);
        return response.data;
    }

    async updateOrder(id: string, data: Partial<NonSubscriptionOrder>): Promise<NonSubscriptionOrder> {
        const response = await this.client.put(`/non-subscription-orders/${id}`, data);
        return response.data;
    }

    async deleteOrder(id: string): Promise<void> {
        await this.client.delete(`/non-subscription-orders/${id}`);
    }

    async checkoutOrder(
        id: string,
        data: {
            paymentMethod: string;
            amountCFA: number;
            note?: string;
        },
    ): Promise<Payment> {
        const response = await this.client.post(`/non-subscription-orders/${id}/checkout`, data);
        return response.data;
    }

    // Price catalog endpoints
    async getPriceCatalog(): Promise<PriceCatalogItem[]> {
        const response = await this.client.get('/price-catalog');
        return response.data;
    }

    // Dashboard endpoints
    async getDashboardData(params?: { dateFrom?: string; dateTo?: string }): Promise<DashboardData> {
        const response = await this.client.get('/dashboard', { params });
        return response.data;
    }

    async getPickupStats(params?: { startDate?: string; endDate?: string }): Promise<{
        totalPickups: number;
        completedPickups: number;
        pendingPickups: number;
        totalDeliveries: number;
        completedDeliveries: number;
        pendingDeliveries: number;
        byStatus: Array<{ _id: string; count: number }>;
        byMonth: Array<{ _id: { year: number; month: number }; count: number }>;
    }> {
        const response = await this.client.get('/subscription-pickups/stats', { params });
        return response.data;
    }

    async getOrderAnalytics(params?: { startDate?: string; endDate?: string }): Promise<{
        totalOrders: number;
        totalRevenue: number;
        averageOrderValue: number;
        byMonth: Array<{ _id: { year: number; month: number }; count: number; revenue: number }>;
        byServiceType: Array<{ _id: string; count: number; revenue: number }>;
    }> {
        const response = await this.client.get('/non-subscription-orders/analytics', { params });
        return response.data;
    }

    async getMonthlyRevenue(
        year?: number,
        dateFrom?: string,
        dateTo?: string,
    ): Promise<
        Array<{
            month: number;
            subscriptionRevenue: number;
            orderRevenue: number;
            totalRevenue: number;
        }>
    > {
        const params = new URLSearchParams();
        if (year) params.append('year', year.toString());
        if (dateFrom) params.append('dateFrom', dateFrom);
        if (dateTo) params.append('dateTo', dateTo);

        const response = await this.client.get(`/dashboard/monthly-revenue?${params.toString()}`);
        return response.data;
    }

    // Import endpoints
    async importClients(file: File): Promise<{
        inserted: number;
        updated: number;
        failed: number;
        errors: Array<{ row: number; error: string }>;
    }> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await this.client.post('/admin/import/clients', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    }

    // WhatsApp endpoints
    async sendWhatsAppPaymentConfirmation(data: {
        phoneNumber: string;
        clientName: string;
        subscriptionRef: string;
        amountPaid: string;
        paymentMethod: string;
        paymentDate: string;
        remainingAmount: string;
    }): Promise<{ success: boolean; message?: string; error?: string }> {
        const response = await this.client.post('/whatsapp/payment-confirmation', data);
        return response.data;
    }

    async sendWhatsAppPickupConfirmation(data: {
        phoneNumber: string;
        clientName: string;
        pickupRef: string;
        serviceType: string;
        pickupDate: string;
        clothesCount: string;
        sheetsCurtainsCount?: string;
        duvetsCount?: string;
        totalItems: string;
        totalLimit?: string;
        remainingItems?: string;
        note?: string;
    }): Promise<{ success: boolean; message?: string; error?: string }> {
        const response = await this.client.post('/whatsapp/pickup-confirmation', data);
        return response.data;
    }
}

// Export singleton instance
export const api = new ApiClient();
