import { Metadata } from 'next';
import ComponentsDashboardOverview from '@/components/dashboard/components-dashboard-overview';

export const metadata: Metadata = {
    title: "Vue d'Ensemble | MIRAI Services BO",
    description: "Tableau de bord principal - Vue d'ensemble des activités",
};

const DashboardOverview = () => {
    return <ComponentsDashboardOverview />;
};

export default DashboardOverview;
