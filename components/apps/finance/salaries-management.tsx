'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { createSalary, deleteSalary, getSalaries, updateSalary } from '@/lib/api/salaries';

interface Advance {
    date: string;
    amount: number;
    description: string;
}

interface SalaryPayment {
    date: string;
    amount: number;
    method: string;
    reference?: string;
}

const SalariesManagement = () => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [showModal, setShowModal] = useState(false);
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedSalary, setSelectedSalary] = useState<any | null>(null);

    // Initialize with current month dates
    const getCurrentMonthDates = () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            start: firstDay.toISOString().split('T')[0],
            end: lastDay.toISOString().split('T')[0],
        };
    };

    const currentMonth = getCurrentMonthDates();
    const [startDate, setStartDate] = useState(currentMonth.start);
    const [endDate, setEndDate] = useState(currentMonth.end);

    // Fetch salaries
    const { data: salariesData, isLoading } = useQuery({
        queryKey: ['salaries'],
        queryFn: () => getSalaries(),
    });

    const salaries = (salariesData as any[]) || [];

    // Filter salaries by date range
    const filteredSalaries = salaries.filter((salary: any) => {
        const salaryDate = new Date(salary.createdAt || salary.month);
        const start = new Date(startDate);
        const end = new Date(endDate + 'T23:59:59');
        return salaryDate >= start && salaryDate <= end;
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: (data: any) => createSalary(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salaries'] });
            Swal.fire('Ajouté!', 'Le salaire a été enregistré.', 'success');
            setShowModal(false);
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateSalary(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salaries'] });
            Swal.fire('Modifié!', 'Le salaire a été mis à jour.', 'success');
            setShowModal(false);
            setShowAdvanceModal(false);
            setShowPaymentModal(false);
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteSalary(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salaries'] });
            Swal.fire('Supprimé!', 'Le salaire a été supprimé.', 'success');
        },
    });

    const [formData, setFormData] = useState({
        employeeName: '',
        employeeId: '',
        position: '',
        baseSalary: '',
        bonuses: '',
        month: new Date().toISOString().split('T')[0].slice(0, 7),
    });

    const [advanceFormData, setAdvanceFormData] = useState({
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
    });

    const [paymentFormData, setPaymentFormData] = useState({
        amount: '',
        method: 'Virement',
        reference: '',
        date: new Date().toISOString().split('T')[0],
    });

    // Calculate totals
    const totalSalaries = filteredSalaries.reduce((sum: number, sal: any) => sum + (sal.grossSalary || 0), 0);
    const totalPaid = filteredSalaries.reduce((sum: number, sal: any) => {
        const payments = sal.payments || [];
        const paidAmount = payments.reduce((pSum: number, p: SalaryPayment) => pSum + p.amount, 0);
        return sum + paidAmount;
    }, 0);
    const totalAdvances = filteredSalaries.reduce((sum: number, sal: any) => {
        const advances = sal.advances || [];
        return sum + advances.reduce((aSum: number, a: Advance) => aSum + a.amount, 0);
    }, 0);
    const totalRemaining = totalSalaries - totalPaid;

    const handleAddSalary = () => {
        setSelectedSalary(null);
        setFormData({
            employeeName: '',
            employeeId: '',
            position: '',
            baseSalary: '',
            bonuses: '',
            month: new Date().toISOString().split('T')[0].slice(0, 7),
        });
        setShowModal(true);
    };

    const handleEditSalary = (salary: any) => {
        setSelectedSalary(salary);
        setFormData({
            employeeName: salary.employeeName,
            employeeId: salary.employeeId,
            position: salary.position,
            baseSalary: salary.baseSalary.toString(),
            bonuses: (salary.bonuses || 0).toString(),
            month: salary.month,
        });
        setShowModal(true);
    };

    const handleDeleteSalary = (salary: any) => {
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
                deleteMutation.mutate(salary._id);
            }
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.employeeName || !formData.baseSalary) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Veuillez remplir tous les champs requis',
            });
            return;
        }

        const salaryData = {
            employeeName: formData.employeeName,
            employeeId: formData.employeeId,
            position: formData.position,
            baseSalary: parseFloat(formData.baseSalary),
            bonuses: parseFloat(formData.bonuses) || 0,
            month: formData.month,
        };

        if (selectedSalary) {
            updateMutation.mutate({ id: selectedSalary._id, data: salaryData });
        } else {
            createMutation.mutate(salaryData);
        }

        setShowModal(false);
    };

    const handleAddAdvance = (salary: any) => {
        setSelectedSalary(salary);
        setAdvanceFormData({
            amount: '',
            description: '',
            date: new Date().toISOString().split('T')[0],
        });
        setShowAdvanceModal(true);
    };

    const handleAdvanceSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!advanceFormData.amount) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Veuillez entrer le montant',
            });
            return;
        }

        const newAdvance = {
            date: advanceFormData.date,
            amount: parseFloat(advanceFormData.amount),
            description: advanceFormData.description,
        };

        const advances = selectedSalary.advances || [];
        advances.push(newAdvance);

        updateMutation.mutate({
            id: selectedSalary._id,
            data: { advances },
        });
    };

    const handleAddPayment = (salary: any) => {
        setSelectedSalary(salary);
        setPaymentFormData({
            amount: '',
            method: 'Virement',
            reference: '',
            date: new Date().toISOString().split('T')[0],
        });
        setShowPaymentModal(true);
    };

    const handlePaymentSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!paymentFormData.amount) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Veuillez entrer le montant',
            });
            return;
        }

        const newPayment = {
            date: paymentFormData.date,
            amount: parseFloat(paymentFormData.amount),
            method: paymentFormData.method,
            reference: paymentFormData.reference,
        };

        const payments = selectedSalary.payments || [];
        payments.push(newPayment);

        updateMutation.mutate({
            id: selectedSalary._id,
            data: { payments },
        });
    };

    const paginatedSalaries = filteredSalaries.slice((page - 1) * pageSize, page * pageSize);
    const totalPages = Math.ceil(filteredSalaries.length / pageSize);

    const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
        <div className={`rounded-xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700/50 dark:bg-[#1a2234] ${className}`}>{children}</div>
    );
    const money = (n: number) => n.toLocaleString('fr-FR') + ' F';
    const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white';

    if (isLoading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Period filter */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-400">
                    Période :{' '}
                    <strong className="text-slate-700 dark:text-slate-200">
                        {startDate} → {endDate}
                    </strong>
                </p>
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-600 dark:bg-[#1a2234] dark:text-white"
                    />
                    <span className="text-slate-400">→</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-600 dark:bg-[#1a2234] dark:text-white"
                    />
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                    { label: 'Total salaires', value: money(totalSalaries), sub: `${filteredSalaries.length} employés` },
                    {
                        label: 'Payé',
                        value: money(totalPaid),
                        sub: `${totalSalaries > 0 ? ((totalPaid / totalSalaries) * 100).toFixed(0) : 0}% du total`,
                        accent: 'text-emerald-600',
                    },
                    { label: 'Avances', value: money(totalAdvances), accent: 'text-amber-500' },
                    {
                        label: 'Restant',
                        value: money(totalRemaining),
                        accent: totalRemaining > 0 ? 'text-red-500' : 'text-emerald-500',
                    },
                ].map((kpi: any) => (
                    <Card key={kpi.label} className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                        <p className={`mt-2 text-2xl font-bold ${kpi.accent || 'text-slate-800 dark:text-white'}`}>{kpi.value}</p>
                        {kpi.sub && <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>}
                    </Card>
                ))}
            </div>

            {/* Table */}
            <Card>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/50">
                    <h3 className="font-semibold text-slate-800 dark:text-white">Gestion des Salaires</h3>
                    <button onClick={handleAddSalary} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90">
                        + Ajouter
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-50 dark:border-slate-800">
                                {['Employé', 'Mois', 'Salaire brut', 'Avances', 'Payé', 'Restant', 'Statut', ''].map((h, i) => (
                                    <th key={`${h}${i}`} className={`px-4 py-2.5 text-xs font-semibold text-slate-400 ${i >= 2 && i <= 5 ? 'text-right' : i === 6 ? 'text-center' : 'text-left'}`}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {paginatedSalaries.map((row: any) => {
                                const payments = row.payments || [];
                                const advances = row.advances || [];
                                const paid = payments.reduce((s: number, p: SalaryPayment) => s + p.amount, 0);
                                const adv = advances.reduce((s: number, a: Advance) => s + a.amount, 0);
                                const remaining = (row.grossSalary || 0) - paid;
                                const status = remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
                                return (
                                    <tr key={row._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-700 dark:text-slate-200">{row.employeeName}</div>
                                            <div className="text-[10px] text-slate-400">{row.position}</div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-400">
                                            {row.month
                                                ? new Date(row.month + '-01').toLocaleDateString('fr-FR', {
                                                      year: 'numeric',
                                                      month: 'long',
                                                  })
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">{money(row.grossSalary || 0)}</td>
                                        <td className="px-4 py-3 text-right text-amber-500">
                                            {money(adv)}
                                            <div className="text-[10px] text-slate-400">{advances.length} avance(s)</div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-emerald-600">
                                            {money(paid)}
                                            <div className="text-[10px] text-slate-400">{payments.length} pmt(s)</div>
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${remaining > 0 ? 'text-red-500' : 'text-slate-400'}`}>{remaining > 0 ? money(remaining) : '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                    status === 'paid' ? 'bg-emerald-50 text-emerald-700' : status === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                                                }`}
                                            >
                                                {status === 'paid' ? 'Payé' : status === 'partial' ? 'Partiel' : 'Impayé'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleAddAdvance(row)}
                                                    title="Avance"
                                                    className="rounded-lg px-2 py-1 text-[10px] font-semibold text-amber-600 hover:bg-amber-50"
                                                >
                                                    Avance
                                                </button>
                                                <button
                                                    onClick={() => handleAddPayment(row)}
                                                    title="Paiement"
                                                    className="rounded-lg px-2 py-1 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-50"
                                                >
                                                    Payer
                                                </button>
                                                <button
                                                    onClick={() => handleEditSalary(row)}
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
                                                    onClick={() => handleDeleteSalary(row)}
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
                                );
                            })}
                            {filteredSalaries.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="py-8 text-center text-slate-400">
                                        Aucun salaire pour la période
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-50 px-5 py-3 dark:border-slate-800">
                        <span className="text-xs text-slate-400">{filteredSalaries.length} entrées</span>
                        <div className="flex items-center gap-2">
                            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700">
                                ← Préc.
                            </button>
                            <span className="text-xs text-slate-400">
                                {page}/{totalPages}
                            </span>
                            <button
                                disabled={page === totalPages}
                                onClick={() => setPage((p) => p + 1)}
                                className="rounded px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700"
                            >
                                Suiv. →
                            </button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Add/Edit Salary Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[999] overflow-y-auto bg-black/50" onClick={() => setShowModal(false)}>
                    <div className="flex min-h-screen items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#1a2234]">
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
                                <h2 className="font-semibold text-slate-800 dark:text-white">{selectedSalary ? 'Modifier le salaire' : 'Nouveau salaire'}</h2>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M18 6L6 18M6 6L18 18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-4 p-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nom de l&apos;employé *</label>
                                        <input
                                            type="text"
                                            className={inputCls}
                                            value={formData.employeeName}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    employeeName: e.target.value,
                                                })
                                            }
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">ID Employé</label>
                                        <input
                                            type="text"
                                            className={inputCls}
                                            value={formData.employeeId}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    employeeId: e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Poste</label>
                                        <input type="text" className={inputCls} value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Mois *</label>
                                        <input type="month" className={inputCls} value={formData.month} onChange={(e) => setFormData({ ...formData, month: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Salaire de base (F) *</label>
                                        <input
                                            type="number"
                                            className={inputCls}
                                            value={formData.baseSalary}
                                            onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                                            required
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Primes (F)</label>
                                        <input type="number" className={inputCls} value={formData.bonuses} onChange={(e) => setFormData({ ...formData, bonuses: e.target.value })} min="0" />
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
                                        {selectedSalary ? 'Mettre à jour' : 'Enregistrer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Advance Modal */}
            {showAdvanceModal && (
                <div className="fixed inset-0 z-[999] overflow-y-auto bg-black/50" onClick={() => setShowAdvanceModal(false)}>
                    <div className="flex min-h-screen items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#1a2234]">
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
                                <h2 className="font-semibold text-slate-800 dark:text-white">Avance — {selectedSalary?.employeeName}</h2>
                                <button onClick={() => setShowAdvanceModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M18 6L6 18M6 6L18 18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleAdvanceSubmit} className="space-y-4 p-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Date *</label>
                                        <input
                                            type="date"
                                            className={inputCls}
                                            value={advanceFormData.date}
                                            onChange={(e) =>
                                                setAdvanceFormData({
                                                    ...advanceFormData,
                                                    date: e.target.value,
                                                })
                                            }
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Montant (F) *</label>
                                        <input
                                            type="number"
                                            className={inputCls}
                                            value={advanceFormData.amount}
                                            onChange={(e) =>
                                                setAdvanceFormData({
                                                    ...advanceFormData,
                                                    amount: e.target.value,
                                                })
                                            }
                                            required
                                            min="0"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Description</label>
                                    <textarea
                                        className={inputCls}
                                        rows={2}
                                        value={advanceFormData.description}
                                        onChange={(e) =>
                                            setAdvanceFormData({
                                                ...advanceFormData,
                                                description: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowAdvanceModal(false)}
                                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
                                    >
                                        Annuler
                                    </button>
                                    <button type="submit" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600">
                                        Enregistrer
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-[999] overflow-y-auto bg-black/50" onClick={() => setShowPaymentModal(false)}>
                    <div className="flex min-h-screen items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#1a2234]">
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
                                <h2 className="font-semibold text-slate-800 dark:text-white">Paiement — {selectedSalary?.employeeName}</h2>
                                <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M18 6L6 18M6 6L18 18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handlePaymentSubmit} className="space-y-4 p-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Date *</label>
                                        <input
                                            type="date"
                                            className={inputCls}
                                            value={paymentFormData.date}
                                            onChange={(e) =>
                                                setPaymentFormData({
                                                    ...paymentFormData,
                                                    date: e.target.value,
                                                })
                                            }
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Montant (F) *</label>
                                        <input
                                            type="number"
                                            className={inputCls}
                                            value={paymentFormData.amount}
                                            onChange={(e) =>
                                                setPaymentFormData({
                                                    ...paymentFormData,
                                                    amount: e.target.value,
                                                })
                                            }
                                            required
                                            min="0"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Mode de paiement *</label>
                                        <select
                                            className={inputCls}
                                            value={paymentFormData.method}
                                            onChange={(e) =>
                                                setPaymentFormData({
                                                    ...paymentFormData,
                                                    method: e.target.value,
                                                })
                                            }
                                            required
                                        >
                                            {['Virement', 'Espèces', 'Chèque', 'Mobile Money'].map((m) => (
                                                <option key={m} value={m}>
                                                    {m}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Référence</label>
                                        <input
                                            type="text"
                                            className={inputCls}
                                            value={paymentFormData.reference}
                                            onChange={(e) =>
                                                setPaymentFormData({
                                                    ...paymentFormData,
                                                    reference: e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowPaymentModal(false)}
                                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
                                    >
                                        Annuler
                                    </button>
                                    <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                                        Enregistrer
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

export default SalariesManagement;
