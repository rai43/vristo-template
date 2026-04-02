import { Metadata } from 'next';
import ComponentsAppsLeads from '@/components/apps/leads/components-apps-leads';

export const metadata: Metadata = {
    title: 'Prospects | MIRAI Services',
};

const LeadsPage = () => {
    return <ComponentsAppsLeads />;
};

export default LeadsPage;
