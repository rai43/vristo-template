'use client';

interface DateRangeFilterProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    onReset?: () => void;
    label?: string;
}

const DateRangeFilter = ({ startDate, endDate, onStartDateChange, onEndDateChange, onReset, label = 'Période' }: DateRangeFilterProps) => {
    const getCurrentMonthDates = () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            start: firstDay.toISOString().split('T')[0],
            end: lastDay.toISOString().split('T')[0],
        };
    };

    const handleResetToCurrentMonth = () => {
        const dates = getCurrentMonthDates();
        onStartDateChange(dates.start);
        onEndDateChange(dates.end);
        if (onReset) onReset();
    };

    return (
        <div className="flex flex-wrap items-end gap-4">
            <div>
                <label htmlFor="startDate" className="mb-1 block text-sm font-semibold">
                    Date de début
                </label>
                <input id="startDate" type="date" className="form-input w-full" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
            </div>
            <div>
                <label htmlFor="endDate" className="mb-1 block text-sm font-semibold">
                    Date de fin
                </label>
                <input id="endDate" type="date" className="form-input w-full" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} min={startDate} />
            </div>
            <button type="button" className="btn btn-primary" onClick={handleResetToCurrentMonth}>
                <svg className="h-5 w-5 ltr:mr-2 rtl:ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12Z" strokeWidth="2" />
                    <path d="M12 7V12L15 15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Mois actuel
            </button>
        </div>
    );
};

export default DateRangeFilter;
