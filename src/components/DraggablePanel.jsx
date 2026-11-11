import React, { useState, useRef, useEffect } from 'react';
import { X, Maximize2 } from 'lucide-react';

export const DraggablePanel = ({ title, onClose, children, defaultSize = { w: 360, h: 480 }, minSize = { w: 260, h: 200 } }) => {
    const [pos, setPos] = useState({ x: 50, y: 50 });
    const [size, setSize] = useState(defaultSize);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef(null);
    const dragStart = useRef(null);
    const resizeStart = useRef(null);

    // Initial position centering or based on default
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const startW = Math.min(defaultSize.w, window.innerWidth - 40);
            const startH = typeof defaultSize.h === 'number' ? Math.min(defaultSize.h, window.innerHeight - 40) : defaultSize.h;
            setSize({ w: startW, h: startH });
            
            // Stagger based on title length to prevent exact overlap
            const staggerX = (title.length % 5) * 20;
            const staggerY = (title.length % 7) * 20;
            
            setPos({
                x: Math.max(10, window.innerWidth / 2 - startW / 2 + staggerX - 40),
                y: Math.max(10, window.innerHeight / 2 - (typeof startH === 'number' ? startH : 400) / 2 + staggerY - 40)
            });
        }
    }, [defaultSize.w, defaultSize.h, title]);

    const handleDragStart = (e) => {
        if (e.target.closest('.no-drag')) return;
        setIsDragging(true);
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        dragStart.current = { x: clientX - pos.x, y: clientY - pos.y };
        e.stopPropagation();
    };

    const handleResizeStart = (e) => {
        setIsResizing(true);
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        resizeStart.current = { startX: clientX, startY: clientY, startW: size.w, startH: size.h };
        e.stopPropagation();
        e.preventDefault();
    };

    useEffect(() => {
        const handleMove = (e) => {
            const clientX = e.type.includes('mouse') ? e.clientX : e.touches?.[0]?.clientX;
            const clientY = e.type.includes('mouse') ? e.clientY : e.touches?.[0]?.clientY;
            if (clientX === undefined) return;

            if (isDragging) {
                setPos({
                    x: Math.max(0, Math.min(window.innerWidth - 50, clientX - dragStart.current.x)),
                    y: Math.max(0, Math.min(window.innerHeight - 50, clientY - dragStart.current.y))
                });
            } else if (isResizing) {
                const dx = clientX - resizeStart.current.startX;
                const dy = clientY - resizeStart.current.startY;
                setSize({
                    w: Math.max(minSize.w, resizeStart.current.startW + dx),
                    h: typeof minSize.h === 'number' ? Math.max(minSize.h, resizeStart.current.startH + dy) : 'auto'
                });
            }
        };

        const handleUp = () => {
            setIsDragging(false);
            setIsResizing(false);
        };

        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMove, { passive: false });
            window.addEventListener('mouseup', handleUp);
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
        };
    }, [isDragging, isResizing, minSize]);

    return (
        <div 
            ref={panelRef}
            className={`fixed z-[100] theme-panel-glass backdrop-blur-xl border theme-border shadow-2xl rounded-xl flex flex-col overflow-hidden transition-opacity duration-200 ${isDragging ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}
            style={{ 
                left: `${pos.x}px`, 
                top: `${pos.y}px`, 
                width: `${size.w}px`, 
                height: typeof size.h === 'number' ? `${size.h}px` : 'auto',
                maxWidth: 'calc(100vw - 20px)',
                maxHeight: 'calc(100vh - 20px)'
            }}
        >
            <div 
                className="flex items-center justify-between px-3.5 py-2.5 border-b theme-border bg-black/5 dark:bg-white/5 cursor-move shrink-0"
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
            >
                <div className="font-bold text-xs sm:text-sm tracking-widest uppercase opacity-80 pointer-events-none truncate pr-2">{title}</div>
                <button onClick={onClose} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors no-drag shrink-0">
                    <X size={16} />
                </button>
            </div>
            
            <div
                className="@container flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar"
                style={{ containerType: 'inline-size' }}
            >
                <div className="p-3 @[480px]:p-4 @[720px]:p-5 w-full min-w-0">
                    {children}
                </div>
            </div>

            <div 
                className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 select-none text-[var(--text-muted)] hover:text-[var(--text-accent)] transition-colors z-50"
                onMouseDown={handleResizeStart}
                onTouchStart={handleResizeStart}
            >
                <svg width="12" height="12" viewBox="0 0 12 12" className="pointer-events-none">
                    <line x1="12" y1="0" x2="0" y2="12" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="12" y1="8" x2="8" y2="12" stroke="currentColor" strokeWidth="1.5" />
                </svg>
            </div>
        </div>
    );
};
