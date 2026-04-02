import axios, { AxiosInstance } from 'axios';

const isBrowser = typeof window !== 'undefined';
const API_URL = isBrowser ? '/api-proxy' : (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001');

const apiClient: AxiosInstance = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

export interface DashboardStats {
    clientStats: {
        totalClients: number;
        totalProspects: number;
        totalCustomers: number;
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
        byMethod: Array<{ _id: string; total: number; count: number }>;
    };
    orderStats: {
        totalOrders: number;
        totalRevenue: number;
    };
    dailyRevenue: Array<{ date: string; revenue: number; count: number }>;
    monthlyRevenue: Array<{ month: string; revenue: number; count: number }>;
    recentActivities: Array<{
        type: string;
        amount?: number;
        method?: string;
        date: string;
        clientName: string;
        description: string;
    }>;
}

export const getDashboardStats = (params?: { dateFrom?: string; dateTo?: string }) => apiClient.get<DashboardStats>('/dashboard', { params });

export const getDashboardMonthlyRevenue = (params?: { year?: number; dateFrom?: string; dateTo?: string }) =>
    apiClient.get<Array<{ month: string; revenue: number; count: number }>>('/dashboard/monthly-revenue', { params });
