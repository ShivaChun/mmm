import React from 'react';

export const ArtisticCompass = React.memo(({ className = '', rotation = 0, isDarkMode = false, hideLetters = false }) => (
    <div className={`relative ${className}`} style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Brutalist Square Frame */}
            <rect x="5" y="5" width="90" height="90" fill="white" stroke="black" strokeWidth="4" />
            <rect x="10" y="10" width="80" height="80" fill="none" stroke="black" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
            
            {/* Crosshairs */}
            <line x1="50" y1="5" x2="50" y2="95" stroke="black" strokeWidth="1" />
            <line x1="5" y1="50" x2="95" y2="50" stroke="black" strokeWidth="1" />
            
            {/* Sharp Needle */}
            <path d="M 50 15 L 60 50 L 50 50 L 40 50 Z" fill="black" />
            <path d="M 50 85 L 45 50 L 50 50 L 55 50 Z" fill="#e2e8f0" stroke="black" strokeWidth="1" />
            
            {!hideLetters && (
                <text x="50" y="32" textAnchor="middle" fontSize="12" fontWeight="900" fill="black" className="font-['Archivo_Black',_sans-serif]">N</text>
            )}
            
            {/* Center Hub */}
            <rect x="47" y="47" width="6" height="6" fill="black" />
        </svg>
        {/* Heavy Shadow Layer */}
        <div className="absolute inset-0 -z-10 translate-x-1 translate-y-1 bg-black opacity-20"></div>
    </div>
));
