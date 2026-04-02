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

export interface Expense {
    _id?: string;
    date: string;
    category: string;
    description: string;
    amount: number;
    vendor: string;
    paymentMethod: 'Espèces' | 'Virement' | 'Chèque' | 'Mobile Money';
    status: 'paid' | 'pending' | 'approved';
    receipt?: string;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface ExpenseStatistics {
    total: number;
    paid: number;
    pending: number;
    count: number;
    byCategory: Record<string, number>;
}

export const getExpenses = async (filters?: { startDate?: string; endDate?: string; category?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.status) params.append('status', filters.status);

    const response = await apiClient.get<Expense[]>(`/expenses?${params.toString()}`);
    return response.data;
};

export const getExpense = async (id: string) => {
    const response = await apiClient.get<Expense>(`/expenses/${id}`);
    return response.data;
};

export const createExpense = async (data: Omit<Expense, '_id' | 'createdAt' | 'updatedAt'>) => {
    const response = await apiClient.post<Expense>('/expenses', data);
    return response.data;
};

export const updateExpense = async (id: string, data: Partial<Expense>) => {
    const response = await apiClient.patch<Expense>(`/expenses/${id}`, data);
    return response.data;
};

export const deleteExpense = async (id: string) => {
    await apiClient.delete(`/expenses/${id}`);
};

export const getExpenseStatistics = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await apiClient.get<ExpenseStatistics>(`/expenses/statistics?${params.toString()}`);
    return response.data;
};
