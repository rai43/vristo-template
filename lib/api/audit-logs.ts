import { api } from '../api';

export interface AuditLogEntry {
    _id: string;
    userId: string;
    userName: string;
    action: string;
    module: string;
    page: string;
    entityId: string;
    entityLabel: string;
    description: string;
    before: Record<string, any> | null;
    after: Record<string, any> | null;
    metadata: Record<string, any>;
    ipAddress: string;
    createdAt: string;
    updatedAt: string;
}

export interface AuditLogSearchResult {
    data: AuditLogEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface AuditLogSearchParams {
    page?: number;
    limit?: number;
    module?: string;
    action?: string;
    userId?: string;
    entityId?: string;
    from?: string;
    to?: string;
    q?: string;
}

export const getAuditLogs = (params: AuditLogSearchParams = {}) => api.client.get<AuditLogSearchResult>('/audit-logs', { params });

// Restore endpoints
export const restoreOrder = (id: string) => api.client.post(`/orders/${id}/restore`);

export const restoreClient = (id: string) => api.client.post(`/clients/${id}/restore`);
