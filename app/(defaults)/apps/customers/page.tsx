import ComponentsAppsCustomers from '@/components/apps/customers/components-apps-customers';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Customers',
};

const Customers = () => {
    return <ComponentsAppsCustomers />;
};

export default Customers;
