import { Metadata } from 'next';
import Link from 'next/link';
import ComponentsClientsSettings from '@/components/management/clients/components-clients-settings';

export const metadata: Metadata = {
    title: 'Paramètres Client | MIRAI Services',
};

const ClientSettings = () => {
    return (
        <div>
            <ul className="flex space-x-2 rtl:space-x-reverse">
                <li>
                    <Link href="/management/clients" className="text-primary hover:underline">
                        Clients
                    </Link>
                </li>
                <li className="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
                    <span>Paramètres</span>
                </li>
            </ul>
            <ComponentsClientsSettings />
        </div>
    );
};

export default ClientSettings;
