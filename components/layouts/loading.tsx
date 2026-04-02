import React from 'react';

const Loading = () => {
    return (
        <div className="screen_loader fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#fafafa] dark:bg-[#060818]">
            {/* MIRAI Logo/Brand */}
            <div className="mb-6">
                <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12">
                        {/* Spinning ring */}
                        <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary" style={{ animationDuration: '1s' }} />
                        {/* Inner circle */}
                        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-primary to-cyan-400 opacity-20" />
                    </div>
                    <div className="text-2xl font-bold text-slate-700 dark:text-white">
                        MIRAI<span className="text-primary">.</span>
                    </div>
                </div>
            </div>

            {/* Loading text */}
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span>Chargement</span>
                <span className="flex gap-1">
                    <span className="inline-block animate-bounce" style={{ animationDelay: '0ms' }}>
                        .
                    </span>
                    <span className="inline-block animate-bounce" style={{ animationDelay: '150ms' }}>
                        .
                    </span>
                    <span className="inline-block animate-bounce" style={{ animationDelay: '300ms' }}>
                        .
                    </span>
                </span>
            </div>

            {/* Progress bar - using custom Tailwind animation */}
            <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-full w-1/2 animate-loading-bar rounded-full bg-gradient-to-r from-primary to-cyan-400" />
            </div>
        </div>
    );
};

export default Loading;
