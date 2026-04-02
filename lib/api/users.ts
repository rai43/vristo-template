import { api } from '../api';

export interface BackofficeUser {
    _id: string;
    email: string;
    name: string;
    role: 'super_admin' | 'admin' | 'manager' | 'operator';
    isActive: boolean;
    phone?: string;
    lastLogin?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateUserDto {
    email: string;
    password: string;
    name: string;
    role: 'super_admin' | 'admin' | 'manager' | 'operator';
    phone?: string;
    isActive?: boolean;
}

export interface UpdateUserDto {
    email?: string;
    name?: string;
    role?: 'super_admin' | 'admin' | 'manager' | 'operator';
    phone?: string;
    isActive?: boolean;
}

export interface CurrentUserResponse {
    data: {
        _id: string;
        email: string;
        name: string;
        role: 'super_admin' | 'admin' | 'manager' | 'operator';
    };
}

export interface UsersListResponse {
    ok: boolean;
    data: BackofficeUser[];
}

export interface ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}

// Get all users
export const getUsers = async (): Promise<UsersListResponse> => {
    const response = await api.client.get('/auth/users');
    return response.data;
};

// Get user by ID
export const getUserById = async (id: string): Promise<{ ok: boolean; data: BackofficeUser }> => {
    const response = await api.client.get(`/auth/users/${id}`);
    return response.data;
};

// Create new user
export const createUser = async (data: CreateUserDto): Promise<{ ok: boolean; data: BackofficeUser }> => {
    const response = await api.client.post('/auth/users', data);
    return response.data;
};

// Update user
export const updateUser = async (id: string, data: UpdateUserDto): Promise<{ ok: boolean; data: BackofficeUser }> => {
    const response = await api.client.put(`/auth/users/${id}`, data);
    return response.data;
};

// Delete user
export const deleteUser = async (id: string): Promise<{ ok: boolean; message: string }> => {
    const response = await api.client.delete(`/auth/users/${id}`);
    return response.data;
};

// Change password
export const changePassword = async (data: ChangePasswordDto): Promise<{ ok: boolean; message: string }> => {
    const response = await api.client.post('/auth/change-password', data);
    return response.data;
};

// Get current user
export const getCurrentUser = async (): Promise<CurrentUserResponse> => {
    const response = await api.client.get('/auth/me');
    // Backend returns { ok: true, id, email, name, role }
    // Transform to match expected structure { data: { ...user } }
    if (response.data.ok) {
        return {
            data: {
                _id: response.data.id,
                email: response.data.email,
                name: response.data.name,
                role: response.data.role,
            },
        };
    }
    return response.data;
};

// Role display names
export const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
        super_admin: 'Super Admin',
        admin: 'Administrateur',
        manager: 'Gestionnaire',
        operator: 'Employé',
    };
    return labels[role] || role;
};

// Role colors
export const getRoleColor = (role: string): string => {
    const colors: Record<string, string> = {
        super_admin: 'danger',
        admin: 'primary',
        manager: 'info',
        operator: 'success',
    };
    return colors[role] || 'secondary';
};

// Admin Role Enum (for admin-users component)
export enum AdminRole {
    SUPER_ADMIN = 'super_admin',
    ADMIN = 'admin',
    MANAGER = 'manager',
    OPERATOR = 'operator',
}

// Type aliases for admin-users component
export type AdminUser = Omit<BackofficeUser, 'role'> & { role: AdminRole };
export type CreateAdminUserDto = Omit<CreateUserDto, 'role'> & { role: AdminRole };
export type UpdateAdminUserDto = Omit<UpdateUserDto, 'role'> & { role?: AdminRole };

// Helper to convert string role to AdminRole enum
const toAdminRole = (role: string): AdminRole => {
    switch (role) {
        case 'super_admin':
            return AdminRole.SUPER_ADMIN;
        case 'admin':
            return AdminRole.ADMIN;
        case 'manager':
            return AdminRole.MANAGER;
        case 'operator':
            return AdminRole.OPERATOR;
        default:
            return AdminRole.OPERATOR;
    }
};

// Helper to convert AdminRole enum to string
const fromAdminRole = (role: AdminRole): 'super_admin' | 'admin' | 'manager' | 'operator' => {
    return role as 'super_admin' | 'admin' | 'manager' | 'operator';
};

// Admin user functions (wrappers that unwrap response data and convert roles)
export const getAdminUsers = async (): Promise<AdminUser[]> => {
    const response = await getUsers();
    return response.data.map((user) => ({
        ...user,
        role: toAdminRole(user.role),
    }));
};

export const createAdminUser = async (data: CreateAdminUserDto): Promise<AdminUser> => {
    const createData: CreateUserDto = {
        ...data,
        role: fromAdminRole(data.role),
    };
    const response = await createUser(createData);
    return {
        ...response.data,
        role: toAdminRole(response.data.role),
    };
};

export const updateAdminUser = async (id: string, data: UpdateAdminUserDto): Promise<AdminUser> => {
    const updateData: UpdateUserDto = {
        ...data,
        role: data.role ? fromAdminRole(data.role) : undefined,
    };
    const response = await updateUser(id, updateData);
    return {
        ...response.data,
        role: toAdminRole(response.data.role),
    };
};

export const deleteAdminUser = async (id: string): Promise<void> => {
    await deleteUser(id);
};
