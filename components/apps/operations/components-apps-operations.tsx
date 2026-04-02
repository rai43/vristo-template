'use client';
import React, { Suspense, useState } from 'react';
import Swal from 'sweetalert2';
import { useOperations } from './useOperations';
import OperationsStatsBar from './shared/OperationsStatsBar';
import OperationsFilterBar from './shared/OperationsFilterBar';
import OperationsTabNav from './shared/OperationsTabNav';
import QuickActionsModal from './shared/QuickActionsModal';
import DailyView from './tabs/DailyView';
import CalendarView from './tabs/CalendarView';
import PriorityView from './tabs/PriorityView';
import PickupsView from './tabs/PickupsView';
import DeliveriesView from './tabs/DeliveriesView';
import StockView from './tabs/StockView';
import { formatDate } from './utils';
import { Operation } from './types';

const ComponentsAppsOperations = () => {
    // Quick actions modal state
    const [quickActionOp, setQuickActionOp] = useState<Operation | null>(null);

    const {
        activeView,
        setActiveView,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        searchQuery,
        setSearchQuery,
        calendarOrderType,
        setCalendarOrderType,
        calendarOperationType,
        setCalendarOperationType,
        deliverySubView,
        setDeliverySubView,
        resetToCurrentWeek,
        stats,
        isLoading,
        dailyOperations,
        priorityOperations,
        pickupOperations,
        deliveryOperations,
        stockOperations,
        allDeliveryOps,
        calendarEvents,
        rescheduleMutation,
        handleViewOrder,
        search,
        refetch,
    } = useOperations();

    const handleEventDrop = async (info: any) => {
        const op = info.event.extendedProps;
        const newDate = info.event.start;
        const formattedDate = newDate.toISOString().split('T')[0];
        const hours = newDate.getHours().toString().padStart(2, '0');
        const minutes = newDate.getMinutes().toString().padStart(2, '0');
        const formattedTime = `${hours}:${minutes}`;

        const result = await Swal.fire({
            title: 'Confirmer la reprogrammation',
            html: `
                <div class="text-left space-y-2 text-sm">
                    <p><strong>Commande:</strong> ${op.orderId}</p>
                    <p><strong>Client:</strong> ${op.customer?.name}</p>
                    <p><strong>Type:</strong> ${op.operationType === 'pickup' ? 'Récupération' : 'Livraison'} #${op.operationIndex + 1}</p>
                    <div class="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
                        <p class="text-primary"><strong>Nouvelle date:</strong> ${formatDate(formattedDate)}</p>
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Oui, reprogrammer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#4361ee',
        });

        if (result.isConfirmed) {
            rescheduleMutation.mutate({
                orderId: op.orderMongoId,
                operationType: op.operationType,
                operationIndex: op.operationIndex,
                newDate: formattedDate,
                scheduledTime: formattedTime,
            });
        } else {
            info.revert();
        }
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-center">
                    <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                    <p className="mt-4 text-sm text-slate-500">Chargement des opérations...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* ── Header + Stats unified ────────────────────── */}
            <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50/80 p-6 shadow-sm dark:border-slate-700/40 dark:from-[#1a2234] dark:to-[#1a2234]">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">Centre des Opérations</h1>
                        <p className="mt-0.5 text-xs text-slate-400">Récupérations · Traitements · Livraisons</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-xs text-slate-400">
                            MAJ :{' '}
                            <span className="font-medium text-slate-600 dark:text-slate-300">
                                {new Date().toLocaleTimeString('fr-FR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </span>
                        </div>
                    </div>
                </div>
                <OperationsStatsBar
                    stats={stats}
                    activeView={activeView}
                    onViewChange={setActiveView}
                    pickupCount={pickupOperations.length}
                    deliveryCount={allDeliveryOps.length}
                    stockCount={stockOperations.length}
                />
            </div>

            {/* ── Filter Bar ────────────────────────────────── */}
            <OperationsFilterBar
                dateFrom={dateFrom}
                dateTo={dateTo}
                searchQuery={searchQuery}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                onSearchChange={setSearchQuery}
                onResetWeek={resetToCurrentWeek}
            />

            {/* ── Tab Navigation ────────────────────────────── */}
            <OperationsTabNav
                activeView={activeView}
                onViewChange={setActiveView}
                counts={{
                    priority: priorityOperations.length,
                    pickups: pickupOperations.length,
                    deliveries: allDeliveryOps.length,
                    stock: stockOperations.length,
                }}
            />

            {/* ── Active Tab Content ────────────────────────── */}
            <div className="min-h-[300px]">
                {activeView === 'daily' && <DailyView dailyOperations={dailyOperations} search={search} onViewOrder={handleViewOrder} />}

                {activeView === 'calendar' && (
                    <Suspense
                        fallback={
                            <div className="flex h-64 items-center justify-center">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                            </div>
                        }
                    >
                        <CalendarView
                            calendarEvents={calendarEvents}
                            calendarOrderType={calendarOrderType}
                            calendarOperationType={calendarOperationType}
                            onOrderTypeChange={setCalendarOrderType}
                            onOperationTypeChange={setCalendarOperationType}
                            onEventDrop={handleEventDrop}
                            onViewOrder={handleViewOrder}
                            onQuickAction={setQuickActionOp}
                            onReschedule={(data) => {
                                rescheduleMutation.mutate({
                                    orderId: data.orderId,
                                    operationType: data.operationType as 'pickup' | 'delivery',
                                    operationIndex: data.operationIndex,
                                    newDate: data.newDate,
                                    scheduledTime: data.scheduledTime,
                                });
                            }}
                        />
                    </Suspense>
                )}

                {activeView === 'priority' && <PriorityView operations={priorityOperations} search={search} onViewOrder={handleViewOrder} onQuickAction={setQuickActionOp} />}
                {activeView === 'pickups' && <PickupsView operations={pickupOperations} search={search} onViewOrder={handleViewOrder} onQuickAction={setQuickActionOp} />}
                {activeView === 'deliveries' && (
                    <DeliveriesView
                        operations={allDeliveryOps}
                        search={search}
                        onViewOrder={handleViewOrder}
                        subView={deliverySubView}
                        onSubViewChange={setDeliverySubView}
                        onQuickAction={setQuickActionOp}
                    />
                )}

                {activeView === 'stock' && <StockView operations={stockOperations} search={search} onViewOrder={handleViewOrder} onQuickAction={setQuickActionOp} />}
            </div>

            {/* Quick Actions Modal */}
            {quickActionOp && <QuickActionsModal operation={quickActionOp} onClose={() => setQuickActionOp(null)} />}
        </div>
    );
};

export default ComponentsAppsOperations;
