import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

export const DraggablePanel = ({ title, onClose, children, defaultSize = { w: 360, h: 480 }, minSize = { w: 260, h: 200 } }) => {
    const [pos, setPos] = useState({ x: 50, y: 50 });
    const [size, setSize] = useState(defaultSize);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef(null);
    const posRef = useRef(pos);
    posRef.current = pos;
    const sizeRef = useRef(size);
    sizeRef.current = size;
    const modeRef = useRef(null); // 'drag' | 'resize' | null
    const dragStart = useRef({ x: 0, y: 0 });
    const resizeStart = useRef({ startX: 0, startY: 0, startW: 360, startH: 480 });

    // Initial position centering or based on default
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const startW = Math.min(defaultSize.w, window.innerWidth - 24);
            const startH = typeof defaultSize.h === 'number' ? Math.min(defaultSize.h, window.innerHeight - 40) : defaultSize.h;
            setSize({ w: startW, h: startH });
            
            // Stagger based on title length to prevent exact overlap
            const staggerX = (title.length % 5) * 16;
            const staggerY = (title.length % 7) * 16;
            
            setPos({
                x: Math.max(10, Math.min(window.innerWidth - startW - 10, window.innerWidth / 2 - startW / 2 + staggerX - 20)),
                y: Math.max(10, Math.min(window.innerHeight - 100, window.innerHeight / 2 - (typeof startH === 'number' ? startH : 400) / 2 + staggerY - 20))
            });
        }
    }, [defaultSize.w, defaultSize.h, title]);

    const getClientCoords = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        }
        if (e.changedTouches && e.changedTouches.length > 0) {
            return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
        }
        return { clientX: e.clientX, clientY: e.clientY };
    };

    const handleGlobalMove = useCallback((e) => {
        if (!modeRef.current) return;
        if (e.cancelable) e.preventDefault();
        const { clientX, clientY } = getClientCoords(e);
        if (clientX === undefined || clientY === undefined) return;

        if (modeRef.current === 'drag') {
            setPos({
                x: Math.max(0, Math.min(window.innerWidth - 60, clientX - dragStart.current.x)),
                y: Math.max(0, Math.min(window.innerHeight - 60, clientY - dragStart.current.y))
            });
        } else if (modeRef.current === 'resize') {
            const dx = clientX - resizeStart.current.startX;
            const dy = clientY - resizeStart.current.startY;
            setSize({
                w: Math.max(minSize.w, resizeStart.current.startW + dx),
                h: typeof minSize.h === 'number' ? Math.max(minSize.h, resizeStart.current.startH + dy) : 'auto'
            });
        }
    }, [minSize.w, minSize.h]);

    const handleGlobalUp = useCallback(() => {
        modeRef.current = null;
        setIsDragging(false);
        setIsResizing(false);
        window.removeEventListener('mousemove', handleGlobalMove);
        window.removeEventListener('mouseup', handleGlobalUp);
        window.removeEventListener('touchmove', handleGlobalMove);
        window.removeEventListener('touchend', handleGlobalUp);
        window.removeEventListener('touchcancel', handleGlobalUp);
    }, [handleGlobalMove]);

    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleGlobalMove);
            window.removeEventListener('mouseup', handleGlobalUp);
            window.removeEventListener('touchmove', handleGlobalMove);
            window.removeEventListener('touchend', handleGlobalUp);
            window.removeEventListener('touchcancel', handleGlobalUp);
        };
    }, [handleGlobalMove, handleGlobalUp]);

    const attachGlobalListeners = () => {
        window.addEventListener('mousemove', handleGlobalMove, { passive: false });
        window.addEventListener('mouseup', handleGlobalUp);
        window.addEventListener('touchmove', handleGlobalMove, { passive: false });
        window.addEventListener('touchend', handleGlobalUp);
        window.addEventListener('touchcancel', handleGlobalUp);
    };

    const handleDragStart = (e) => {
        if (e.target.closest('.no-drag')) return;
        e.stopPropagation();
        const { clientX, clientY } = getClientCoords(e);
        modeRef.current = 'drag';
        setIsDragging(true);
        dragStart.current = { x: clientX - posRef.current.x, y: clientY - posRef.current.y };
        attachGlobalListeners();
    };

    const handleResizeStart = (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        const { clientX, clientY } = getClientCoords(e);
        const rect = panelRef.current?.getBoundingClientRect();
        modeRef.current = 'resize';
        setIsResizing(true);
        resizeStart.current = {
            startX: clientX,
            startY: clientY,
            startW: typeof sizeRef.current.w === 'number' ? sizeRef.current.w : (rect?.width || 360),
            startH: typeof sizeRef.current.h === 'number' ? sizeRef.current.h : (rect?.height || 400)
        };
        attachGlobalListeners();
    };

    return (
        <div 
            ref={panelRef}
            className={`fixed z-[100] yra-card rounded-2xl flex flex-col overflow-hidden transition-opacity duration-200 no-print ${isDragging ? 'opacity-85' : 'opacity-100'}`}
            style={{ 
                left: `${pos.x}px`, 
                top: `${pos.y}px`, 
                width: `${size.w}px`, 
                height: typeof size.h === 'number' ? `${size.h}px` : 'auto',
                maxWidth: 'calc(100vw - 16px)',
                maxHeight: 'calc(100dvh - 20px)'
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
        >
            <div 
                className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] cursor-move shrink-0 select-none touch-none"
                style={{ touchAction: 'none' }}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
            >
                <div className="flex items-center gap-2 pointer-events-none truncate pr-2">
                    <div className="flex flex-col gap-0.5 opacity-40 shrink-0">
                        <div className="w-3.5 h-0.5 bg-current rounded-full" />
                        <div className="w-3.5 h-0.5 bg-current rounded-full" />
                    </div>
                    <div className="font-bold text-sm tracking-normal truncate">{title}</div>
                </div>
                <button onClick={onClose} className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center hover:bg-black/10 rounded-lg transition-colors no-drag shrink-0" aria-label="關閉視窗">
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
                className="absolute bottom-0 right-0 w-7 h-7 cursor-se-resize flex items-end justify-end p-1 select-none touch-none text-[var(--text-muted)] hover:text-[var(--text-accent)] transition-colors z-50"
                style={{ touchAction: 'none' }}
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
