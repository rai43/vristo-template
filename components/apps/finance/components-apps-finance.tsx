'use client';
import React, { useState } from 'react';
import FinanceDashboard from './finance-dashboard';
import RevenueAnalytics from './revenue-analytics';
import ExpenseTracking from './expense-tracking';
import PaymentReconciliation from './payment-reconciliation';
import FinancialReports from './financial-reports';
import SalariesManagement from './salaries-management';

const TABS = [
    { id: 'overview', label: "Vue d'ensemble" },
    { id: 'revenue', label: 'Revenus' },
    { id: 'expenses', label: 'Dépenses' },
    { id: 'salaries', label: 'Salaires' },
    { id: 'reconciliation', label: 'Recouvrement' },
    { id: 'reports', label: 'Rapports' },
];

const ComponentsAppsFinance = () => {
    const [activeTab, setActiveTab] = useState('overview');

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Gestion Financière</h1>
                    <p className="mt-0.5 text-sm text-slate-400">
                        {new Date().toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        })}{' '}
                        · Revenus, dépenses, salaires et rapports
                    </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Exercice {new Date().getFullYear()}</span>
            </div>

            {/* Tab bar */}
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex gap-1 overflow-x-auto">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-t after:bg-primary'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab content */}
            <div>
                {activeTab === 'overview' && <FinanceDashboard />}
                {activeTab === 'revenue' && <RevenueAnalytics />}
                {activeTab === 'expenses' && <ExpenseTracking />}
                {activeTab === 'salaries' && <SalariesManagement />}
                {activeTab === 'reconciliation' && <PaymentReconciliation />}
                {activeTab === 'reports' && <FinancialReports />}
            </div>
        </div>
    );
};

export default ComponentsAppsFinance;
