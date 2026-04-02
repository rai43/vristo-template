import ClientProfile from '@/components/users/profile/client-profile';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Profil Client | MIRAI Services',
};

const Profile = () => {
    return <ClientProfile />;
};

export default Profile;
