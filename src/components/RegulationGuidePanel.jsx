import React, { useState, useMemo } from 'react';
import { BookOpen, CheckCircle2, AlertTriangle, XCircle, ExternalLink, Eye, EyeOff, Scale, ChevronDown, ChevronUp, X } from 'lucide-react';
import { TAIWAN_REGULATIONS, REGULATION_CATEGORIES } from '../utils/taiwanRegulations';

const StatusBadge = ({ status, label }) => {
    if (status === 'fail') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black bg-red-100 text-red-700 border border-red-400">
                <XCircle size={11} className="shrink-0" />
                {label}
            </span>
        );
    }
    if (status === 'warn') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-400">
                <AlertTriangle size={11} className="shrink-0" />
                {label}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-400">
            <CheckCircle2 size={11} className="shrink-0" />
            {label}
        </span>
    );
};

/**
 * 嵌入於詳細計算表單列下方的「台灣建築法規說明」區塊（支援全部顯示/關閉或單項展開/收合）
 */
export const RegulationInlineRow = ({ regKey, inputs, res, params, colSpan = 5, onCloseItem }) => {
    const reg = TAIWAN_REGULATIONS[regKey];
    if (!reg) return null;
    const live = reg.getLiveCheck ? reg.getLiveCheck(inputs, res, params) : null;

    return (
        <tr className="bg-amber-50/70 border-b-2 border-black">
            <td colSpan={colSpan} className="p-2.5 @[480px]:p-3.5 pl-4 @[480px]:pl-6 border-l-4 border-amber-500">
                <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-stone-900 text-amber-300 font-black text-[10px]">
                                <Scale size={11} />
                                {reg.lawName} {reg.article}
                            </span>
                            <span className="font-black text-stone-900 text-xs">{reg.title}</span>
                            {live && <StatusBadge status={live.status} label={live.statusLabel} />}
                        </div>
                        <div className="flex items-center gap-2">
                            {reg.mojUrl && (
                                <a
                                    href={reg.mojUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-700 hover:text-indigo-900 underline"
                                >
                                    全國法規資料庫 <ExternalLink size={10} />
                                </a>
                            )}
                            {onCloseItem && (
                                <button
                                    onClick={onCloseItem}
                                    className="text-stone-400 hover:text-black p-0.5"
                                    title="隱藏此項法規說明"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </div>
                    <p className="text-[11px] text-stone-700 font-medium leading-relaxed">
                        <strong className="font-black text-stone-900">法規要旨：</strong>
                        {reg.summary}
                    </p>
                    <div className="text-[11px] font-mono bg-white/90 border border-stone-300 px-2 py-1 text-stone-800">
                        <strong className="font-sans font-black text-stone-900">計算基準：</strong>
                        {reg.formulaDesc}
                    </div>
                    {live && (
                        <div className={`text-[11px] px-2.5 py-1.5 border font-bold leading-relaxed ${
                            live.status === 'fail'
                                ? 'bg-red-50 border-red-300 text-red-900'
                                : live.status === 'warn'
                                    ? 'bg-amber-100/60 border-amber-300 text-amber-950'
                                    : 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                        }`}>
                            <strong className="font-black">本案即時檢討：</strong>
                            {live.detail}
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
};

/**
 * 3D 模擬畫面左下角可開關的「目前檢討線法規即時說明卡」
 */
export const ChecklineRegulationOverlay = ({
    inputs,
    res,
    showCheckLines,
    showHeightRatio,
    showWeiLao,
    showBackyard,
    fallingCurveRequired,
    isOpen,
    onToggleOpen,
    onOpenFullGuide,
    isDarkMode
}) => {
    const activeItems = useMemo(() => {
        const keys = [];
        if (showCheckLines) {
            if (showHeightRatio) keys.push('heightRatio');
            if (showWeiLao) keys.push('weiLaoRatio');
            if (showBackyard) keys.push('backyardDepthRatio');
            if (fallingCurveRequired) keys.push('fallingCurve50m');
        }
        if (keys.length === 0) {
            keys.push('maxBuildingArea', 'statutoryFA', 'heightRatio');
        }
        return keys.map(k => TAIWAN_REGULATIONS[k]).filter(Boolean);
    }, [showCheckLines, showHeightRatio, showWeiLao, showBackyard, fallingCurveRequired]);

    return (
        <div
            className="absolute bottom-6 left-4 z-30 pointer-events-auto max-w-[calc(100vw-110px)] sm:max-w-sm"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            {!isOpen ? (
                <button
                    onClick={() => onToggleOpen(true)}
                    className={`flex items-center gap-2 px-3 py-2 border-2 border-black shadow-[4px_4px_0_#000] text-xs font-black transition-all ${
                        isDarkMode ? 'bg-slate-900/95 text-amber-300 border-amber-400/80' : 'bg-white/95 text-black hover:bg-amber-50'
                    }`}
                    title="顯示目前檢討項目的台灣建築法規說明"
                >
                    <Scale size={15} className="text-amber-500 shrink-0" />
                    <span>法規檢討說明</span>
                    <Eye size={13} className="opacity-70" />
                </button>
            ) : (
                <div className={`border-2 border-black shadow-[6px_6px_0_#000] backdrop-blur-md overflow-hidden ${
                    isDarkMode ? 'bg-slate-900/95 text-slate-100 border-slate-600' : 'bg-white/95 text-stone-900'
                }`}>
                    <div className="px-3 py-2 bg-stone-900 text-white flex items-center justify-between gap-2 border-b-2 border-black">
                        <div className="flex items-center gap-1.5 text-xs font-black">
                            <Scale size={14} className="text-amber-400 shrink-0" />
                            <span>目前檢討項目・台灣建築法規說明</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {onOpenFullGuide && (
                                <button
                                    onClick={onOpenFullGuide}
                                    className="px-2 py-0.5 text-[10px] font-black bg-amber-400 text-black hover:bg-amber-300 transition-colors"
                                    title="開啟完整台灣建築法規檢討總覽視窗"
                                >
                                    完整總覽
                                </button>
                            )}
                            <button
                                onClick={() => onToggleOpen(false)}
                                className="p-1 text-stone-300 hover:text-white transition-colors"
                                title="關閉法規說明浮動卡"
                            >
                                <EyeOff size={13} />
                            </button>
                        </div>
                    </div>
                    <div className="p-2.5 max-h-60 overflow-y-auto space-y-2 thin-scrollbar">
                        {activeItems.map(reg => {
                            const live = reg.getLiveCheck ? reg.getLiveCheck(inputs, res) : null;
                            const colorTag = reg.id === 'heightRatio'
                                ? 'border-l-rose-500'
                                : reg.id === 'weiLaoRatio'
                                    ? 'border-l-blue-500'
                                    : reg.id === 'backyardDepthRatio'
                                        ? 'border-l-emerald-500'
                                        : reg.id === 'fallingCurve50m'
                                            ? 'border-l-amber-500'
                                            : 'border-l-indigo-500';
                            return (
                                <div
                                    key={reg.id}
                                    className={`p-2 border border-stone-300/80 border-l-4 ${colorTag} ${
                                        isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-stone-50/90'
                                    } text-[11px] space-y-1`}
                                >
                                    <div className="flex items-center justify-between gap-1 flex-wrap">
                                        <span className="font-black text-xs">{reg.title}</span>
                                        {live && <StatusBadge status={live.status} label={live.statusLabel} />}
                                    </div>
                                    <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between gap-1">
                                        <span>{reg.lawName} {reg.article}</span>
                                        {reg.mojUrl && (
                                            <a
                                                href={reg.mojUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-0.5 underline hover:opacity-80 shrink-0"
                                            >
                                                法條 <ExternalLink size={9} />
                                            </a>
                                        )}
                                    </div>
                                    {live && (
                                        <p className="text-[11px] leading-snug opacity-90">
                                            {live.detail}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * 台灣建築法規檢討總覽面板內容（顯示於 DraggablePanel 中）
 */
export const RegulationGuidePanel = ({
    inputs,
    res,
    params,
    activeSiteName = '基地 A',
    showRegulationNotes,
    onToggleRegulationNotes,
    show3DRegulationOverlay,
    onToggle3DRegulationOverlay,
    focusedRegKey = null
}) => {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [expandedKeys, setExpandedKeys] = useState(() => {
        const allKeys = Object.keys(TAIWAN_REGULATIONS);
        return new Set(allKeys);
    });

    const filteredRegulations = useMemo(() => {
        const list = Object.values(TAIWAN_REGULATIONS);
        if (selectedCategory === 'all') return list;
        return list.filter(r => r.category === selectedCategory);
    }, [selectedCategory]);

    const toggleExpand = (id) => {
        setExpandedKeys(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const expandAll = () => setExpandedKeys(new Set(Object.keys(TAIWAN_REGULATIONS)));
    const collapseAll = () => setExpandedKeys(new Set());

    return (
        <div className="space-y-3 w-full min-w-0">
            {/* 頂部開關控制列 */}
            <div className="p-3 bg-stone-900 text-white border-2 border-black flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <BookOpen size={18} className="text-amber-400 shrink-0" />
                        <div>
                            <div className="text-sm font-black tracking-wide">
                                台灣建築法規即時檢討說明 ({activeSiteName})
                            </div>
                            <div className="text-[10px] text-stone-300 font-bold">
                                依據《建築技術規則》建築設計施工編、都市計畫土管要點及危老都更條例自動核算
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-700">
                    {onToggleRegulationNotes && (
                        <button
                            onClick={() => onToggleRegulationNotes(!showRegulationNotes)}
                            className={`px-2.5 py-1 text-[11px] font-black border flex items-center gap-1.5 transition-colors ${
                                showRegulationNotes
                                    ? 'bg-amber-400 text-black border-amber-300'
                                    : 'bg-stone-800 text-stone-300 border-stone-600 hover:bg-stone-700'
                            }`}
                        >
                            {showRegulationNotes ? <Eye size={13} /> : <EyeOff size={13} />}
                            <span>計算表內嵌法規：{showRegulationNotes ? '顯示中' : '已關閉'}</span>
                        </button>
                    )}
                    {onToggle3DRegulationOverlay && (
                        <button
                            onClick={() => onToggle3DRegulationOverlay(!show3DRegulationOverlay)}
                            className={`px-2.5 py-1 text-[11px] font-black border flex items-center gap-1.5 transition-colors ${
                                show3DRegulationOverlay
                                    ? 'bg-emerald-400 text-black border-emerald-300'
                                    : 'bg-stone-800 text-stone-300 border-stone-600 hover:bg-stone-700'
                            }`}
                        >
                            {show3DRegulationOverlay ? <Eye size={13} /> : <EyeOff size={13} />}
                            <span>3D 畫面法規浮動卡：{show3DRegulationOverlay ? '顯示中' : '已關閉'}</span>
                        </button>
                    )}
                    <div className="ml-auto flex items-center gap-1">
                        <button
                            onClick={expandAll}
                            className="px-2 py-1 text-[10px] font-black bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-200"
                        >
                            全部展開
                        </button>
                        <button
                            onClick={collapseAll}
                            className="px-2 py-1 text-[10px] font-black bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-200"
                        >
                            全部收合
                        </button>
                    </div>
                </div>
            </div>

            {/* 分類篩選按鈕 */}
            <div className="flex flex-wrap gap-1.5">
                {REGULATION_CATEGORIES.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-2.5 py-1.5 text-xs font-black border-2 border-black transition-all ${
                            selectedCategory === cat.id
                                ? 'bg-[var(--text-accent)] text-white shadow-[2px_2px_0_#000]'
                                : 'bg-white text-black hover:bg-stone-100'
                        }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* 各檢討項目法規卡片列表 */}
            <div className="space-y-2.5">
                {filteredRegulations.map(reg => {
                    const isExpanded = expandedKeys.has(reg.id) || focusedRegKey === reg.id;
                    const live = reg.getLiveCheck ? reg.getLiveCheck(inputs, res, params) : null;
                    return (
                        <div
                            key={reg.id}
                            className={`border-2 border-black bg-white shadow-[3px_3px_0_#111] transition-all ${
                                focusedRegKey === reg.id ? 'ring-2 ring-amber-500' : ''
                            }`}
                        >
                            <div
                                onClick={() => toggleExpand(reg.id)}
                                className="p-2.5 @[480px]:p-3 flex flex-wrap items-center justify-between gap-2 cursor-pointer hover:bg-stone-50 select-none"
                            >
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                    <span className="px-1.5 py-0.5 bg-stone-900 text-amber-300 font-black text-[10px] shrink-0">
                                        {reg.article}
                                    </span>
                                    <span className="font-black text-xs @[480px]:text-sm text-black">
                                        {reg.title}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {live && <StatusBadge status={live.status} label={live.statusLabel} />}
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="px-3 pb-3 pt-2 border-t-2 border-stone-200 bg-stone-50/60 space-y-2 text-xs">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-stone-600">
                                        <span>法源依據：《{reg.lawName}》{reg.article}</span>
                                        {reg.mojUrl && (
                                            <a
                                                href={reg.mojUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-indigo-700 hover:text-indigo-900 font-black underline"
                                            >
                                                前往全國法規資料庫查閱條文 <ExternalLink size={11} />
                                            </a>
                                        )}
                                    </div>
                                    <div className="p-2 bg-white border border-stone-300 text-stone-800 leading-relaxed">
                                        <span className="font-black text-black">法規條文說明：</span>
                                        {reg.summary}
                                    </div>
                                    <div className="px-2.5 py-1.5 bg-stone-900 text-amber-200 font-mono text-[11px]">
                                        <span className="font-sans font-black text-white">檢討公式：</span>
                                        {reg.formulaDesc}
                                    </div>
                                    {live && (
                                        <div className={`p-2.5 border-l-4 font-bold leading-relaxed ${
                                            live.status === 'fail'
                                                ? 'bg-red-50 border-red-600 text-red-900'
                                                : live.status === 'warn'
                                                    ? 'bg-amber-50 border-amber-500 text-amber-950'
                                                    : 'bg-emerald-50 border-emerald-600 text-emerald-950'
                                        }`}>
                                            <span className="font-black">本案目前檢討結果：</span>
                                            {live.detail}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
