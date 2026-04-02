import RegistrationList from '@/components/apps/registrations/registration-list';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Enregistrements',
};

const RegistrationsPage = () => {
    return <RegistrationList />;
};

export default RegistrationsPage;
