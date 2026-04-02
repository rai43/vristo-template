import { Metadata } from 'next';
import ComponentsAppsFinance from '@/components/apps/finance/components-apps-finance';

export const metadata: Metadata = {
    title: 'Finance | MIRAI Services BO',
    description: 'Gestion financière complète - Revenus, Dépenses, Rapports',
};

const Finance = () => {
    return <ComponentsAppsFinance />;
};

export default Finance;
