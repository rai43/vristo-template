import { Metadata } from 'next';
import DeliveryPersonsPage from '@/components/apps/delivery-persons/delivery-persons-page';

export const metadata: Metadata = {
    title: 'Livreurs | MIRAI Services BO',
};

const Page = () => {
    return <DeliveryPersonsPage />;
};

export default Page;
