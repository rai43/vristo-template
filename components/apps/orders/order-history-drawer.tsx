'use client';
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useQuery } from '@tanstack/react-query';
import IconX from '@/components/icon/icon-x';
import IconUser from '@/components/icon/icon-user';
import IconClock from '@/components/icon/icon-clock';
import IconArrowForward from '@/components/icon/icon-arrow-forward';
import { getOrderHistory, type Order, type HistoryEntry, getStatusConfig } from '@/lib/api/orders';

interface OrderHistoryDrawerProps {
    order: Order;
    isOpen: boolean;
    onClose: () => void;
}

const OrderHistoryDrawer = ({ order, isOpen, onClose }: OrderHistoryDrawerProps) => {
    const { data: historyData, isLoading } = useQuery({
        queryKey: ['order', order._id, 'history'],
        queryFn: () => getOrderHistory(order._id),
        enabled: isOpen,
    });

    const history = historyData?.data || order.history || [];

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (status: string) => {
        const config = getStatusConfig(status as any);
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                {config.icon} {config.label}
            </span>
        );
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" open={isOpen} onClose={onClose}>
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 z-[998] bg-[black]/60" />
                </Transition.Child>

                <div className="fixed inset-0 z-[999] overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                            <Transition.Child
                                as={Fragment}
                                enter="transform transition ease-in-out duration-300"
                                enterFrom="translate-x-full"
                                enterTo="translate-x-0"
                                leave="transform transition ease-in-out duration-300"
                                leaveFrom="translate-x-0"
                                leaveTo="translate-x-full"
                            >
                                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                                    <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl dark:bg-[#0e1726]">
                                        {/* Header */}
                                        <div className="bg-primary px-4 py-6 sm:px-6">
                                            <div className="flex items-center justify-between">
                                                <Dialog.Title className="text-lg font-medium text-white">Order History</Dialog.Title>
                                                <button type="button" className="rounded-md text-white hover:text-gray-200 focus:outline-none" onClick={onClose}>
                                                    <IconX className="h-6 w-6" />
                                                </button>
                                            </div>
                                            <div className="mt-1 text-sm text-white/80">{order.orderId}</div>
                                        </div>

                                        {/* Content */}
                                        <div className="relative flex-1 px-4 py-6 sm:px-6">
                                            {isLoading ? (
                                                <div className="flex justify-center py-10">
                                                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-l-transparent"></div>
                                                </div>
                                            ) : history.length === 0 ? (
                                                <div className="py-10 text-center text-gray-500">No history available</div>
                                            ) : (
                                                <div className="flow-root">
                                                    <ul className="-mb-8">
                                                        {history.map((entry: HistoryEntry, index: number) => (
                                                            <li key={index}>
                                                                <div className="relative pb-8">
                                                                    {index !== history.length - 1 && (
                                                                        <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
                                                                    )}
                                                                    <div className="relative flex space-x-3">
                                                                        <div>
                                                                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 ring-8 ring-white dark:ring-gray-900">
                                                                                <IconClock className="h-4 w-4 text-primary" />
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                                                                            <div className="flex-1">
                                                                                {/* Status Change */}
                                                                                {entry.previousStatus && entry.newStatus && (
                                                                                    <div className="mb-2 flex items-center gap-2 text-sm">
                                                                                        {getStatusBadge(entry.previousStatus)}
                                                                                        <IconArrowForward className="h-4 w-4 text-gray-400" />
                                                                                        {getStatusBadge(entry.newStatus)}
                                                                                    </div>
                                                                                )}

                                                                                {/* Note */}
                                                                                {entry.note && <p className="text-sm text-gray-600 dark:text-gray-300">{entry.note}</p>}

                                                                                {/* Changes Detail */}
                                                                                {entry.changes && Object.keys(entry.changes).length > 0 && (
                                                                                    <div className="mt-2 rounded-md bg-gray-50 p-2 dark:bg-gray-800">
                                                                                        <p className="text-xs font-medium text-gray-700 dark:text-gray-400">Changes:</p>
                                                                                        <ul className="mt-1 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                                                                                            {Object.entries(entry.changes).map(([key, value]: [string, any]) => (
                                                                                                <li key={key} className="flex items-start gap-1">
                                                                                                    <span className="font-medium">{key}:</span>
                                                                                                    {typeof value === 'object' && value.from && value.to ? (
                                                                                                        <span>
                                                                                                            {JSON.stringify(value.from)} → {JSON.stringify(value.to)}
                                                                                                        </span>
                                                                                                    ) : (
                                                                                                        <span>{JSON.stringify(value)}</span>
                                                                                                    )}
                                                                                                </li>
                                                                                            ))}
                                                                                        </ul>
                                                                                    </div>
                                                                                )}

                                                                                {/* Metadata */}
                                                                                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                                                                                    <div className="flex items-center gap-1">
                                                                                        <IconUser className="h-3 w-3" />
                                                                                        <span>{entry.modifiedBy || 'System'}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1">
                                                                                        <IconClock className="h-3 w-3" />
                                                                                        <span>{formatDate(entry.modifiedAt)}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer */}
                                        <div className="border-t border-gray-200 px-4 py-4 dark:border-gray-700">
                                            <button type="button" className="btn btn-primary w-full" onClick={onClose}>
                                                Close
                                            </button>
                                        </div>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default OrderHistoryDrawer;
