import React from 'react';
import { Operation, OperationStatus } from './types'; // ─── Date helpers ──────────────────────────────────────────

// ─── Date helpers ──────────────────────────────────────────

export const getStartOfWeek = (): string => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(now);
    start.setDate(now.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    return start.toISOString().split('T')[0];
};

export const getEndOfWeek = (): string => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    const end = new Date(now);
    end.setDate(now.getDate() + diff);
    end.setHours(23, 59, 59, 999);
    return end.toISOString().split('T')[0];
};

export const getStartOfMonth = (): string => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
};

export const getEndOfMonth = (): string => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
};

export const formatDate = (dateString: string): string =>
    new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

export const formatDateShort = (dateString: string): string =>
    new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
    });

export const formatDateTime = (dateString: string): string =>
    new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });

export const isToday = (dateString: string): boolean => {
    const d = new Date(dateString);
    const now = new Date();
    return d.toDateString() === now.toDateString();
};

export const daysBetween = (dateString: string): number => {
    const d = new Date(dateString);
    const now = new Date();
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
};

// ─── Status config ─────────────────────────────────────────

export interface StatusConfig {
    label: string;
    color: string;
    bgClass: string;
    textClass: string;
    dotClass: string;
    order: number;
}

export const STATUS_CONFIG: Record<OperationStatus, StatusConfig> = {
    pending: {
        label: 'En attente',
        color: 'slate',
        bgClass: 'bg-slate-100 dark:bg-slate-700',
        textClass: 'text-slate-600 dark:text-slate-300',
        dotClass: 'bg-slate-400',
        order: 0,
    },
    confirmed: {
        label: 'Confirmé (client)',
        color: 'info',
        bgClass: 'bg-blue-100 dark:bg-blue-500/10',
        textClass: 'text-blue-700 dark:text-blue-300',
        dotClass: 'bg-blue-500',
        order: 0,
    },
    registered: {
        label: 'Enregistré',
        color: 'info',
        bgClass: 'bg-info/10',
        textClass: 'text-info',
        dotClass: 'bg-info',
        order: 1,
    },
    processing: {
        label: 'En traitement',
        color: 'primary',
        bgClass: 'bg-primary/10',
        textClass: 'text-primary',
        dotClass: 'bg-primary',
        order: 2,
    },
    ready_for_delivery: {
        label: 'Prêt livraison',
        color: 'success',
        bgClass: 'bg-success/10',
        textClass: 'text-success',
        dotClass: 'bg-success',
        order: 3,
    },
    out_for_delivery: {
        label: 'En livraison',
        color: 'warning',
        bgClass: 'bg-warning/10',
        textClass: 'text-warning',
        dotClass: 'bg-warning',
        order: 4,
    },
    not_delivered: {
        label: 'Pas livré',
        color: 'danger',
        bgClass: 'bg-danger/10',
        textClass: 'text-danger',
        dotClass: 'bg-danger',
        order: 5,
    },
    delivered: {
        label: 'Livré',
        color: 'success',
        bgClass: 'bg-success/10',
        textClass: 'text-success',
        dotClass: 'bg-success',
        order: 6,
    },
    returned: {
        label: 'Retourné',
        color: 'danger',
        bgClass: 'bg-danger/10',
        textClass: 'text-danger',
        dotClass: 'bg-danger',
        order: 7,
    },
    cancelled: {
        label: 'Annulé',
        color: 'dark',
        bgClass: 'bg-dark/10',
        textClass: 'text-dark dark:text-slate-400',
        dotClass: 'bg-dark',
        order: 8,
    },
};

export const getStatusLabel = (status: string): string => STATUS_CONFIG[status as OperationStatus]?.label || status;

export const getStatusBadge = (op: Operation): React.ReactElement => {
    // Lead-based potential operations
    if (op.isLead) {
        return React.createElement(
            'span',
            { className: 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300' },
            '⭐ Prospect'
        );
    }
    // Always show the actual status - the UI sections already provide context
    const cfg = STATUS_CONFIG[op.status] || { label: op.status, bgClass: 'bg-slate-100', textClass: 'text-slate-600' };
    return React.createElement('span', { className: `inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bgClass} ${cfg.textClass}` }, `● ${cfg.label}`);
};

// ─── Search filter ─────────────────────────────────────────

export const filterBySearch = (ops: Operation[], query: string): Operation[] => {
    if (!query.trim()) return ops;
    const q = query.toLowerCase();
    return ops.filter((op) => op.orderId.toLowerCase().includes(q) || op.customer.name.toLowerCase().includes(q) || op.city?.toLowerCase().includes(q) || op.packName?.toLowerCase().includes(q));
};

// ─── Excel export ──────────────────────────────────────────

export const exportDailyToExcel = async (dailyOps: { urgentOps: Operation[]; toPickupToday: Operation[]; toWashToday: Operation[]; toDeliverToday: Operation[]; inProgress: Operation[] }) => {
    const XLSX = await import('xlsx');

    const format = (ops: Operation[]) =>
        ops.map((op) => ({
            Commande: op.orderId,
            Type: op.isSubscription ? 'Abonnement' : 'À la carte',
            Client: op.customer.name,
            Téléphone: op.customer.phone || '-',
            Date: formatDate(op.date),
            Heure: op.scheduledTime || '-',
            Opération: op.operationType === 'pickup' ? 'Récupération' : 'Livraison',
            Ville: op.city || '-',
            Pack: op.packName || '-',
            Statut: getStatusLabel(op.status),
            Vêtements: op.clothesCount || '-',
            Agent: (op.operationType === 'pickup' ? op.pickupAgent : op.deliveryAgent) || '-',
            Retard: op.isOverdue ? 'OUI' : 'NON',
        }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(format(dailyOps.toPickupToday)), 'Récupérations');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(format(dailyOps.toWashToday)), 'À Laver');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(format(dailyOps.toDeliverToday)), 'À Livrer');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(format(dailyOps.inProgress)), 'En Cours');
    XLSX.writeFile(wb, `MIRAI-Operations-${new Date().toISOString().split('T')[0]}.xlsx`);
};
