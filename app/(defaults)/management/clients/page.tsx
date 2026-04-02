import { Metadata } from 'next';
import ComponentsAppsCustomers from '@/components/apps/customers/components-apps-customers';

export const metadata: Metadata = {
    title: 'Clients | MIRAI Services',
};

const ClientsPage = () => {
    return <ComponentsAppsCustomers />;
};

export default ClientsPage;


