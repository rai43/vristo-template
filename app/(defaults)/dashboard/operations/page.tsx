// Operations Dashboard Page
import ComponentsDashboardOperations from '@/components/dashboard/components-dashboard-operations';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Statistiques Opérations | MIRAI Services BO',
    description: 'Tableau de bord opérations - Métriques et suivi',
};

const Operations = () => {
    return <ComponentsDashboardOperations />;
};

export default Operations;
