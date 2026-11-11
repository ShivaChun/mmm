import React from 'react';

export const InfoItem = ({ label, value, unit, isDarkMode }) => (
    <div className="flex flex-col border-l-4 border-black pl-3 py-1">
        <span className="theme-text-muted text-[10px] font-black uppercase tracking-wider">{label}</span>
        <span className="theme-text font-black text-lg whitespace-nowrap leading-none mt-1">
            {value} <span className="text-xs font-bold opacity-60 uppercase">{unit}</span>
        </span>
    </div>
);

export const LegendItem = ({ color, label, value, textColor, valueColor, type = 'box' }) => (
    <div className="flex items-center gap-3 p-1 hover:bg-stone-100 transition-colors">
        {type === 'line' ? (
            <div className={`w-6 h-1 ${color.replace('bg-', 'bg-')} border border-black shadow-[2px_2px_0_#000]`}></div>
        ) : (
            <div className={`w-4 h-4 rounded-none border-2 border-black ${color} shadow-[2px_2px_0_#000]`}></div>
        )}
        <div className="flex flex-col leading-tight">
            <span className={`text-[11px] font-black uppercase tracking-tight ${textColor}`}>{label}</span>
            {value && <span className={`text-[10px] font-bold opacity-70 ${valueColor}`}>{value}</span>}
        </div>
    </div>
);
