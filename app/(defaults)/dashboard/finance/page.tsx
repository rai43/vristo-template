import { Metadata } from 'next';
import ComponentsAppsFinance from '@/components/apps/finance/components-apps-finance';

export const metadata: Metadata = {
    title: 'Finance | MIRAI Services BO',
    description: 'Gestion financière complète - Revenus, Dépenses, Salaires, Budgets',
};

const DashboardFinance = () => {
    return <ComponentsAppsFinance />;
};

export default DashboardFinance;
