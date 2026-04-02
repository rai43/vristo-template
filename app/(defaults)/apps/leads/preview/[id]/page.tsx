import { Metadata } from 'next';
import LeadDetail from '@/components/apps/leads/lead-detail';

export const metadata: Metadata = {
    title: 'Détails Prospect | MIRAI Services',
};

const LeadPreviewPage = ({ params }: { params: { id: string } }) => {
    return <LeadDetail leadId={params.id} />;
};

export default LeadPreviewPage;
