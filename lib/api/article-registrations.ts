import axios, { AxiosInstance } from 'axios';

const isBrowser = typeof window !== 'undefined';
const API_URL = isBrowser ? '/api-proxy' : (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001');

const apiClient: AxiosInstance = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    // Do NOT set a default Content-Type header here.
    // Axios auto-sets 'application/json' for objects and
    // 'multipart/form-data' for FormData. A hardcoded default
    // can leak into FormData requests on some mobile browsers
    // and confuse multer on the backend.
});

// Redirect to login on 401 (session expired) — same as main ApiClient
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            if (currentPath !== '/management/auth' && !error.config?.url?.includes('/auth/login')) {
                window.location.href = '/management/auth';
            }
        }
        return Promise.reject(error);
    }
);

// ─── Types ─────────────────────────────────────────────────

export interface ArticleCategory {
    name: string;
    label: string;
    quantity: number;
    subCount1?: number;
    subLabel1?: string;
    notes?: string;
}

export interface RegistrationPhoto {
    url: string;
    filename: string;
    thumbnailUrl?: string;
    type: 'articles' | 'bags' | 'defects' | 'other';
    caption?: string;
    uploadedAt: string;
    sizeBytes?: number;
    embedding?: number[];
}

export interface BagInfo {
    count: number;
    photoUrls: string[];
    notes?: string;
    status: 'received' | 'in_shop' | 'returned';
}

export interface ArticleVerification {
    articleIndex: number;
    categoryName: string;
    status: 'pending' | 'found' | 'not_found' | 'returned_bad_quality';
    verifiedAt?: string;
    verifiedBy?: string;
    matchedPhotoUrl?: string;
    notes?: string;
}

export interface VerificationSummary {
    total: number;
    found: number;
    notFound: number;
    badQuality: number;
    pending: number;
}

export interface ArticleRegistration {
    _id: string;
    registrationId: string;
    orderId: string;
    clientId: string;
    registeredBy?: { _id: string; name: string; email: string };
    operationIndex?: number;
    status: 'draft' | 'completed' | 'validated';
    articles: ArticleCategory[];
    totalArticles: number;
    photos: RegistrationPhoto[];
    bags?: BagInfo;
    verifications?: ArticleVerification[];
    verificationSummary?: VerificationSummary;
    summaryText?: string;
    notes?: string;
    clientName?: string;
    orderRef?: string;
    createdAt: string;
    updatedAt: string;
}

export interface DefaultCategory {
    name: string;
    label: string;
    subLabel1?: string;
}

// ─── API ───────────────────────────────────────────────────

const BASE = '/article-registrations';

export const registrationsApi = {
    /** Get default article categories for counter UI */
    getCategories: async (): Promise<DefaultCategory[]> => {
        const res = await apiClient.get(`${BASE}/categories`);
        return res.data.data;
    },

    /** Create new registration (draft) */
    create: async (data: { orderId: string; clientId: string; operationIndex?: number; notes?: string }): Promise<ArticleRegistration> => {
        const res = await apiClient.post(BASE, data);
        // The backend returns { ok: true, data: reg }
        // But handle any response format robustly:
        //   res.data         = HTTP body (could be { ok, data: reg } or reg directly)
        //   res.data.data    = reg (when wrapped)
        const body = res.data;
        const reg = body?.data ?? body;
        // Ensure _id is present (Mongoose may serialize as _id or id)
        if (reg && !reg._id && reg.id) {
            reg._id = reg.id;
        }
        if (!reg?._id) {
            console.error('[registrationsApi.create] Unexpected response structure:', JSON.stringify(body).slice(0, 500));
        }
        return reg as ArticleRegistration;
    },

    /** List registrations */
    list: async (params?: {
        orderId?: string;
        clientId?: string;
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        data: ArticleRegistration[];
        total: number;
        page: number;
        totalPages: number;
    }> => {
        const res = await apiClient.get(BASE, { params });
        return res.data;
    },

    /** Get single registration */
    get: async (id: string): Promise<ArticleRegistration> => {
        const res = await apiClient.get(`${BASE}/${id}`);
        return res.data.data;
    },

    /** Get registrations for an order */
    getByOrder: async (orderId: string): Promise<ArticleRegistration[]> => {
        const res = await apiClient.get(`${BASE}/by-order/${orderId}`);
        return res.data.data;
    },

    /** Update articles / bags / notes */
    update: async (
        id: string,
        data: {
            articles?: ArticleCategory[];
            bags?: Partial<BagInfo>;
            notes?: string;
            status?: string;
        }
    ): Promise<ArticleRegistration> => {
        const res = await apiClient.patch(`${BASE}/${id}`, data);
        return res.data.data;
    },

    /** Complete registration → generates summary + updates order */
    complete: async (id: string): Promise<ArticleRegistration> => {
        const res = await apiClient.post(`${BASE}/${id}/complete`);
        return res.data.data;
    },

    /** Upload photos — uploads in batches of 3 for mobile reliability */
    uploadPhotos: async (
        id: string,
        files: File[],
        type: 'articles' | 'bags' | 'defects' | 'other' = 'articles',
        onProgress?: (_uploaded: number, _total: number) => void
    ): Promise<ArticleRegistration> => {
        const BATCH_SIZE = 3; // Small batches for mobile reliability
        const MAX_RETRIES = 3;
        let lastResult: any = null;
        const total = files.length;

        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);
            const formData = new FormData();
            batch.forEach((f) => formData.append('photos', f));
            formData.append('type', type);

            let attempt = 0;
            let success = false;

            while (attempt <= MAX_RETRIES && !success) {
                try {
                    const res = await apiClient.post(`${BASE}/${id}/photos`, formData, {
                        // Do NOT set Content-Type manually — axios auto-sets the
                        // correct multipart/form-data boundary when it detects FormData.
                        // Setting it explicitly can strip the boundary on some mobile browsers.
                        timeout: 90_000 * (attempt + 1), // 90s base, increases on retry
                    });
                    lastResult = res.data.data;
                    success = true;
                } catch (err: any) {
                    attempt++;
                    console.error(`[Upload] Batch ${Math.floor(i / BATCH_SIZE) + 1} attempt ${attempt} failed:`, err?.message);
                    if (attempt > MAX_RETRIES) {
                        throw err;
                    }
                    // Exponential backoff before retry
                    await new Promise((r) => setTimeout(r, 1500 * attempt));
                }
            }

            onProgress?.(Math.min(i + BATCH_SIZE, total), total);
        }

        return lastResult;
    },

    /** Delete a photo */
    removePhoto: async (id: string, photoUrl: string): Promise<ArticleRegistration> => {
        const res = await apiClient.delete(`${BASE}/${id}/photos`, { data: { photoUrl } });
        return res.data.data;
    },

    /** Soft delete */
    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`${BASE}/${id}`);
    },

    /** Update verification status for an article */
    verifyArticle: async (
        id: string,
        data: {
            articleIndex: number;
            categoryName: string;
            status: string;
            notes?: string;
            matchedPhotoUrl?: string;
        }
    ): Promise<ArticleRegistration> => {
        const res = await apiClient.patch(`${BASE}/${id}/verify`, data);
        return res.data.data;
    },

    /** Clear all verifications for a registration */
    clearVerifications: async (id: string): Promise<ArticleRegistration> => {
        const res = await apiClient.patch(`${BASE}/${id}/verify/clear`);
        return res.data.data;
    },

    /** Get all non-found articles across all registrations */
    getNonFoundArticles: async (): Promise<any[]> => {
        const res = await apiClient.get(`${BASE}/non-found-articles`);
        return res.data.data;
    },

    /** Store embedding for a photo */
    storeEmbedding: async (id: string, filename: string, embedding: number[]): Promise<void> => {
        await apiClient.post(`${BASE}/${id}/photos/${filename}/embedding`, { embedding });
    },

    /** Get all embeddings for a registration */
    getEmbeddings: async (id: string): Promise<{ filename: string; url: string; embedding: number[] }[]> => {
        const res = await apiClient.get(`${BASE}/${id}/embeddings`);
        return res.data.data;
    },
};
