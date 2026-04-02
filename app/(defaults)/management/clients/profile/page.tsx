import { Metadata } from 'next';
import Link from 'next/link';
import ComponentsClientsProfile from '@/components/management/clients/components-clients-profile';

export const metadata: Metadata = {
    title: 'Profil Client | MIRAI Services',
};

const ClientProfile = () => {
    return (
        <div>
            <ul className="flex space-x-2 rtl:space-x-reverse">
                <li>
                    <Link href="/management/clients" className="text-primary hover:underline">
                        Clients
                    </Link>
                </li>
                <li className="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
                    <span>Profil</span>
                </li>
            </ul>
            <ComponentsClientsProfile />
        </div>
    );
};

export default ClientProfile;
