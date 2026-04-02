import { redirect } from 'next/navigation';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Orders Management',
};

const Orders = () => {
    redirect('/apps/orders/list');
};

export default Orders;
