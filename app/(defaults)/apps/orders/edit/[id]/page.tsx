import OrderEdit from '@/components/apps/orders/order-edit';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Edit Order',
};

interface EditOrderPageProps {
    params: {
        id: string;
    };
}

const EditOrderPage = ({ params }: EditOrderPageProps) => {
    return <OrderEdit orderId={params.id} />;
};

export default EditOrderPage;
