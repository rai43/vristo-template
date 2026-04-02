'use client';
import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import IconX from '@/components/icon/icon-x';
import IconSave from '@/components/icon/icon-save';
import { getStatusConfig, getSubscriptionPickups, type Order, type OrderStatus, updateOrder } from '@/lib/api/orders';
import OrderTimeline from './order-timeline';

interface OrderDetailsModalProps {
    order: Order;
    isOpen: boolean;
    onClose: () => void;
}

const OrderDetailsModal = ({ order, isOpen, onClose }: OrderDetailsModalProps) => {
    const queryClient = useQueryClient();
    const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(order.status);
    const [note, setNote] = useState('');
    const [receivedItemCount, setReceivedItemCount] = useState(0);
    const [receivedSpecialCount, setReceivedSpecialCount] = useState(0);

    // Calculate pack progress for subscriptions
    const packProgress =
        order.type === 'subscription' && order.packName
            ? {
                  totalItems: order.items.reduce((sum, item) => sum + item.quantity, 0),
                  packLimit: order.packName === 'ÉCLAT' ? 100 : order.packName === 'PRESTIGE' ? 200 : 0,
                  pickupNumber: order.pickupNumber || 1,
              }
            : null;

    // Fetch pickup orders for subscriptions
    const { data: pickupOrders } = useQuery({
        queryKey: ['subscription-pickups', order._id],
        queryFn: () => getSubscriptionPickups(order._id),
        enabled: order.type === 'subscription' && !order.pickupNumber, // Only fetch for master subscription records
    });

    const updateMutation = useMutation({
        mutationFn: (data: { status: OrderStatus; note: string }) => updateOrder(order._id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['order', order._id] });
            Swal.fire({
                icon: 'success',
                title: 'Updated!',
                text: 'Order status has been updated successfully.',
                timer: 2000,
                showConfirmButton: false,
            });
            onClose();
        },
        onError: (error: any) => {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.response?.data?.message || 'Failed to update order',
            });
        },
    });

    const handleSave = () => {
        if (selectedStatus === order.status && !note) {
            Swal.fire({
                icon: 'warning',
                title: 'No Changes',
                text: 'Please change the status or add a note.',
            });
            return;
        }

        // Validation for registered status
        if (selectedStatus === 'registered' && order.status !== 'registered') {
            if (receivedItemCount === 0 && receivedSpecialCount === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Comptage requis',
                    text: 'Veuillez préciser le nombre d\'articles reçus avant de passer au statut "Enregistrement".',
                });
                return;
            }
        }

        let updateNote = note;
        if (selectedStatus === 'registered' && (receivedItemCount > 0 || receivedSpecialCount > 0)) {
            updateNote = `${note || 'Articles reçus'}. Ordinaires: ${receivedItemCount}, Spéciaux: ${receivedSpecialCount}`;
        }

        updateMutation.mutate({
            status: selectedStatus,
            note: updateNote || `Status updated to ${getStatusConfig(selectedStatus).label}`,
        });
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" open={isOpen} onClose={onClose}>
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-[black]/60" />
                </Transition.Child>

                <div className="fixed inset-0 z-[999] overflow-y-auto px-4">
                    <div className="flex min-h-screen items-center justify-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="panel w-full max-w-5xl overflow-hidden rounded-lg border-0 p-0 text-black dark:text-white-dark">
                                {/* Header */}
                                <div className="flex items-center justify-between bg-[#fbfbfb] px-5 py-3 dark:bg-[#121c2c]">
                                    <h5 className="text-lg font-bold">Order Details - {order.orderId}</h5>
                                    <button type="button" className="text-white-dark hover:text-dark" onClick={onClose}>
                                        <IconX className="h-5 w-5" />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="max-h-[80vh] overflow-y-auto p-5">
                                    {/* Order Timeline */}
                                    <div className="mb-6">
                                        <h6 className="mb-4 text-base font-semibold">Order Progress</h6>
                                        <OrderTimeline currentStatus={order.status} />
                                    </div>

                                    {/* Pack Progress (for subscriptions) */}
                                    {packProgress && (
                                        <div className="mb-6 rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
                                            <h6 className="mb-3 text-base font-semibold text-blue-700 dark:text-blue-300">Subscription Pack Status</h6>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <div className="text-xs text-gray-600 dark:text-gray-400">Pack</div>
                                                    <div className="text-lg font-bold">{order.packName}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-600 dark:text-gray-400">Items Used</div>
                                                    <div className="text-lg font-bold">
                                                        {packProgress.totalItems} / {packProgress.packLimit}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-600 dark:text-gray-400">Pickup #</div>
                                                    <div className="text-lg font-bold">{packProgress.pickupNumber}</div>
                                                </div>
                                            </div>
                                            <div className="mt-3">
                                                <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                                                    <div
                                                        className="h-2 rounded-full bg-blue-600 transition-all"
                                                        style={{ width: `${Math.min((packProgress.totalItems / packProgress.packLimit) * 100, 100)}%` }}
                                                    />
                                                </div>
                                                <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                                    {Math.round((packProgress.totalItems / packProgress.packLimit) * 100)}% of pack limit used
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Pickup Orders (for subscription master records) */}
                                    {order.type === 'subscription' && !order.pickupNumber && (
                                        <div className="mb-6 rounded-md bg-purple-50 p-4 dark:bg-purple-900/20">
                                            <h6 className="mb-3 text-base font-semibold text-purple-700 dark:text-purple-300">Pickup Schedule</h6>
                                            {pickupOrders?.data?.length ? (
                                                <div className="space-y-3">
                                                    {pickupOrders.data.map((pickup) => (
                                                        <div key={pickup._id} className="rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <div className="font-medium">Pickup #{pickup.pickupNumber}</div>
                                                                    <div className="text-xs text-gray-500">
                                                                        {new Date(pickup.pickup.date).toLocaleDateString()} - {pickup.orderId}
                                                                    </div>
                                                                </div>
                                                                <div className={`rounded-full px-2.5 py-1 text-xs font-medium text-white bg-${getStatusConfig(pickup.status).color}-500`}>
                                                                    {getStatusConfig(pickup.status).label}
                                                                </div>
                                                            </div>
                                                            <div className="mt-2 text-sm">
                                                                <div>
                                                                    <span className="font-medium">Items:</span>{' '}
                                                                    {pickup.items.map((item, idx) => (
                                                                        <span key={`${item.name}-${idx}`}>
                                                                            {item.quantity} {item.name}
                                                                            {idx !== pickup.items.length - 1 ? ', ' : ''}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-gray-500">No pickup orders found</div>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                        {/* Order Information */}
                                        <div className="space-y-4">
                                            <div>
                                                <h6 className="mb-3 text-base font-semibold">Order Information</h6>
                                                <div className="space-y-2 rounded-md bg-gray-50 p-4 dark:bg-gray-800">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">Order ID:</span>
                                                        <span className="font-semibold">{order.orderId}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">Type:</span>
                                                        <span className="font-medium">{order.type === 'subscription' ? order.packName || 'Subscription' : 'Libre Service'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">Total Price:</span>
                                                        <span className="text-lg font-bold text-primary">{order.totalPrice.toLocaleString()} CFA</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">Created:</span>
                                                        <span>{new Date(order.createdAt).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Customer Information */}
                                            <div>
                                                <h6 className="mb-3 text-base font-semibold">Customer Information</h6>
                                                <div className="space-y-2 rounded-md bg-gray-50 p-4 dark:bg-gray-800">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">Name:</span>
                                                        <span className="font-semibold">{order.customerId?.name || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">Customer ID:</span>
                                                        <span>{order.customerId?.customerId || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">Location:</span>
                                                        <span>{order.customerId?.location || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Pickup & Delivery */}
                                        <div className="space-y-4">
                                            <div>
                                                <h6 className="mb-3 text-base font-semibold">Pickup Information</h6>
                                                <div className="space-y-2 rounded-md bg-gray-50 p-4 dark:bg-gray-800">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">Date:</span>
                                                        <span className="font-medium">{new Date(order.pickup.date).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">City:</span>
                                                        <span>{order.pickup.city}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-600 dark:text-gray-400">Address:</span>
                                                        <p className="mt-1 text-sm">{order.pickup.address}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <h6 className="mb-3 text-base font-semibold">Delivery Information</h6>
                                                <div className="space-y-2 rounded-md bg-gray-50 p-4 dark:bg-gray-800">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">Date:</span>
                                                        <span className="font-medium">{new Date(order.delivery.date).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 dark:text-gray-400">City:</span>
                                                        <span>{order.delivery.city}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-600 dark:text-gray-400">Address:</span>
                                                        <p className="mt-1 text-sm">{order.delivery.address}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Items List */}
                                    <div className="mt-6">
                                        <h6 className="mb-3 text-base font-semibold">Items ({order.items.length})</h6>
                                        <div className="overflow-x-auto">
                                            <table className="w-full table-auto">
                                                <thead>
                                                    <tr className="bg-gray-100 dark:bg-gray-800">
                                                        <th className="px-4 py-2 text-left">Item</th>
                                                        <th className="px-4 py-2 text-center">Quantity</th>
                                                        <th className="px-4 py-2 text-center">Category</th>
                                                        <th className="px-4 py-2 text-right">Unit Price</th>
                                                        <th className="px-4 py-2 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {order.items.map((item, index) => (
                                                        <tr key={index} className="border-b dark:border-gray-700">
                                                            <td className="px-4 py-2">{item.name}</td>
                                                            <td className="px-4 py-2 text-center">{item.quantity}</td>
                                                            <td className="px-4 py-2 text-center">
                                                                <span className={`badge ${item.category === 'special' ? 'badge-outline-warning' : 'badge-outline-secondary'}`}>{item.category}</span>
                                                            </td>
                                                            <td className="px-4 py-2 text-right">{item.unitPrice.toLocaleString()} CFA</td>
                                                            <td className="px-4 py-2 text-right font-semibold">{(item.quantity * item.unitPrice).toLocaleString()} CFA</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Update Status Section */}
                                    <div className="mt-6 rounded-md border border-primary p-4">
                                        <h6 className="mb-3 text-base font-semibold">Update Order Status</h6>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="form-label">Nouveau Statut</label>
                                                <select className="form-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}>
                                                    <option value="pending">En attente</option>
                                                    <option value="registered">Enregistrement</option>
                                                    <option value="processing">En traitement</option>
                                                    <option value="ready_for_delivery">Prêt pour livraison</option>
                                                    <option value="out_for_delivery">En cours de livraison</option>
                                                    <option value="not_delivered">Pas livré</option>
                                                    <option value="delivered">Livré</option>
                                                    <option value="returned">Retourné</option>
                                                    <option value="cancelled">Annulé</option>
                                                </select>
                                            </div>

                                            {/* Item count inputs for "registered" status */}
                                            {selectedStatus === 'registered' && order.status !== 'registered' && (
                                                <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-900/20">
                                                    <p className="mb-3 text-sm font-medium text-blue-700 dark:text-blue-300">Indiquez combien d&apos;articles ont été reçus :</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="form-label text-xs">Ordinary Items</label>
                                                            <input
                                                                type="number"
                                                                className="form-input"
                                                                min="0"
                                                                value={receivedItemCount}
                                                                onChange={(e) => setReceivedItemCount(parseInt(e.target.value) || 0)}
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="form-label text-xs">Special Items</label>
                                                            <input
                                                                type="number"
                                                                className="form-input"
                                                                min="0"
                                                                value={receivedSpecialCount}
                                                                onChange={(e) => setReceivedSpecialCount(parseInt(e.target.value) || 0)}
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    </div>
                                                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                                        Total received: <strong>{receivedItemCount + receivedSpecialCount}</strong> items
                                                    </p>
                                                </div>
                                            )}

                                            <div>
                                                <label className="form-label">Note (optional)</label>
                                                <textarea
                                                    className="form-textarea"
                                                    rows={3}
                                                    placeholder="Add a note about this status change..."
                                                    value={note}
                                                    onChange={(e) => setNote(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-end gap-3 border-t border-[#e0e6ed] p-5 dark:border-[#1b2e4b]">
                                    <button type="button" className="btn btn-outline-danger" onClick={onClose}>
                                        Cancel
                                    </button>
                                    <button type="button" className="btn btn-primary" onClick={handleSave} disabled={updateMutation.isPending}>
                                        <IconSave className="h-5 w-5 ltr:mr-2 rtl:ml-2" />
                                        {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default OrderDetailsModal;
