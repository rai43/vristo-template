'use client';
import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Select from 'react-select';
import Swal from 'sweetalert2';
import IconX from '@/components/icon/icon-x';
import IconSave from '@/components/icon/icon-save';
import IconPlus from '@/components/icon/icon-plus';
import IconTrash from '@/components/icon/icon-trash';
import IconCalendar from '@/components/icon/icon-calendar';
import { createOrder, getPacks, type OrderType, type Pack } from '@/lib/api/orders';
import { getCustomers } from '@/lib/api/clients';

interface CreateOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateOrderModal = ({ isOpen, onClose }: CreateOrderModalProps) => {
    const queryClient = useQueryClient();

    // Form state
    const [orderType, setOrderType] = useState<OrderType>('a-la-carte');
    const [customerId, setCustomerId] = useState('');
    const [note, setNote] = useState('');

    // À-la-carte fields
    const [pickupDate, setPickupDate] = useState('');
    const [pickupAddress, setPickupAddress] = useState('');
    const [pickupCity, setPickupCity] = useState('Cocody');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliveryCity, setDeliveryCity] = useState('Cocody');
    const [items, setItems] = useState<
        Array<{
            name: string;
            quantity: number;
            category: 'ordinary' | 'special' | 'couette' | 'drap' | 'serviette' | 'veste';
            unitPrice: number;
        }>
    >([
        {
            name: '',
            quantity: 1,
            category: 'ordinary',
            unitPrice: 400,
        },
    ]);

    // Subscription-specific fields
    const [packName, setPackName] = useState('');
    const [addOnPickups, setAddOnPickups] = useState(0); // 0, 1, or 2
    const [subscriptionStartDate, setSubscriptionStartDate] = useState(new Date().toISOString().slice(0, 10)); // Default: today
    const [subscriptionEndDate, setSubscriptionEndDate] = useState('');
    const [pickupSchedule, setPickupSchedule] = useState<Array<{ date: string; address: string; city: string }>>([
        { date: '', address: 'Default Address', city: 'Cocody' },
        { date: '', address: 'Default Address', city: 'Cocody' },
    ]);
    const [deliverySchedule, setDeliverySchedule] = useState<Array<{ date: string; address: string; city: string }>>([
        { date: '', address: 'Default Address', city: 'Cocody' },
        { date: '', address: 'Default Address', city: 'Cocody' },
    ]);

    // Special items tracking for subscriptions
    const [specialItems, setSpecialItems] = useState({
        drapsEtServiettes: 0,
        couettes: 0,
        vestes: 0,
    });

    // Fetch customers
    const { data: customersData } = useQuery({
        queryKey: ['customers'],
        queryFn: () => getCustomers({ limit: 100 }),
        enabled: isOpen,
    });

    // Fetch packs
    const { data: packsData } = useQuery({
        queryKey: ['packs'],
        queryFn: () => getPacks(),
        enabled: isOpen && orderType === 'subscription',
    });

    const customers = customersData?.data.data || [];
    const packs = packsData?.data || [];

    // Calculate delivery date excluding Sundays (business days only)
    const calculateDeliveryDate = (pickupDate: string, businessDays: number = 6): string => {
        if (!pickupDate) return '';

        const startDate = new Date(pickupDate);
        let daysAdded = 0;
        let currentDate = new Date(startDate);

        while (daysAdded < businessDays) {
            currentDate.setDate(currentDate.getDate() + 1);
            // Skip Sundays (0 = Sunday) - business days only
            if (currentDate.getDay() !== 0) {
                daysAdded++;
            }
        }

        // Format as datetime-local
        return currentDate.toISOString().slice(0, 16);
    };

    // Add business days to a date (excluding Sundays)
    const addBusinessDays = (startDate: Date, days: number): Date => {
        let daysAdded = 0;
        let currentDate = new Date(startDate);

        while (daysAdded < days) {
            currentDate.setDate(currentDate.getDate() + 1);
            if (currentDate.getDay() !== 0) {
                daysAdded++;
            }
        }

        return currentDate;
    };

    // Add calendar days (may include Sundays for pickup spacing)
    const addCalendarDays = (startDate: Date, days: number): Date => {
        const result = new Date(startDate);
        result.setDate(result.getDate() + days);
        return result;
    };

    // Auto-calculate delivery date when pickup date changes for subscriptions
    useEffect(() => {
        if (orderType === 'subscription' && packName && pickupDate && packs.length > 0) {
            const selectedPack = packs.find((p: Pack) => p.code === packName);
            if (selectedPack) {
                const expectedDelivery = calculateDeliveryDate(pickupDate, selectedPack.delayDays);
                setDeliveryDate(expectedDelivery);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pickupDate, packName, orderType]);

    // Create mutation
    const createMutation = useMutation({
        mutationFn: createOrder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            Swal.fire({
                icon: 'success',
                title: 'Created!',
                text: 'Order has been created successfully.',
                timer: 2000,
                showConfirmButton: false,
            });
            onClose();
            resetForm();
        },
        onError: (error: any) => {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.response?.data?.message || 'Failed to create order',
            });
        },
    });

    const resetForm = () => {
        setOrderType('a-la-carte');
        setCustomerId('');
        setNote('');
        // À-la-carte
        setPickupDate('');
        setPickupAddress('');
        setPickupCity('Cocody');
        setDeliveryDate('');
        setDeliveryAddress('');
        setDeliveryCity('Cocody');
        setItems([{ name: '', quantity: 1, category: 'ordinary', unitPrice: 400 }]);
        // Subscription
        setPackName('');
        setAddOnPickups(0);
        setSubscriptionStartDate(new Date().toISOString().slice(0, 10));
        setSubscriptionEndDate('');
        setPickupSchedule([
            { date: '', address: 'Default Address', city: 'Cocody' },
            { date: '', address: 'Default Address', city: 'Cocody' },
        ]);
        setDeliverySchedule([
            { date: '', address: 'Default Address', city: 'Cocody' },
            { date: '', address: 'Default Address', city: 'Cocody' },
        ]);
        setSpecialItems({ drapsEtServiettes: 0, couettes: 0, vestes: 0 });
    };

    // Set default special items when pack changes
    useEffect(() => {
        if (packName === 'ÉCLAT' || packName === 'ECLAT') {
            setSpecialItems({ drapsEtServiettes: 11, couettes: 1, vestes: 3 });
        } else if (packName === 'PRESTIGE') {
            setSpecialItems({ drapsEtServiettes: 18, couettes: 2, vestes: 5 });
        }
    }, [packName]);

    // Calculate total pickups based on pack and add-ons
    const getTotalPickups = () => {
        if (!packName) return 2; // Default: 2 base pickups
        // Base: 2 pickups + add-ons
        return 2 + addOnPickups;
    };

    // Get pack add-on details
    const getAddOnInfo = () => {
        if (!packName || addOnPickups === 0) return null;

        if (packName === 'ÉCLAT' || packName === 'ECLAT') {
            // Base: 100 items (15 special: 1 couette, 3 vestes, 11 draps/serviettes)
            if (addOnPickups === 1)
                return {
                    price: 5000,
                    items: 20,
                    total: 120,
                    itemsPerPickup: 40, // 120 / 3 pickups
                    specialNote: 'Special items remain: 1 couette, 3 vestes, 11 draps/serviettes',
                };
            if (addOnPickups === 2)
                return {
                    price: 10000,
                    items: 40,
                    total: 140,
                    itemsPerPickup: 35, // 140 / 4 pickups
                    specialNote: 'Special items remain: 1 couette, 3 vestes, 11 draps/serviettes',
                };
        }

        if (packName === 'PRESTIGE') {
            // Base: 200 items (25 special: 2 couettes, 5 vestes, 18 draps/serviettes)
            if (addOnPickups === 1)
                return {
                    price: 5000,
                    items: 10,
                    total: 210,
                    itemsPerPickup: 70, // 210 / 3 pickups
                    specialNote: 'Special items remain: 2 couettes, 5 vestes, 18 draps/serviettes',
                };
            if (addOnPickups === 2)
                return {
                    price: 10000,
                    items: 20,
                    total: 220,
                    itemsPerPickup: 55, // 220 / 4 pickups
                    specialNote: 'Special items remain: 2 couettes, 5 vestes, 18 draps/serviettes',
                };
        }

        return null;
    };

    // Get pickup spacing based on add-ons
    const getPickupSpacing = (): number => {
        if (addOnPickups === 0) return 14; // Base: 14 days between pickups
        if (addOnPickups === 1) return 10; // +1: every 10 days
        if (addOnPickups === 2) return 7; // +2: every 7 days
        return 14;
    };

    // Auto-generate pickup/delivery schedule when subscription details change
    useEffect(() => {
        if (orderType === 'subscription' && subscriptionStartDate && packName) {
            const totalPickups = getTotalPickups();
            const startDate = new Date(subscriptionStartDate);

            const newPickupSchedule: Array<{ date: string; address: string; city: string }> = [];
            const newDeliverySchedule: Array<{ date: string; address: string; city: string }> = [];

            for (let i = 0; i < totalPickups; i++) {
                let pickupDate: Date;

                if (i === 0) {
                    // Pickup 1: Start date
                    pickupDate = new Date(startDate);
                } else {
                    // Subsequent pickups: spaced according to rules
                    if (addOnPickups === 0) {
                        // Base: Pickup 2 = Pickup 1 + 14 days
                        pickupDate = addCalendarDays(startDate, 14);
                    } else if (addOnPickups === 1) {
                        // +1: pickups spaced every 10 days
                        pickupDate = addCalendarDays(startDate, 10 * i);
                    } else if (addOnPickups === 2) {
                        // +2: pickups spaced every 7 days
                        pickupDate = addCalendarDays(startDate, 7 * i);
                    } else {
                        pickupDate = addCalendarDays(startDate, 14 * i);
                    }
                }

                // Calculate delivery date: pickup + 6 business days (excluding Sundays)
                const deliveryDate = addBusinessDays(pickupDate, 6);

                newPickupSchedule.push({
                    date: pickupDate.toISOString().slice(0, 16),
                    address: pickupSchedule[i]?.address || 'Default Address',
                    city: pickupSchedule[i]?.city || 'Cocody',
                });

                newDeliverySchedule.push({
                    date: deliveryDate.toISOString().slice(0, 16),
                    address: deliverySchedule[i]?.address || 'Default Address',
                    city: deliverySchedule[i]?.city || 'Cocody',
                });
            }

            setPickupSchedule(newPickupSchedule);
            setDeliverySchedule(newDeliverySchedule);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [packName, addOnPickups, subscriptionStartDate, orderType]);

    // Auto-set subscription end date (1 month from start)
    useEffect(() => {
        if (subscriptionStartDate) {
            const start = new Date(subscriptionStartDate);
            const end = new Date(start);
            end.setMonth(end.getMonth() + 1);
            setSubscriptionEndDate(end.toISOString().slice(0, 10));
        }
    }, [subscriptionStartDate]);

    const updatePickupSchedule = (index: number, field: string, value: string) => {
        const newSchedule = [...pickupSchedule];
        (newSchedule[index] as any)[field] = value;
        setPickupSchedule(newSchedule);

        // Auto-calculate delivery date for this pickup
        if (field === 'date' && value && packName) {
            const selectedPack = packs.find((p: Pack) => p.code === packName);
            if (selectedPack) {
                const deliveryDate = calculateDeliveryDate(value, selectedPack.delayDays);
                const newDeliverySchedule = [...deliverySchedule];
                newDeliverySchedule[index] = {
                    ...newDeliverySchedule[index],
                    date: deliveryDate,
                    address: newSchedule[index].address,
                    city: newSchedule[index].city,
                };
                setDeliverySchedule(newDeliverySchedule);
            }
        }
    };

    const updateDeliverySchedule = (index: number, field: string, value: string) => {
        const newSchedule = [...deliverySchedule];
        (newSchedule[index] as any)[field] = value;
        setDeliverySchedule(newSchedule);
    };

    const addItem = () => {
        setItems([
            ...items,
            {
                name: '',
                quantity: 1,
                category: 'ordinary',
                unitPrice: orderType === 'subscription' ? 200 : 400,
            },
        ]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;

        // Auto-update category when item name changes
        if (field === 'name' && value) {
            const selectedItem = itemTypeOptions.find((item) => item.value === value);
            if (selectedItem) {
                newItems[index].category = selectedItem.category;
            }
        }

        setItems(newItems);
    };

    const handleSubmit = () => {
        // Validation
        if (!customerId) {
            Swal.fire({ icon: 'warning', title: 'Missing Customer', text: 'Please select a customer' });
            return;
        }

        if (orderType === 'a-la-carte') {
            // À-la-carte validation
            if (!pickupDate || !pickupAddress || !deliveryDate || !deliveryAddress) {
                Swal.fire({ icon: 'warning', title: 'Missing Information', text: 'Please fill in pickup and delivery details' });
                return;
            }

            const validItems = items.filter((item) => item.name && item.quantity > 0);
            if (validItems.length === 0) {
                Swal.fire({ icon: 'warning', title: 'Missing Items', text: 'Please add at least one item' });
                return;
            }

            const orderData = {
                customerId,
                type: orderType,
                items: validItems,
                pickup: {
                    date: new Date(pickupDate).toISOString(),
                    address: pickupAddress,
                    city: pickupCity,
                },
                delivery: {
                    date: new Date(deliveryDate).toISOString(),
                    address: deliveryAddress,
                    city: deliveryCity,
                },
                note: note || 'À-la-carte order created',
            };

            createMutation.mutate(orderData);
        } else {
            // Subscription validation
            if (!packName) {
                Swal.fire({ icon: 'warning', title: 'Missing Pack', text: 'Please select a pack' });
                return;
            }
            if (!subscriptionStartDate || !subscriptionEndDate) {
                Swal.fire({ icon: 'warning', title: 'Missing Dates', text: 'Please set subscription period' });
                return;
            }

            const invalidPickup = pickupSchedule.find((p) => !p.date || !p.address);
            if (invalidPickup) {
                Swal.fire({ icon: 'warning', title: 'Incomplete Schedule', text: 'Please complete all pickup dates and addresses' });
                return;
            }

            const invalidDelivery = deliverySchedule.find((d) => !d.date || !d.address);
            if (invalidDelivery) {
                Swal.fire({ icon: 'warning', title: 'Incomplete Schedule', text: 'Please complete all delivery addresses' });
                return;
            }

            const addOnInfo = getAddOnInfo();
            const selectedPack = packs.find((p: Pack) => p.code === packName);
            const spacing = getPickupSpacing();

            let subscriptionNote = note || '';
            subscriptionNote += `\n🎯 Subscription: ${packName} Pack`;
            subscriptionNote += `\n📅 Period: ${new Date(subscriptionStartDate).toLocaleDateString()} - ${new Date(subscriptionEndDate).toLocaleDateString()}`;
            subscriptionNote += `\n📦 Total Items: ${addOnInfo ? addOnInfo.total : packName === 'ÉCLAT' || packName === 'ECLAT' ? 100 : 200}`;

            if (addOnInfo) {
                subscriptionNote += `\n💰 Add-on: +${addOnPickups} pickup(s) (+${addOnInfo.price.toLocaleString()} FCFA, +${addOnInfo.items} ordinary items)`;
                subscriptionNote += `\n   → ${addOnInfo.total} items total (~${addOnInfo.itemsPerPickup} items/pickup)`;
                subscriptionNote += `\n   → Pickups every ${spacing} days`;
            } else {
                subscriptionNote += `\n🚚 Pickups: 2 included (every ${spacing} days, 50 items/pickup)`;
            }

            subscriptionNote += `\n📌 Special Items (fixed limits):`;
            subscriptionNote += `\n   • Draps & Serviettes: ${specialItems.drapsEtServiettes}`;
            subscriptionNote += `\n   • Couettes: ${specialItems.couettes}`;
            subscriptionNote += `\n   • Vestes: ${specialItems.vestes}`;

            subscriptionNote += `\n\n📍 Pickup Schedule:`;
            pickupSchedule.forEach((p, i) => {
                subscriptionNote += `\n  #${i + 1}: ${new Date(p.date).toLocaleDateString()} at ${p.address}, ${p.city}`;
                subscriptionNote += `\n      → Delivery: ${new Date(deliverySchedule[i].date).toLocaleDateString()} (6 business days)`;
            });

            // For subscriptions, we don't create items in the initial order
            // Items will be added when actual pickups occur
            const subscriptionItems = [
                // Add a placeholder item to satisfy backend validation
                {
                    name: 'Subscription Placeholder',
                    quantity: 1,
                    category: 'ordinary',
                    unitPrice: 0,
                },
            ];

            // Always use ECLAT without accent for backend
            const normalizedPackName = packName.toUpperCase() === 'ÉCLAT' ? 'ECLAT' : packName;

            // Create subscription master record
            const orderData = {
                customerId,
                type: orderType,
                packName: normalizedPackName,
                // No pickupNumber for the master subscription record
                items: subscriptionItems,
                // Include first pickup/delivery info
                pickup: {
                    date: new Date(pickupSchedule[0].date).toISOString(),
                    address: pickupSchedule[0].address,
                    city: pickupSchedule[0].city,
                },
                delivery: {
                    date: new Date(deliverySchedule[0].date).toISOString(),
                    address: deliverySchedule[0].address,
                    city: deliverySchedule[0].city,
                },
                // Add subscription details to note
                note: subscriptionNote + '\n\n[SUBSCRIPTION MASTER RECORD]',
                // Add subscription period
                subscriptionStartDate: new Date(subscriptionStartDate).toISOString(),
                subscriptionEndDate: new Date(subscriptionEndDate).toISOString(),
                // Include all pickup dates for backend processing
                pickupSchedule: pickupSchedule.map((p) => ({
                    date: new Date(p.date).toISOString(),
                    address: p.address,
                    city: p.city,
                })),
                deliverySchedule: deliverySchedule.map((d) => ({
                    date: new Date(d.date).toISOString(),
                    address: d.address,
                    city: d.city,
                })),
            };

            createMutation.mutate(orderData);
        }
    };

    // Item type options with categories
    const itemTypeOptions = [
        // Ordinary items
        { value: 'chemise', label: 'Chemise', category: 'ordinary' as const },
        { value: 'pantalon', label: 'Pantalon', category: 'ordinary' as const },
        { value: 'robe', label: 'Robe', category: 'ordinary' as const },
        { value: 'jupe', label: 'Jupe', category: 'ordinary' as const },
        { value: 'cintre', label: 'Cintre', category: 'ordinary' as const },

        // Special items
        { value: 'veste', label: 'Veste', category: 'special' as const },
        { value: 'couette', label: 'Couette', category: 'special' as const },
        { value: 'drap', label: 'Drap', category: 'special' as const },
        { value: 'serviette', label: 'Serviette', category: 'special' as const },
    ];

    // Customer options for react-select
    const customerOptions = customers.map((customer: any) => ({
        value: customer._id,
        label: `${customer.name} (${customer.customerId})`,
    }));

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
                            <Dialog.Panel className="panel w-full max-w-4xl overflow-hidden rounded-lg border-0 p-0 text-black dark:text-white-dark">
                                {/* Header */}
                                <div className="flex items-center justify-between bg-[#fbfbfb] px-5 py-3 dark:bg-[#121c2c]">
                                    <h5 className="text-lg font-bold">Create New Order</h5>
                                    <button type="button" className="text-white-dark hover:text-dark" onClick={onClose}>
                                        <IconX className="h-5 w-5" />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="max-h-[70vh] overflow-y-auto p-5">
                                    {/* Order Type Selection */}
                                    <div className="mb-6 flex gap-2">
                                        <button
                                            type="button"
                                            className={`flex-1 rounded-lg px-4 py-3 font-semibold transition-all ${
                                                orderType === 'a-la-carte' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                                            }`}
                                            onClick={() => setOrderType('a-la-carte')}
                                        >
                                            🛍️ Libre Service
                                        </button>
                                        <button
                                            type="button"
                                            className={`flex-1 rounded-lg px-4 py-3 font-semibold transition-all ${
                                                orderType === 'subscription' ? 'bg-primary text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                                            }`}
                                            onClick={() => setOrderType('subscription')}
                                        >
                                            📦 Subscription
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Customer Selection (Common) */}
                                        <div>
                                            <label className="form-label">Customer *</label>
                                            <Select
                                                placeholder="Search customer by name or ID..."
                                                options={customerOptions}
                                                isSearchable={true}
                                                value={customerOptions.find((opt: any) => opt.value === customerId)}
                                                onChange={(option: any) => setCustomerId(option?.value || '')}
                                                className="react-select-container"
                                                classNamePrefix="react-select"
                                            />
                                        </div>

                                        {/* À-LA-CARTE FLOW */}
                                        {orderType === 'a-la-carte' && (
                                            <>
                                                {/* Items */}
                                                <div>
                                                    <div className="mb-3 flex items-center justify-between">
                                                        <label className="form-label">Items *</label>
                                                        <button type="button" className="btn btn-sm btn-primary" onClick={addItem}>
                                                            <IconPlus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                                                            Add Item
                                                        </button>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {items.map((item, index) => (
                                                            <div key={index} className="flex gap-2 rounded-md border p-3">
                                                                <div className="grid flex-1 grid-cols-4 gap-2">
                                                                    <select
                                                                        className="form-select"
                                                                        value={item.name}
                                                                        onChange={(e) => {
                                                                            const selectedOption = itemTypeOptions.find((opt) => opt.value === e.target.value);
                                                                            updateItem(index, 'name', e.target.value);
                                                                            if (selectedOption) {
                                                                                updateItem(index, 'category', selectedOption.category);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <option value="">Select Item</option>
                                                                        <optgroup label="Ordinary Items">
                                                                            <option value="chemise">Chemise</option>
                                                                            <option value="pantalon">Pantalon</option>
                                                                            <option value="robe">Robe</option>
                                                                            <option value="jupe">Jupe</option>
                                                                            <option value="cintre">Cintre</option>
                                                                        </optgroup>
                                                                        <optgroup label="Special Items">
                                                                            <option value="veste">Veste</option>
                                                                            <option value="couette">Couette</option>
                                                                            <option value="drap">Drap</option>
                                                                            <option value="serviette">Serviette</option>
                                                                        </optgroup>
                                                                    </select>
                                                                    <input
                                                                        type="number"
                                                                        className="form-input"
                                                                        placeholder="Qty"
                                                                        min="1"
                                                                        value={item.quantity}
                                                                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                                                    />
                                                                    <div className="form-input flex items-center bg-gray-50 px-2 text-sm">
                                                                        <span className={`badge ${item.category === 'ordinary' ? 'badge-outline-secondary' : 'badge-outline-warning'}`}>
                                                                            {item.category === 'ordinary' ? 'Ordinary' : 'Special'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="relative">
                                                                        <input
                                                                            type="number"
                                                                            className="form-input"
                                                                            placeholder="Unit Price"
                                                                            min="0"
                                                                            value={item.unitPrice}
                                                                            onChange={(e) => updateItem(index, 'unitPrice', parseInt(e.target.value) || 0)}
                                                                        />
                                                                        <div className="mt-1 text-xs text-gray-500">
                                                                            Total: {(item.quantity * item.unitPrice).toLocaleString()} FCFA
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeItem(index)} disabled={items.length === 1}>
                                                                    <IconTrash className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Pickup Information */}
                                                <div>
                                                    <h6 className="mb-3 text-base font-semibold">Pickup Information</h6>
                                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                                                        <div>
                                                            <label className="form-label">Pickup Date *</label>
                                                            <input type="datetime-local" className="form-input" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
                                                        </div>
                                                        <div>
                                                            <label className="form-label">City *</label>
                                                            <select className="form-select" value={pickupCity} onChange={(e) => setPickupCity(e.target.value)}>
                                                                <option value="Cocody">Cocody</option>
                                                                <option value="Bingerville">Bingerville</option>
                                                                <option value="Yopougon">Yopougon</option>
                                                                <option value="Koumassi">Koumassi</option>
                                                                <option value="Marcory">Marcory</option>
                                                                <option value="Adjamé">Adjamé</option>
                                                                <option value="Abobo">Abobo</option>
                                                            </select>
                                                        </div>
                                                        <div className="lg:col-span-1">
                                                            <label className="form-label">Address *</label>
                                                            <input
                                                                type="text"
                                                                className="form-input"
                                                                placeholder="Pickup address"
                                                                value={pickupAddress}
                                                                onChange={(e) => setPickupAddress(e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Delivery Information */}
                                                <div>
                                                    <h6 className="mb-3 text-base font-semibold">Delivery Information</h6>
                                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                                                        <div>
                                                            <label className="form-label">Delivery Date *</label>
                                                            <input type="datetime-local" className="form-input" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                                                        </div>
                                                        <div>
                                                            <label className="form-label">City *</label>
                                                            <select className="form-select" value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)}>
                                                                <option value="Cocody">Cocody</option>
                                                                <option value="Bingerville">Bingerville</option>
                                                                <option value="Yopougon">Yopougon</option>
                                                                <option value="Koumassi">Koumassi</option>
                                                                <option value="Marcory">Marcory</option>
                                                                <option value="Adjamé">Adjamé</option>
                                                                <option value="Abobo">Abobo</option>
                                                            </select>
                                                        </div>
                                                        <div className="lg:col-span-1">
                                                            <label className="form-label">Address *</label>
                                                            <input
                                                                type="text"
                                                                className="form-input"
                                                                placeholder="Delivery address"
                                                                value={deliveryAddress}
                                                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* SUBSCRIPTION FLOW */}
                                        {orderType === 'subscription' && (
                                            <>
                                                {/* Pack & Add-ons */}
                                                <div className="rounded-lg bg-primary/5 p-4 dark:bg-primary/10">
                                                    <h6 className="mb-3 text-base font-semibold">Pack Selection</h6>
                                                    <div className="grid gap-4 md:grid-cols-2">
                                                        <div>
                                                            <label className="form-label">Pack *</label>
                                                            <select className="form-select" value={packName} onChange={(e) => setPackName(e.target.value)}>
                                                                <option value="">Select Pack</option>
                                                                {packs.map((pack: Pack) => (
                                                                    <option key={pack.code} value={pack.code}>
                                                                        {pack.code} - {pack.price.toLocaleString()} CFA ({pack.limit} items)
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="form-label">Add-on Pickups</label>
                                                            <select className="form-select" value={addOnPickups} onChange={(e) => setAddOnPickups(Number(e.target.value))}>
                                                                <option value={0}>No Add-on</option>
                                                                <option value={1}>+1 Pickup</option>
                                                                <option value={2}>+2 Pickups</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    {getAddOnInfo() && (
                                                        <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
                                                            <div className="font-semibold">
                                                                💰 Add-on: +{getAddOnInfo()?.price.toLocaleString()} FCFA | +{getAddOnInfo()?.items} ordinary items →{' '}
                                                                <strong>{getAddOnInfo()?.total} items total</strong> (~{getAddOnInfo()?.itemsPerPickup} items/pickup)
                                                            </div>
                                                            <div className="mt-1 text-xs">📌 {getAddOnInfo()?.specialNote}</div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Subscription Period */}
                                                <div className="grid gap-4 md:grid-cols-2">
                                                    <div>
                                                        <label className="form-label">Start Date *</label>
                                                        <input type="date" className="form-input" value={subscriptionStartDate} onChange={(e) => setSubscriptionStartDate(e.target.value)} />
                                                    </div>
                                                    <div>
                                                        <label className="form-label">End Date (auto)</label>
                                                        <input type="date" className="form-input" value={subscriptionEndDate} readOnly />
                                                    </div>
                                                </div>

                                                {/* Special Items (Pack Limits) */}
                                                {packName && (
                                                    <div className="rounded-md bg-amber-50 p-4 dark:bg-amber-900/20">
                                                        <h6 className="mb-3 text-sm font-semibold text-amber-700 dark:text-amber-300">⚠️ Special Items Limit (Does NOT increase with add-ons)</h6>
                                                        <div className="grid gap-3 md:grid-cols-3">
                                                            <div>
                                                                <label className="form-label text-xs">Draps & Serviettes</label>
                                                                <input
                                                                    type="number"
                                                                    className="form-input"
                                                                    min="0"
                                                                    value={specialItems.drapsEtServiettes}
                                                                    onChange={(e) => setSpecialItems({ ...specialItems, drapsEtServiettes: parseInt(e.target.value) || 0 })}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="form-label text-xs">Couettes</label>
                                                                <input
                                                                    type="number"
                                                                    className="form-input"
                                                                    min="0"
                                                                    value={specialItems.couettes}
                                                                    onChange={(e) => setSpecialItems({ ...specialItems, couettes: parseInt(e.target.value) || 0 })}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="form-label text-xs">Vestes</label>
                                                                <input
                                                                    type="number"
                                                                    className="form-input"
                                                                    min="0"
                                                                    value={specialItems.vestes}
                                                                    onChange={(e) => setSpecialItems({ ...specialItems, vestes: parseInt(e.target.value) || 0 })}
                                                                />
                                                            </div>
                                                        </div>
                                                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                                            📋 Default limits set by pack. These items do NOT increase when you add pickups.
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Pickup Schedule */}
                                                {pickupSchedule.length > 0 && (
                                                    <div>
                                                        <h6 className="mb-3 flex items-center gap-2 text-base font-semibold">
                                                            <IconCalendar className="h-5 w-5" />
                                                            Pickup & Delivery Schedule ({pickupSchedule.length} pickups)
                                                        </h6>
                                                        <div className="space-y-4">
                                                            {pickupSchedule.map((pickup, index) => (
                                                                <div key={index} className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                                                                    <div className="mb-3 font-semibold text-primary">Pickup #{index + 1}</div>
                                                                    <div className="grid gap-3 md:grid-cols-3">
                                                                        <div>
                                                                            <label className="form-label text-xs">Pickup Date *</label>
                                                                            <input
                                                                                type="datetime-local"
                                                                                className="form-input"
                                                                                value={pickup.date}
                                                                                onChange={(e) => updatePickupSchedule(index, 'date', e.target.value)}
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="form-label text-xs">City *</label>
                                                                            <select className="form-select" value={pickup.city} onChange={(e) => updatePickupSchedule(index, 'city', e.target.value)}>
                                                                                <option value="Cocody">Cocody</option>
                                                                                <option value="Bingerville">Bingerville</option>
                                                                                <option value="Yopougon">Yopougon</option>
                                                                                <option value="Koumassi">Koumassi</option>
                                                                                <option value="Marcory">Marcory</option>
                                                                                <option value="Adjamé">Adjamé</option>
                                                                                <option value="Abobo">Abobo</option>
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <label className="form-label text-xs">Address *</label>
                                                                            <input
                                                                                type="text"
                                                                                className="form-input"
                                                                                placeholder="Pickup address"
                                                                                value={pickup.address}
                                                                                onChange={(e) => updatePickupSchedule(index, 'address', e.target.value)}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div className="mt-3 border-t border-primary/20 pt-3">
                                                                        <div className="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">Expected Delivery</div>
                                                                        <div className="grid gap-3 md:grid-cols-3">
                                                                            <div>
                                                                                <input type="datetime-local" className="form-input bg-gray-50" value={deliverySchedule[index]?.date || ''} readOnly />
                                                                                <p className="mt-1 text-xs text-gray-500">Auto-calculated (no Sundays)</p>
                                                                            </div>
                                                                            <div>
                                                                                <select
                                                                                    className="form-select"
                                                                                    value={deliverySchedule[index]?.city || pickup.city}
                                                                                    onChange={(e) => updateDeliverySchedule(index, 'city', e.target.value)}
                                                                                >
                                                                                    <option value="Cocody">Cocody</option>
                                                                                    <option value="Bingerville">Bingerville</option>
                                                                                    <option value="Yopougon">Yopougon</option>
                                                                                    <option value="Koumassi">Koumassi</option>
                                                                                    <option value="Marcory">Marcory</option>
                                                                                    <option value="Adjamé">Adjamé</option>
                                                                                    <option value="Abobo">Abobo</option>
                                                                                </select>
                                                                            </div>
                                                                            <div>
                                                                                <input
                                                                                    type="text"
                                                                                    className="form-input"
                                                                                    placeholder="Delivery address"
                                                                                    value={deliverySchedule[index]?.address || pickup.address}
                                                                                    onChange={(e) => updateDeliverySchedule(index, 'address', e.target.value)}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* Note (Common for both) */}
                                        <div>
                                            <label className="form-label">Notes</label>
                                            <textarea className="form-textarea" rows={3} placeholder="Additional notes..." value={note} onChange={(e) => setNote(e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-end gap-3 border-t border-[#e0e6ed] p-5 dark:border-[#1b2e4b]">
                                    <button type="button" className="btn btn-outline-danger" onClick={onClose}>
                                        Cancel
                                    </button>
                                    <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={createMutation.isPending}>
                                        <IconSave className="h-5 w-5 ltr:mr-2 rtl:ml-2" />
                                        {createMutation.isPending ? 'Creating...' : 'Create Order'}
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

export default CreateOrderModal;
