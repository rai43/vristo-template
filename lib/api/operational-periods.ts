import { api } from '@/lib/api';

export interface OperationalPeriod {
    _id: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    isActive: boolean;
    order: number;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

const client = api.client;

export const operationalPeriodsApi = {
    /** Get all periods (latest first) */
    getAll: async (): Promise<OperationalPeriod[]> => {
        const res = await client.get('/operational-periods');
        return res.data.data;
    },

    /** Get the current (active/latest) period */
    getCurrent: async (): Promise<OperationalPeriod | null> => {
        const res = await client.get('/operational-periods/current');
        return res.data.data;
    },

    /** Get a single period */
    getOne: async (id: string): Promise<OperationalPeriod> => {
        const res = await client.get(`/operational-periods/${id}`);
        return res.data.data;
    },

    /** Create a new period */
    create: async (data: {
        name: string;
        startDate: string;
        endDate: string;
        isCurrent?: boolean;
        order?: number;
        description?: string;
    }): Promise<OperationalPeriod> => {
        const res = await client.post('/operational-periods', data);
        return res.data.data;
    },

    /** Update a period */
    update: async (
        id: string,
        data: Partial<{
            name: string;
            startDate: string;
            endDate: string;
            isCurrent: boolean;
            isActive: boolean;
            order: number;
            description: string;
        }>
    ): Promise<OperationalPeriod> => {
        const res = await client.patch(`/operational-periods/${id}`, data);
        return res.data.data;
    },

    /** Delete a period (soft delete) */
    delete: async (id: string): Promise<void> => {
        await client.delete(`/operational-periods/${id}`);
    },
};

