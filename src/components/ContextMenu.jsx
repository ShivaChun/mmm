import React, { useEffect, useRef, useState } from 'react';
import {
    Layers, MapPin, FileText, Table, Plus, Eye, Maximize2,
    Settings2, MapPinned, Trash2, ChevronRight, X, Sun, Moon,
    Home, Building2, Grid3X3, ToggleLeft, ToggleRight
} from 'lucide-react';
import { createGlassDisplacementMap } from '../utils/liquidGlass';


export const ContextMenu = ({
    x, y, onClose, onAction,
    isDarkMode, sitesCount = 1, isMobile = false,
    sites = [], activeSiteIndex = 0, onSwitchSite, onAddSite, onRemoveSite,
    inputs = {}, onInputChange,
    showCheckLines = true, showHeightRatio = true, showWeiLao = false, showBackyard = true,
    res, unusedArea
}) => {
    const toPing = (sqm) => (sqm * 0.3025).toFixed(2);
    const formatNum = (num, decimals = 0) => {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };
    const SummaryRow = ({ label, value, highlight, isAlert, alertText, subtext }) => (
        <div className={`flex justify-between items-end p-2 border-b theme-border ${highlight ? 'bg-[var(--text-accent)]/10' : ''} ${isAlert ? 'bg-red-50' : ''}`}>
            <div className="flex flex-col">
                <span className={`text-[10px] font-black uppercase tracking-wider ${isAlert ? 'text-red-500' : 'theme-text-muted'}`}>{label}</span>
                {subtext && <span className="text-[9px] opacity-60 font-bold">{subtext}</span>}
            </div>
            <div className="flex items-center gap-2">
                {isAlert && <span className="text-[10px] font-black text-red-500 bg-red-100 px-1.5 py-0.5 rounded animate-pulse">{alertText}</span>}
                <span className={`font-black text-base num-font ${isAlert ? 'text-red-600' : (highlight ? 'text-[var(--text-accent)]' : 'theme-text')}`}>{value}</span>
            </div>
        </div>
    );

    const menuRef = useRef(null);
    const [pos, setPos] = useState({ x: Math.max(16, x), y: Math.max(16, y) });
    const [size, setSize] = useState({ w: 260, h: 'auto' });
    const scaleFactor = typeof size.w === "number" ? Math.max(0.5, Math.min(2.0, size.w / 260)) : 1;
    const dragRef = useRef({ isDragging: false, isResizing: false, startX: 0, startY: 0, startPos: { x: 0, y: 0 }, startSize: { w: 0, h: 0 } });
    
    const [glassFilterUrl, setGlassFilterUrl] = useState('');
    const glassUrlRef = useRef('');

    useEffect(() => {
        setPos({ x: Math.max(16, x), y: Math.max(16, y) });
    }, [x, y]);

    useEffect(() => {
        if (!menuRef.current) return;
        let lastW = 0, lastH = 0;
        let frameId;

        const updateGlass = async () => {
            if (!menuRef.current) return;
            const rect = menuRef.current.getBoundingClientRect();
            const w = Math.round(rect.width);
            const h = Math.round(rect.height);
            
            if (w !== lastW || h !== lastH) {
                lastW = w;
                lastH = h;
                const url = await createGlassDisplacementMap(w, h, 8, 40); // Radius 8px? 
                if (glassUrlRef.current) {
                    URL.revokeObjectURL(glassUrlRef.current);
                }
                glassUrlRef.current = url;
                setGlassFilterUrl(url);
            }
        };

        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(updateGlass);
        });
        
        observer.observe(menuRef.current);
        
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frameId);
            if (glassUrlRef.current) {
                URL.revokeObjectURL(glassUrlRef.current);
            }
        };
    }, []);

    const handleGlobalMouseMove = (e) => {
        if (dragRef.current.isDragging) {
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            setPos({
                x: Math.max(0, dragRef.current.startPos.x + dx),
                y: Math.max(0, dragRef.current.startPos.y + dy)
            });
        } else if (dragRef.current.isResizing) {
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            setSize({
                w: Math.max(260, dragRef.current.startSize.w + dx),
                h: dragRef.current.startSize.h === 'auto' ? 'auto' : Math.max(200, dragRef.current.startSize.h + dy)
            });
        }
    };

    const handleGlobalMouseUp = () => {
        dragRef.current.isDragging = false;
        dragRef.current.isResizing = false;
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
    };

    const handleHeaderMouseDown = (e) => {
        if (e.target.closest('button')) return;
        dragRef.current.isDragging = true;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        dragRef.current.startPos = { ...pos };
        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);
    };

    const handleResizeMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragRef.current.isResizing = true;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        const rect = menuRef.current.getBoundingClientRect();
        dragRef.current.startSize = { w: rect.width, h: rect.height };
        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);
    };
    const [activeSubmenus, setActiveSubmenus] = useState([]);
    const toggleSubmenu = (menu) => setActiveSubmenus(prev => prev.includes(menu) ? prev.filter(m => m !== menu) : [...prev, menu]); // 'sites' | 'project' | 'checklines' | null

    // Click outside disabled, menu is draggable tool palette.

    // Replaced by drag state

    const btnCls = "flex items-start gap-3 w-full px-3 py-2.5 text-left transition-all duration-150 group hover:bg-[var(--text-accent)] hover:text-white rounded-sm";
    const dividerCls = "mx-2 my-1.5 border-t border-[var(--border-strong)] opacity-40";

    const SITE_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    return (
        <>
            {glassFilterUrl && (
                <svg width="0" height="0" className="absolute pointer-events-none" style={{ position: 'absolute' }}>
                    <filter id="liquid-glass-filter" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
                        <feImage href={glassFilterUrl} result="MAP" />
                        <feDisplacementMap 
                            in="SourceGraphic" 
                            in2="MAP" 
                            scale="1" 
                            xChannelSelector="R" 
                            yChannelSelector="G" 
                            result="DISPLACED" 
                        />
                        <feColorMatrix in="MAP" type="matrix" values="
                            0 0 1 0 0
                            0 0 1 0 0
                            0 0 1 0 0
                            0 0 1 0 0" result="SPECULAR" />
                        <feComposite operator="arithmetic" k1="0" k2="1" k3="1" k4="0" in="SPECULAR" in2="DISPLACED" result="BLEND" />
                    </filter>
                </svg>
            )}
            <div
                ref={menuRef}
                className="fixed z-[9999] theme-panel shadow-2xl border-2 border-[var(--border-strong)] flex flex-col"
                style={{ 
                    left: `${pos.x}px`, 
                    top: `${pos.y}px`, 
                    width: size.w === 'auto' ? 'auto' : `${size.w}px`,
                    height: size.h === 'auto' ? 'auto' : `${size.h}px`,
                    backdropFilter: glassFilterUrl ? 'url(#liquid-glass-filter)' : 'blur(16px)'
                }}
            >
                {/* 標題欄 */}
                <div 
            className="px-3 py-2 flex items-center justify-between border-b-2 border-[var(--border-strong)] bg-[var(--text-accent)]/10 cursor-move select-none"
        onMouseDown={handleHeaderMouseDown}
    >
                <span className="text-[10px] font-black tracking-widest uppercase theme-text-muted">快捷選單 / MENU</span>
                <button onClick={onClose} className="p-0.5 hover:text-red-500 transition-colors">
                    <X size={12} />
                </button>
            </div>

            <div className="py-1.5 flex flex-col gap-0.5 px-1.5 flex-1 overflow-y-auto custom-scrollbar" style={{ zoom: scaleFactor, transformOrigin: "top left" }}>

                {/* ── 基地管理 子選單 ── */}
                <div className="relative">
                    <button
                        className={`${btnCls} justify-between`}
                        onClick={() => toggleSubmenu('sites')}
                    >
                        <div className="flex items-start gap-3">
                            <MapPinned className="w-4 h-4 mt-0.5 shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-xs font-black uppercase tracking-wide">基地管理</span>
                                <span className="text-[10px] theme-text-muted group-hover:text-white/70 mt-0.5">
                                    切換 / 新增 / 刪除基地
                                </span>
                            </div>
                        </div>
                        <ChevronRight size={14} className={`mt-0.5 shrink-0 transition-transform ${activeSubmenus.includes('sites') ? 'rotate-90' : ''}`} />
                    </button>

                    {/* 子選單：基地列表 */}
                    {activeSubmenus.includes('sites') && (
                        <div className="mx-2 mb-1 bg-[var(--bg-body)]/50 rounded border border-[var(--border-strong)]/50 overflow-hidden">
                            {sites.map((site, idx) => (
                                <div key={site.id} className="flex items-center justify-between group/site">
                                    <button
                                        onClick={() => { onSwitchSite?.(idx); onClose(); }}
                                        className={`flex-1 flex items-center gap-2 px-3 py-2 text-xs font-bold text-left transition-colors hover:bg-[var(--text-accent)]/20 ${idx === activeSiteIndex ? 'text-[var(--text-accent)] bg-[var(--text-accent)]/10 font-black' : 'theme-text'}`}
                                    >
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${idx === activeSiteIndex ? 'border-[var(--text-accent)] bg-[var(--text-accent)] text-white' : 'border-[var(--border-strong)]'}`}>
                                            {SITE_LABELS[idx] || idx + 1}
                                        </span>
                                        {site.name}
                                    </button>
                                    {sites.length > 1 && (
                                        <button
                                            onClick={() => { onRemoveSite?.(idx); }}
                                            className="px-2 py-2 text-red-400 hover:text-red-500 opacity-0 group-hover/site:opacity-100 transition-opacity"
                                            title="刪除此基地"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <div className="border-t border-[var(--border-strong)]/40 mx-2" />
                            <button
                                onClick={() => { onAction('open_add_site'); onClose(); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-black text-[var(--text-accent)] hover:bg-[var(--text-accent)]/10 transition-colors"
                            >
                                <Plus size={12} /> 新增規劃基地
                            </button>
                        </div>
                    )}
                </div>

                {/* ── 專案設定 子選單 ── */}
                <div className="relative">
                    <button
                        className={`${btnCls} justify-between`}
                        onClick={() => toggleSubmenu('project')}
                    >
                        <div className="flex items-start gap-3">
                            <Settings2 className="w-4 h-4 mt-0.5 shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-xs font-black uppercase tracking-wide">專案設定</span>
                                <span className="text-[10px] theme-text-muted group-hover:text-white/70 mt-0.5">
                                    修改專案名稱與模式
                                </span>
                            </div>
                        </div>
                        <ChevronRight size={14} className={`mt-0.5 shrink-0 transition-transform ${activeSubmenus.includes('project') ? 'rotate-90' : ''}`} />
                    </button>
                    {activeSubmenus.includes('project') && (
                        <div className="mx-2 mb-1 p-2.5 bg-[var(--bg-body)]/50 rounded border border-[var(--border-strong)]/50">
                            <label className="block text-[10px] font-black uppercase tracking-widest theme-text-muted mb-1">專案名稱</label>
                            <input
                                type="text"
                                name="projectName"
                                value={inputs.projectName || ''}
                                onChange={onInputChange}
                                placeholder="輸入專案名稱…"
                                className="w-full px-2 py-1.5 text-xs font-bold border-2 border-[var(--border-strong)] bg-[var(--bg-body)] theme-text outline-none focus:border-[var(--text-accent)] rounded-sm"
                            />
                        </div>
                    )}
                </div>

                {/* ── 法規檢討線 子選單 ── */}
                <div className="relative">
                    <button
                        className={`${btnCls} justify-between`}
                        onClick={() => toggleSubmenu('checklines')}
                    >
                        <div className="flex items-start gap-3">
                            <Layers className="w-4 h-4 mt-0.5 shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-xs font-black uppercase tracking-wide">法規檢討線</span>
                                <span className="text-[10px] theme-text-muted group-hover:text-white/70 mt-0.5">
                                    高度比 / 危老 / 後院退縮
                                </span>
                            </div>
                        </div>
                        <ChevronRight size={14} className={`mt-0.5 shrink-0 transition-transform ${activeSubmenus.includes('checklines') ? 'rotate-90' : ''}`} />
                    </button>
                    {activeSubmenus.includes('checklines') && (
                        <div className="mx-2 mb-1 p-1.5 bg-[var(--bg-body)]/50 rounded border border-[var(--border-strong)]/50 flex flex-col gap-0.5">
                            {/* 總開關 */}
                            <button
                                onClick={() => onAction('toggle_check_lines')}
                                className="flex items-center justify-between px-2.5 py-1.5 text-xs font-bold transition-colors hover:bg-[var(--text-accent)]/20 theme-text w-full"
                            >
                                <span className="flex items-center gap-1.5">
                                    {showCheckLines ? <ToggleRight size={14} className="text-[var(--text-accent)]" /> : <ToggleLeft size={14} />}
                                    開啟檢討線
                                </span>
                            </button>
                            {showCheckLines && (
                                <>
                                    <div className="border-t border-[var(--border-strong)]/40 my-0.5 mx-2.5" />
                                    <button
                                        onClick={() => onAction('toggle_height_ratio')}
                                        className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-left w-full hover:bg-[var(--text-accent)]/15 ${showHeightRatio ? 'text-rose-500 font-bold' : 'theme-text'}`}
                                    >
                                        <span className={`w-3.5 h-3.5 border flex items-center justify-center text-[8px] ${showHeightRatio ? 'bg-rose-500 border-rose-600 text-white' : 'border-slate-400'}`}>
                                            {showHeightRatio ? '✓' : ''}
                                        </span>
                                        高度比檢討線
                                    </button>
                                    <button
                                        onClick={() => onAction('toggle_wei_lao')}
                                        className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-left w-full hover:bg-[var(--text-accent)]/15 ${showWeiLao ? 'text-purple-500 font-bold' : 'theme-text'}`}
                                    >
                                        <span className={`w-3.5 h-3.5 border flex items-center justify-center text-[8px] ${showWeiLao ? 'bg-purple-500 border-purple-600 text-white' : 'border-slate-400'}`}>
                                            {showWeiLao ? '✓' : ''}
                                        </span>
                                        危老檢討線 (1:5)
                                    </button>
                                    <button
                                        onClick={() => onAction('toggle_backyard')}
                                        className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-left w-full hover:bg-[var(--text-accent)]/15 ${showBackyard ? 'text-emerald-500 font-bold' : 'theme-text'}`}
                                    >
                                        <span className={`w-3.5 h-3.5 border flex items-center justify-center text-[8px] ${showBackyard ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-slate-400'}`}>
                                            {showBackyard ? '✓' : ''}
                                        </span>
                                        後院檢討線
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className={dividerCls} />

                {/* ── 資訊面板 ── */}
                <button className={btnCls} onClick={() => { onAction('toggle_info_panel'); onClose(); }}>
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-xs font-black uppercase tracking-wide">基地與法規設定</span>
                        <span className="text-[10px] theme-text-muted group-hover:text-white/70 mt-0.5">臨路、建蔽、容積、退縮</span>
                    </div>
                </button>

                <button className={btnCls} onClick={() => { onAction('toggle_results_panel'); onClose(); }}>
                    <FileText className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-xs font-black uppercase tracking-wide">詳細計算表</span>
                        <span className="text-[10px] theme-text-muted group-hover:text-white/70 mt-0.5">容積、停車、預算報表</span>
                    </div>
                </button>

                {sitesCount > 1 && (
                    <button className={btnCls} onClick={() => { onAction('toggle_combined_table'); onClose(); }}>
                        <Table className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-xs font-black uppercase tracking-wide">整體合併檢討</span>
                            <span className="text-[10px] theme-text-muted group-hover:text-white/70 mt-0.5">多基地綜合評估</span>
                        </div>
                    </button>
                )}

                <button className={btnCls} onClick={() => { onAction('toggle_summary_panel'); onClose(); }}>
                    <Building2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-xs font-black uppercase tracking-wide">專案摘要</span>
                        <span className="text-[10px] theme-text-muted group-hover:text-white/70 mt-0.5">Project Summary 面板</span>
                    </div>
                </button>

                <button className={btnCls} onClick={() => { onAction('toggle_env_panel'); onClose(); }}>
                    <Grid3X3 className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-xs font-black uppercase tracking-wide">臨地與簡易造型</span>
                        <span className="text-[10px] theme-text-muted group-hover:text-white/70 mt-0.5">臨地顯示 / 隨機造型模擬</span>
                    </div>
                </button>

                <div className={dividerCls} />

                {/* ── 深色模式 ── */}
                <button className={`${btnCls} justify-between`} onClick={() => { onAction('toggle_dark_mode'); onClose(); }}>
                    <div className="flex items-start gap-3">
                        {isDarkMode ? <Moon className="w-4 h-4 mt-0.5 shrink-0" /> : <Sun className="w-4 h-4 mt-0.5 shrink-0" />}
                        <div className="flex flex-col">
                            <span className="text-xs font-black uppercase tracking-wide">{isDarkMode ? '明亮模式' : '暗黑模式'}</span>
                            <span className="text-[10px] theme-text-muted group-hover:text-white/70 mt-0.5">切換介面配色主題</span>
                        </div>
                    </div>
                    {isDarkMode ? <ToggleRight size={16} className="mt-0.5 text-[var(--text-accent)]" /> : <ToggleLeft size={16} className="mt-0.5" />}
                </button>

                {/* ── 手機橫置 ── */}
                {isMobile && (
                    <button className={btnCls} onClick={() => { onAction('toggle_landscape'); onClose(); }}>
                        <Maximize2 className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-xs font-black uppercase tracking-wide">橫置全螢幕</span>
                            <span className="text-[10px] theme-text-muted group-hover:text-white/70 mt-0.5">手機旋轉橫置顯示</span>
                        </div>
                    </button>
                )}

            </div>

            {/* 拖曳調整大小的手柄 */}
            <div
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-1 opacity-50 hover:opacity-100"
                onMouseDown={handleResizeMouseDown}
            >
                <div className="w-2 h-2 border-r-2 border-b-2 border-[var(--text-accent)]" />
            </div>
        </div>
        </>
    );
};
