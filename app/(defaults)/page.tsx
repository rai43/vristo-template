import ComponentsDashboardOverview from '@/components/dashboard/components-dashboard-overview';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: "Vue d'Ensemble | MIRAI Services BO",
    description: "Tableau de bord principal - Vue d'ensemble des activités",
};

const Dashboard = () => {
    return <ComponentsDashboardOverview />;
};

export default Dashboard;
