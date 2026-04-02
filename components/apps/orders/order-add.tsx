'use client';
import IconSave from '@/components/icon/icon-save';
import IconUserPlus from '@/components/icon/icon-user-plus';
import IconX from '@/components/icon/icon-x';
import NewCustomerModal from '@/components/common/NewCustomerModal';
import Image from 'next/image';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Customer, getCustomer, getCustomers } from '@/lib/api/clients';
import { createOrder } from '@/lib/api/orders';
import { getPacks, Pack } from '@/lib/api/packs';
import { getPriceCatalogItems, PriceCatalogItem } from '@/lib/api/price-catalog';
import { getActiveZones, Zone } from '@/lib/api/zones';
import { ADD_ONS, WHITE_SURCHARGE } from '@/lib/order-constants';

// import IconDownload from '@/components/icon/icon-download';
// import IconEye from '@/components/icon/icon-eye';
// import IconSend from '@/components/icon/icon-send';
// import Link from 'next/link';

const OrderAdd = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();

    // Lead conversion prefill
    const fromLeadId = searchParams.get('fromLead');
    const prefillClientId = searchParams.get('clientId');
    const prefillPack = searchParams.get('packChoice');
    const prefillZone = searchParams.get('zone');
    const prefillAddOn = searchParams.get('addOnPickups');
    const prefillPickupDate = searchParams.get('pickupDate');
    const [leadPrefilled, setLeadPrefilled] = useState(false);
    const [showLeadBanner, setShowLeadBanner] = useState(!!fromLeadId);
    // const currencyList = ['USD - US Dollar', 'GBP - British Pound', 'IDR - Indonesian Rupiah', 'INR - Indian Rupee', 'BRL - Brazilian Real', 'EUR - Germany (Euro)', 'TRY - Turkish Lira'];

    // Get today's date and format it for input
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    // Business day calculation (skip Sundays only) (memoized with useCallback)
    const addBusinessDays = useCallback((startDate: Date, days: number) => {
        const result = new Date(startDate);
        let businessDaysAdded = 0;

        while (businessDaysAdded < days) {
            result.setDate(result.getDate() + 1);
            // Skip Sundays only (Sunday = 0)
            if (result.getDay() !== 0) {
                businessDaysAdded++;
            }
        }

        return result;
    }, []);

    // Calculate delivery date (5-6 business days) (memoized with useCallback)
    const calculateDeliveryDate = useCallback(
        (pickupDate: Date, isFullLoad: boolean = false) => {
            const baseDays = 6; // 5-6 business days
            const extraDays = isFullLoad ? 3 : 0; // +3 days for full load
            return addBusinessDays(pickupDate, baseDays + extraDays);
        },
        [addBusinessDays]
    );

    // Generate pickup schedule for subscription (memoized with useCallback)
    const generatePickupSchedule = useCallback(
        (start: Date, totalPickups: number) => {
            if (totalPickups <= 0) {
                setPickupSchedule([]);
                return;
            }

            const schedule = [];
            const pickupInterval = Math.floor(30 / totalPickups); // Days between pickups

            for (let i = 0; i < totalPickups; i++) {
                const pickupDate = new Date(start);
                pickupDate.setDate(pickupDate.getDate() + i * pickupInterval);

                // Skip Sundays
                while (pickupDate.getDay() === 0) {
                    pickupDate.setDate(pickupDate.getDate() + 1);
                }

                const deliveryDate = calculateDeliveryDate(pickupDate);

                schedule.push({
                    pickup: pickupDate.toISOString().split('T')[0],
                    delivery: deliveryDate.toISOString().split('T')[0],
                });
            }

            setPickupSchedule(schedule);
        },
        [calculateDeliveryDate]
    );

    // Calculate à la carte delivery date (today + 4 days)
    const calculateALaCarteDeliveryDate = () => {
        const today = new Date();
        const delivery = new Date(today);
        delivery.setDate(delivery.getDate() + 4);
        return delivery.toISOString().split('T')[0];
    };

    // Fetch packs from API (only active packs)
    const { data: rawPacksData, isLoading: isLoadingPacks } = useQuery<Pack[]>({
        queryKey: ['packs', 'active'],
        queryFn: async () => {
            const response = await getPacks(false);
            const data = response.data;
            if (!Array.isArray(data)) return [];
            return data.filter((p: Pack) => p.isActive);
        },
        staleTime: 0, // Always consider data stale to ensure fresh fetch
        retry: 3,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
        refetchOnMount: 'always', // Always refetch when component mounts
        refetchOnWindowFocus: false, // Don't refetch on window focus
    });
    const packsData: Pack[] = useMemo(() => (Array.isArray(rawPacksData) ? rawPacksData : []), [rawPacksData]);

    // Fetch price catalog items from API
    const { data: rawPriceCatalogData } = useQuery<any[]>({
        queryKey: ['priceCatalog'],
        queryFn: async () => {
            const response = await getPriceCatalogItems(false);
            return Array.isArray(response.data) ? response.data : [];
        },
        staleTime: 0,
        retry: 3,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
        refetchOnMount: 'always',
        refetchOnWindowFocus: false,
    });
    const priceCatalogData: any[] = useMemo(() => (Array.isArray(rawPriceCatalogData) ? rawPriceCatalogData : []), [rawPriceCatalogData]);

    // Fetch active zones from API
    const { data: rawZonesData } = useQuery({
        queryKey: ['zones', 'active'],
        queryFn: async () => {
            const response = await getActiveZones();
            return Array.isArray(response.data) ? response.data : [];
        },
        staleTime: 0,
        retry: 3,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
        refetchOnMount: 'always',
        refetchOnWindowFocus: false,
    });

    const zones: Zone[] = useMemo(() => (Array.isArray(rawZonesData) ? rawZonesData : []), [rawZonesData]);

    // Subscription pack configurations (from API, memoized to avoid dependency changes)
    const subscriptionPacks = useMemo(() => {
        if (packsData.length === 0) return {};

        const packs: Record<string, any> = {};
        packsData.forEach((pack: Pack) => {
            packs[pack.code] = {
                name: pack.name,
                price: pack.price,
                baseVetements: pack.vetements,
                basePickups: pack.defaultPickups,
                validityDays: pack.validityDays,
                specialArticles: {
                    couettes: pack.couettes,
                    draps_serviettes: pack.draps_serviettes,
                    vestes: pack.vestes,
                },
                total: pack.total,
            };
        });
        return packs;
    }, [packsData]);

    // Add-on configurations (from shared constants)
    const addOns = ADD_ONS;

    // À la carte item types (from API, memoized to avoid dependency changes)
    const aLaCarteItems = useMemo(() => {
        if (!priceCatalogData) return [];

        return priceCatalogData.map((item: PriceCatalogItem) => ({
            name: item.itemCode.toLowerCase().replace(/_/g, ' '),
            price: item.priceCFA,
            label: item.label,
            category: item.category as 'ordinary' | 'special' | 'custom',
        }));
    }, [priceCatalogData]);

    const [orderType, setOrderType] = useState<string>('');
    const [packType, setPackType] = useState<string>('');
    const [basePickupCount, setBasePickupCount] = useState<number>(2); // Base pickup count (1 or 2)
    const [addOnLevel, setAddOnLevel] = useState<number>(0);
    const [startDate, setStartDate] = useState<string>(todayString);
    const [endDate, setEndDate] = useState<string>('');
    const [pickupSchedule, setPickupSchedule] = useState<any[]>([]);
    const [totalPrice, setTotalPrice] = useState<number>(0);
    const [totalVetements, setTotalVetements] = useState<number>(0);
    const [totalPickups, setTotalPickups] = useState<number>(0);

    // À la carte specific states
    const [pickupDate, setPickupDate] = useState<string>(todayString);
    const [deliveryDate, setDeliveryDate] = useState<string>('');

    // Delivery zone and fee states
    const [deliveryZone, setDeliveryZone] = useState<string>('');
    const [deliveryFee, setDeliveryFee] = useState<number>(0);
    const [serviceCharge, setServiceCharge] = useState<number>(0);

    // Save states
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [saveError, setSaveError] = useState<string>('');
    const [saveSuccess, setSaveSuccess] = useState<string>('');

    // Form validation states
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // Service type state
    const [serviceType, setServiceType] = useState<string>('Wash & Iron');

    // Payment method state - default to 'Other'
    const [paymentMethod, setPaymentMethod] = useState<string>('Other');

    // Currency state
    const [currency, setCurrency] = useState<string>('FCFA');

    // Special instructions state
    const [specialInstructions, setSpecialInstructions] = useState<string>('');

    // Pickup and delivery zone states for à la carte
    const [pickupZone, setPickupZone] = useState<string>('');
    const [pickupFee, setPickupFee] = useState<number>(0);
    const [enablePickup, setEnablePickup] = useState<boolean>(false);
    const [enableDelivery, setEnableDelivery] = useState<boolean>(false);

    // Customer search states
    const [customerSearch, setCustomerSearch] = useState<string>('');
    const [customerResults, setCustomerResults] = useState<Customer[]>([]);
    const [showCustomerResults, setShowCustomerResults] = useState<boolean>(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerDetails, setCustomerDetails] = useState({
        name: '',
        email: '',
        address: '',
        phone: '',
    });

    // New customer modal state
    const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);

    // Define item type to avoid 'any' type errors
    interface OrderItem {
        id: number;
        name: string; // Backend item type (e.g., 'chemises', 'veste')
        label: string; // Display name (e.g., 'Chemises', 'Vestes')
        quantity: number;
        price: number;
        total: number;
        category: 'ordinary' | 'special' | 'add-on' | 'package' | 'custom';
        color?: 'white' | 'colored';
        serviceType?: 'Wash & Iron' | 'Iron' | 'Other';
    }

    const [items, setItems] = useState<OrderItem[]>([
        {
            id: 1,
            name: '',
            label: '',
            quantity: 1,
            price: 0,
            total: 0,
            category: 'ordinary',
            color: 'colored',
            serviceType: 'Wash & Iron',
        },
    ]);

    // Custom item modal states
    const [showCustomItemModal, setShowCustomItemModal] = useState(false);
    const [customItemName, setCustomItemName] = useState('');
    const [customItemPrice, setCustomItemPrice] = useState(0);
    const [customItemQuantity, setCustomItemQuantity] = useState(1);

    // Calculate subscription totals (memoized with useCallback)
    const calculateSubscriptionTotals = useCallback(() => {
        // Guard against empty startDate - use today as fallback
        const effectiveStartDate = startDate || todayString;
        if (!packType) return;

        const pack = subscriptionPacks[packType as keyof typeof subscriptionPacks];
        if (!pack) return;

        const addOn = addOns[addOnLevel as keyof typeof addOns];

        const newTotalVetements = pack.baseVetements + addOn.vetements;
        const newTotalPickups = basePickupCount + addOn.pickups; // Use basePickupCount instead of pack.basePickups

        const totalDeliveryFee = deliveryFee || 0; // deliveryFee represents overall delivery cost selected by user

        // Total price = pack price + add-on price + delivery fees for all pickups
        const newTotalPrice = pack.price + addOn.price + totalDeliveryFee;

        setTotalVetements(newTotalVetements);
        setTotalPickups(newTotalPickups);
        setTotalPrice(newTotalPrice);
        setServiceCharge(pack.price + addOn.price); // Service charge equals pack + add-on (without delivery)

        // Calculate end date using pack.validityDays instead of +1 month
        const start = new Date(effectiveStartDate);
        // Validate the date is valid before using it
        if (Number.isNaN(start.getTime())) {
            setEndDate('');
            setPickupSchedule([]);
            return;
        }

        const end = new Date(start);
        const validityDays = pack.validityDays || 30; // Default to 30 days if not specified
        end.setDate(end.getDate() + validityDays);
        setEndDate(end.toISOString().split('T')[0]);

        // Generate pickup schedule
        generatePickupSchedule(start, newTotalPickups);
    }, [packType, basePickupCount, addOnLevel, startDate, deliveryFee, subscriptionPacks, addOns, generatePickupSchedule, todayString]);

    // Calculate à la carte totals (memoized with useCallback)
    const calculateALaCarteTotals = useCallback(() => {
        const itemsTotal = items.reduce((sum: number, item: OrderItem) => sum + item.quantity * item.price, 0);

        // Backend only adds delivery fee if pickup address !== delivery address
        // For now, we'll add pickup and delivery fees if enabled
        const pickupTotal = enablePickup ? pickupFee : 0;
        const deliveryTotal = enableDelivery ? deliveryFee : 0;

        // Backend calculates: items total + delivery fee (if needed)
        // We're adding both pickup and delivery fees
        const total = itemsTotal + pickupTotal + deliveryTotal;

        setTotalPrice(total); // This should match backend calculation
        setServiceCharge(itemsTotal); // Service charge equals items total for à la carte
    }, [items, enablePickup, enableDelivery, pickupFee, deliveryFee]);

    // Search customers using the API
    const searchCustomers = async (query: string) => {
        if (query.length < 2) {
            setCustomerResults([]);
            setShowCustomerResults(false);
            return;
        }

        try {
            const response = await getCustomers({
                q: query,
                limit: 10,
            });

            setCustomerResults(response.data.data);
            setShowCustomerResults(true);
        } catch (error) {
            console.error('Error searching customers:', error);
            setCustomerResults([]);
            setShowCustomerResults(false);
        }
    };

    // Handle customer search input
    const handleCustomerSearch = (value: string) => {
        setCustomerSearch(value);
        searchCustomers(value);
    };

    // Select a customer from search results
    const selectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setCustomerDetails({
            name: customer.name,
            email: '', // Customer schema doesn't have email field
            address: customer.location,
            phone: customer.phones?.[0]?.number || '',
        });
        setCustomerSearch(customer.name);
        setShowCustomerResults(false);

        // Auto-set zones from customer's zone
        if (customer.zone) {
            const zone = zones.find((z) => z.name === customer.zone);

            if (orderType === 'subscription') {
                setDeliveryZone(customer.zone);
                if (zone) {
                    setDeliveryFee(totalPickups > 0 ? zone.subscriptionFee * totalPickups : zone.subscriptionFee);
                }
            } else if (orderType === 'a-la-carte') {
                // For à la carte, set both pickup and delivery zones
                setPickupZone(customer.zone);
                setDeliveryZone(customer.zone);
                if (zone) {
                    setPickupFee(zone.aLaCarteFee);
                    setDeliveryFee(zone.aLaCarteFee);
                }
            }
        }
    };

    // Clear customer selection
    const clearCustomer = () => {
        setSelectedCustomer(null);
        setCustomerDetails({
            name: '',
            email: '',
            address: '',
            phone: '',
        });
        setCustomerSearch('');
    };

    // Handle customer detail changes
    const handleCustomerDetailChange = (field: string, value: string) => {
        setCustomerDetails((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const addItem = () => {
        let maxId = 0;
        maxId = items?.length ? items.reduce((max: number, character: any) => (character.id > max ? character.id : max), items[0].id) : 0;

        setItems([
            ...items,
            {
                id: maxId + 1,
                name: '',
                label: '',
                quantity: 1,
                price: 0,
                total: 0,
                category: 'ordinary',
                color: 'colored',
                serviceType: 'Wash & Iron',
            },
        ]);
    };

    const addCustomItem = () => {
        if (!customItemName || customItemPrice <= 0 || customItemQuantity <= 0) {
            return;
        }

        let maxId = 0;
        maxId = items?.length ? items.reduce((max: number, item: OrderItem) => (item.id > max ? item.id : max), items[0].id) : 0;

        setItems([
            ...items,
            {
                id: maxId + 1,
                name: customItemName,
                label: customItemName,
                quantity: customItemQuantity,
                price: customItemPrice,
                total: customItemPrice * customItemQuantity,
                category: 'custom',
                color: 'colored',
                serviceType: 'Wash & Iron',
            },
        ]);

        // Reset modal states
        setShowCustomItemModal(false);
        setCustomItemName('');
        setCustomItemPrice(0);
        setCustomItemQuantity(1);

        // Recalculate totals
        if (orderType === 'a-la-carte') {
            calculateALaCarteTotals();
        }
    };

    const removeItem = (item: OrderItem | null = null) => {
        if (item) {
            setItems(items.filter((d) => d.id !== item.id));
        }
    };

    const changeItemDetails = (type: string, value: string, id: number) => {
        const list = [...items];
        const item = list.find((d) => d.id === id);
        if (item) {
            if (type === 'quantity') {
                item.quantity = Number(value);
            }
            if (type === 'price') {
                item.price = Number(value);
            }
            if (type === 'color') {
                // Update color and recalculate price based on color
                item.color = value as 'white' | 'colored';

                // Only recalculate price for catalog items, not custom items
                if (item.category !== 'custom' && item.name) {
                    const catalogItem = aLaCarteItems.find((i: any) => i.name === item.name);
                    if (catalogItem) {
                        item.price = value === 'white' ? catalogItem.price + WHITE_SURCHARGE : catalogItem.price;
                    }
                }
            }
            if (type === 'serviceType') {
                item.serviceType = value as 'Wash & Iron' | 'Iron' | 'Other';
            }
            item.total = item.quantity * item.price;
            setItems(list);
            if (orderType === 'a-la-carte') {
                calculateALaCarteTotals();
            }
        }
    };

    const handleOrderTypeChange = (selectedOrderType: string) => {
        setOrderType(selectedOrderType);

        // Reset all accounting values
        setTotalPrice(0);
        setTotalVetements(0);
        setTotalPickups(0);
        setPickupSchedule([]);
        setEndDate('');
        setDeliveryZone('');
        setDeliveryFee(0);
        setServiceCharge(0);

        if (selectedOrderType === 'subscription') {
            setPackType('ÉCLAT'); // Default to ÉCLAT pack
            setAddOnLevel(0);
        } else if (selectedOrderType === 'a-la-carte') {
            setPackType('');
            setAddOnLevel(0);
            // Set à la carte dates
            setPickupDate(todayString);
            setDeliveryDate(calculateALaCarteDeliveryDate());
        } else {
            setPackType('');
            setAddOnLevel(0);
            setPickupDate(todayString);
            setDeliveryDate('');
        }
    };

    const handlePackTypeChange = (selectedPackType: string) => {
        setPackType(selectedPackType);
    };

    const handleAddOnChange = (level: number) => {
        setAddOnLevel(level);
    };

    const handleDeliveryZoneChange = (zoneName: string) => {
        setDeliveryZone(zoneName);
        const selectedZone = zones.find((z) => z.name === zoneName);
        if (selectedZone) {
            const fee = orderType === 'subscription' ? selectedZone.subscriptionFee : selectedZone.aLaCarteFee;
            if (orderType === 'subscription') {
                setDeliveryFee(totalPickups > 0 ? fee * totalPickups : fee);
            } else {
                setDeliveryFee(fee);
            }
        } else {
            setDeliveryFee(0);
        }
    };

    const handlePickupZoneChange = (zoneName: string) => {
        setPickupZone(zoneName);
        const selectedZone = zones.find((z) => z.name === zoneName);
        if (selectedZone) {
            setPickupFee(selectedZone.aLaCarteFee);
        } else {
            setPickupFee(0);
        }
    };

    // Update basePickupCount when pack type changes
    useEffect(() => {
        if (orderType === 'subscription' && packType && subscriptionPacks[packType]) {
            const selectedPack = subscriptionPacks[packType];
            setBasePickupCount(selectedPack.basePickups || 2);
        }
    }, [packType, orderType, subscriptionPacks]);

    // Update calculations when dependencies change
    useEffect(() => {
        if (orderType === 'subscription' && packType) {
            calculateSubscriptionTotals();
        }
    }, [packType, basePickupCount, addOnLevel, startDate, orderType, calculateSubscriptionTotals]);

    // Update à la carte delivery date when pickup date changes
    useEffect(() => {
        if (orderType === 'a-la-carte' && pickupDate) {
            const pickup = new Date(pickupDate);
            const delivery = new Date(pickup);
            delivery.setDate(delivery.getDate() + 4);
            setDeliveryDate(delivery.toISOString().split('T')[0]);
        }
    }, [pickupDate, orderType]);

    // Update à la carte totals when pickup/delivery settings change
    useEffect(() => {
        if (orderType === 'a-la-carte') {
            calculateALaCarteTotals();
        }
    }, [enablePickup, enableDelivery, pickupFee, deliveryFee, items, orderType, calculateALaCarteTotals]);

    // Update delivery fee when pickups change in subscription mode
    useEffect(() => {
        if (orderType === 'subscription' && deliveryZone) {
            const selectedZone = zones.find((z) => z.name === deliveryZone);
            if (selectedZone) {
                setDeliveryFee(totalPickups > 0 ? selectedZone.subscriptionFee * totalPickups : 0);
            }
        }
    }, [totalPickups, deliveryZone, orderType, zones]);

    // ── Lead conversion prefill ────────────────────────────
    useEffect(() => {
        if (!fromLeadId || !prefillClientId || leadPrefilled) return;
        // Wait for packs data to be available
        if (packsData.length === 0) return;

        const prefill = async () => {
            try {
                // Fetch the client created from the lead
                const res = await getCustomer(prefillClientId);
                const client = res.data;
                if (client) {
                    setSelectedCustomer(client);
                    setCustomerDetails({
                        name: client.name || '',
                        email: '',
                        address: client.location || '',
                        phone: client.phones?.[0]?.number || '',
                    });
                    setCustomerSearch(client.name || '');
                }

                // Set order type based on pack
                if (prefillPack === 'a_la_carte') {
                    setOrderType('a-la-carte');
                } else if (prefillPack) {
                    setOrderType('subscription');
                    // Map pack code to the pack code used in the packs dropdown
                    const matchedPack = packsData.find(
                        (p) =>
                            p.code
                                .toLowerCase()
                                .normalize('NFD')
                                .replace(/[\u0300-\u036f]/g, '') === prefillPack.toLowerCase()
                    );
                    if (matchedPack) {
                        setPackType(matchedPack.code);
                    }
                }

                // Set zone
                if (prefillZone) {
                    setDeliveryZone(prefillZone);
                    const matchedZone = zones.find((z) => z.name === prefillZone);
                    if (matchedZone) {
                        setDeliveryFee(matchedZone.subscriptionFee);
                    }
                }

                // Set add-on pickups
                if (prefillAddOn) {
                    setAddOnLevel(Number(prefillAddOn));
                }

                // Set start date
                if (prefillPickupDate) {
                    setStartDate(prefillPickupDate);
                    setPickupDate(prefillPickupDate);
                }

                setLeadPrefilled(true);
            } catch (err) {
                console.error('Error prefilling from lead:', err);
                setLeadPrefilled(true);
            }
        };

        prefill();
    }, [fromLeadId, prefillClientId, prefillPack, prefillZone, prefillAddOn, prefillPickupDate, leadPrefilled, packsData, zones]);

    // Validate compulsory fields
    const validateForm = () => {
        const errors: Record<string, string> = {};

        // Customer validation
        if (!selectedCustomer) {
            errors.customer = 'Please select a customer';
        }

        // Order type validation
        if (!orderType) {
            errors.orderType = 'Please select an order type';
        }

        // Pack type validation (for subscription)
        if (orderType === 'subscription' && !packType) {
            errors.packType = 'Please select a valid pack type';
        }

        // Delivery zone validation
        if (orderType === 'subscription' && !deliveryZone) {
            errors.deliveryZone = 'Please select a delivery zone';
        }

        // À la carte pickup and delivery validation
        if (orderType === 'a-la-carte') {
            if (enablePickup && !pickupZone) {
                errors.pickupZone = 'Please select a pickup zone';
            }
            if (enableDelivery && !deliveryZone) {
                errors.deliveryZone = 'Please select a delivery zone';
            }
            // Neither pickup nor delivery is compulsory for à la carte orders
        }

        // Payment method validation
        if (!paymentMethod) {
            errors.paymentMethod = 'Please select a payment method';
        }

        // Service type validation (only for subscription - à la carte has per-item serviceType)
        if (orderType !== 'a-la-carte' && !serviceType) {
            errors.serviceType = 'Please select a service type';
        }

        // Special instructions validation
        // if (!specialInstructions.trim()) {
        //     errors.specialInstructions = 'Please provide special instructions';
        // }

        // Start date validation
        if (!startDate) {
            errors.startDate = 'Please select a start date';
        }

        // End date validation (for subscription)
        if (orderType === 'subscription' && !endDate) {
            errors.endDate = 'Please select an end date';
        }

        // Delivery date validation (for à la carte)
        if (orderType === 'a-la-carte' && !deliveryDate) {
            errors.deliveryDate = 'Please select a delivery date';
        }

        // Pickup date validation (for à la carte)
        if (orderType === 'a-la-carte' && !pickupDate) {
            errors.pickupDate = 'Please select a pickup date';
        }

        // Items validation (for à la carte)
        if (orderType === 'a-la-carte' && (items.length === 0 || items.every((item) => item.quantity === 0))) {
            errors.items = 'Please add at least one item';
        }

        // Delivery fee validation
        if (deliveryFee < 0) {
            errors.deliveryFee = 'Delivery fee cannot be negative';
        }

        // Service charge validation
        if (serviceCharge < 0) {
            errors.serviceCharge = 'Service charge cannot be negative';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Prepare order data for API
    const prepareOrderData = () => {
        if (!selectedCustomer) {
            throw new Error('Please select a customer');
        }

        if (orderType === 'subscription') {
            if (!packType) {
                throw new Error('Please select a pack type');
            }

            // Prepare subscription order
            const pack = subscriptionPacks[packType as keyof typeof subscriptionPacks];

            // Create items based on pack configuration
            const orderItems: Array<{
                name: string;
                quantity: number;
                category: 'ordinary' | 'special' | 'add-on' | 'package';
                unitPrice: number;
            }> = [
                {
                    name: packType, // Use pack name directly (ÉCLAT or PRESTIGE)
                    quantity: 1,
                    category: 'package' as const,
                    unitPrice: pack.price,
                },
            ];

            // Add add-on items if any
            if (addOnLevel > 0) {
                orderItems.push({
                    name: 'pickup',
                    quantity: addOnLevel, // 1 or 2 additional pickups
                    category: 'add-on' as const,
                    unitPrice: 5000, // 5000 FCFA per additional pickup
                });
            }

            // Calculate per-operation delivery fee (only for delivery, not pickup)
            const perOperationDeliveryFee = totalPickups > 0 ? deliveryFee / totalPickups : 0;

            return {
                customerId: selectedCustomer._id,
                type: 'subscription' as const,
                currency: currency,
                items: orderItems,
                pickup: {
                    date: startDate,
                    address: customerDetails.address,
                    city: deliveryZone || 'Cocody',
                    fee: 0, // No pickup fee for subscriptions
                    enabled: true,
                },
                delivery: {
                    date: endDate,
                    address: customerDetails.address,
                    city: deliveryZone || 'Cocody',
                    fee: perOperationDeliveryFee,
                    enabled: true,
                },
                packName: packType,
                basePickupCount: basePickupCount,
                subscriptionStartDate: startDate,
                subscriptionEndDate: endDate,
                pickupSchedule: pickupSchedule.map((schedule) => ({
                    date: schedule.pickup,
                    address: customerDetails.address,
                    city: deliveryZone || 'Cocody',
                    fee: 0, // No pickup fee for subscriptions
                    enabled: true,
                })),
                deliverySchedule: pickupSchedule.map((schedule) => ({
                    date: schedule.delivery,
                    address: customerDetails.address,
                    city: deliveryZone || 'Cocody',
                    fee: perOperationDeliveryFee,
                    enabled: true,
                })),
                paymentMethod: paymentMethod,
                serviceType: serviceType,
                note: `Subscription order - ${pack.name} with ${pickupSchedule.length} pickups${specialInstructions ? ` - ${specialInstructions}` : ''}`,
            };
        } else {
            // Prepare à la carte order
            if (items.length === 0 || items.every((item: OrderItem) => item.quantity === 0)) {
                throw new Error('Please add at least one item');
            }

            const orderItems = items
                .filter((item: OrderItem) => item.quantity > 0)
                .map((item: OrderItem) => ({
                    name: item.name,
                    quantity: item.quantity,
                    category: item.category,
                    unitPrice: item.price,
                    color: item.color || 'colored',
                    serviceType: item.serviceType || 'Wash & Iron',
                }));

            return {
                customerId: selectedCustomer._id,
                type: 'a-la-carte' as const,
                currency: currency,
                items: orderItems,
                pickup: {
                    date: pickupDate,
                    address: customerDetails.address,
                    city: pickupZone || 'Cocody',
                    fee: enablePickup ? pickupFee : 0,
                    enabled: enablePickup,
                },
                delivery: {
                    date: deliveryDate,
                    address: customerDetails.address,
                    city: deliveryZone || 'Cocody',
                    fee: enableDelivery ? deliveryFee : 0,
                    enabled: enableDelivery,
                },
                status: enablePickup ? 'en_attente' : 'enregistrement',
                paymentMethod: paymentMethod,
                note: `À la carte order${specialInstructions ? ` - ${specialInstructions}` : ''}`,
            };
        }
    };

    // Handle start date change - fallback to today if empty
    const handleStartDateChange = (value: string) => {
        setStartDate(value || todayString);
    };

    // Handle new customer created from modal
    const handleNewCustomerCreated = (customer: Customer) => {
        selectCustomer(customer);
        setShowNewCustomerModal(false);
    };

    // Save order function
    const handleSave = async () => {
        try {
            setIsLoading(true);
            setSaveError('');
            setSaveSuccess('');
            setValidationErrors({});

            // Validate form first
            if (!validateForm()) {
                setSaveError('Please fix the validation errors before saving');
                setIsLoading(false);
                return;
            }

            const orderData = prepareOrderData();
            console.log('Saving order:', orderData);

            const response = await createOrder(orderData);
            console.log('Order saved successfully:', response.data);

            // Invalidate orders cache to ensure list shows fresh data
            await queryClient.invalidateQueries({ queryKey: ['orders'] });

            setSaveSuccess('Order saved successfully! Redirecting...');

            // Redirect to orders list
            router.push('/apps/orders/list');
        } catch (error: any) {
            console.error('Error saving order:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to save order';
            setSaveError(errorMessage);
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        router.push('/apps/orders/list');
    };

    return (
        <div className="flex flex-col gap-2.5 xl:flex-row">
            {/* Lead conversion banner */}
            {showLeadBanner && fromLeadId && (
                <div className="fixed left-0 right-0 top-16 z-30 mx-auto max-w-4xl px-4">
                    <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-blue-50 px-5 py-3 shadow-lg dark:from-primary/10 dark:to-blue-900/20">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">Création de commande depuis un prospect</p>
                            <p className="text-xs text-slate-500">Le formulaire a été pré-rempli avec les informations du prospect. Vérifiez et ajustez si nécessaire.</p>
                        </div>
                        <button onClick={() => setShowLeadBanner(false)} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
            <div className="panel flex-1 px-0 py-6 ltr:xl:mr-6 rtl:xl:ml-6">
                <div className="flex flex-wrap justify-between px-4">
                    <div className="mb-6 w-full lg:w-1/2">
                        <div className="flex shrink-0 items-center text-black dark:text-white">
                            <Image src="/mirai-logo-white-bg.png" alt="MIRAI Services Logo" width={56} height={56} className="w-14" />
                        </div>
                        <div className="mt-6 space-y-1 text-gray-500 dark:text-gray-400">
                            <div className="font-semibold text-black dark:text-white">MIRAI Services</div>
                            <div className="text-sm">Entreprise de pressing</div>
                            <div>Derri&egrave;re le march&eacute; de Djorogobit&eacute;,</div>
                            <div>Angr&eacute; Djorogobit&eacute; 2, Cocody, Abidjan, C&ocirc;te d&apos;Ivoire</div>
                            <div>📞 +225 05 01 91 90 80</div>
                            <div>✉️ infomiraisrv@gmail.com</div>
                        </div>
                    </div>
                    <div className="w-full lg:w-1/2 lg:max-w-fit">
                        <div className="flex items-center">
                            <label htmlFor="orderLabel" className="mb-0 flex-1 ltr:mr-2 rtl:ml-2">
                                Order Type
                            </label>
                            <select
                                id="orderLabel"
                                name="order-type"
                                className={`form-input w-2/3 lg:w-[250px] ${validationErrors.orderType ? 'border-red-500' : ''}`}
                                value={orderType}
                                onChange={(e) => handleOrderTypeChange(e.target.value)}
                            >
                                <option value="">Select Order Type</option>
                                <option value="subscription">Subscription (Abonnement)</option>
                                <option value="a-la-carte">À la carte (Libre Service)</option>
                            </select>
                            {validationErrors.orderType && <div className="mt-1 text-sm text-red-600">{validationErrors.orderType}</div>}
                        </div>

                        {orderType === 'subscription' && (
                            <>
                                <div className="mt-4 flex items-center">
                                    <label htmlFor="packType" className="mb-0 flex-1 ltr:mr-2 rtl:ml-2">
                                        Pack Type
                                    </label>
                                    <select
                                        id="packType"
                                        name="pack-type"
                                        className={`form-input w-2/3 lg:w-[250px] ${validationErrors.packType ? 'border-red-500' : ''}`}
                                        value={packType}
                                        onChange={(e) => handlePackTypeChange(e.target.value)}
                                    >
                                        <option value="">{isLoadingPacks ? 'Chargement des packs...' : 'Select Pack'}</option>
                                        {packsData?.map((pack: Pack) => (
                                            <option key={pack.code} value={pack.code}>
                                                {pack.name} ({pack.price.toLocaleString()} FCFA - {pack.total} articles)
                                            </option>
                                        ))}
                                    </select>
                                    {validationErrors.packType && <div className="mt-1 text-sm text-red-600">{validationErrors.packType}</div>}
                                </div>

                                {packType && (
                                    <>
                                        <div className="mt-4">
                                            <div className="flex items-center">
                                                <label htmlFor="basePickupCount" className="mb-0 flex-1 ltr:mr-2 rtl:ml-2">
                                                    Nombre de récupérations incluses
                                                </label>
                                                <select
                                                    id="basePickupCount"
                                                    name="base-pickup-count"
                                                    className="form-input w-2/3 lg:w-[250px]"
                                                    value={basePickupCount}
                                                    onChange={(e) => setBasePickupCount(Number(e.target.value))}
                                                >
                                                    <option value={0}>0 récupération (client apporte)</option>
                                                    <option value={1}>1 récupération (frais réduits)</option>
                                                    <option value={2}>2 récupérations (recommandé)</option>
                                                </select>
                                            </div>
                                            <div className="mt-1 text-xs text-gray-500 ltr:ml-auto ltr:text-right rtl:mr-auto rtl:text-left">
                                                {basePickupCount === 0
                                                    ? 'Le client gère ses récupérations (pas de frais logistiques de base)'
                                                    : `Les frais de livraison sont calculés sur ${basePickupCount}${basePickupCount > 1 ? ' récupérations incluses' : ' récupération incluse'}`}
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center">
                                            <label htmlFor="addOns" className="mb-0 flex-1 ltr:mr-2 rtl:ml-2">
                                                Add-ons
                                            </label>
                                            <select id="addOns" name="add-ons" className="form-input w-2/3 lg:w-[250px]" value={addOnLevel} onChange={(e) => handleAddOnChange(Number(e.target.value))}>
                                                {/* list throw addOns to show the options*/}
                                                {Object.entries(addOns).map(([level, addOn]) => (
                                                    <option key={level} value={level}>
                                                        {addOn.name} {addOn.price > 0 ? `(+${addOn.price.toLocaleString()} FCFA)` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}

                                <div className="mt-4 flex items-center">
                                    <label htmlFor="startDate" className="mb-0 flex-1 ltr:mr-2 rtl:ml-2">
                                        Start Date
                                    </label>
                                    <input
                                        id="startDate"
                                        type="date"
                                        name="start-date"
                                        className={`form-input w-2/3 lg:w-[250px] ${validationErrors.startDate ? 'border-red-500' : ''}`}
                                        value={startDate}
                                        onChange={(e) => handleStartDateChange(e.target.value)}
                                    />
                                    {validationErrors.startDate && <div className="mt-1 text-sm text-red-600">{validationErrors.startDate}</div>}
                                </div>

                                {endDate && (
                                    <div className="mt-4 flex items-center">
                                        <label htmlFor="endDate" className="mb-0 flex-1 ltr:mr-2 rtl:ml-2">
                                            End Date
                                        </label>
                                        <input
                                            id="endDate"
                                            type="date"
                                            name="end-date"
                                            className={`form-input w-2/3 lg:w-[250px] ${validationErrors.endDate ? 'border-red-500' : ''}`}
                                            value={endDate}
                                            readOnly
                                        />
                                        {validationErrors.endDate && <div className="mt-1 text-sm text-red-600">{validationErrors.endDate}</div>}
                                    </div>
                                )}
                            </>
                        )}

                        {orderType === 'a-la-carte' && (
                            <>
                                <div className="mt-4 flex items-center">
                                    <label htmlFor="pickupDate" className="mb-0 flex-1 ltr:mr-2 rtl:ml-2">
                                        Pickup Date
                                    </label>
                                    <input
                                        id="pickupDate"
                                        type="date"
                                        name="pickup-date"
                                        className={`form-input w-2/3 lg:w-[250px] ${validationErrors.pickupDate ? 'border-red-500' : ''}`}
                                        value={pickupDate}
                                        onChange={(e) => setPickupDate(e.target.value)}
                                    />
                                    {validationErrors.pickupDate && <div className="mt-1 text-sm text-red-600">{validationErrors.pickupDate}</div>}
                                </div>
                                <div className="mt-4 flex items-center">
                                    <label htmlFor="deliveryDate" className="mb-0 flex-1 ltr:mr-2 rtl:ml-2">
                                        Expected Delivery
                                    </label>
                                    <input
                                        id="deliveryDate"
                                        type="date"
                                        name="delivery-date"
                                        className={`form-input w-2/3 lg:w-[250px] ${validationErrors.deliveryDate ? 'border-red-500' : ''}`}
                                        value={deliveryDate}
                                        onChange={(e) => setDeliveryDate(e.target.value)}
                                    />
                                    {validationErrors.deliveryDate && <div className="mt-1 text-sm text-red-600">{validationErrors.deliveryDate}</div>}
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <hr className="my-6 border-white-light dark:border-[#1b2e4b]" />
                <div className="mt-8 px-4">
                    <div className="flex flex-col justify-between lg:flex-row">
                        <div className="mb-6 w-full lg:w-1/2 ltr:lg:mr-6 rtl:lg:ml-6">
                            <div className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800/50">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="text-base font-semibold text-slate-800 dark:text-white">Détails du client</h3>
                                    {!selectedCustomer && (
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                                            onClick={() => setShowNewCustomerModal(true)}
                                        >
                                            <IconUserPlus className="h-3.5 w-3.5" />
                                            Nouveau client
                                        </button>
                                    )}
                                </div>
                                {validationErrors.customer && <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20">{validationErrors.customer}</div>}

                                {/* Customer Search */}
                                <div className="mb-4">
                                    <label htmlFor="customer-search" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Rechercher un client
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="customer-search"
                                            type="text"
                                            className="form-input w-full rounded-lg"
                                            placeholder="Nom ou numéro de téléphone..."
                                            value={customerSearch}
                                            onChange={(e) => handleCustomerSearch(e.target.value)}
                                            disabled={!!selectedCustomer}
                                        />
                                        {selectedCustomer && (
                                            <button
                                                type="button"
                                                onClick={clearCustomer}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
                                            >
                                                <IconX className="h-4 w-4" />
                                            </button>
                                        )}

                                        {/* Search Results Dropdown */}
                                        {showCustomerResults && customerResults.length > 0 && (
                                            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
                                                {customerResults.map((customer) => (
                                                    <div
                                                        key={customer._id}
                                                        className="cursor-pointer border-b border-slate-100 p-3 last:border-b-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"
                                                        onClick={() => selectCustomer(customer)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-medium text-slate-800 dark:text-white">{customer.name}</div>
                                                            {customer.isBusiness && (
                                                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                                    Entreprise
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-sm text-slate-500">{customer.phones?.[0]?.number || 'Pas de téléphone'}</div>
                                                        <div className="text-xs text-slate-400">{customer.location}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Customer Details Form - Read-only when customer is selected */}
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="sm:col-span-2">
                                        <label htmlFor="customer-name" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Nom
                                        </label>
                                        <input
                                            id="customer-name"
                                            type="text"
                                            className={`form-input w-full rounded-lg ${selectedCustomer ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                                            placeholder="Nom du client"
                                            value={customerDetails.name}
                                            onChange={(e) => handleCustomerDetailChange('name', e.target.value)}
                                            readOnly={!!selectedCustomer}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="customer-phone" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Téléphone
                                        </label>
                                        <input
                                            id="customer-phone"
                                            type="text"
                                            className={`form-input w-full rounded-lg ${selectedCustomer ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                                            placeholder="Numéro de téléphone"
                                            value={customerDetails.phone}
                                            onChange={(e) => handleCustomerDetailChange('phone', e.target.value)}
                                            readOnly={!!selectedCustomer}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="customer-email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Email
                                        </label>
                                        <input
                                            id="customer-email"
                                            type="email"
                                            className={`form-input w-full rounded-lg ${selectedCustomer ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                                            placeholder="Email (optionnel)"
                                            value={customerDetails.email}
                                            onChange={(e) => handleCustomerDetailChange('email', e.target.value)}
                                            readOnly={!!selectedCustomer}
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label htmlFor="customer-address" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Adresse
                                        </label>
                                        <input
                                            id="customer-address"
                                            type="text"
                                            className={`form-input w-full rounded-lg ${selectedCustomer ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                                            placeholder="Adresse de livraison"
                                            value={customerDetails.address}
                                            onChange={(e) => handleCustomerDetailChange('address', e.target.value)}
                                            readOnly={!!selectedCustomer}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="w-full lg:w-1/2">
                            <div className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800/50">
                                <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-white">Détails du service</h3>

                                <div className="space-y-4">
                                    {orderType !== 'a-la-carte' && (
                                        <div>
                                            <label htmlFor="service-type" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                Type de service <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                id="service-type"
                                                className={`form-select w-full rounded-lg ${validationErrors.serviceType ? 'border-red-500' : ''}`}
                                                value={serviceType}
                                                onChange={(e) => setServiceType(e.target.value)}
                                            >
                                                <option value="">Sélectionner un service</option>
                                                <option value="Wash & Iron">Lavage & Repassage</option>
                                                <option value="Iron">Repassage uniquement</option>
                                                <option value="Other">Autre</option>
                                            </select>
                                            {validationErrors.serviceType && <div className="mt-1 text-xs text-red-600">{validationErrors.serviceType}</div>}
                                        </div>
                                    )}
                                    {orderType === 'a-la-carte' && (
                                        <div className="rounded-lg bg-blue-50/50 p-3 text-sm text-slate-600 dark:bg-blue-900/10 dark:text-slate-400">
                                            💡 Le type de service est défini par article dans la section ci-dessous.
                                        </div>
                                    )}

                                    {orderType === 'subscription' && packType && (
                                        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:from-blue-900/20 dark:to-indigo-900/20">
                                            {(() => {
                                                const currentPack = subscriptionPacks[packType as keyof typeof subscriptionPacks];
                                                const currentAddOn = addOns[addOnLevel as keyof typeof addOns];
                                                const packPrice = currentPack?.price || 0;
                                                const addOnPrice = currentAddOn?.price || 0;
                                                const deliveryTotal = deliveryFee || 0;

                                                return (
                                                    <>
                                                        <div className="mb-3 flex items-center gap-2">
                                                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-800/50 dark:text-blue-200">
                                                                {currentPack?.name}
                                                            </span>
                                                            <span className="text-xs text-slate-500">Résumé abonnement</span>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                                            <div className="rounded-lg bg-white/60 p-2.5 dark:bg-slate-800/40">
                                                                <p className="text-xs text-slate-500">Vêtements inclus</p>
                                                                <p className="font-semibold text-slate-800 dark:text-white">{totalVetements}</p>
                                                            </div>
                                                            <div className="rounded-lg bg-white/60 p-2.5 dark:bg-slate-800/40">
                                                                <p className="text-xs text-slate-500">Récupérations</p>
                                                                <p className="font-semibold text-slate-800 dark:text-white">{totalPickups}</p>
                                                            </div>
                                                            <div className="rounded-lg bg-white/60 p-2.5 dark:bg-slate-800/40">
                                                                <p className="text-xs text-slate-500">Prix pack</p>
                                                                <p className="font-semibold text-slate-800 dark:text-white">{packPrice.toLocaleString()} FCFA</p>
                                                            </div>
                                                            {addOnPrice > 0 && (
                                                                <div className="rounded-lg bg-white/60 p-2.5 dark:bg-slate-800/40">
                                                                    <p className="text-xs text-slate-500">Add-on</p>
                                                                    <p className="font-semibold text-green-600">+{addOnPrice.toLocaleString()} FCFA</p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {deliveryZone && (
                                                            <div className="mt-3 text-sm">
                                                                <span className="text-slate-600 dark:text-slate-400">Logistique ({deliveryZone}): </span>
                                                                <span className={deliveryTotal > 0 ? 'font-medium' : 'font-medium text-green-600'}>
                                                                    {deliveryTotal > 0 ? `${deliveryTotal.toLocaleString()} FCFA` : 'Offerte'}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/10 p-3">
                                                            <span className="font-medium text-slate-700 dark:text-slate-200">Total final</span>
                                                            <span className="text-lg font-bold text-primary">{totalPrice.toLocaleString()} FCFA</span>
                                                        </div>

                                                        {currentPack && (
                                                            <div className="mt-3 text-xs text-slate-500">
                                                                <p className="mb-1 font-medium">Articles spéciaux inclus:</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    <span className="rounded bg-white/60 px-2 py-0.5 dark:bg-slate-800/40">Couettes: {currentPack.specialArticles.couettes}</span>
                                                                    <span className="rounded bg-white/60 px-2 py-0.5 dark:bg-slate-800/40">
                                                                        Draps & Serviettes: {currentPack.specialArticles.draps_serviettes}
                                                                    </span>
                                                                    <span className="rounded bg-white/60 px-2 py-0.5 dark:bg-slate-800/40">Vestes: {currentPack.specialArticles.vestes}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}

                                            {pickupSchedule.length > 0 && (
                                                <div className="mt-3 border-t border-blue-200/50 pt-3 dark:border-blue-700/30">
                                                    <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">Planning de récupération:</p>
                                                    <div className="space-y-1">
                                                        {pickupSchedule.map((schedule, index) => {
                                                            const pickupDateFormatted = new Date(schedule.pickup).toLocaleDateString('fr-FR', {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric',
                                                            });
                                                            const deliveryDateFormatted = new Date(schedule.delivery).toLocaleDateString('fr-FR', {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric',
                                                            });
                                                            return (
                                                                <div key={index} className="flex items-center gap-2 text-xs">
                                                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-200/50 text-blue-700 dark:bg-blue-800/50 dark:text-blue-300">
                                                                        {index + 1}
                                                                    </span>
                                                                    <span className="text-slate-600 dark:text-slate-400">{pickupDateFormatted}</span>
                                                                    <span className="text-slate-400">→</span>
                                                                    <span className="text-slate-600 dark:text-slate-400">{deliveryDateFormatted}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {orderType === 'a-la-carte' && (
                    <div className="mt-8 px-4">
                        <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800/50">
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-slate-200/60 px-5 py-4 dark:border-slate-700/50">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-800 dark:text-white">Articles de la commande</h3>
                                    <p className="mt-0.5 text-xs text-slate-400">{items.filter((i) => i.quantity > 0).length} article(s) sélectionné(s)</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                                        onClick={() => addItem()}
                                    >
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Ajouter
                                    </button>
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                                        onClick={() => setShowCustomItemModal(true)}
                                    >
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                            />
                                        </svg>
                                        Personnalisé
                                    </button>
                                </div>
                            </div>

                            {validationErrors.items && <div className="mx-5 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{validationErrors.items}</div>}

                            {/* Items List */}
                            <div className="p-5">
                                {items.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                                            <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                        </div>
                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Aucun article ajouté</p>
                                        <p className="mt-1 text-xs text-slate-400">Cliquez sur « Ajouter » pour commencer</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {items.map((item: any, index: number) => {
                                            const isCustom = item.category === 'custom';
                                            return (
                                                <div
                                                    key={item.id}
                                                    className="group relative rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/30 dark:hover:border-slate-600"
                                                >
                                                    {/* Main row: all fields on one line */}
                                                    <div className="flex items-end gap-3">
                                                        {/* Item number */}
                                                        <div className="flex h-[38px] w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                                            {index + 1}
                                                        </div>

                                                        {/* Item type */}
                                                        <div className="min-w-0 flex-[3]">
                                                            <label className="mb-1 block text-[11px] font-medium text-slate-400">Type d&apos;article</label>
                                                            {isCustom ? (
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="text"
                                                                        className="form-input w-full rounded-lg bg-slate-100 text-sm dark:bg-slate-700"
                                                                        value={item.label || item.name}
                                                                        readOnly
                                                                        disabled
                                                                    />
                                                                    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                                        Perso.
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <select
                                                                    className="form-select w-full rounded-lg text-sm"
                                                                    value={item.name || ''}
                                                                    onChange={(e) => {
                                                                        const selectedItem = aLaCarteItems.find((i: any) => i.name === e.target.value);
                                                                        if (selectedItem) {
                                                                            const basePrice = selectedItem.price;
                                                                            const finalPrice = item.color === 'white' ? basePrice + WHITE_SURCHARGE : basePrice;
                                                                            changeItemDetails('price', finalPrice.toString(), item.id);
                                                                            item.name = selectedItem.name;
                                                                            item.label = selectedItem.label;
                                                                            item.category = selectedItem.category;
                                                                        }
                                                                        setItems([...items]);
                                                                    }}
                                                                >
                                                                    <option value="">Sélectionner...</option>
                                                                    {aLaCarteItems.map((aLaCarteItem: any, idx: number) => (
                                                                        <option key={`${aLaCarteItem.name}-${idx}`} value={aLaCarteItem.name}>
                                                                            {aLaCarteItem.label} — {aLaCarteItem.price.toLocaleString()} FCFA
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                        </div>

                                                        {/* Service Type */}
                                                        <div className="w-[130px] shrink-0">
                                                            <label className="mb-1 block text-[11px] font-medium text-slate-400">Service</label>
                                                            <select
                                                                className="form-select w-full rounded-lg text-xs"
                                                                value={item.serviceType || 'Wash & Iron'}
                                                                onChange={(e) => changeItemDetails('serviceType', e.target.value, item.id)}
                                                            >
                                                                <option value="Wash & Iron">🧺 Lavage & Rep.</option>
                                                                <option value="Iron">👔 Repassage</option>
                                                                <option value="Other">📦 Autre</option>
                                                            </select>
                                                        </div>

                                                        {/* Quantity */}
                                                        <div className="w-16 shrink-0">
                                                            <label className="mb-1 block text-[11px] font-medium text-slate-400">Qté</label>
                                                            <input
                                                                type="number"
                                                                className="form-input w-full rounded-lg text-center text-sm"
                                                                value={item.quantity}
                                                                min={1}
                                                                onChange={(e) => changeItemDetails('quantity', e.target.value, item.id)}
                                                            />
                                                        </div>

                                                        {/* Unit Price */}
                                                        <div className="w-20 shrink-0">
                                                            <label className="mb-1 block text-[11px] font-medium text-slate-400">Prix u.</label>
                                                            <input
                                                                type="number"
                                                                className={`form-input w-full rounded-lg text-right text-sm ${!isCustom ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                                                                value={item.price}
                                                                min={0}
                                                                onChange={(e) => changeItemDetails('price', e.target.value, item.id)}
                                                                readOnly={!isCustom}
                                                            />
                                                        </div>

                                                        {/* Total */}
                                                        <div className="w-24 shrink-0">
                                                            <label className="mb-1 block text-[11px] font-medium text-slate-400">Total</label>
                                                            <div className="flex h-[38px] items-center justify-end rounded-lg bg-primary/5 px-2">
                                                                <span className="text-sm font-bold text-primary">{item.total.toLocaleString()}</span>
                                                                <span className="ml-0.5 text-[9px] text-primary/60">F</span>
                                                            </div>
                                                        </div>

                                                        {/* Delete */}
                                                        <button
                                                            type="button"
                                                            className="flex h-[38px] w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                                                            onClick={() => removeItem(item)}
                                                        >
                                                            <IconX className="h-4 w-4" />
                                                        </button>
                                                    </div>

                                                    {/* Description row below */}
                                                    {item.label && (
                                                        <div className="mt-2 flex items-center gap-2 pl-11 text-xs text-slate-400">
                                                            {item.category && (
                                                                <span
                                                                    className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                                                        item.category === 'special'
                                                                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20'
                                                                            : item.category === 'custom'
                                                                            ? 'bg-violet-50 text-violet-600 dark:bg-violet-900/20'
                                                                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700'
                                                                    }`}
                                                                >
                                                                    {item.category === 'special' ? 'Spécial' : item.category === 'custom' ? 'Personnalisé' : 'Ordinaire'}
                                                                </span>
                                                            )}
                                                            <span>{item.label}</span>
                                                            {item.color === 'white' && <span className="text-slate-400">· Blanc (+{WHITE_SURCHARGE})</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Summary Footer */}
                            <div className="border-t border-slate-200/60 bg-slate-50/80 px-5 py-4 dark:border-slate-700/50 dark:bg-slate-800/50">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    {/* Quick stats */}
                                    <div className="flex flex-wrap gap-3">
                                        <div className="rounded-lg bg-white px-4 py-2 shadow-sm dark:bg-slate-700">
                                            <p className="text-xs text-slate-500">Articles</p>
                                            <p className="text-lg font-bold text-slate-800 dark:text-white">{items.filter((i) => i.quantity > 0).length}</p>
                                        </div>
                                        <div className="rounded-lg bg-white px-4 py-2 shadow-sm dark:bg-slate-700">
                                            <p className="text-xs text-slate-500">Quantité totale</p>
                                            <p className="text-lg font-bold text-slate-800 dark:text-white">{items.reduce((sum, i) => sum + i.quantity, 0)}</p>
                                        </div>
                                    </div>

                                    {/* Totals */}
                                    <div className="w-full max-w-xs space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500">Sous-total articles</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-200">
                                                {items.reduce((sum: number, item: any) => sum + item.quantity * item.price, 0).toLocaleString()} FCFA
                                            </span>
                                        </div>
                                        {enablePickup && (
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-slate-500">Frais de récupération</span>
                                                <span className="font-medium text-slate-700 dark:text-slate-200">{pickupFee.toLocaleString()} FCFA</span>
                                            </div>
                                        )}
                                        {enableDelivery && (
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-slate-500">Frais de livraison</span>
                                                <span className="font-medium text-slate-700 dark:text-slate-200">{deliveryFee.toLocaleString()} FCFA</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between text-sm text-slate-400">
                                            <span>Taxe</span>
                                            <span>0%</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm text-slate-400">
                                            <span>Remise</span>
                                            <span>0%</span>
                                        </div>
                                        <div className="border-t border-slate-200 pt-2 dark:border-slate-600">
                                            <div className="flex items-center justify-between">
                                                <span className="text-base font-semibold text-slate-800 dark:text-white">Total</span>
                                                <span className="text-xl font-bold text-primary">{totalPrice.toLocaleString()} FCFA</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div className="mt-8 px-4">
                    <label htmlFor="notes">Special Instructions</label>
                    <textarea
                        id="notes"
                        name="notes"
                        className={`form-textarea min-h-[130px] ${validationErrors.specialInstructions ? 'border-red-500' : ''}`}
                        placeholder="Any special instructions for this order..."
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                    ></textarea>
                    {validationErrors.specialInstructions && <div className="mt-1 text-sm text-red-600">{validationErrors.specialInstructions}</div>}
                </div>
            </div>
            <div className="mt-6 w-full xl:mt-0 xl:w-96">
                <div className="panel mb-5">
                    <label htmlFor="currency">Currency</label>
                    <select id="currency" name="currency" className="form-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                        <option value="FCFA">FCFA - West African CFA Franc</option>
                    </select>

                    {orderType === 'subscription' && (
                        <div className="mt-4">
                            <label htmlFor="delivery-zone">Delivery Zone *</label>
                            <select
                                id="delivery-zone"
                                name="delivery-zone"
                                className={`form-select ${validationErrors.deliveryZone ? 'border-red-500' : ''}`}
                                value={deliveryZone}
                                onChange={(e) => handleDeliveryZoneChange(e.target.value)}
                            >
                                <option value="">Select Delivery Zone</option>
                                {zones.map((zone) => (
                                    <option key={zone._id} value={zone.name}>
                                        {zone.displayName} ({zone.subscriptionFee > 0 ? `${zone.subscriptionFee.toLocaleString()} FCFA` : 'Gratuit'})
                                    </option>
                                ))}
                            </select>
                            {validationErrors.deliveryZone && <div className="mt-1 text-sm text-red-600">{validationErrors.deliveryZone}</div>}
                        </div>
                    )}

                    {orderType === 'a-la-carte' && (
                        <>
                            <div className="mt-4">
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center">
                                        <input type="checkbox" checked={enablePickup} onChange={(e) => setEnablePickup(e.target.checked)} className="form-checkbox" />
                                        <span className="ml-2">Enable Pickup Service</span>
                                    </label>
                                    <label className="flex items-center">
                                        <input type="checkbox" checked={enableDelivery} onChange={(e) => setEnableDelivery(e.target.checked)} className="form-checkbox" />
                                        <span className="ml-2">Enable Delivery Service</span>
                                    </label>
                                </div>
                            </div>

                            {enablePickup && (
                                <div className="mt-4">
                                    <label htmlFor="pickup-zone">Pickup Zone *</label>
                                    <select
                                        id="pickup-zone"
                                        name="pickup-zone"
                                        className={`form-select ${validationErrors.pickupZone ? 'border-red-500' : ''}`}
                                        value={pickupZone}
                                        onChange={(e) => handlePickupZoneChange(e.target.value)}
                                    >
                                        <option value="">Select Pickup Zone</option>
                                        {zones.map((zone) => (
                                            <option key={zone._id} value={zone.name}>
                                                {zone.displayName} ({zone.aLaCarteFee.toLocaleString()} FCFA)
                                            </option>
                                        ))}
                                    </select>
                                    {validationErrors.pickupZone && <div className="mt-1 text-sm text-red-600">{validationErrors.pickupZone}</div>}
                                </div>
                            )}

                            {enableDelivery && (
                                <div className="mt-4">
                                    <label htmlFor="delivery-zone">Delivery Zone *</label>
                                    <select
                                        id="delivery-zone"
                                        name="delivery-zone"
                                        className={`form-select ${validationErrors.deliveryZone ? 'border-red-500' : ''}`}
                                        value={deliveryZone}
                                        onChange={(e) => handleDeliveryZoneChange(e.target.value)}
                                    >
                                        <option value="">Select Delivery Zone</option>
                                        {zones.map((zone) => (
                                            <option key={zone._id} value={zone.name}>
                                                {zone.displayName} ({zone.aLaCarteFee.toLocaleString()} FCFA)
                                            </option>
                                        ))}
                                    </select>
                                    {validationErrors.deliveryZone && <div className="mt-1 text-sm text-red-600">{validationErrors.deliveryZone}</div>}
                                </div>
                            )}
                        </>
                    )}

                    <div className="mt-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="tax">Tax(%) </label>
                                <input id="tax" type="number" name="tax" className="form-input" defaultValue={0} placeholder="Tax" />
                            </div>
                            <div>
                                <label htmlFor="discount">Discount(%) </label>
                                <input id="discount" type="number" name="discount" className="form-input" defaultValue={0} placeholder="Discount" />
                            </div>
                        </div>
                    </div>
                    <div className="mt-4">
                        <div>
                            <label htmlFor="service-charge">Service Charge (FCFA) *</label>
                            <input
                                id="service-charge"
                                type="number"
                                name="service-charge"
                                className={`form-input ${validationErrors.serviceCharge ? 'border-red-500' : ''}`}
                                value={serviceCharge}
                                onChange={(e) => setServiceCharge(Number(e.target.value))}
                                placeholder="Service Charge"
                            />
                            {validationErrors.serviceCharge && <div className="mt-1 text-sm text-red-600">{validationErrors.serviceCharge}</div>}
                        </div>
                    </div>

                    {orderType === 'subscription' && (
                        <div className="mt-4">
                            <div>
                                <label htmlFor="delivery-fee">Delivery Fee (FCFA) *</label>
                                <input
                                    id="delivery-fee"
                                    type="number"
                                    name="delivery-fee"
                                    className={`form-input ${validationErrors.deliveryFee ? 'border-red-500' : ''}`}
                                    value={deliveryFee}
                                    onChange={(e) => setDeliveryFee(Number(e.target.value))}
                                    placeholder="Delivery Fee"
                                />
                                {validationErrors.deliveryFee && <div className="mt-1 text-sm text-red-600">{validationErrors.deliveryFee}</div>}
                            </div>
                        </div>
                    )}

                    {orderType === 'a-la-carte' && (
                        <>
                            {enablePickup && (
                                <div className="mt-4">
                                    <div>
                                        <label htmlFor="pickup-fee">Pickup Fee (FCFA) *</label>
                                        <input
                                            id="pickup-fee"
                                            type="number"
                                            name="pickup-fee"
                                            className="form-input"
                                            value={pickupFee}
                                            onChange={(e) => setPickupFee(Number(e.target.value))}
                                            placeholder="Pickup Fee"
                                        />
                                    </div>
                                </div>
                            )}

                            {enableDelivery && (
                                <div className="mt-4">
                                    <div>
                                        <label htmlFor="delivery-fee">Delivery Fee (FCFA) *</label>
                                        <input
                                            id="delivery-fee"
                                            type="number"
                                            name="delivery-fee"
                                            className={`form-input ${validationErrors.deliveryFee ? 'border-red-500' : ''}`}
                                            value={deliveryFee}
                                            onChange={(e) => setDeliveryFee(Number(e.target.value))}
                                            placeholder="Delivery Fee"
                                        />
                                        {validationErrors.deliveryFee && <div className="mt-1 text-sm text-red-600">{validationErrors.deliveryFee}</div>}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    <div className="mt-4">
                        <label htmlFor="payment-method">Accept Payment Via *</label>
                        <select
                            id="payment-method"
                            name="payment-method"
                            className={`form-select ${validationErrors.paymentMethod ? 'border-red-500' : ''}`}
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                        >
                            <option value="">Select Payment</option>
                            <option value="OrangeMoney">Orange Money</option>
                            <option value="MTNMoney">MTN Money</option>
                            <option value="MoovMoney">Moov Money</option>
                            <option value="Wave">Wave</option>
                            <option value="Cash">Cash</option>
                            <option value="Other">Other</option>
                        </select>
                        {validationErrors.paymentMethod && <div className="mt-1 text-sm text-red-600">{validationErrors.paymentMethod}</div>}
                    </div>
                </div>
                <div className="panel">
                    {saveError && (
                        <div className="mb-4 rounded-md bg-red-50 p-4 dark:bg-red-900/20">
                            <div className="flex">
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error saving order</h3>
                                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">{saveError}</div>
                                </div>
                            </div>
                        </div>
                    )}
                    {saveSuccess && (
                        <div className="mb-4 rounded-md bg-green-50 p-4 dark:bg-green-900/20">
                            <div className="flex">
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-green-800 dark:text-green-200">Success</h3>
                                    <div className="mt-2 text-sm text-green-700 dark:text-green-300">{saveSuccess}</div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-1">
                        <button type="button" className="btn btn-success w-full gap-2" onClick={handleSave} disabled={isLoading}>
                            <IconSave className="shrink-0 ltr:mr-2 rtl:ml-2" />
                            {isLoading ? 'Saving...' : 'Save'}
                        </button>

                        {/* <button type="button" className="btn btn-info w-full gap-2">
                            <IconSend className="shrink-0 ltr:mr-2 rtl:ml-2" />
                            Save and Send Order
                        </button>

                        <button type="button" className="btn btn-primary w-full gap-2">
                            <IconEye className="shrink-0 ltr:mr-2 rtl:ml-2" />
                            Print Order
                        </button>

                        <button type="button" className="btn btn-secondary w-full gap-2">
                            <IconDownload className="shrink-0 ltr:mr-2 rtl:ml-2" />
                            Download
                        </button> */}

                        <button type="button" onClick={handleClose} className="btn btn-outline-danger w-full gap-2">
                            <IconX className="shrink-0 ltr:mr-2 rtl:ml-2" />
                            Cancel
                        </button>
                    </div>
                </div>
            </div>

            {/* Custom Item Modal */}
            {showCustomItemModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="m-4 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1a2234]">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-200/60 bg-gradient-to-r from-primary/5 to-transparent px-6 py-4 dark:border-slate-700/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Article personnalisé</h3>
                                <p className="mt-0.5 text-xs text-slate-400">Ajoutez un article non catalogué</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCustomItemModal(false)}
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                            >
                                <IconX className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="space-y-4 p-6">
                            <div>
                                <label htmlFor="custom-item-name" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Nom de l&apos;article <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="custom-item-name"
                                    type="text"
                                    className="form-input w-full rounded-lg"
                                    placeholder="Ex: Costume sur mesure, Rideau..."
                                    value={customItemName}
                                    onChange={(e) => setCustomItemName(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="custom-item-price" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Prix unitaire (FCFA) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="custom-item-price"
                                        type="number"
                                        className="form-input w-full rounded-lg"
                                        placeholder="0"
                                        value={customItemPrice}
                                        onChange={(e) => setCustomItemPrice(Number(e.target.value))}
                                        min={0}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="custom-item-quantity" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Quantité <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="custom-item-quantity"
                                        type="number"
                                        className="form-input w-full rounded-lg"
                                        placeholder="1"
                                        value={customItemQuantity}
                                        onChange={(e) => setCustomItemQuantity(Number(e.target.value))}
                                        min={1}
                                    />
                                </div>
                            </div>

                            {/* Price Preview */}
                            <div className="rounded-xl bg-gradient-to-br from-primary/5 to-indigo-50 p-4 dark:from-primary/10 dark:to-indigo-900/10">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                        <span>{customItemPrice.toLocaleString()} FCFA</span>
                                        <span className="mx-1.5 text-slate-400">×</span>
                                        <span>{customItemQuantity}</span>
                                    </div>
                                    <div className="text-lg font-bold text-primary">{(customItemPrice * customItemQuantity).toLocaleString()} FCFA</div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 border-t border-slate-200/60 bg-slate-50/50 px-6 py-4 dark:border-slate-700/50 dark:bg-slate-800/30">
                            <button
                                type="button"
                                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                onClick={() => setShowCustomItemModal(false)}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={addCustomItem}
                                disabled={!customItemName || customItemPrice <= 0 || customItemQuantity <= 0}
                            >
                                Ajouter l&apos;article
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Customer Modal (shared component) */}
            <NewCustomerModal isOpen={showNewCustomerModal} onClose={() => setShowNewCustomerModal(false)} onCustomerCreated={handleNewCustomerCreated} zones={zones} />
        </div>
    );
};

export default OrderAdd;
