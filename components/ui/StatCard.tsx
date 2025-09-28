
import React from 'react';

export const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="bg-slate-800/50 p-4 rounded-lg flex items-center gap-4 border border-slate-700/50">
        <div className="text-teal-400">{icon}</div>
        <div>
            <div className="text-sm text-slate-400">{label}</div>
            <div className="text-lg font-bold text-slate-100 truncate" title={String(value)}>{value}</div>
        </div>
    </div>
);
