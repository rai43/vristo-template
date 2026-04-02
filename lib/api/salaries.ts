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

export interface Salary {
    _id?: string;
    employeeName: string;
    position: string;
    baseSalary: number;
    bonus?: number;
    deductions?: number;
    paymentDate: string;
    period: string; // Format: YYYY-MM
    status: 'paid' | 'pending' | 'processing';
    paymentMethod?: 'Espèces' | 'Virement' | 'Chèque' | 'Mobile Money';
    notes?: string;
    netSalary: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface SalaryStatistics {
    total: number;
    paid: number;
    pending: number;
    count: number;
    employeeCount: number;
    byEmployee: Record<string, number>;
}

export const getSalaries = async (filters?: { period?: string; status?: string; employeeName?: string }) => {
    const params = new URLSearchParams();
    if (filters?.period) params.append('period', filters.period);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.employeeName) params.append('employeeName', filters.employeeName);

    const response = await apiClient.get<Salary[]>(`/salaries?${params.toString()}`);
    return response.data;
};

export const getSalary = async (id: string) => {
    const response = await apiClient.get<Salary>(`/salaries/${id}`);
    return response.data;
};

export const createSalary = async (data: Omit<Salary, '_id' | 'netSalary' | 'createdAt' | 'updatedAt'>) => {
    const response = await apiClient.post<Salary>('/salaries', data);
    return response.data;
};

export const updateSalary = async (id: string, data: Partial<Salary>) => {
    const response = await apiClient.patch<Salary>(`/salaries/${id}`, data);
    return response.data;
};

export const deleteSalary = async (id: string) => {
    await apiClient.delete(`/salaries/${id}`);
};

export const getSalaryStatistics = async (period?: string) => {
    const params = new URLSearchParams();
    if (period) params.append('period', period);

    const response = await apiClient.get<SalaryStatistics>(`/salaries/statistics?${params.toString()}`);
    return response.data;
};

export const getEmployeeList = async () => {
    const response = await apiClient.get<string[]>('/salaries/employees');
    return response.data;
};
