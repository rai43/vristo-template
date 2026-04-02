'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import RegistrationDetail from '@/components/apps/registrations/registration-detail';

const RegistrationDetailPage = () => {
    const params = useParams();
    const id = params?.id as string;
    return <RegistrationDetail id={id} />;
};

export default RegistrationDetailPage;
