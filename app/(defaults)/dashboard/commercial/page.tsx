import ComponentsDashboardCommercial from '@/components/dashboard/components-dashboard-commercial';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Gestion Commerciale | MIRAI Services BO',
    description: "Tableau de bord commercial - Vue d'ensemble des commandes et clients",
};

const Commercial = () => {
    return <ComponentsDashboardCommercial />;
};

export default Commercial;
