'use client';
import { getStatusConfig, type OrderStatus } from '@/lib/api/orders';

interface OrderTimelineProps {
    currentStatus: OrderStatus;
}

const OrderTimeline = ({ currentStatus }: OrderTimelineProps) => {
    const statuses: OrderStatus[] = ['pending', 'registered', 'processing', 'ready_for_delivery', 'out_for_delivery', 'delivered'];

    const currentIndex = statuses.indexOf(currentStatus);
    const isCancelled = currentStatus === 'cancelled';
    const isReturned = currentStatus === 'returned';

    const getStepStatus = (index: number) => {
        if (isCancelled || isReturned) {
            return index === currentIndex ? 'current-special' : 'pending';
        }
        if (index < currentIndex) return 'completed';
        if (index === currentIndex) return 'current';
        return 'pending';
    };

    const getStepClass = (status: string) => {
        const baseClasses = 'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300';

        switch (status) {
            case 'completed':
                return `${baseClasses} border-success bg-success text-white`;
            case 'current':
                return `${baseClasses} border-primary bg-primary text-white ring-4 ring-primary/30`;
            case 'current-special':
                return `${baseClasses} border-danger bg-danger text-white ring-4 ring-danger/30`;
            default:
                return `${baseClasses} border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800`;
        }
    };

    const getLineClass = (status: string) => {
        const baseClasses = 'h-0.5 flex-1 transition-all duration-300';

        switch (status) {
            case 'completed':
                return `${baseClasses} bg-success`;
            case 'current':
            case 'current-special':
                return `${baseClasses} bg-gradient-to-r from-success to-gray-300`;
            default:
                return `${baseClasses} bg-gray-300 dark:bg-gray-600`;
        }
    };

    // If order is in a special state, show only that state
    if (isCancelled || isReturned) {
        const config = getStatusConfig(currentStatus);
        return (
            <div className="flex items-center justify-center py-8">
                <div className="text-center">
                    <div className={getStepClass('current-special')}>
                        <span className="text-2xl">{config.icon}</span>
                    </div>
                    <div className="mt-3 font-semibold text-danger">{config.label}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto pb-4">
            <div className="flex items-center justify-between" style={{ minWidth: '800px' }}>
                {statuses.map((status, index) => {
                    const stepStatus = getStepStatus(index);
                    const config = getStatusConfig(status);
                    const isLast = index === statuses.length - 1;

                    return (
                        <div key={status} className="flex flex-1 items-center">
                            <div className="flex flex-col items-center">
                                <div className={getStepClass(stepStatus)} title={config.label}>
                                    <span>{config.icon}</span>
                                </div>
                                <div className={`mt-2 text-center text-xs font-medium ${stepStatus === 'pending' ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                    <div className="max-w-[80px] break-words">{config.label}</div>
                                </div>
                            </div>
                            {!isLast && <div className={getLineClass(index < currentIndex ? 'completed' : 'pending')} />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default OrderTimeline;
