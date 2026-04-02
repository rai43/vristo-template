import { Metadata } from 'next';
import ComponentsAppsOperations from '@/components/apps/operations/components-apps-operations';

export const metadata: Metadata = {
    title: 'Opérations | MIRAI Services BO',
};

const Operations = () => {
    return <ComponentsAppsOperations />;
};

export default Operations;
