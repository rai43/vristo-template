import React from 'react';
import { getStatusConfig, OrderStatus } from '@/lib/api/orders';

export const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
        pending: { color: 'secondary', label: 'En attente' },
        confirmed: { color: 'info', label: 'Confirmé (client)' },
        registered: { color: 'info', label: 'Enregistrement' },
        processing: { color: 'primary', label: 'En traitement' },
        ready_for_delivery: { color: 'warning', label: 'Prêt pour livraison' },
        out_for_delivery: { color: 'warning', label: 'En cours de livraison' },
        not_delivered: { color: 'danger', label: 'Pas livré' },
        delivered: { color: 'success', label: 'Livré' },
        returned: { color: 'danger', label: 'Retourné' },
        cancelled: { color: 'secondary', label: 'Annulé' },
    };

    const config = statusMap[status] || { color: 'secondary', label: status };
    return <span className={`badge badge-outline-${config.color}`}>{config.label}</span>;
};

export const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

/** Unified operation flow: pending → registered → processing → ready_for_delivery → out_for_delivery → delivered */
export const getOperationStatusConfig = (status?: string) => {
    const statusMap: Record<string, { color: string; label: string; step: number }> = {
        pending: { color: 'secondary', label: 'En attente', step: 0 },
        confirmed: { color: 'info', label: 'Confirmé (client)', step: 0 },
        registered: { color: 'info', label: 'Enregistrement', step: 1 },
        processing: { color: 'primary', label: 'En traitement', step: 2 },
        ready_for_delivery: { color: 'warning', label: 'Prêt livraison', step: 3 },
        out_for_delivery: { color: 'warning', label: 'En cours de livraison', step: 4 },
        not_delivered: { color: 'danger', label: 'Pas livré', step: 3 },
        delivered: { color: 'success', label: 'Livré', step: 5 },
        returned: { color: 'danger', label: 'Retourné', step: -1 },
        cancelled: { color: 'secondary', label: 'Annulé', step: -1 },
    };
    return statusMap[status || 'pending'] || statusMap.pending;
};

export const getStatusConfigSafe = (status: string) => {
    if (status === 'active') return { color: 'success', label: 'Actif', icon: '●' };
    if (status === 'completed') return { color: 'info', label: 'Terminé', icon: '●' };
    if (status === 'stopped') return { color: 'secondary', label: 'Arrêté', icon: '●' };

    // Try new status names first
    const opConfig = getOperationStatusConfig(status);
    if (opConfig) return { color: opConfig.color, label: opConfig.label, icon: '●' };

    const config = getStatusConfig(status as OrderStatus);
    return config || { color: 'secondary', label: status, icon: '●' };
};

export interface PackLimits {
    couettes: number;
    vestes: number;
    draps_serviettes: number;
    total: number;
    ordinaires: number;
}

export const EMPTY_LIMITS: PackLimits = { couettes: 0, vestes: 0, draps_serviettes: 0, total: 0, ordinaires: 0 };

/**
 * Get pack limits from the fetched packs data (from DB).
 * @param packName - the pack code stored on the order (e.g. "ÉCLAT")
 * @param packsData - array of Pack objects fetched from the API
 */
export const getPackLimits = (packName?: string, packsData?: any[]): PackLimits => {
    if (!packName) return EMPTY_LIMITS;

    // If we have actual packs data from the API, use it
    if (packsData && packsData.length > 0) {
        const pack = packsData.find((p) => p.code === packName || p.code?.toUpperCase() === packName.toUpperCase() || p.name === packName);
        if (pack) {
            const total = pack.total || 0;
            const couettes = pack.couettes || 0;
            const vestes = pack.vestes || 0;
            const draps_serviettes = pack.draps_serviettes || 0;
            return {
                couettes,
                vestes,
                draps_serviettes,
                total,
                ordinaires: total - couettes - vestes - draps_serviettes,
            };
        }
    }

    // Fallback: return empty (no hardcoded values)
    return EMPTY_LIMITS;
};

export const getBackLink = () => {
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const from = params.get('from');
        if (from === 'operations') {
            return '/apps/operations';
        }
    }
    return '/apps/orders/list';
};
