export type UserRole = 'super_admin' | 'admin' | 'manager' | 'operator';

export interface User {
    id?: string;
    email: string;
    name: string;
    role: UserRole;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}
