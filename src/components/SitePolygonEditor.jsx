import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
    Hexagon, Map, Compass, Move, Square, CheckCircle2, 
    GripHorizontal, ChevronUp, ChevronDown, Layers, Shovel, 
    Lock, Unlock, LayoutDashboard, RotateCcw, Trash2, Info, Plus, Edit3, X,
    Pencil, EyeOff, Sparkles, CopyCheck, Maximize2, Minimize2
} from 'lucide-react';
import { toPing, toSqm, formatNum } from '../utils/geometry';
import { scalePolygon, calculatePolygonArea, getPolygonCentroid, discretizePolygon, getSegmentNormal, clipPolygonByPolygon, getPolygonBounds } from '../utils/polygon';

export const HOVER_TIPS_STORAGE_KEY = 'yra_hide_hover_tooltips_v1';

/**
 * 全域懸浮提示偏好設定 Hook（支援跨元件即時同步與永久關閉/重啟）
 */
export function useHoverTipsPreference() {
    const [hoverTipsEnabled, setHoverTipsEnabledState] = useState(() => {
        try {
            return localStorage.getItem(HOVER_TIPS_STORAGE_KEY) !== 'true';
        } catch {
            return true;
        }
    });

    useEffect(() => {
        const onSync = () => {
            try {
                setHoverTipsEnabledState(localStorage.getItem(HOVER_TIPS_STORAGE_KEY) !== 'true');
            } catch {}
        };
        window.addEventListener('yra-hover-tips-change', onSync);
        return () => window.removeEventListener('yra-hover-tips-change', onSync);
    }, []);

    const setHoverTipsEnabled = useCallback((enabled) => {
        try {
            if (enabled) localStorage.removeItem(HOVER_TIPS_STORAGE_KEY);
            else localStorage.setItem(HOVER_TIPS_STORAGE_KEY, 'true');
        } catch {}
        setHoverTipsEnabledState(Boolean(enabled));
        window.dispatchEvent(new Event('yra-hover-tips-change'));
    }, []);

    return [hoverTipsEnabled, setHoverTipsEnabled];
}

/**
 * Blender / SketchUp 風格圖示工具按鈕（具備「點選前精確懸浮提示卡」與「不再顯示提示」開關）
 */
export const ToolIconBtn = ({
    icon,
    label,
    showLabel = false,
    badge = null,
    active = false,
    disabled = false,
    variant = 'default', // 'default' | 'emerald' | 'amber' | 'indigo' | 'sky' | 'blue' | 'danger' | 'dark'
    tipTitle,
    tipDesc,
    tipShortcut,
    tipPlacement = 'bottom', // 'bottom' | 'top' | 'right'
    hoverTipsEnabled = true,
    onDisableHoverTips,
    onClick,
    className = ''
}) => {
    const [hovered, setHovered] = useState(false);

    // 統一視覺系統：未啟用為單色線條（黑/暖灰），啟用一律以主色橘填滿（警示為警示紅）
    const activeOrange = 'bg-[#E85D2A] text-white border-[#171614] shadow-[2px_2px_0_rgba(23,22,20,0.25)]';
    const inactiveMono = 'bg-white/95 text-[#171614] border-[#DDD8CE] hover:bg-[#F4F2EE] hover:border-[#171614]';
    const variantStyles = {
        default: active ? activeOrange : inactiveMono,
        emerald: active ? activeOrange : inactiveMono,
        amber: active ? activeOrange : inactiveMono,
        indigo: active ? activeOrange : inactiveMono,
        sky: active ? activeOrange : inactiveMono,
        blue: active
            ? 'bg-[#2563EB] text-white border-[#171614] shadow-[2px_2px_0_rgba(23,22,20,0.25)]'
            : inactiveMono,
        danger: active
            ? 'bg-[#DC2626] text-white border-[#171614] shadow-[2px_2px_0_rgba(23,22,20,0.25)]'
            : 'bg-white/95 text-[#DC2626] border-[#DDD8CE] hover:bg-red-50 hover:border-[#DC2626]',
        dark: 'bg-[#171614] text-white border-[#171614] hover:bg-[#2C2A26] shadow-[2px_2px_0_rgba(23,22,20,0.25)]'
    };

    const posClasses = tipPlacement === 'top'
        ? 'bottom-full mb-2.5 left-1/2 -translate-x-1/2'
        : tipPlacement === 'right'
            ? 'left-full ml-2.5 top-0'
            : 'top-full mt-2.5 left-0';

    return (
        <div
            className="relative inline-flex items-center"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <button
                type="button"
                disabled={disabled}
                title={tipTitle || label}
                aria-label={tipTitle || label}
                onClick={(e) => {
                    setHovered(false);
                    if (onClick) onClick(e);
                }}
                className={`relative flex items-center justify-center gap-1.5 border-2 transition-all select-none ${
                    showLabel ? 'px-2.5 h-9 text-xs font-black' : 'w-9 h-9'
                } ${
                    disabled
                        ? 'bg-stone-200 text-stone-400 border-stone-400 cursor-not-allowed'
                        : variantStyles[variant] || variantStyles.default
                } ${className}`}
            >
                {icon}
                {showLabel && label && <span className="whitespace-nowrap">{label}</span>}
                {badge !== null && badge !== undefined && (
                    <span className={`px-1 py-0 text-[9px] font-mono font-black leading-tight border border-black ${
                        active ? 'bg-white text-black' : 'bg-slate-900 text-white'
                    } ${showLabel ? 'ml-0.5' : 'absolute -top-1.5 -right-1.5'}`}>
                        {badge}
                    </span>
                )}
                {active && !showLabel && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-current opacity-90" />
                )}
            </button>

            {/* 點選前精確懸浮提示卡 (Hover Tooltip before clicking) */}
            {hovered && hoverTipsEnabled && (tipTitle || tipDesc) && (
                <div
                    className={`absolute ${posClasses} z-[220] w-64 p-2.5 bg-slate-900 text-white border-2 border-black shadow-[4px_4px_0_#000] pointer-events-auto animate-in fade-in duration-100 text-left`}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1.5 mb-1.5">
                        <span className="font-black text-xs text-amber-300 flex items-center gap-1.5">
                            {icon}
                            <span>{tipTitle || label}</span>
                        </span>
                        {tipShortcut && (
                            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-600 text-[9px] font-mono font-bold text-slate-200 whitespace-nowrap">
                                {tipShortcut}
                            </kbd>
                        )}
                    </div>
                    {tipDesc && (
                        <p className="text-[11px] text-slate-200 leading-relaxed font-medium">
                            {tipDesc}
                        </p>
                    )}
                    {onDisableHoverTips && (
                        <div className="mt-2 pt-1.5 border-t border-slate-700/80 flex items-center justify-between">
                            <span className="text-[9px] text-slate-400">點選前懸浮說明</span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setHovered(false);
                                    onDisableHoverTips();
                                }}
                                className="text-[10px] font-black text-rose-300 hover:text-white bg-slate-800 hover:bg-rose-600 px-1.5 py-0.5 border border-slate-600 transition-colors flex items-center gap-1"
                            >
                                <EyeOff size={10} />
                                <span>不再顯示提示</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const EditableInput = ({ value, onChange, className, step = 1, disabled }) => {
    const [localVal, setLocalVal] = useState(value);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!isEditing) {
            setLocalVal(typeof value === 'number' ? parseFloat(value.toFixed(2)) : value);
        }
    }, [value, isEditing]);

    const handleBlur = () => {
        setIsEditing(false);
        if (localVal !== "" && !isNaN(parseFloat(localVal))) {
            onChange(parseFloat(localVal));
        } else {
            setLocalVal(typeof value === 'number' ? parseFloat(value.toFixed(2)) : value);
        }
    };

    return (
        <input
            type="number"
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onFocus={() => setIsEditing(true)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
            step={step}
            className={className}
            disabled={disabled}
        />
    );
};

export const SummaryRow = ({ label, value, highlight, isAlert, alertText, subtext }) => (
    <div className="flex justify-between items-center py-2 border-b-2 border-black last:border-0 group">
        <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 group-hover:text-black transition-colors">{label}</span>
        <div className="text-right">
            <div className={`font-black num-font ${highlight ? 'text-emerald-600 text-lg' : (isAlert ? 'text-red-600 underline' : 'text-black')}`}>
                {value}
                {isAlert && <span className="ml-2 text-[10px] bg-red-600 text-white px-1 font-black uppercase tracking-tighter">{alertText}</span>}
            </div>
            {subtext && <div className="text-[9px] font-bold text-stone-400 uppercase">{subtext}</div>}
        </div>
    </div>
);

const GESTURE_GUIDE_STORAGE_KEY = 'yra_hide_2d_gesture_guide_v1';

const getEventClientCoords = (e) => {
    if (e.touches && e.touches.length > 0) {
        return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
        return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
};

export const CoordinatePopup = ({ point, idx, onChange, scale, isDarkMode, selectedIndices, totalPointsCount = 4, onDeletePoint, onClearSelection, screenAnchor }) => {
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const dragRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });
    const offsetRef = useRef(dragOffset);
    offsetRef.current = dragOffset;

    const handleMove = useCallback((e) => {
        if (!dragRef.current.active) return;
        if (e.cancelable) e.preventDefault();
        const { clientX, clientY } = getEventClientCoords(e);
        if (clientX === undefined || clientY === undefined) return;
        setDragOffset({
            x: dragRef.current.origX + (clientX - dragRef.current.startX),
            y: dragRef.current.origY + (clientY - dragRef.current.startY)
        });
    }, []);

    const handleUp = useCallback(() => {
        dragRef.current.active = false;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleUp);
        window.removeEventListener('touchcancel', handleUp);
    }, [handleMove]);

    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
            window.removeEventListener('touchcancel', handleUp);
        };
    }, [handleMove, handleUp]);

    const handleHeaderStart = (e) => {
        if (e.target.closest('button')) return;
        e.stopPropagation();
        const { clientX, clientY } = getEventClientCoords(e);
        dragRef.current = {
            active: true,
            startX: clientX,
            startY: clientY,
            origX: offsetRef.current.x,
            origY: offsetRef.current.y
        };
        window.addEventListener('mousemove', handleMove, { passive: false });
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleUp);
        window.addEventListener('touchcancel', handleUp);
    };

    const selectedCount = selectedIndices ? selectedIndices.size : (point ? 1 : 0);
    if (!point && selectedCount === 0) return null;

    const anchorX = screenAnchor ? screenAnchor.x : (point ? point.x * scale : 0);
    const anchorY = screenAnchor ? screenAnchor.y : (point ? point.y * scale : 0);
    const selectedLabels = selectedIndices ? Array.from(selectedIndices).sort((a, b) => a - b).map(i => `#${i + 1}`).join(', ') : `#${(idx || 0) + 1}`;

    return (
        <div
            className="absolute z-[60] p-2.5 rounded-none shadow-[4px_4px_0_#000] border-2 border-black bg-white text-black animate-riseUp min-w-[148px] no-context-menu"
            style={{
                left: `calc(50% + ${anchorX + dragOffset.x}px)`,
                top: `calc(50% + ${anchorY + dragOffset.y}px)`,
                transform: 'translate(14px, -50%)'
            }}
            onPointerDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
        >
            <div
                className="text-[10px] font-black uppercase tracking-widest text-stone-600 mb-2 pb-1 border-b border-stone-200 flex justify-between items-center gap-2 cursor-move select-none touch-none"
                style={{ touchAction: 'none' }}
                onMouseDown={handleHeaderStart}
                onTouchStart={handleHeaderStart}
            >
                <span className="flex items-center gap-1">
                    <GripHorizontal size={12} className="text-stone-400" />
                    {selectedCount > 1 ? `已多選 ${selectedCount} 點` : `Point ${(idx ?? 0) + 1}`}
                </span>
                {onClearSelection && (
                    <button onClick={(e) => { e.stopPropagation(); onClearSelection(); }} className="p-0.5 hover:bg-stone-200 text-stone-500 hover:text-black" title="取消選取">
                        <X size={12} />
                    </button>
                )}
            </div>
            {selectedCount > 1 && (
                <div className="mb-2 px-1.5 py-1 bg-indigo-50 border border-indigo-200 text-[10px] font-bold text-indigo-700 leading-tight">
                    <div>選取點: {selectedLabels}</div>
                    <div className="text-[9px] text-indigo-500 mt-0.5">拖曳任一選中點即可同步移動</div>
                </div>
            )}
            {point && (
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black w-4">X</span>
                        <EditableInput value={point.x} onChange={(v) => onChange('x', v)} className="w-20 p-1 text-xs border-2 border-black rounded-none bg-white text-right font-black outline-none focus:bg-black focus:text-white" />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black w-4">Y</span>
                        <EditableInput value={point.y} onChange={(v) => onChange('y', v)} className="w-20 p-1 text-xs border-2 border-black rounded-none bg-white text-right font-black outline-none focus:bg-black focus:text-white" />
                    </div>
                </div>
            )}
            {totalPointsCount > 3 && onDeletePoint && idx !== undefined && idx !== null && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDeletePoint(e, idx); }}
                    className="mt-2 w-full py-1 px-2 text-[10px] font-black uppercase border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center gap-1"
                >
                    <Trash2 size={11} /> 刪除此控制點
                </button>
            )}
        </div>
    );
};

export const ContextMenu = ({ x, y, isOpen, onClose, items, isDarkMode }) => {
    const [pos, setPos] = useState({ x: 20, y: 20 });
    const posRef = useRef(pos);
    posRef.current = pos;
    const dragRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });

    useEffect(() => {
        if (isOpen && typeof window !== 'undefined') {
            const clampedX = Math.max(12, Math.min(x, window.innerWidth - 210));
            const clampedY = Math.max(12, Math.min(y, window.innerHeight - 320));
            setPos({ x: clampedX, y: clampedY });
        }
    }, [x, y, isOpen]);

    const handleMove = useCallback((e) => {
        if (!dragRef.current.active) return;
        if (e.cancelable) e.preventDefault();
        const { clientX, clientY } = getEventClientCoords(e);
        if (clientX === undefined || clientY === undefined) return;
        const maxX = typeof window !== 'undefined' ? window.innerWidth - 60 : 9999;
        const maxY = typeof window !== 'undefined' ? window.innerHeight - 60 : 9999;
        setPos({
            x: Math.max(0, Math.min(maxX, dragRef.current.origX + (clientX - dragRef.current.startX))),
            y: Math.max(0, Math.min(maxY, dragRef.current.origY + (clientY - dragRef.current.startY)))
        });
    }, []);

    const handleUp = useCallback(() => {
        dragRef.current.active = false;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleUp);
        window.removeEventListener('touchcancel', handleUp);
    }, [handleMove]);

    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
            window.removeEventListener('touchcancel', handleUp);
        };
    }, [handleMove, handleUp]);

    const handleHeaderDragStart = (e) => {
        if (e.target.closest('button')) return;
        e.stopPropagation();
        const { clientX, clientY } = getEventClientCoords(e);
        dragRef.current = {
            active: true,
            startX: clientX,
            startY: clientY,
            origX: posRef.current.x,
            origY: posRef.current.y
        };
        window.addEventListener('mousemove', handleMove, { passive: false });
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleUp);
        window.addEventListener('touchcancel', handleUp);
    };

    if (!isOpen) return null;
    return (
        <div
            className="fixed z-[80] min-w-[195px] rounded-none shadow-[8px_8px_0_#000] border-4 border-black overflow-hidden animate-in fade-in zoom-in-95 duration-100 bg-white text-black no-context-menu"
            style={{ top: pos.y, left: pos.x }}
            onTouchStart={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div
                className="px-3 py-2 bg-black text-white flex items-center justify-between cursor-move select-none touch-none border-b-2 border-black"
                style={{ touchAction: 'none' }}
                onMouseDown={handleHeaderDragStart}
                onTouchStart={handleHeaderDragStart}
            >
                <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 pointer-events-none">
                    <GripHorizontal size={13} /> 編輯選單
                </span>
                <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-0.5 hover:text-red-400 transition-colors">
                    <X size={13} />
                </button>
            </div>
            {items.map((item, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); item.action(); onClose(); }} className={`w-full text-left px-4 py-2.5 text-xs font-black uppercase tracking-tight flex items-center gap-3 border-b-2 border-black last:border-0 hover:bg-black hover:text-white transition-colors ${item.className || ''}`}>
                    {item.icon}
                    <span>{item.label}</span>
                </button>
            ))}
        </div>
    );
};

export const EditMenu2D = ({ data, isDarkMode, onUpdateSetting, onReset, isOpen, onClose, scale3d, inputs, basePoints, isRoadSelectMode, onToggleRoadSelectMode, interactionMode, setInteractionMode, selectedCurveIdx, onUpdateRoads, onUpdateInputs, isAreaLocked, setIsAreaLocked, unitSettings, onUpdateUnitSettings, onStartDrawSite, onRequestApplyAll }) => {
    const [activeTab, setActiveTab] = useState('shape');
    const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, isOpen: false });
    const [dontShowGuideAgain, setDontShowGuideAgain] = useState(false);
    // 預設不自動彈出遮擋畫面的全螢幕說明窗，改以「點選前懸浮提示卡」呈現；使用者僅在主動點擊「?」時才開啟完整手冊
    const [showHelp, setShowHelp] = useState(false);
    const [hoverTipsEnabled, setHoverTipsEnabled] = useHoverTipsPreference();

    const handleCloseGuide = (persistDismiss = false) => {
        if (persistDismiss || dontShowGuideAgain) {
            try {
                localStorage.setItem(GESTURE_GUIDE_STORAGE_KEY, 'true');
            } catch {
                // ignore storage errors
            }
        }
        setShowHelp(false);
    };

    const contextMenuItems = [
        { label: '形狀編輯', icon: <Edit3 size={14} />, action: () => setActiveTab('shape') },
        { label: '框選多個控制點', icon: <Square size={14} className="text-indigo-600" />, action: () => { setActiveTab('shape'); setInteractionMode(prev => prev === 'box_select' ? 'none' : 'box_select'); } },
        { label: '曲線編輯 (拉動橘點)', icon: <Hexagon size={14} className="text-amber-500" />, action: () => { setActiveTab('shape'); setInteractionMode(prev => prev === 'curve' ? 'none' : 'curve'); } },
        { label: '道路設定', icon: <Compass size={14} />, action: () => setActiveTab('roads') },
        { label: '位置移動', icon: <Move size={14} />, action: () => setActiveTab('pos') },
        { label: '後院退縮', icon: <Square size={14} className="text-emerald-500" />, action: () => setInteractionMode('set_back') },
        { label: '側院退縮', icon: <Square size={14} className="text-blue-500" />, action: () => setInteractionMode('set_side') },
        { label: '操作手勢說明', icon: <Info size={14} className="text-sky-600" />, action: () => setShowHelp(true) },
        { label: '完成編輯', icon: <CheckCircle2 size={14} />, action: onClose, className: 'text-green-600 font-bold' }
    ];
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [lockedParam, setLockedParam] = useState(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const posRef = useRef(position);
    posRef.current = position;
    const isRenderable = Boolean(data) && isOpen;
    const isBase = data?.id === 'base';
    const isExcavation = data?.id === 'excavation';
    const pingValue = toPing(data?.realArea || 0);
    const points = data?.points || null;

    useEffect(() => {
        if (!isRenderable) return;
        if (activeTab === 'shape' && !points && !isRoadSelectMode && !isBase) {
            const w = data.realWidth;
            const d = data.realDepth;

            if (isExcavation && basePoints) {
                const scaleRate = Math.sqrt(inputs.excavationRatio / 100);
                const { points: newPts, curves: newCurves } = scalePolygon(basePoints, inputs.baseCurves, scaleRate);
                onUpdateSetting(data.id, 'points', newPts);
                onUpdateSetting(data.id, 'curves', newCurves);
            } else {
                const pts = [{ x: -w / 2, y: -d / 2 }, { x: w / 2, y: -d / 2 }, { x: w / 2, y: d / 2 }, { x: -w / 2, y: d / 2 }];
                onUpdateSetting(data.id, 'points', pts);
            }
        }
    }, [activeTab, data, inputs.excavationRatio, isBase, isExcavation, isRenderable, isRoadSelectMode, onUpdateSetting, points, basePoints]);

    const handleArea = (val) => {
        const newAreaSqm = toSqm(val);
        if (points) {
            const currentArea = data.realArea;
            const scale = Math.sqrt(newAreaSqm / currentArea);
            const { points: newPoints, curves: newCurves } = scalePolygon(points, data.curves, scale, { x: 0, y: 0 });
            onUpdateSetting(data.id, 'points', newPoints);
            if (newCurves) onUpdateSetting(data.id, 'curves', newCurves);
        } else {
            if (lockedParam === 'width') onUpdateSetting(data.id, 'depth', newAreaSqm / data.realWidth);
            else if (lockedParam === 'depth') onUpdateSetting(data.id, 'width', newAreaSqm / data.realDepth);
            onUpdateSetting(data.id, 'area', newAreaSqm);
        }
    };

    const handleResetShape = () => {
        if (isBase) {
            const w = data.realWidth;
            const d = data.realDepth;
            const pts = [{ x: -w / 2, y: -d / 2 }, { x: w / 2, y: -d / 2 }, { x: w / 2, y: d / 2 }, { x: -w / 2, y: d / 2 }];
            onUpdateSetting(data.id, 'points', pts);
            onUpdateSetting(data.id, 'curves', null);
        } else {
            onUpdateSetting(data.id, 'points', null);
            onUpdateSetting(data.id, 'curves', null);
        }
        onReset(data.id);
    };

    const handleRevertCurve = () => {
        if (selectedCurveIdx !== null) {
            const newCurves = { ...(data.curves || {}) };
            delete newCurves[selectedCurveIdx];
            onUpdateSetting(data.id, 'curves', newCurves);
        }
    };

    const toggleTab = (t) => setActiveTab(prev => prev === t ? null : t);
    const toggleLock = (p) => setLockedParam(prev => prev === p ? null : p);

    const LockBtn = ({ p }) => (
        <button onClick={(e) => { e.stopPropagation(); toggleLock(p); }} className={`p-1 rounded ${lockedParam === p ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400'}`}>
            {lockedParam === p ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
    );

    const handleToggleEdge = (roadId, edgeIdx) => {
        const newRoads = inputs.roads.map(r => {
            if (r.id === roadId) {
                const indices = new Set(r.edgeIndices || []);
                if (r.edgeIndex !== undefined && r.edgeIndex !== null && r.edgeIndex !== "") indices.add(parseInt(r.edgeIndex));
                if (indices.has(edgeIdx)) indices.delete(edgeIdx);
                else indices.add(edgeIdx);
                return { ...r, edgeIndices: Array.from(indices), edgeIndex: undefined };
            }
            return r;
        });
        onUpdateRoads(newRoads);
    };

    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const initialPos = useRef({ x: 0, y: 0 });

    const handleGlobalMove = useCallback((e) => {
        if (!isDragging.current) return;
        if (e.cancelable) e.preventDefault();
        const { clientX, clientY } = getEventClientCoords(e);
        if (clientX === undefined || clientY === undefined) return;
        const dx = clientX - dragStart.current.x;
        const dy = clientY - dragStart.current.y;
        setPosition({ x: initialPos.current.x + dx, y: initialPos.current.y + dy });
    }, []);

    const handleGlobalEnd = useCallback(() => {
        isDragging.current = false;
        window.removeEventListener('mousemove', handleGlobalMove);
        window.removeEventListener('mouseup', handleGlobalEnd);
        window.removeEventListener('touchmove', handleGlobalMove);
        window.removeEventListener('touchend', handleGlobalEnd);
        window.removeEventListener('touchcancel', handleGlobalEnd);
    }, [handleGlobalMove]);

    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleGlobalMove);
            window.removeEventListener('mouseup', handleGlobalEnd);
            window.removeEventListener('touchmove', handleGlobalMove);
            window.removeEventListener('touchend', handleGlobalEnd);
            window.removeEventListener('touchcancel', handleGlobalEnd);
        };
    }, [handleGlobalMove, handleGlobalEnd]);

    if (!isRenderable) return null;

    const handleDragStart = (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
        e.stopPropagation();
        const { clientX, clientY } = getEventClientCoords(e);
        isDragging.current = true;
        dragStart.current = { x: clientX, y: clientY };
        initialPos.current = { ...posRef.current };
        window.addEventListener('mousemove', handleGlobalMove, { passive: false });
        window.addEventListener('mouseup', handleGlobalEnd);
        window.addEventListener('touchmove', handleGlobalMove, { passive: false });
        window.addEventListener('touchend', handleGlobalEnd);
        window.addEventListener('touchcancel', handleGlobalEnd);
    };

    return (
        <>
            <ContextMenu x={contextMenu.x} y={contextMenu.y} isOpen={contextMenu.isOpen} onClose={() => setContextMenu({ ...contextMenu, isOpen: false })} items={contextMenuItems} isDarkMode={isDarkMode} />

            {/* 第一次操作提示 / 操作手勢說明 Modal */}
            {showHelp && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150 no-context-menu"
                    onClick={(e) => { e.stopPropagation(); handleCloseGuide(false); }}
                    onTouchStart={(e) => e.stopPropagation()}
                >
                    <div
                        className="relative bg-white text-black border-4 border-black shadow-[10px_10px_0_#000] max-w-md w-full p-5 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b-2 border-black pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-black text-white flex items-center justify-center font-black">
                                    <Info size={16} />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm sm:text-base uppercase tracking-tight">2D/3D 整合工作台・點拉線與操作指南</h3>
                                    <p className="text-[11px] font-bold text-stone-500">直接在 3D/俯視統一畫布中點拉線繪製基地與編輯各層形狀</p>
                                </div>
                            </div>
                            <button onClick={() => handleCloseGuide(false)} className="p-1 hover:bg-stone-100 border-2 border-transparent hover:border-black transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs leading-relaxed">
                            <div className="p-3 bg-emerald-50/80 border-2 border-black space-y-1.5">
                                <div className="font-black text-emerald-800 flex items-center gap-1.5 text-xs sm:text-sm">
                                    <span>✏️ 1. 點拉線繪製基地（自由多邊形）</span>
                                </div>
                                <ul className="list-disc pl-4 space-y-1 text-stone-700 font-medium">
                                    <li><span className="font-black text-black">開始繪製：</span>點擊左上角或工具列「<span className="font-black text-emerald-700">點拉線繪基地</span>」，直接在畫布點擊第 1 點後移動滑鼠拉出線段，依序點擊各角點。</li>
                                    <li><span className="font-black text-black">精確控制：</span>拉線時即時顯示邊長與角度；可開啟「<span className="font-black text-emerald-700">正交鎖定</span>」或直接輸入精確米數落點。</li>
                                    <li><span className="font-black text-black">完成封閉：</span>點擊起點 <span className="font-black">#1</span>、雙擊最後一點或按 <kbd className="px-1 py-0.5 bg-white border border-black text-[10px] font-black">Enter</kbd> 即可封閉成形，並自動生成 3D 量體與進入形狀微調模式！</li>
                                </ul>
                            </div>

                            <div className="p-3 bg-indigo-50/80 border-2 border-black space-y-1.5">
                                <div className="font-black text-indigo-700 flex items-center gap-1.5 text-xs sm:text-sm">
                                    <span>🎯 2. 多選控制點與同步移動</span>
                                </div>
                                <ul className="list-disc pl-4 space-y-1 text-stone-700 font-medium">
                                    <li><span className="font-black text-black">點選多點：</span>直接<span className="font-black text-indigo-600">輕點（Tap）多個控制點</span>即可逐一加入或取消多選（電腦亦可按住 <kbd className="px-1 py-0.5 bg-white border border-black text-[10px] font-black">Shift</kbd> 點選）。</li>
                                    <li><span className="font-black text-black">整邊選取：</span><span className="font-black text-indigo-600">輕點任意邊線</span>，可一鍵同時選取該邊兩端的控制點並直接拖曳整條邊！</li>
                                    <li><span className="font-black text-black">框選多點：</span>點選下方工具列「<span className="font-black text-indigo-600">BOX 框選</span>」按鈕，直接拉出方框即可一次框選多個控制點。</li>
                                    <li><span className="font-black text-black">同步拖曳：</span>選中多個點後，<span className="font-black text-indigo-600">按住任一已選控制點拖曳</span>，所有選中點與 3D 量體會即時同步更新。</li>
                                </ul>
                            </div>

                            <div className="p-3 bg-amber-50/70 border-2 border-black space-y-1.5">
                                <div className="font-black text-amber-800 flex items-center gap-1.5 text-xs sm:text-sm">
                                    <span>📐 3. 新增、刪除頂點與曲線編輯</span>
                                </div>
                                <ul className="list-disc pl-4 space-y-1 text-stone-700 font-medium">
                                    <li><span className="font-black text-black">新增與刪除：</span><span className="font-black text-amber-700">雙擊邊線</span>可在中間新增控制點；點選控制點後可於座標面板點擊「<span className="font-black text-red-600">刪除此控制點</span>」。</li>
                                    <li><span className="font-black text-black">拉出弧線：</span>開啟下方「<span className="font-black text-amber-700">CURVE</span>」或選取相鄰兩點，拖曳<span className="font-black text-amber-600">橘色圓點</span>即可拉出曲線（雙擊橘點恢復直線）。</li>
                                    <li><span className="font-black text-black">精確邊長：</span><span className="font-black text-amber-700">長按邊線</span>（或 Shift+點擊邊線）可輸入精確邊長數值。</li>
                                </ul>
                            </div>

                            <div className="p-3 bg-stone-100 border-2 border-black space-y-1">
                                <div className="font-black text-stone-800 text-xs sm:text-sm">🖐️ 3. 畫布瀏覽與選單拖曳</div>
                                <p className="text-stone-700 font-medium">
                                    單指拖曳空白處可平移畫布、雙指捏合可縮放；所有選單、工具列與座標框皆可<span className="font-black text-black">按住標題欄或上方拖曳柄</span>自由移動位置。
                                </p>
                            </div>
                        </div>

                        <div className="pt-2 border-t-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <label className="flex items-center gap-2 text-xs font-black cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={dontShowGuideAgain}
                                    onChange={(e) => setDontShowGuideAgain(e.target.checked)}
                                    className="w-4 h-4 accent-black border-2 border-black cursor-pointer"
                                />
                                <span>下次不再自動顯示此提示</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleCloseGuide(true)}
                                    className="flex-1 sm:flex-none px-3 py-2 text-xs font-black border-2 border-black bg-stone-100 hover:bg-stone-200 transition-colors"
                                >
                                    關閉且不再顯示
                                </button>
                                <button
                                    onClick={() => handleCloseGuide(false)}
                                    className="flex-1 sm:flex-none px-4 py-2 text-xs font-black border-2 border-black bg-black text-white hover:bg-[var(--text-accent)] transition-colors shadow-[3px_3px_0_#000]"
                                >
                                    開始操作
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 底部 SketchUp / Blender 風格圖示化可收納幾何編輯塢 (Iconic Collapsible CAD Dock) */}
            <div
                className="absolute bottom-5 left-0 right-0 z-50 rounded-none shadow-[6px_6px_0_#000] border-2 border-black bg-white/95 backdrop-blur-md text-black transition-all duration-200 flex items-center p-1.5 gap-1.5 mx-auto w-fit max-w-[96vw] no-context-menu"
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
            >
                {/* 左側：拖曳柄 + 收納/展開按鈕 */}
                <div
                    className="h-9 px-1.5 bg-slate-900 text-white cursor-grab active:cursor-grabbing flex items-center justify-center border border-black select-none touch-none"
                    style={{ touchAction: 'none' }}
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                    title="按住拖曳移動此工具塢"
                >
                    <GripHorizontal size={14} className="pointer-events-none" />
                </div>

                <ToolIconBtn
                    icon={isCollapsed ? <Maximize2 size={15} strokeWidth={2.5} /> : <Minimize2 size={15} strokeWidth={2.5} />}
                    tipTitle={isCollapsed ? '展開幾何工具列' : '收納幾何工具列'}
                    tipDesc={isCollapsed ? '展開下方圖示化頂點、弧線、道路與退縮編輯工具。' : '將下方幾何編輯工具列收合為精簡膠囊，騰出最大繪圖視野。'}
                    tipPlacement="top"
                    hoverTipsEnabled={hoverTipsEnabled}
                    onDisableHoverTips={() => setHoverTipsEnabled(false)}
                    onClick={() => setIsCollapsed(!isCollapsed)}
                />

                {/* 當前編輯圖層與面積（及地上層樓高）精簡顯示區 */}
                <div
                    className="flex items-center gap-2 px-2 h-9 bg-stone-100 border-2 border-black select-none"
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                >
                    <span className="font-black flex items-center gap-1 text-xs uppercase tracking-tighter">
                        {isBase ? <Map size={14} strokeWidth={2.5} className="text-sky-700" /> : (isExcavation ? <Shovel size={14} strokeWidth={2.5} className="text-amber-600" /> : <Layers size={14} strokeWidth={2.5} className="text-indigo-600" />)}
                        <span>{isBase ? '基地' : (isExcavation ? '開挖' : data.id)}</span>
                    </span>
                    <div className="h-4 w-[1.5px] bg-stone-300" />
                    <div className="flex items-center gap-1">
                        <EditableInput
                            value={pingValue}
                            onChange={handleArea}
                            step="0.5"
                            className="w-14 p-0 text-right font-black font-mono text-xs border-b border-transparent hover:border-black focus:border-black outline-none bg-transparent"
                        />
                        <span className="text-[10px] font-black text-stone-500">坪</span>
                    </div>
                    {!isBase && !isExcavation && !/^B\d+$/.test(data.id || '') && (
                        <>
                            <div className="h-4 w-[1.5px] bg-stone-300" />
                            <div className="flex items-center gap-1" title="直接輸入或上下推拉調整此層樓高 (m)">
                                <span className="text-[10px] font-black text-indigo-700">樓高</span>
                                <EditableInput
                                    value={parseFloat(data.realHeight) || 3.2}
                                    onChange={(v) => onUpdateSetting(data.id, 'floorHeight', Math.max(2.4, Math.min(20, v)))}
                                    step="0.1"
                                    className="w-11 p-0 text-right font-black font-mono text-xs text-indigo-700 border-b border-indigo-300 hover:border-black focus:border-black outline-none bg-transparent"
                                />
                                <span className="text-[10px] font-black text-stone-500">m</span>
                            </div>
                        </>
                    )}
                </div>

                {points && !isCollapsed && (
                    <ToolIconBtn
                        icon={isAreaLocked ? <Lock size={15} strokeWidth={2.5} /> : <Unlock size={15} strokeWidth={2.5} />}
                        active={isAreaLocked}
                        variant="default"
                        tipTitle={isAreaLocked ? '面積鎖定：已開啟' : '鎖定總面積'}
                        tipDesc="開啟後，拖曳改變多邊形某個角點或邊線時，其餘角點會自動等比例縮放以維持當前總坪數不變。"
                        tipPlacement="top"
                        hoverTipsEnabled={hoverTipsEnabled}
                        onDisableHoverTips={() => setHoverTipsEnabled(false)}
                        onClick={() => setIsAreaLocked(!isAreaLocked)}
                    />
                )}

                {/* 展開狀態：SketchUp / Blender 風格純圖示工具群組 */}
                {!isCollapsed && (
                    <>
                        <div className="h-6 w-[2px] bg-stone-300 mx-0.5" />

                        <div className="flex items-center gap-1">
                            {isBase && onStartDrawSite && (
                                <ToolIconBtn
                                    icon={<Pencil size={16} strokeWidth={2.5} />}
                                    variant="emerald"
                                    tipTitle="點拉線重繪基地"
                                    tipShortcut="Shift 正交 / Enter 完成"
                                    tipDesc="直接在畫布上以點拉線方式重新繪製此基地的多邊形輪廓，支援正交鎖定、節點吸附與精確邊長輸入。"
                                    tipPlacement="top"
                                    hoverTipsEnabled={hoverTipsEnabled}
                                    onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                    onClick={() => onStartDrawSite('current')}
                                />
                            )}

                            <ToolIconBtn
                                icon={<Hexagon size={16} strokeWidth={2.5} />}
                                active={activeTab === 'shape' && interactionMode === 'none'}
                                variant="default"
                                tipTitle="角點與邊線編輯 (Shape)"
                                tipShortcut="拖曳角點 / 邊線"
                                tipDesc="直接拖曳 #1..#n 角點或整條邊線調整形狀；長按邊線可輸入精確米數。"
                                tipPlacement="top"
                                hoverTipsEnabled={hoverTipsEnabled}
                                onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                onClick={() => {
                                    setActiveTab('shape');
                                    setInteractionMode('none');
                                }}
                            />

                            <ToolIconBtn
                                icon={<Plus size={16} strokeWidth={3} />}
                                active={interactionMode === 'add_vertex'}
                                variant="emerald"
                                tipTitle="新增控制點 (Add Vertex)"
                                tipShortcut="點擊邊線落點"
                                tipDesc="啟動後，直接點擊多邊形的任一條邊線，即可在點擊位置精準新增一個控制點（保持原形狀與弧線完全不跳動）。"
                                tipPlacement="top"
                                hoverTipsEnabled={hoverTipsEnabled}
                                onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                onClick={() => {
                                    setActiveTab('shape');
                                    setInteractionMode(interactionMode === 'add_vertex' ? 'none' : 'add_vertex');
                                }}
                            />

                            {!isBase && !isExcavation && !/^B\d+$/.test(data.id || '') && (
                                <ToolIconBtn
                                    icon={<ChevronUp size={16} strokeWidth={3} />}
                                    label="面推拉"
                                    showLabel={true}
                                    active={interactionMode === 'push_pull'}
                                    variant="indigo"
                                    tipTitle="SketchUp 風格面推拉 (Push/Pull)"
                                    tipShortcut="拉動牆面 ↔ / 頂面 ↕"
                                    tipDesc="開啟面推拉模式後：拖曳任一牆面邊線（#0..#n ↔）可沿法線方向垂直推拉牆面形狀；上下拖曳樓層頂面或『↕ 推拉樓高』控制柄可直接推拉調整該層樓高！"
                                    tipPlacement="top"
                                    hoverTipsEnabled={hoverTipsEnabled}
                                    onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                    onClick={() => {
                                        setActiveTab('shape');
                                        setInteractionMode(interactionMode === 'push_pull' ? 'none' : 'push_pull');
                                    }}
                                />
                            )}

                            <ToolIconBtn
                                icon={<Square size={16} strokeWidth={2.5} className="stroke-dasharray-2" />}
                                active={interactionMode === 'box_select'}
                                variant="indigo"
                                tipTitle="框選多個角點 (Box Select)"
                                tipShortcut="按住左鍵拉框"
                                tipDesc="在畫布空白處按住左鍵拉出矩形選取框，一次框選多個控制點並同步拖曳移動。"
                                tipPlacement="top"
                                hoverTipsEnabled={hoverTipsEnabled}
                                onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                onClick={() => {
                                    setActiveTab('shape');
                                    setInteractionMode(interactionMode === 'box_select' ? 'none' : 'box_select');
                                }}
                            />

                            <ToolIconBtn
                                icon={<Edit3 size={16} strokeWidth={2.5} />}
                                active={interactionMode === 'curve'}
                                variant="amber"
                                tipTitle="弧形邊線控制 (Curve)"
                                tipShortcut="拖曳橘點 / 雙擊還原"
                                tipDesc="顯示每條邊線中央的橘色貝茲控制點，拖曳橘點即可將直線邊拉成平滑圓弧；雙擊橘點可恢復直線。"
                                tipPlacement="top"
                                hoverTipsEnabled={hoverTipsEnabled}
                                onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                onClick={() => {
                                    setActiveTab('shape');
                                    setInteractionMode(interactionMode === 'curve' ? 'none' : 'curve');
                                }}
                            />
                        </div>

                        {isBase && (
                            <>
                                <div className="h-6 w-[2px] bg-stone-300 mx-0.5" />
                                <div className="flex items-center gap-1">
                                    {points && (
                                        <>
                                            <ToolIconBtn
                                                icon={<Square size={15} strokeWidth={3} fill={interactionMode === 'set_back' ? 'currentColor' : 'none'} />}
                                                active={interactionMode === 'set_back'}
                                                variant="emerald"
                                                tipTitle="指定後院退縮邊 (Backyard)"
                                                tipDesc="啟動後，直接在畫布點擊基地的任一條邊線，即可將該邊指定或取消為『後院退縮邊（綠色標示）』。"
                                                tipPlacement="top"
                                                hoverTipsEnabled={hoverTipsEnabled}
                                                onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                                onClick={() => setInteractionMode(interactionMode === 'set_back' ? 'none' : 'set_back')}
                                            />
                                            <ToolIconBtn
                                                icon={<Square size={15} strokeWidth={3} fill={interactionMode === 'set_side' ? 'currentColor' : 'none'} />}
                                                active={interactionMode === 'set_side'}
                                                variant="blue"
                                                tipTitle="指定側院退縮邊 (Sideyard)"
                                                tipDesc="啟動後，直接在畫布點擊基地的任一條邊線，即可將該邊指定或取消為『側院退縮邊（藍色標示）』。"
                                                tipPlacement="top"
                                                hoverTipsEnabled={hoverTipsEnabled}
                                                onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                                onClick={() => setInteractionMode(interactionMode === 'set_side' ? 'none' : 'set_side')}
                                            />
                                        </>
                                    )}
                                    <ToolIconBtn
                                        icon={<Compass size={16} strokeWidth={2.5} />}
                                        active={activeTab === 'roads'}
                                        variant="default"
                                        tipTitle="臨路與路寬配置 (Roads)"
                                        tipDesc="開啟道路設定小面板，指定基地各邊線（#0、#1...）對應之面前道路名稱、路寬與主/次要道路。"
                                        tipPlacement="top"
                                        hoverTipsEnabled={hoverTipsEnabled}
                                        onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                        onClick={() => toggleTab('roads')}
                                    />
                                    <ToolIconBtn
                                        icon={<Map size={16} strokeWidth={2.5} />}
                                        label="基地現況"
                                        showLabel={true}
                                        active={activeTab === 'base'}
                                        variant="sky"
                                        tipTitle="基地現況與法規設定 (Site Conditions)"
                                        tipDesc="編輯此基地之建蔽率、容積率、開挖率、前後側院退縮深度、騎樓深度與指北針方位角。"
                                        tipPlacement="top"
                                        hoverTipsEnabled={hoverTipsEnabled}
                                        onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                        onClick={() => toggleTab('base')}
                                    />
                                </div>
                            </>
                        )}

                        {!isBase && (
                            <>
                                <div className="h-6 w-[2px] bg-stone-300 mx-0.5" />
                                <div className="flex items-center gap-1">
                                    <ToolIconBtn
                                        icon={<Move size={16} strokeWidth={2.5} />}
                                        active={activeTab === 'pos'}
                                        variant="default"
                                        tipTitle="樓板平面偏移微調 (Offset)"
                                        tipDesc="開啟 X / Y 軸偏移小面板，精確輸入此樓層相對於基準位置的水平與垂直偏移公尺數。"
                                        tipPlacement="top"
                                        hoverTipsEnabled={hoverTipsEnabled}
                                        onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                        onClick={() => toggleTab('pos')}
                                    />
                                    {data.id !== 'excavation' && (
                                        <>
                                            <ToolIconBtn
                                                icon={<LayoutDashboard size={16} strokeWidth={2.5} />}
                                                active={Boolean(unitSettings?.enabled)}
                                                variant="indigo"
                                                tipTitle="分戶 / 分棟切割 (Split Units)"
                                                tipDesc="依比例、戶數或每戶坪數將此樓層平面切割為多戶或多棟，並可設定棟距 (Gap)。"
                                                tipPlacement="top"
                                                hoverTipsEnabled={hoverTipsEnabled}
                                                onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                                onClick={() => onUpdateUnitSettings(prev => ({ ...prev, enabled: !prev.enabled, target: data.id }))}
                                            />
                                            {onRequestApplyAll && (
                                                <ToolIconBtn
                                                    icon={<CopyCheck size={16} strokeWidth={2.5} />}
                                                    variant="amber"
                                                    tipTitle="套用至全棟所有樓層 (Apply All)"
                                                    tipDesc="將目前這一層調整好的多邊形形狀、弧線與分戶切割設定，一鍵同步套用到所有地上樓層。"
                                                    tipPlacement="top"
                                                    hoverTipsEnabled={hoverTipsEnabled}
                                                    onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                                    onClick={onRequestApplyAll}
                                                />
                                            )}
                                        </>
                                    )}
                                </div>
                            </>
                        )}

                        <div className="h-6 w-[2px] bg-stone-300 mx-0.5" />

                        <div className="flex items-center gap-1">
                            {selectedCurveIdx !== null && (
                                <ToolIconBtn
                                    icon={<RotateCcw size={15} strokeWidth={2.5} />}
                                    variant="amber"
                                    tipTitle="還原直線邊 (Revert Curve)"
                                    tipDesc="將目前選中的弧形邊線恢復為直線段。"
                                    tipPlacement="top"
                                    hoverTipsEnabled={hoverTipsEnabled}
                                    onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                    onClick={handleRevertCurve}
                                />
                            )}
                            <ToolIconBtn
                                icon={<Trash2 size={15} strokeWidth={2.5} />}
                                variant="danger"
                                tipTitle="重置目前圖層形狀 (Reset)"
                                tipDesc="清除此圖層的手動頂點與弧線修改，恢復為預設標準幾何形狀。"
                                tipPlacement="top"
                                hoverTipsEnabled={hoverTipsEnabled}
                                onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                onClick={handleResetShape}
                            />
                            <ToolIconBtn
                                icon={<Sparkles size={15} strokeWidth={2.5} />}
                                active={hoverTipsEnabled}
                                variant="sky"
                                tipTitle={hoverTipsEnabled ? '懸浮提示：開啟中（點此關閉）' : '懸浮提示：已關閉（點此開啟）'}
                                tipDesc="切換滑鼠移到工具圖示上時是否顯示點選前的功能說明提示卡。"
                                tipPlacement="top"
                                hoverTipsEnabled={true}
                                onClick={() => setHoverTipsEnabled(!hoverTipsEnabled)}
                            />
                            <ToolIconBtn
                                icon={<Info size={15} strokeWidth={2.5} />}
                                active={showHelp}
                                variant="default"
                                tipTitle="完整操作手勢指南"
                                tipDesc="開啟完整圖文操作手冊（查看點拉線、多選控制點與曲線拉弧說明）。"
                                tipPlacement="top"
                                hoverTipsEnabled={hoverTipsEnabled}
                                onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                onClick={() => setShowHelp(!showHelp)}
                            />
                        </div>
                    </>
                )}

                {/* 完成並關閉編輯按鈕 */}
                <ToolIconBtn
                    icon={<CheckCircle2 size={16} strokeWidth={2.5} />}
                    variant="dark"
                    tipTitle="完成編輯 (Done)"
                    tipShortcut="Esc"
                    tipDesc="結束目前圖層的幾何編輯並返回一般 3D 檢視狀態。"
                    tipPlacement="top"
                    hoverTipsEnabled={hoverTipsEnabled}
                    onDisableHoverTips={() => setHoverTipsEnabled(false)}
                    onClick={onClose}
                />

                {activeTab && activeTab !== 'shape' && !isCollapsed && (
                    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-88 max-w-[94vw] p-3.5 rounded-none border-2 border-black shadow-[6px_6px_0_#000] bg-white text-black animate-slide-up">
                        <div
                            className="flex items-center justify-between pb-2 mb-2.5 border-b-2 border-black cursor-move select-none touch-none"
                            style={{ touchAction: 'none' }}
                            onMouseDown={handleDragStart}
                            onTouchStart={handleDragStart}
                        >
                            <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 pointer-events-none">
                                <GripHorizontal size={13} />
                                {activeTab === 'base' ? '基地現況與法規參數設定' : activeTab === 'roads' ? '面前道路與臨路邊指定' : '樓板平面位置微調'}
                            </span>
                            <button onClick={() => setActiveTab('shape')} className="p-0.5 hover:text-red-500">
                                <X size={14} />
                            </button>
                        </div>
                        {activeTab === 'base' && isBase && (
                            <div className="space-y-2.5 text-xs">
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-[10px] font-black text-stone-500 block mb-0.5">建蔽率 (%)</label>
                                        <EditableInput
                                            value={inputs.coverageRatio ?? 60}
                                            onChange={(v) => onUpdateInputs('coverageRatio', Math.max(10, Math.min(100, v)))}
                                            step="5"
                                            className="w-full p-1 text-right font-mono font-black border-2 border-black bg-stone-50 focus:bg-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-stone-500 block mb-0.5">容積率 (%)</label>
                                        <EditableInput
                                            value={inputs.floorRatio ?? 240}
                                            onChange={(v) => onUpdateInputs('floorRatio', Math.max(30, Math.min(2000, v)))}
                                            step="10"
                                            className="w-full p-1 text-right font-mono font-black border-2 border-black bg-stone-50 focus:bg-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-stone-500 block mb-0.5">開挖率 (%)</label>
                                        <EditableInput
                                            value={inputs.excavationRatio ?? 70}
                                            onChange={(v) => onUpdateInputs('excavationRatio', Math.max(10, Math.min(100, v)))}
                                            step="5"
                                            className="w-full p-1 text-right font-mono font-black border-2 border-black bg-stone-50 focus:bg-white outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-stone-200">
                                    <div>
                                        <label className="text-[10px] font-black text-red-700 block mb-0.5">前院(m)</label>
                                        <EditableInput
                                            value={inputs.frontYardDepth ?? 0}
                                            onChange={(v) => onUpdateInputs('frontYardDepth', Math.max(0, v))}
                                            step="0.5"
                                            className="w-full p-1 text-right font-mono font-black border border-black bg-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-emerald-700 block mb-0.5">後院(m)</label>
                                        <EditableInput
                                            value={inputs.backYardDepth ?? 0}
                                            onChange={(v) => onUpdateInputs('backYardDepth', Math.max(0, v))}
                                            step="0.5"
                                            className="w-full p-1 text-right font-mono font-black border border-black bg-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-blue-700 block mb-0.5">側院(m)</label>
                                        <EditableInput
                                            value={inputs.sideYardDepth ?? 0}
                                            onChange={(v) => onUpdateInputs('sideYardDepth', Math.max(0, v))}
                                            step="0.5"
                                            className="w-full p-1 text-right font-mono font-black border border-black bg-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-amber-700 block mb-0.5">騎樓(m)</label>
                                        <EditableInput
                                            value={inputs.arcadeDepth ?? 0}
                                            onChange={(v) => onUpdateInputs('arcadeDepth', Math.max(0, v))}
                                            step="0.5"
                                            className="w-full p-1 text-right font-mono font-black border border-black bg-white outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-1.5 border-t border-stone-200">
                                    <span className="font-black flex items-center gap-1 text-[11px]"><Compass size={13} /> 北向方位角</span>
                                    <div className="flex items-center gap-1">
                                        <input type="range" min="0" max="360" value={inputs.northAngle || 0} onChange={(e) => onUpdateInputs('northAngle', parseFloat(e.target.value))} className="w-20 accent-indigo-600" />
                                        <EditableInput value={inputs.northAngle || 0} onChange={(v) => onUpdateInputs('northAngle', v)} className="w-11 p-0.5 text-right border border-black font-mono font-black bg-transparent" />
                                        <span className="font-bold">°</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeTab === 'roads' && isBase && points && (
                            <div className="space-y-3">
                                <div className="pb-2 border-b border-stone-200 flex justify-between items-center">
                                    <span className="text-xs font-bold opacity-70">設定道路名稱、路寬與臨路邊</span>
                                    <button onClick={() => { const newId = Math.max(0, ...inputs.roads.map(r => r.id)) + 1; onUpdateRoads([...inputs.roads, { id: newId, name: '新道路', width: 8, type: 'secondary' }]); }} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1 font-bold"><Plus size={10} /> 新增道路</button>
                                </div>
                                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                    {inputs.roads.map(road => (
                                        <div key={road.id} className="flex flex-col text-xs gap-1.5 border-b border-stone-200 pb-2 mb-2 last:border-0">
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => onUpdateRoads(inputs.roads.filter(r => r.id !== road.id))} className="text-stone-400 hover:text-red-500 p-0.5"><Trash2 size={12} /></button>
                                                <input
                                                    type="text"
                                                    value={road.name || ''}
                                                    onChange={(e) => onUpdateRoads(inputs.roads.map(r => r.id === road.id ? { ...r, name: e.target.value } : r))}
                                                    className="w-20 px-1 py-0.5 border border-stone-300 font-bold text-xs outline-none focus:border-black"
                                                    placeholder="道路名稱"
                                                />
                                                <EditableInput
                                                    value={road.width || 8}
                                                    onChange={(v) => onUpdateRoads(inputs.roads.map(r => r.id === road.id ? { ...r, width: Math.max(2, v) } : r))}
                                                    step="1"
                                                    className="w-11 px-1 py-0.5 text-right border border-stone-300 font-mono font-black text-xs outline-none focus:border-black"
                                                />
                                                <span className="text-[10px] text-stone-500 font-bold">m</span>
                                                <select value={road.type || 'secondary'} onChange={(e) => onUpdateRoads(inputs.roads.map(r => r.id === road.id ? { ...r, type: e.target.value } : r))} className="ml-auto text-[10px] p-0.5 border border-stone-300 bg-white text-stone-700 outline-none font-bold">
                                                    <option value="primary">主要</option>
                                                    <option value="secondary">一般</option>
                                                </select>
                                            </div>
                                            <div className="flex flex-wrap gap-1 pl-4">
                                                {points.map((_, i) => {
                                                    const isActive = (road.edgeIndices || []).includes(i) || road.edgeIndex == i;
                                                    return (<button key={i} onClick={() => handleToggleEdge(road.id, i)} className={`text-[10px] px-1.5 py-0.5 border transition-colors ${isActive ? 'bg-indigo-600 border-black text-white font-black' : 'bg-white border-stone-300 text-stone-500 hover:bg-stone-100'}`}>#{i}</button>);
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {activeTab === 'pos' && !isBase && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-[10px] text-stone-500 font-bold block mb-1">X 軸偏移</label><div className="flex items-center gap-1"><EditableInput value={data.offset?.x || 0} onChange={(v) => onUpdateSetting(data.id, 'offset', { ...(data.offset || { x: 0, y: 0 }), x: v })} step="0.1" className="w-full p-1 text-right text-xs border border-black bg-transparent font-bold" /><span>m</span></div></div>
                                    <div><label className="text-[10px] text-stone-500 font-bold block mb-1">Y 軸偏移</label><div className="flex items-center gap-1"><EditableInput value={data.offset?.y || 0} onChange={(v) => onUpdateSetting(data.id, 'offset', { ...(data.offset || { x: 0, y: 0 }), y: v })} step="0.1" className="w-full p-1 text-right text-xs border border-black bg-transparent font-bold" /><span>m</span></div></div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

export const BuildingLayer = React.memo(({ width, depth, height, x, y, z, rotation, pivot, scale, color, strokeColor, opacity, visible, showFrame, isSlabMode, animate, delay, isDarkMode, onClick, isSelected, isViolation, points, curves, staticPoints, unusedReviewArea, unitLabel, unitArea, interactive = true, aoMode = false, aoNight = false, sunVec = null, isContextMassing = false }) => {
    if (!visible) return null;
    const thickness = isSlabMode ? Math.max(1.5, height * 0.08) : height;
    const pivotX = (pivot?.x || 0) * scale;
    const pivotY = (pivot?.y || 0) * scale;
    const pe = interactive ? 'auto' : 'none';

    // 若父層刻意將非目標樓層設為半透明穿透（opacity < 0.5），不應由 AO 模式強制拉回不透明
    const isGhostedLayer = typeof opacity === 'number' && opacity < 0.5;
    const effectiveAO = Boolean(aoMode) && !isSelected && !isViolation && !isGhostedLayer;
    let displayColor = color;
    let displayBorder = strokeColor;
    let displayOpacity = opacity;

    if (effectiveAO) {
        if (aoNight) {
            displayColor = isContextMassing ? 'rgb(34, 37, 42)' : 'rgb(218, 222, 228)';
            displayBorder = isContextMassing ? 'rgba(15, 18, 24, 0.78)' : 'rgba(20, 24, 30, 0.72)';
        } else {
            displayColor = isContextMassing ? 'rgb(224, 227, 232)' : 'rgb(244, 245, 248)';
            displayBorder = 'rgba(30, 35, 42, 0.52)';
        }
        displayOpacity = Math.max(0.96, opacity || 1);
    }

    const highlightColor = isSelected ? displayBorder : displayBorder;
    const highlightBorder = isViolation ? `2px solid ${displayBorder}` : (isSelected ? `2.5px solid ${highlightColor}` : (showFrame || effectiveAO ? `1px solid ${displayBorder}` : 'none'));
    const highlightBg = displayColor;
    const finalBorder = isSlabMode ? (showFrame ? `1px solid ${isViolation ? strokeColor : highlightColor}` : 'none') : highlightBorder;
    const finalOpacity = effectiveAO ? displayOpacity : (isSlabMode ? (isViolation ? 0.8 : 0.95) : opacity);

    const showStroke = isViolation || isSelected || showFrame || isSlabMode || effectiveAO;
    const unitText = unitLabel ? `${unitLabel} (${formatNum(toPing(unitArea || 0))}坪)` : null;

    // 依太陽方向與牆面法向量計算 AO 白模牆面明暗與接縫遮蔽漸層
    const getAOWallStyle = (outNx, outNy) => {
        if (!effectiveAO) return {};
        const sx = sunVec?.x ?? 0.55;
        const sy = sunVec?.y ?? 0.55;
        const dot = Math.max(-1, Math.min(1, outNx * sx + outNy * sy));
        const lit = dot * 0.5 + 0.5; // 0 (背光) ~ 1 (向光)

        if (aoNight) {
            if (isContextMassing) {
                const v = Math.round(24 + lit * 16);
                return {
                    backgroundColor: `rgb(${v}, ${v + 2}, ${v + 5})`,
                    backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.18) 38%, rgba(255,255,255,0.04) 100%)',
                    boxShadow: 'inset 0 0 12px rgba(0, 0, 0, 0.5)'
                };
            }
            const v = Math.round(104 + lit * 48);
            return {
                backgroundColor: `rgb(${v}, ${v + 2}, ${v + 5})`,
                backgroundImage: 'linear-gradient(to top, rgba(6, 8, 12, 0.68) 0%, rgba(12, 15, 22, 0.24) 26%, rgba(255, 255, 255, 0.08) 84%, rgba(10, 12, 18, 0.34) 100%)',
                boxShadow: 'inset 0 0 15px rgba(0, 0, 0, 0.38)'
            };
        }

        const baseMin = isContextMassing ? 164 : 172;
        const baseSpan = isContextMassing ? 56 : 68;
        const v = Math.round(baseMin + lit * baseSpan);
        return {
            backgroundColor: `rgb(${v}, ${v + 1}, ${v + 3})`,
            backgroundImage: 'linear-gradient(to top, rgba(15, 23, 42, 0.26) 0%, rgba(15, 23, 42, 0.09) 18%, rgba(255, 255, 255, 0) 44%, rgba(15, 23, 42, 0.14) 100%)',
            boxShadow: 'inset 0 0 11px rgba(15, 23, 42, 0.14)'
        };
    };

    const aoTopExtraStyle = effectiveAO
        ? (aoNight
            ? {
                backgroundImage: isContextMassing
                    ? 'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.06), rgba(0,0,0,0.45))'
                    : 'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.22), rgba(15,23,42,0.26))',
                boxShadow: 'inset 0 0 18px rgba(0, 0, 0, 0.35)'
            }
            : {
                backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(15,23,42,0.06) 100%)',
                boxShadow: 'inset 0 0 14px rgba(15, 23, 42, 0.1)'
            })
        : {};

    const face = (w, h, tx, ty, tz, rx, ry, rz, bg, border, op) => ({
        width: `${w}px`, height: `${h}px`, position: 'absolute', left: '50%', top: '50%', marginLeft: `-${w / 2}px`, marginTop: `-${h / 2}px`, backgroundColor: bg, border: border, boxSizing: 'border-box', transform: `translate3d(${tx}px, ${ty}px, ${tz}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`, opacity: op, pointerEvents: pe, cursor: interactive ? 'pointer' : 'default', transition: effectiveAO ? 'background-color 0.12s linear, opacity 0.3s' : 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)', backfaceVisibility: 'visible', animation: isViolation ? 'pulse-red 3s infinite' : 'none', boxShadow: isSelected ? "0 0 18px rgba(249, 115, 22, 0.45)" : (isDarkMode ? (isSlabMode ? "inset 0 0 15px rgba(255,255,255,0.1)" : "none") : (isSlabMode ? "inset 0 0 5px rgba(0,0,0,0.1)" : "none"))
    });

    const getPolyData = (pts, crvs) => {
        if (!pts || pts.length === 0) return null;
        const ptsPx = pts.map(p => ({ x: (p.x || 0) * scale, y: (p.y || 0) * scale }));
        if (ptsPx.some(p => isNaN(p.x) || isNaN(p.y))) return null;
        // 將所有頂點與貝茲曲線控制點一併納入包絡盒計算，徹底避免弧形邊界被容器裁切破圖
        const allXs = ptsPx.map(p => p.x);
        const allYs = ptsPx.map(p => p.y);
        if (crvs) {
            Object.values(crvs).forEach(c => {
                if (c && !isNaN(c.x) && !isNaN(c.y)) {
                    allXs.push(c.x * scale);
                    allYs.push(c.y * scale);
                }
            });
        }
        const minX = Math.min(...allXs); const maxX = Math.max(...allXs);
        const minY = Math.min(...allYs); const maxY = Math.max(...allYs);
        const bCx = (maxX + minX) / 2; const bCy = (maxY + minY) / 2;
        const padding = 80;
        const contW = Math.max(1, (maxX - minX) + padding * 2);
        const contH = Math.max(1, (maxY - minY) + padding * 2);
        let d = `M ${(ptsPx[0].x - minX + padding).toFixed(2)} ${(ptsPx[0].y - minY + padding).toFixed(2)}`;
        for (let i = 0; i < ptsPx.length; i++) {
            const pNext = ptsPx[(i + 1) % ptsPx.length];
            const curve = crvs ? crvs[i] : null;
            const nextX = (pNext.x - minX + padding).toFixed(2);
            const nextY = (pNext.y - minY + padding).toFixed(2);
            if (curve && !isNaN(curve.x) && !isNaN(curve.y)) {
                const cpX = (curve.x * scale - minX + padding).toFixed(2);
                const cpY = (curve.y * scale - minY + padding).toFixed(2);
                d += ` Q ${cpX} ${cpY}, ${nextX} ${nextY}`;
            } else {
                d += ` L ${nextX} ${nextY}`;
            }
        }
        d += " Z";
        return { d, contW, contH, bCx, bCy };
    };

    if (points && points.length > 0) {
        const polyData = getPolyData(points, curves);
        if (!polyData) return null;
        const { d, contW, contH, bCx, bCy } = polyData;

        const ptsPx = points.map(p => ({ x: (p.x || 0) * scale, y: (p.y || 0) * scale }));
        const polyCentroidPx = getPolygonCentroid(ptsPx);
        const walls = []; const segmentsForCurve = 12;
        for (let i = 0; i < ptsPx.length; i++) {
            const p1 = ptsPx[i]; const p2 = ptsPx[(i + 1) % ptsPx.length]; const curve = curves ? curves[i] : null;
            const generateWallSeg = (pt1, pt2, key) => {
                const dx = pt2.x - pt1.x; const dy = pt2.y - pt1.y; const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 0.05) return;
                const angle = Math.atan2(dy, dx) * (180 / Math.PI); const midX = (pt1.x + pt2.x) / 2; const midY = (pt1.y + pt2.y) / 2; const customTransform = `translate3d(${midX}px, ${midY}px, ${thickness / 2}px) rotateZ(${angle}deg) rotateX(90deg)`;
                let wallAoStyle = {};
                if (effectiveAO && dist > 1e-3) {
                    const inN = getSegmentNormal(pt1, pt2, polyCentroidPx);
                    wallAoStyle = getAOWallStyle(-inN.x, -inN.y);
                }
                walls.push(<div key={key} style={{ width: `${dist + 0.5}px`, height: `${thickness}px`, position: 'absolute', left: '50%', top: '50%', marginLeft: `-${(dist + 0.5) / 2}px`, marginTop: `-${thickness / 2}px`, backgroundColor: highlightBg, border: finalBorder, boxSizing: 'border-box', transform: customTransform, opacity: finalOpacity, pointerEvents: pe, cursor: interactive ? 'pointer' : 'default', transition: effectiveAO ? 'background-color 0.12s linear' : 'all 0.5s', backfaceVisibility: 'visible', boxShadow: isSelected ? "0 0 12px rgba(249, 115, 22, 0.35)" : (isSlabMode ? "inset 0 0 5px rgba(0,0,0,0.1)" : "none"), ...wallAoStyle }} />);
            };
            if (curve && !isNaN(curve.x) && !isNaN(curve.y)) {
                const cp = { x: curve.x * scale, y: curve.y * scale }; let prevP = p1;
                for (let k = 1; k <= segmentsForCurve; k++) { const t = k / segmentsForCurve; const tx = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * cp.x + t * t * p2.x; const ty = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * cp.y + t * t * p2.y; const currP = { x: tx, y: ty }; generateWallSeg(prevP, currP, `${i}-${k}`); prevP = currP; }
            } else { generateWallSeg(p1, p2, i); }
        }

        // 以原生 SVG <path> 繪製頂面與底面（取代易於 3D 弧形破圖之 CSS clip-path），確保與弧形牆面 100% 密合不破圖
        const topPlaneStyle = { ...face(contW, contH, bCx, bCy, thickness, 0, 0, 0, 'transparent', 'none', 1), pointerEvents: 'none', boxShadow: 'none' };
        const bottomPlaneStyle = { ...face(contW, contH, bCx, bCy, 0, 0, 0, 0, 'transparent', 'none', 1), pointerEvents: 'none', boxShadow: 'none' };
        const topOpacity = Math.min(1, finalOpacity + 0.1);

        // Ghost (Static) Layer Logic
        let ghostLayer = null;
        if (staticPoints && staticPoints.length > 0) {
            const gPoly = getPolyData(staticPoints, curves);
            if (gPoly) {
                const ghostStyle = { ...face(gPoly.contW, gPoly.contH, gPoly.bCx, gPoly.bCy, thickness - 1, 0, 0, 0, 'transparent', 'none', 1), pointerEvents: 'none', boxShadow: 'none' };
                ghostLayer = (
                    <div style={ghostStyle}>
                        <svg width={gPoly.contW} height={gPoly.contH} viewBox={`0 0 ${gPoly.contW} ${gPoly.contH}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
                            <path d={gPoly.d} fill="#ef4444" fillOpacity="0.2" stroke="none" />
                        </svg>
                    </div>
                );
            }
        }

        return (<div className="absolute" onClick={onClick} style={{ left: '50%', top: '50%', width: 0, height: 0, transformStyle: 'preserve-3d', transform: `translate3d(${x}px, ${y}px, ${z}px) rotateZ(${rotation || 0}deg)`, animation: animate ? `riseUp 0.8s ease-out ${delay}ms backwards` : 'none', '--tx': `${x}px`, '--ty': `${y}px`, '--tz': `${z}px` }}>
            {ghostLayer}
            {walls}
            {/* 頂面原生 SVG 樓板（含 AO 質感與外框線，與弧形牆體 100% 精準對齊） */}
            <div style={topPlaneStyle}>
                <svg width={contW} height={contH} viewBox={`0 0 ${contW} ${contH}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', shapeRendering: 'geometricPrecision', pointerEvents: 'none' }}>
                    <path
                        d={d}
                        fill={highlightBg}
                        fillOpacity={topOpacity}
                        stroke={showStroke ? displayBorder : 'none'}
                        strokeWidth={isSelected ? "3.2" : (effectiveAO ? "1.35" : "2")}
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ pointerEvents: pe, cursor: interactive ? 'pointer' : 'default', filter: isSelected ? 'brightness(1.12)' : 'none' }}
                    />
                </svg>
            </div>
            {/* 底面原生 SVG 樓板 */}
            <div style={bottomPlaneStyle}>
                <svg width={contW} height={contH} viewBox={`0 0 ${contW} ${contH}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', shapeRendering: 'geometricPrecision', pointerEvents: 'none' }}>
                    <path
                        d={d}
                        fill={highlightBg}
                        fillOpacity={finalOpacity}
                        stroke={showStroke ? displayBorder : 'none'}
                        strokeWidth={isSelected ? "3.2" : (effectiveAO ? "1.35" : "2")}
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
            {unusedReviewArea > 0.1 && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100px', height: '20px', transform: `translate3d(${bCx}px, ${bCy}px, ${thickness + 10}px) rotateX(-90deg)`, pointerEvents: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div className="bg-red-500/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm backdrop-blur-sm whitespace-nowrap">
                        -{unusedReviewArea.toFixed(1)}坪
                    </div>
                </div>
            )}
            {unitText && (
                <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate3d(${bCx}px, ${bCy}px, ${thickness + 10}px) rotateX(-90deg)`, pointerEvents: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div className="bg-white/90 text-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm backdrop-blur-sm whitespace-nowrap">
                        {unitText}
                    </div>
                </div>
            )}
        </div>);
    }
    const topFaceStyle = { ...face(width, depth, 0, 0, thickness, 0, 0, 0, highlightBg, finalBorder, finalOpacity + 0.1), filter: isSelected ? 'brightness(1.1)' : 'none', ...aoTopExtraStyle };
    return (<div className="absolute" onClick={onClick} style={{ left: '50%', top: '50%', width: 0, height: 0, transformStyle: 'preserve-3d', transform: `translate3d(${x}px, ${y}px, ${z}px) rotateZ(${rotation || 0}deg)`, transformOrigin: `calc(50% + ${pivotX}px) calc(50% - ${pivotY}px)`, animation: animate ? `riseUp 0.8s ease-out ${delay}ms backwards` : 'none', '--tx': `${x}px`, '--ty': `${y}px`, '--tz': `${z}px` }}> <div style={{ ...face(width, thickness, 0, depth / 2, thickness / 2, 90, 0, 0, highlightBg, finalBorder, finalOpacity), ...getAOWallStyle(0, 1) }} /> <div style={{ ...face(width, thickness, 0, -depth / 2, thickness / 2, -90, 0, 0, highlightBg, finalBorder, finalOpacity), ...getAOWallStyle(0, -1) }} /> <div style={{ ...face(depth, thickness, width / 2, 0, thickness / 2, 0, 90, 90, highlightBg, finalBorder, finalOpacity), ...getAOWallStyle(1, 0) }} /> <div style={{ ...face(depth, thickness, -width / 2, 0, thickness / 2, 0, 90, -90, highlightBg, finalBorder, finalOpacity), ...getAOWallStyle(-1, 0) }} /> <div style={topFaceStyle} className="hover:brightness-110" /> <div style={face(width, depth, 0, 0, 0, 0, 0, 0, highlightBg, finalBorder, finalOpacity)} /> {unitText && (<div style={{ position: 'absolute', top: 0, left: 0, transform: `translate3d(0px, 0px, ${thickness + 10}px) rotateX(-90deg)`, pointerEvents: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}> <div className="bg-white/90 text-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm backdrop-blur-sm whitespace-nowrap"> {unitText} </div> </div>)} </div>);
});

const SitePolygonEditor = () => null;
export default SitePolygonEditor;
