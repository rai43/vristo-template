import ComponentsAppsLivreurs from '@/components/apps/livreurs/components-apps-livreurs';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Livreurs | MIRAI Services',
};

const LivreursPage = () => {
    return <ComponentsAppsLivreurs />;
};

export default LivreursPage;
