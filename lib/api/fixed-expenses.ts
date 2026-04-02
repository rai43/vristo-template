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

export interface FixedExpense {
    _id?: string;
    name: string;
    category: string;
    monthlyBudget: number;
    currentMonthSpent: number;
    currentPeriod: string; // Format: YYYY-MM
    status: 'active' | 'inactive';
    alertThreshold: number;
    description?: string;
    vendor?: string;
    dueDate?: string;
    remainingBudget: number;
    percentageUsed: number;
    isOverBudget: boolean;
    isNearingLimit: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface FixedExpenseStatistics {
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
    percentageUsed: number;
    overBudgetCount: number;
    nearingLimitCount: number;
    overBudgetItems: Array<{
        id: string;
        name: string;
        budget: number;
        spent: number;
        overage: number;
    }>;
    nearingLimitItems: Array<{
        id: string;
        name: string;
        budget: number;
        spent: number;
        percentageUsed: number;
    }>;
    byCategory: Record<
        string,
        {
            budget: number;
            spent: number;
            count: number;
        }
    >;
}

export interface FixedExpenseAlert {
    id: string;
    name: string;
    type: 'over_budget' | 'nearing_limit';
    budget: number;
    spent: number;
    percentageUsed: number;
    message: string;
}

export const getFixedExpenses = async (filters?: { period?: string; status?: string; category?: string }) => {
    const params = new URLSearchParams();
    if (filters?.period) params.append('period', filters.period);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);

    const response = await apiClient.get<FixedExpense[]>(`/fixed-expenses?${params.toString()}`);
    return response.data;
};

export const getFixedExpense = async (id: string) => {
    const response = await apiClient.get<FixedExpense>(`/fixed-expenses/${id}`);
    return response.data;
};

export const createFixedExpense = async (data: Omit<FixedExpense, '_id' | 'remainingBudget' | 'percentageUsed' | 'isOverBudget' | 'isNearingLimit' | 'createdAt' | 'updatedAt'>) => {
    const response = await apiClient.post<FixedExpense>('/fixed-expenses', data);
    return response.data;
};

export const updateFixedExpense = async (id: string, data: Partial<FixedExpense>) => {
    const response = await apiClient.patch<FixedExpense>(`/fixed-expenses/${id}`, data);
    return response.data;
};

export const deleteFixedExpense = async (id: string) => {
    await apiClient.delete(`/fixed-expenses/${id}`);
};

export const addSpending = async (id: string, amount: number) => {
    const response = await apiClient.post<FixedExpense>(`/fixed-expenses/${id}/add-spending`, { amount });
    return response.data;
};

export const getFixedExpenseStatistics = async (period?: string) => {
    const params = new URLSearchParams();
    if (period) params.append('period', period);

    const response = await apiClient.get<FixedExpenseStatistics>(`/fixed-expenses/statistics?${params.toString()}`);
    return response.data;
};

export const getFixedExpenseAlerts = async () => {
    const response = await apiClient.get<FixedExpenseAlert[]>('/fixed-expenses/alerts');
    return response.data;
};

export const resetMonthlySpending = async (period: string) => {
    const response = await apiClient.post<{ updated: number }>(`/fixed-expenses/reset-monthly/${period}`);
    return response.data;
};
