import { Metadata } from 'next';
import ComponentsManagementUsers from '@/components/management/users/components-management-users';

export const metadata: Metadata = {
    title: 'Gestion des Utilisateurs | MIRAI Services',
};

const UsersManagementPage = () => {
    return <ComponentsManagementUsers />;
};

export default UsersManagementPage;
