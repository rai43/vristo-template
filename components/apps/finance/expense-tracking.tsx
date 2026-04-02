'use client';
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import dynamic from 'next/dynamic';
import { createExpense, deleteExpense, getExpenses, updateExpense } from '@/lib/api/expenses';
import { createBudget, deleteBudget, getBudgets, updateBudget } from '@/lib/api/budgets';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Expense {
    _id: string;
    id?: string;
    date: string;
    category: string;
    description: string;
    amount: number;
    vendor: string;
    paymentMethod: string;
    status: 'paid' | 'pending' | 'approved';
    receipt?: string;
}

const ExpenseTracking = () => {
    const queryClient = useQueryClient();
    const [isMounted, setIsMounted] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [showModal, setShowModal] = useState(false);
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState<any | null>(null);

    // Fetch budgets from API
    const { data: budgetsData } = useQuery({
        queryKey: ['budgets'],
        queryFn: () => getBudgets(),
    });

    const budgetsList = budgetsData || [];

    const [budgetFormData, setBudgetFormData] = useState({
        category: '',
        budget: '',
        alertThreshold: '70',
    });
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

    // Fetch real expenses from API
    const { data: expensesData } = useQuery({
        queryKey: ['expenses'],
        queryFn: () => getExpenses(),
    });

    const expenses = (expensesData as any[]) || [];

    // Date range filter — default: current month
    const [filterStart, setFilterStart] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    });
    const [filterEnd, setFilterEnd] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    });

    // Filter expenses by selected date range
    const filteredExpenses = expenses.filter((expense: any) => {
        const d = new Date(expense.date);
        return d >= new Date(filterStart) && d <= new Date(filterEnd + 'T23:59:59');
    });

    // Monthly spending for budgets (always current month)
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthlySpending: Record<string, number> = {};
    expenses.forEach((expense: any) => {
        const expenseDate = new Date(expense.date);
        if (expenseDate >= firstDayOfMonth && expenseDate <= lastDayOfMonth) {
            monthlySpending[expense.category] = (monthlySpending[expense.category] || 0) + expense.amount;
        }
    });

    // Check for budget alerts
    const budgetAlerts: {
        category: string;
        spent: number;
        budget: number;
        percentage: number;
        threshold: number;
    }[] = [];
    budgetsList.forEach((budgetItem: any) => {
        const spent = monthlySpending[budgetItem.category] || 0;
        const percentage = budgetItem.budget > 0 ? (spent / budgetItem.budget) * 100 : 0;

        if (percentage >= budgetItem.alertThreshold) {
            budgetAlerts.push({
                category: budgetItem.category,
                spent,
                budget: budgetItem.budget,
                percentage,
                threshold: budgetItem.alertThreshold,
            });
        }
    });

    // Show alert if there are budget warnings
    useEffect(() => {
        if (budgetAlerts.length > 0 && isMounted) {
            const alertMessages = budgetAlerts
                .map(
                    (alert) => `<div class="mb-2">
                    <strong>${alert.category}:</strong> ${alert.spent.toLocaleString()} / ${alert.budget.toLocaleString()} FCFA
                    (${alert.percentage.toFixed(1)}%)
                </div>`,
                )
                .join('');

            Swal.fire({
                title: 'Alerte Budget!',
                html: `<div class="text-left">${alertMessages}</div>`,
                icon: 'warning',
                confirmButtonText: 'OK',
                confirmButtonColor: '#e7515a',
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [budgetAlerts.length, isMounted]);

    // Create mutation
    const createMutation = useMutation({
        mutationFn: (data: any) => createExpense(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            Swal.fire('Ajoutée!', 'La dépense a été enregistrée.', 'success');
            setShowModal(false);
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateExpense(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            Swal.fire('Modifiée!', 'La dépense a été mise à jour.', 'success');
            setShowModal(false);
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteExpense(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            Swal.fire('Supprimé!', 'La dépense a été supprimée.', 'success');
        },
    });

    // Budget mutations
    const createBudgetMutation = useMutation({
        mutationFn: (data: any) => {
            console.log('createBudget mutation called with data:', data);
            return createBudget(data);
        },
        onSuccess: (data) => {
            console.log('Budget created successfully:', data);
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            Swal.fire('Ajouté!', 'Le budget a été créé.', 'success');
            setShowBudgetModal(false);
            setBudgetFormData({ category: '', budget: '', alertThreshold: '70' });
        },
        onError: (error: any) => {
            console.error('Error creating budget:', error);
            console.error('Error response:', error?.response);
            console.error('Error data:', error?.response?.data);
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: error?.response?.data?.message || error?.message || 'Une erreur est survenue lors de la création du budget',
            });
        },
    });

    const updateBudgetMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateBudget(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            Swal.fire('Modifié!', 'Le budget a été mis à jour.', 'success');
            setShowBudgetModal(false);
            setIsEditingBudget(false);
            setEditingBudgetId(null);
            setBudgetFormData({ category: '', budget: '', alertThreshold: '70' });
        },
        onError: (error: any) => {
            console.error('Error updating budget:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: error?.response?.data?.message || 'Une erreur est survenue lors de la modification du budget',
            });
        },
    });

    const deleteBudgetMutation = useMutation({
        mutationFn: (id: string) => deleteBudget(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            Swal.fire('Supprimé!', 'Le budget a été supprimé.', 'success');
        },
        onError: (error: any) => {
            console.error('Error deleting budget:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: error?.response?.data?.message || 'Une erreur est survenue lors de la suppression du budget',
            });
        },
    });

    const [formData, setFormData] = useState({
        category: '',
        description: '',
        amount: '',
        vendor: '',
        paymentMethod: 'Espèces',
        status: 'approved',
        date: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            if (openDropdownId) {
                setOpenDropdownId(null);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [openDropdownId]);

    const categories = ['Produits de nettoyage', 'Équipement', 'Carburant', 'Salaires', 'Maintenance', 'Électricité', 'Eau', 'Loyer', 'Assurance', 'Marketing', 'Fournitures', 'Autres'];

    // Calculate totals from filtered range
    const totalExpenses = filteredExpenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
    const paidExpenses = filteredExpenses.filter((e: any) => e.status === 'paid').reduce((sum: number, exp: any) => sum + exp.amount, 0);
    const pendingExpenses = filteredExpenses.filter((e: any) => e.status === 'pending').reduce((sum: number, exp: any) => sum + exp.amount, 0);

    // Expenses by category (filtered)
    const expensesByCategory: Record<string, number> = {};
    filteredExpenses.forEach((exp: any) => {
        expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + exp.amount;
    });

    // Expenses chart
    const expensesChart: any = {
        series: Object.values(expensesByCategory),
        options: {
            chart: {
                type: 'donut',
                height: 350,
                fontFamily: 'Nunito, sans-serif',
            },
            dataLabels: {
                enabled: false,
            },
            stroke: {
                show: true,
                width: 2,
            },
            colors: ['#4361ee', '#00ab55', '#e7515a', '#e2a03f', '#805dca', '#00bcd4', '#ff9800', '#9e9e9e'],
            legend: {
                position: 'bottom',
                horizontalAlign: 'center',
                fontSize: '14px',
                markers: {
                    width: 10,
                    height: 10,
                },
                itemMargin: {
                    horizontal: 10,
                    vertical: 8,
                },
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: '65%',
                        background: 'transparent',
                        labels: {
                            show: true,
                            name: {
                                show: true,
                                fontSize: '22px',
                                offsetY: -10,
                            },
                            value: {
                                show: true,
                                fontSize: '20px',
                                offsetY: 10,
                                formatter: (val: any) => {
                                    return `${Number(val).toLocaleString()} F`;
                                },
                            },
                            total: {
                                show: true,
                                label: 'Total',
                                color: '#888ea8',
                                fontSize: '16px',
                                formatter: () => {
                                    return `${totalExpenses.toLocaleString()} F`;
                                },
                            },
                        },
                    },
                },
            },
            labels: Object.keys(expensesByCategory),
            states: {
                hover: {
                    filter: {
                        type: 'none',
                    },
                },
                active: {
                    filter: {
                        type: 'none',
                    },
                },
            },
        },
    };

    const handleAddExpense = () => {
        setSelectedExpense(null);
        setFormData({
            category: '',
            description: '',
            amount: '',
            vendor: '',
            paymentMethod: 'Espèces',
            status: 'approved',
            date: new Date().toISOString().split('T')[0],
        });
        setShowModal(true);
    };

    const handleEditExpense = (expense: Expense) => {
        setSelectedExpense(expense);
        setFormData({
            category: expense.category,
            description: expense.description,
            amount: expense.amount.toString(),
            vendor: expense.vendor,
            paymentMethod: expense.paymentMethod,
            status: expense.status,
            date: expense.date,
        });
        setShowModal(true);
    };

    const handleDeleteExpense = (expense: any) => {
        Swal.fire({
            icon: 'warning',
            title: 'Êtes-vous sûr?',
            text: 'Cette action est irréversible!',
            showCancelButton: true,
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler',
            padding: '2em',
        }).then((result) => {
            if (result.isConfirmed) {
                deleteMutation.mutate(expense._id);
            }
        });
    };

    const handleStatusChange = (expense: any, newStatus: string) => {
        setOpenDropdownId(null); // Close dropdown immediately
        Swal.fire({
            title: 'Changer le statut',
            text: `Voulez-vous changer le statut à "${newStatus === 'paid' ? 'Payé' : newStatus === 'approved' ? 'Approuvé' : 'En attente'}"?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Oui, changer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#00ab55',
        }).then((result) => {
            if (result.isConfirmed) {
                updateMutation.mutate({
                    id: expense._id,
                    data: { status: newStatus },
                });
            }
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.category || !formData.description || !formData.amount || !formData.vendor) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Veuillez remplir tous les champs requis',
            });
            return;
        }

        const expenseData = {
            date: formData.date,
            category: formData.category,
            description: formData.description,
            amount: parseFloat(formData.amount),
            vendor: formData.vendor,
            paymentMethod: formData.paymentMethod,
            status: formData.status,
        };

        if (selectedExpense) {
            updateMutation.mutate({ id: selectedExpense._id, data: expenseData });
        } else {
            createMutation.mutate(expenseData);
        }

        setShowModal(false);
    };

    const handleAddBudget = () => {
        setBudgetFormData({
            category: '',
            budget: '',
            alertThreshold: '70',
        });
        setIsEditingBudget(false);
        setEditingBudgetId(null);
        setShowBudgetModal(true);
    };

    const handleEditBudget = (budgetItem: any) => {
        setBudgetFormData({
            category: budgetItem.category,
            budget: budgetItem.budget.toString(),
            alertThreshold: budgetItem.alertThreshold.toString(),
        });
        setIsEditingBudget(true);
        setEditingBudgetId(budgetItem._id);
        setShowBudgetModal(true);
    };

    const handleDeleteBudget = (budgetId: string, category: string) => {
        Swal.fire({
            icon: 'warning',
            title: 'Êtes-vous sûr?',
            text: `Voulez-vous supprimer le budget pour ${category}?`,
            showCancelButton: true,
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#e7515a',
        }).then((result) => {
            if (result.isConfirmed) {
                deleteBudgetMutation.mutate(budgetId);
            }
        });
    };

    const handleBudgetSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        console.log('handleBudgetSubmit called', { budgetFormData, isEditingBudget, editingBudgetId });

        if (!budgetFormData.category || !budgetFormData.budget) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Veuillez remplir tous les champs requis',
            });
            return;
        }

        const budgetData = {
            category: budgetFormData.category,
            budget: parseFloat(budgetFormData.budget),
            alertThreshold: parseFloat(budgetFormData.alertThreshold),
        };

        console.log('Budget data to submit:', budgetData);

        if (isEditingBudget && editingBudgetId) {
            console.log('Updating budget:', editingBudgetId);
            updateBudgetMutation.mutate({ id: editingBudgetId, data: budgetData });
        } else {
            console.log('Creating new budget');
            createBudgetMutation.mutate(budgetData);
        }
    };

    const paginatedExpenses = filteredExpenses.slice((page - 1) * pageSize, page * pageSize);

    const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
        <div className={`rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234] ${className}`}>{children}</div>
    );
    const money = (n: number) => n.toLocaleString('fr-FR') + ' F';

    return (
        <div className="space-y-6">
            {/* Date filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-white px-5 py-3.5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234]">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Période :{' '}
                    <span className="font-bold text-slate-800 dark:text-white">
                        {new Date(filterStart).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                        })}
                        {' → '}
                        {new Date(filterEnd).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                        })}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">
                        ({filteredExpenses.length} dépense{filteredExpenses.length > 1 ? 's' : ''})
                    </span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="date"
                        value={filterStart}
                        onChange={(e) => {
                            setFilterStart(e.target.value);
                            setPage(1);
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <span className="text-slate-400">→</span>
                    <input
                        type="date"
                        value={filterEnd}
                        onChange={(e) => {
                            setFilterEnd(e.target.value);
                            setPage(1);
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <button
                        onClick={() => {
                            const d = new Date();
                            setFilterStart(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]);
                            setFilterEnd(new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]);
                            setPage(1);
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        Ce mois
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total dépenses', value: money(totalExpenses), accent: 'text-red-500' },
                    {
                        label: 'Payées',
                        value: money(paidExpenses),
                        sub: totalExpenses > 0 ? `${((paidExpenses / totalExpenses) * 100).toFixed(0)}% du total` : '',
                        accent: 'text-emerald-600',
                    },
                    { label: 'En attente', value: money(pendingExpenses), accent: 'text-amber-500' },
                ].map((kpi) => (
                    <Card key={kpi.label} className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                        <p className={`mt-2 text-2xl font-bold ${kpi.accent}`}>{kpi.value}</p>
                        {kpi.sub && <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>}
                    </Card>
                ))}
            </div>

            {/* Charts row */}
            <div className="grid gap-6 lg:grid-cols-5">
                <Card className="p-5 lg:col-span-3">
                    <h3 className="mb-4 font-semibold text-slate-800 dark:text-white">Top catégories</h3>
                    <div className="space-y-3">
                        {Object.entries(expensesByCategory)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 6)
                            .map(([cat, amt]) => (
                                <div key={cat}>
                                    <div className="mb-1 flex items-center justify-between">
                                        <span className="text-sm text-slate-600 dark:text-slate-300">{cat}</span>
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{money(amt)}</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                        <div className="h-full rounded-full bg-red-400" style={{ width: `${(amt / totalExpenses) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        {Object.keys(expensesByCategory).length === 0 && <p className="py-4 text-center text-sm text-slate-400">Aucune dépense</p>}
                    </div>
                </Card>
                <Card className="p-5 lg:col-span-2">
                    <h3 className="mb-3 font-semibold text-slate-800 dark:text-white">Répartition</h3>
                    {isMounted && Object.keys(expensesByCategory).length > 0 ? (
                        <ReactApexChart series={expensesChart.series} options={expensesChart.options} type="donut" height={220} />
                    ) : (
                        <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">Aucune donnée</div>
                    )}
                </Card>
            </div>

            {/* Budget Section */}
            <Card>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                    <h3 className="font-semibold text-slate-800 dark:text-white">Budgets Mensuels</h3>
                    <button onClick={handleAddBudget} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90">
                        + Ajouter un budget
                    </button>
                </div>
                {(budgetsList as any[]).length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-400">Aucun budget configuré</p>
                ) : (
                    <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
                        {(budgetsList as any[]).map((budgetItem: any) => {
                            const spent = monthlySpending[budgetItem.category] || 0;
                            const remaining = budgetItem.budget - spent;
                            const percentage = budgetItem.budget > 0 ? (spent / budgetItem.budget) * 100 : 0;
                            const isAlert = percentage >= budgetItem.alertThreshold;

                            return (
                                <div
                                    key={budgetItem._id}
                                    className={`rounded-xl border p-4 ${isAlert ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-900/10' : 'border-slate-100 dark:border-slate-700/50'}`}
                                >
                                    <div className="mb-2 flex items-center justify-between">
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{budgetItem.category}</span>
                                        <div className="flex items-center gap-1.5">
                                            {isAlert && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">Alerte</span>}
                                            <button onClick={() => handleEditBudget(budgetItem)} className="text-slate-400 hover:text-primary" title="Modifier">
                                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path
                                                        d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            </button>
                                            <button onClick={() => handleDeleteBudget(budgetItem._id, budgetItem.category)} className="text-slate-400 hover:text-red-500" title="Supprimer">
                                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path
                                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mb-2 flex items-end justify-between">
                                        <span className="text-lg font-bold text-slate-800 dark:text-white">{money(spent)}</span>
                                        <span className="text-xs text-slate-400">/ {money(budgetItem.budget)}</span>
                                    </div>
                                    <div className="mb-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                percentage >= 100 ? 'bg-red-500' : percentage >= budgetItem.alertThreshold ? 'bg-amber-500' : 'bg-emerald-500'
                                            }`}
                                            style={{ width: `${Math.min(percentage, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-slate-400">{percentage.toFixed(0)}% utilisé</span>
                                        <span className={remaining >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                                            {remaining >= 0 ? `${money(remaining)} restant` : `${money(Math.abs(remaining))} dépassé`}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {/* Expenses Table */}
            <Card>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                    <h3 className="font-semibold text-slate-800 dark:text-white">Liste des dépenses</h3>
                    <button onClick={handleAddExpense} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90">
                        + Ajouter
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-50 dark:border-slate-800">
                                {['Date', 'Catégorie', 'Description', 'Fournisseur', 'Mode', 'Montant', 'Statut', ''].map((h, i) => (
                                    <th key={`${h}${i}`} className={`px-4 py-2.5 text-xs font-semibold text-slate-400 ${i === 5 ? 'text-right' : i === 6 ? 'text-center' : 'text-left'}`}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {paginatedExpenses.map((expense: any) => (
                                <tr key={expense._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                    <td className="px-4 py-2.5 text-xs text-slate-400">{new Date(expense.date).toLocaleDateString('fr-FR')}</td>
                                    <td className="px-4 py-2.5">
                                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{expense.category}</span>
                                    </td>
                                    <td className="max-w-[180px] truncate px-4 py-2.5 text-slate-600 dark:text-slate-300">{expense.description}</td>
                                    <td className="px-4 py-2.5 text-xs text-slate-500">{expense.vendor}</td>
                                    <td className="px-4 py-2.5 text-xs text-slate-500">{expense.paymentMethod}</td>
                                    <td className="px-4 py-2.5 text-right font-semibold text-red-500">{money(expense.amount)}</td>
                                    <td className="px-4 py-2.5 text-center">
                                        <div className="relative inline-block">
                                            <span
                                                className={`cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                    expense.status === 'paid'
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : expense.status === 'approved'
                                                          ? 'bg-blue-50 text-blue-700'
                                                          : 'bg-amber-50 text-amber-700'
                                                }`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenDropdownId(openDropdownId === expense._id ? null : expense._id);
                                                }}
                                            >
                                                {expense.status === 'paid' ? 'Payé' : expense.status === 'approved' ? 'Approuvé' : 'En attente'} ▾
                                            </span>
                                            {openDropdownId === expense._id && (
                                                <ul
                                                    className="absolute right-0 z-50 mt-1 min-w-[160px] rounded-xl border border-slate-100 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-[#1a2234]"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {(['paid', 'approved', 'pending'] as const).map((s) => (
                                                        <li key={s}>
                                                            <button
                                                                type="button"
                                                                className="w-full px-4 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                                                                onClick={() => handleStatusChange(expense, s)}
                                                            >
                                                                {s === 'paid' ? 'Marquer payé' : s === 'approved' ? 'Marquer approuvé' : 'Marquer en attente'}
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleEditExpense(expense)}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                                            >
                                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path
                                                        d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteExpense(expense)}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                                            >
                                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path
                                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredExpenses.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="py-8 text-center text-slate-400">
                                        Aucune dépense pour la période sélectionnée
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {filteredExpenses.length > pageSize && (
                    <div className="flex items-center justify-between border-t border-slate-50 px-5 py-3 dark:border-slate-800">
                        <span className="text-xs text-slate-400">{filteredExpenses.length} dépenses</span>
                        <div className="flex items-center gap-2">
                            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700">
                                ← Préc.
                            </button>
                            <span className="text-xs text-slate-400">
                                {page}/{Math.ceil(filteredExpenses.length / pageSize)}
                            </span>
                            <button
                                disabled={page >= Math.ceil(filteredExpenses.length / pageSize)}
                                onClick={() => setPage((p) => p + 1)}
                                className="rounded px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700"
                            >
                                Suiv. →
                            </button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Add/Edit Expense Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[999] overflow-y-auto bg-black/50" onClick={() => setShowModal(false)}>
                    <div className="flex min-h-screen items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#1a2234]">
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
                                <h2 className="font-semibold text-slate-800 dark:text-white">{selectedExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}</h2>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M18 6L6 18M6 6L18 18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-4 p-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Date *</label>
                                        <input
                                            type="date"
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Catégorie *</label>
                                        <select
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800"
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            required
                                        >
                                            <option value="">— Catégorie —</option>
                                            {categories.map((cat) => (
                                                <option key={cat} value={cat}>
                                                    {cat}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Description *</label>
                                    <textarea
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800"
                                        rows={2}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Fournisseur *</label>
                                        <input
                                            type="text"
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800"
                                            value={formData.vendor}
                                            onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Montant (F) *</label>
                                        <input
                                            type="number"
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800"
                                            value={formData.amount}
                                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                            required
                                            min="0"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Mode de paiement</label>
                                        <select
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800"
                                            value={formData.paymentMethod}
                                            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                                        >
                                            {['Espèces', 'Virement', 'Chèque', 'Mobile Money'].map((m) => (
                                                <option key={m} value={m}>
                                                    {m}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Statut</label>
                                        <select
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800"
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        >
                                            <option value="approved">Approuvé</option>
                                            <option value="pending">En attente</option>
                                            <option value="paid">Payé</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
                                    >
                                        Annuler
                                    </button>
                                    <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
                                        {selectedExpense ? 'Mettre à jour' : 'Enregistrer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Budget Modal */}
            {showBudgetModal && (
                <div className="fixed inset-0 z-[999] overflow-y-auto bg-black/50" onClick={() => setShowBudgetModal(false)}>
                    <div className="flex min-h-screen items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#1a2234]">
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
                                <h2 className="font-semibold text-slate-800 dark:text-white">{isEditingBudget ? 'Modifier le budget' : 'Nouveau budget'}</h2>
                                <button onClick={() => setShowBudgetModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M18 6L6 18M6 6L18 18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleBudgetSubmit} className="space-y-4 p-6">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Catégorie *</label>
                                    {isEditingBudget ? (
                                        <input
                                            type="text"
                                            className="w-full rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                                            value={budgetFormData.category}
                                            disabled
                                        />
                                    ) : (
                                        <select
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800"
                                            value={budgetFormData.category}
                                            onChange={(e) =>
                                                setBudgetFormData({
                                                    ...budgetFormData,
                                                    category: e.target.value,
                                                })
                                            }
                                            required
                                        >
                                            <option value="">— Catégorie —</option>
                                            {categories.map((cat) => (
                                                <option key={cat} value={cat}>
                                                    {cat}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Budget mensuel (F) *</label>
                                    <input
                                        type="number"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800"
                                        value={budgetFormData.budget}
                                        onChange={(e) => setBudgetFormData({ ...budgetFormData, budget: e.target.value })}
                                        required
                                        min="0"
                                        placeholder="Ex: 300000"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Seuil d&apos;alerte (%)</label>
                                    <input
                                        type="number"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800"
                                        value={budgetFormData.alertThreshold}
                                        onChange={(e) =>
                                            setBudgetFormData({
                                                ...budgetFormData,
                                                alertThreshold: e.target.value,
                                            })
                                        }
                                        min="1"
                                        max="100"
                                        placeholder="70"
                                    />
                                    <p className="mt-1 text-[10px] text-slate-400">Alerte déclenchée quand ce % du budget est atteint</p>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowBudgetModal(false)}
                                        disabled={createBudgetMutation.isPending || updateBudgetMutation.isPending}
                                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={createBudgetMutation.isPending || updateBudgetMutation.isPending}
                                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
                                    >
                                        {createBudgetMutation.isPending || updateBudgetMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpenseTracking;
