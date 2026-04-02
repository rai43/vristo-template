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

export interface Budget {
    _id: string;
    category: string;
    budget: number;
    alertThreshold: number;
    currentSpending: number;
    month: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateBudgetDto {
    category: string;
    budget: number;
    alertThreshold: number;
}

export interface UpdateBudgetDto {
    category?: string;
    budget?: number;
    alertThreshold?: number;
    currentSpending?: number;
}

export const getBudgets = async () => {
    const response = await apiClient.get<Budget[]>('/budgets');
    return response.data;
};

export const getBudgetById = async (id: string) => {
    const response = await apiClient.get<Budget>(`/budgets/${id}`);
    return response.data;
};

export const createBudget = async (data: CreateBudgetDto) => {
    const response = await apiClient.post<Budget>('/budgets', data);
    return response.data;
};

export const updateBudget = async (id: string, data: UpdateBudgetDto) => {
    const response = await apiClient.patch<Budget>(`/budgets/${id}`, data);
    return response.data;
};

export const deleteBudget = async (id: string) => {
    await apiClient.delete(`/budgets/${id}`);
};
