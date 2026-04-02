import { Metadata } from 'next';
export const metadata: Metadata = {
    title: 'Inscription Client - MIRAI Services',
    description: 'Inscrivez-vous pour bénéficier des services de blanchisserie MIRAI Services',
};
export default function RegisterLayout({ children }: { children: React.ReactNode }) {
    return children;
}
