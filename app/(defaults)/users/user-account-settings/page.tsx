import ComponentsUsersAccountSettingsTabs from '@/components/users/account-settings/components-users-account-settings-tabs';
import { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';

export const metadata: Metadata = {
    title: 'Paramètres du compte | MIRAI Services',
};

const UserAccountSettings = () => {
    return (
        <div>
            <ul className="flex space-x-2 rtl:space-x-reverse">
                <li>
                    <Link href="/dashboard" className="text-primary hover:underline">
                        Accueil
                    </Link>
                </li>
                <li className="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
                    <span>Paramètres du compte</span>
                </li>
            </ul>
            <ComponentsUsersAccountSettingsTabs />
        </div>
    );
};

export default UserAccountSettings;
