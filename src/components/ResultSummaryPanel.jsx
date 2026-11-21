import React, { useState, useRef, useMemo } from 'react';
import {
    MapPin,
    ChevronUp,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    FileText,
    SlidersHorizontal,
    Info,
    Copy,
    Check,
    Share2,
    FolderClock,
    CopyPlus
} from 'lucide-react';
import { toPing, formatNum } from '../utils/geometry';
import { formatRange, buildPlainTextSummary } from '../utils/summaryText';

export const ResultSummaryPanel = ({
    activeSite,
    sites = [],
    activeSiteIndex = 0,
    onSwitchSite,
    inputs,
    finalRes,
    params,
    massingSummary,
    isMobile = false,
    isDarkMode = false,
    isHiddenForEdit = false,
    onOpenPanel,
    onOpenExport,
    onParamChange,
    savedProjects = [],
    currentProjectId,
    onLoadProject,
    onDuplicateAsPlanB,
    isReadOnlyShare = false,
    desktopTopOffset = false
}) => {
    // 手機 Bottom Sheet 預設收合，桌機左側面板預設展開
    const [mobileExpanded, setMobileExpanded] = useState(false);
    const [desktopCollapsed, setDesktopCollapsed] = useState(false);
    const [showRecentList, setShowRecentList] = useState(false);
    const [copied, setCopied] = useState(false);

    // 手機上下拖曳手勢狀態
    const touchStartYRef = useRef(null);
    const [dragDeltaY, setDragDeltaY] = useState(0);

    const metrics = useMemo(() => {
        const baseM2 = finalRes.base || 0;
        const basePing = toPing(baseM2);

        // 總樓地板面積（含陽台屋突，取 ±5% 區間）
        const totalCfaPing = toPing(finalRes.totalCFA || 0);
        const cfaRange = formatRange(totalCfaPing, 0.05, totalCfaPing >= 100 ? 5 : 2);

        // 樓層數（若推算樓層介於整數間，顯示區間如 4–5F）
        const calcFloors = finalRes.calculatedFloors || 0;
        const visualFloors = massingSummary?.visualFloorsAbove || finalRes.floorsAbove || 1;
        const floorsBelow = parseInt(inputs.floorsBelow || 0, 10);
        const floorLow = Math.max(1, Math.floor(calcFloors || visualFloors));
        const floorHigh = Math.max(floorLow, visualFloors);
        const floorDisplay = floorLow < floorHigh ? `${floorLow}–${floorHigh}F` : `${visualFloors}F`;
        const floorSubDisplay = floorsBelow > 0 ? `地上 ${floorDisplay} · 地下 B${floorsBelow}` : `地上 ${floorDisplay}`;

        // 建蔽率使用比例
        const covLimit = Math.max(1, parseFloat(inputs.coverageRatio) || 50);
        const actualFootprintM2 = massingSummary?.actualFootprintM2 || finalRes.maxBuildingArea || 0;
        const actualCovPct = baseM2 > 0 ? (actualFootprintM2 / baseM2) * 100 : covLimit;
        const covUsageRatio = Math.min(130, (actualCovPct / covLimit) * 100);
        const covOver = actualCovPct > covLimit + 0.5;
        const openSpacePct = Math.max(0, Math.round(100 - Math.min(actualCovPct, 100)));

        // 容積率使用比例
        const farLimit = Math.max(1, parseFloat(inputs.floorRatio) || 150);
        const allowedVolumeM2 = finalRes.permittedIndoor || (baseM2 * farLimit / 100);
        const actualUsedVolM2 = massingSummary?.actualUsedVolumeM2 || allowedVolumeM2;
        const farUsageRatio = allowedVolumeM2 > 0 ? Math.min(130, (actualUsedVolM2 / allowedVolumeM2) * 100) : 100;
        const effectiveFarPct = (farLimit * Math.min(farUsageRatio, 130)) / 100;
        const farOver = farUsageRatio > 100.5;

        // 概估造價區間（依單價 ±12% 呈現區間）
        const unitPrice = parseFloat(params.pricePerPing) || 25;
        const priceLow = Math.max(10, Math.round(unitPrice * 0.88));
        const priceHigh = Math.round(unitPrice * 1.12);
        const budgetCenter = finalRes.estimatedBudget || 0;
        const budgetRange = formatRange(budgetCenter, 0.12, budgetCenter >= 1000 ? 100 : 50);

        // 預估車位區間
        const parkEst = finalRes.possibleParking || 0;
        const parkDisplay = parkEst <= 1 ? '1–2 席' : `${Math.max(1, parkEst - 1)}–${parkEst + 1} 席`;

        // 白話說明（讓業主一眼聽懂）
        const cfaPlainNote = totalCfaPing < 60
            ? '精巧尺度，適合小家庭自住透天。'
            : totalCfaPing < 130
                ? '含梯廳陽台，約可規劃寬敞三代同堂獨棟住宅。'
                : '量體充裕，可規劃多戶住宅或大坪數電梯宅。';

        const floorPlainNote = visualFloors <= 3
            ? '低層尺度親人，動線單純好維護。'
            : visualFloors <= 5
                ? '常見自建透天／電梯別墅高度，兼具採光與機能。'
                : '中高層量體，建議納入電梯與結構耐震考量。';

        const covPlainNote = covOver
            ? '目前量體略高於法定建蔽，建議微調退縮或縮小單層。'
            : `留設約 ${openSpacePct}% 基地空地，可規劃前後院與停車。`;

        const farPlainNote = farOver
            ? '量體已超過允建上限，建議減少樓層或縮減面積。'
            : farUsageRatio >= 92
                ? '法定容積近乎用滿，土地開發效益高。'
                : `尚餘約 ${Math.max(1, Math.round(100 - farUsageRatio))}% 容積彈性，可再微調樓層配置。`;

        const budgetPlainNote = `以每坪 ${priceLow}–${priceHigh} 萬估算，含基礎營建、不含室內裝修。`;

        return {
            baseM2,
            basePing,
            cfaRange,
            floorDisplay,
            floorSubDisplay,
            floorsBelow,
            covLimit,
            actualCovPct,
            covUsageRatio,
            covOver,
            farLimit,
            effectiveFarPct,
            farUsageRatio,
            farOver,
            budgetRange,
            priceLow,
            priceHigh,
            parkDisplay,
            cfaPlainNote,
            floorPlainNote,
            covPlainNote,
            farPlainNote,
            budgetPlainNote
        };
    }, [finalRes, inputs, params, massingSummary]);

    if (isHiddenForEdit) return null;

    const handleCopySummary = async () => {
        try {
            const text = buildPlainTextSummary({ activeSite, inputs, finalRes, params, massingSummary });
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            setCopied(false);
        }
    };

    // 手機觸控手勢處理
    const handleSheetTouchStart = (e) => {
        if (e.touches.length !== 1) return;
        touchStartYRef.current = e.touches[0].clientY;
        setDragDeltaY(0);
    };
    const handleSheetTouchMove = (e) => {
        if (touchStartYRef.current === null || e.touches.length !== 1) return;
        const delta = e.touches[0].clientY - touchStartYRef.current;
        setDragDeltaY(Math.max(-120, Math.min(120, delta)));
    };
    const handleSheetTouchEnd = () => {
        if (touchStartYRef.current === null) return;
        if (!mobileExpanded && dragDeltaY < -28) {
            setMobileExpanded(true);
        } else if (mobileExpanded && dragDeltaY > 36) {
            setMobileExpanded(false);
        }
        touchStartYRef.current = null;
        setDragDeltaY(0);
    };

    const mutedText = isDarkMode ? 'text-[#A8A39B]' : 'text-[#767168]';
    const subtleBorder = isDarkMode ? 'border-white/12' : 'border-[#E6E2D8]';
    const surfaceBg = isDarkMode ? 'bg-white/6' : 'bg-[#F7F5F1]';

    /* =========================================================================
     * 手機版（<768px）：底部 Bottom Sheet（預設收合顯示 3 個關鍵數字）
     * ========================================================================= */
    if (isMobile) {
        return (
            <div
                className="fixed left-3 right-3 z-[55] pointer-events-auto no-context-menu transition-all duration-300 ease-out"
                style={{
                    bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
                    transform: dragDeltaY !== 0 ? `translateY(${dragDeltaY * 0.25}px)` : 'translateY(0)'
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <div className="yra-card rounded-3xl overflow-hidden">
                    {/* 拉柄與標題列（支援上下拖曳或點擊展開） */}
                    <div
                        className="px-4 pt-2 pb-2.5 cursor-pointer select-none touch-none"
                        onTouchStart={handleSheetTouchStart}
                        onTouchMove={handleSheetTouchMove}
                        onTouchEnd={handleSheetTouchEnd}
                        onClick={() => setMobileExpanded(prev => !prev)}
                    >
                        <div className="w-9 h-1 rounded-full bg-[#C9C3B8] mx-auto mb-2" />
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <MapPin size={15} className="text-[#E85D2A] shrink-0" />
                                <span className="font-bold text-sm truncate">
                                    {activeSite?.name || '基地 A'} · 基地 {formatNum(metrics.basePing, 2)} 坪
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${surfaceBg} ${mutedText}`}>
                                    概估，非正式審查
                                </span>
                                <span className={`p-1 rounded-full ${surfaceBg}`}>
                                    {mobileExpanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 預設收合即顯示：3 個關鍵數字 */}
                    <div className={`grid grid-cols-3 border-t ${subtleBorder} divide-x ${isDarkMode ? 'divide-white/12' : 'divide-[#E6E2D8]'}`}>
                        <div className="px-3 py-2.5">
                            <div className={`text-[10px] font-medium ${mutedText}`}>總樓地板面積</div>
                            <div className="font-black text-sm yra-num mt-0.5 leading-tight">
                                {metrics.cfaRange} <span className="text-[10px] font-bold">坪</span>
                            </div>
                        </div>
                        <div className="px-3 py-2.5">
                            <div className={`text-[10px] font-medium ${mutedText}`}>建議層數</div>
                            <div className="font-black text-sm yra-num mt-0.5 leading-tight">
                                {metrics.floorDisplay}
                                {metrics.floorsBelow > 0 && (
                                    <span className={`text-[10px] font-medium ml-1 ${mutedText}`}>B{metrics.floorsBelow}</span>
                                )}
                            </div>
                        </div>
                        <div className="px-3 py-2.5">
                            <div className={`text-[10px] font-medium ${mutedText}`}>概估造價</div>
                            <div className="font-black text-sm yra-num text-[#E85D2A] mt-0.5 leading-tight">
                                {metrics.budgetRange} <span className="text-[10px] font-bold">萬</span>
                            </div>
                        </div>
                    </div>

                    {/* 展開後的細節、白話說明與假設 */}
                    {mobileExpanded && (
                        <div className={`max-h-[52dvh] overflow-y-auto px-4 py-3 border-t ${subtleBorder} space-y-3`}>
                            {/* 建蔽率 & 容積率使用比例 */}
                            <div className="grid grid-cols-2 gap-2.5">
                                <div className={`rounded-2xl p-2.5 ${surfaceBg}`}>
                                    <div className="flex items-baseline justify-between gap-1">
                                        <span className={`text-[11px] font-medium ${mutedText}`}>建蔽率使用</span>
                                        <span className={`text-xs font-black yra-num ${metrics.covOver ? 'text-[#E85D2A]' : ''}`}>
                                            {formatNum(metrics.actualCovPct, 1)}% / {metrics.covLimit}%
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden mt-1.5">
                                        <div
                                            className="h-full rounded-full transition-all duration-300"
                                            style={{
                                                width: `${Math.min(100, metrics.covUsageRatio)}%`,
                                                backgroundColor: metrics.covOver ? '#E85D2A' : '#171614'
                                            }}
                                        />
                                    </div>
                                    <p className={`text-[11px] leading-snug mt-1.5 ${mutedText}`}>
                                        {metrics.covPlainNote}
                                    </p>
                                </div>

                                <div className={`rounded-2xl p-2.5 ${surfaceBg}`}>
                                    <div className="flex items-baseline justify-between gap-1">
                                        <span className={`text-[11px] font-medium ${mutedText}`}>容積率使用</span>
                                        <span className={`text-xs font-black yra-num ${metrics.farOver ? 'text-[#E85D2A]' : ''}`}>
                                            {formatNum(metrics.effectiveFarPct, 1)}% / {metrics.farLimit}%
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden mt-1.5">
                                        <div
                                            className="h-full rounded-full transition-all duration-300"
                                            style={{
                                                width: `${Math.min(100, metrics.farUsageRatio)}%`,
                                                backgroundColor: '#E85D2A'
                                            }}
                                        />
                                    </div>
                                    <p className={`text-[11px] leading-snug mt-1.5 ${mutedText}`}>
                                        {metrics.farPlainNote}
                                    </p>
                                </div>
                            </div>

                            {/* 白話解說列 */}
                            <div className={`rounded-2xl p-3 space-y-2 text-xs ${surfaceBg}`}>
                                <div className="flex justify-between gap-2">
                                    <span className={`font-medium shrink-0 ${mutedText}`}>空間規模</span>
                                    <span className="text-right">{metrics.cfaPlainNote}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <span className={`font-medium shrink-0 ${mutedText}`}>量體層數</span>
                                    <span className="text-right">{metrics.floorSubDisplay}；{metrics.floorPlainNote}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <span className={`font-medium shrink-0 ${mutedText}`}>預估車位</span>
                                    <span className="text-right font-bold yra-num">約 {metrics.parkDisplay}</span>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <span className={`font-medium shrink-0 ${mutedText}`}>造價說明</span>
                                    <span className="text-right">{metrics.budgetPlainNote}</span>
                                </div>
                            </div>

                            {/* 計算假設微調（營建單價） */}
                            <div className={`flex items-center justify-between gap-2 rounded-2xl px-3 py-2 border ${subtleBorder}`}>
                                <span className={`text-xs font-medium ${mutedText}`}>基準營建單價（萬/坪）</span>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min="10"
                                        max="100"
                                        value={params.pricePerPing}
                                        onChange={(e) => onParamChange && onParamChange('pricePerPing', e.target.value)}
                                        className={`w-16 text-right font-bold text-sm yra-num px-2 py-1 rounded-lg border ${subtleBorder} bg-transparent outline-none focus:border-[#E85D2A]`}
                                    />
                                    <span className={`text-xs ${mutedText}`}>萬</span>
                                </div>
                            </div>

                            {/* 明確免責標註 */}
                            <div className={`flex items-start gap-1.5 text-[11px] leading-relaxed ${mutedText}`}>
                                <Info size={13} className="shrink-0 mt-0.5 text-[#E85D2A]" />
                                <span>
                                    概估，非正式法規審查。實際允建面積與造價需依建築師正式套繪、土管規定與營造報價為準。
                                </span>
                            </div>

                            {/* 行動按鈕 */}
                            <div className="flex gap-2 pt-0.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMobileExpanded(false);
                                        if (onOpenExport) onOpenExport();
                                        else onOpenPanel && onOpenPanel('results');
                                    }}
                                    className="flex-1 min-h-[44px] rounded-2xl bg-[#E85D2A] text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                                >
                                    <Share2 size={14} />
                                    輸出長圖 / 分享
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMobileExpanded(false);
                                        onOpenPanel && onOpenPanel('results');
                                    }}
                                    className={`min-h-[44px] px-3.5 rounded-2xl border ${subtleBorder} text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform`}
                                >
                                    <FileText size={14} />
                                    詳細表
                                </button>
                            </div>

                            {/* 最近案件與複製為方案 B（非唯讀模式顯示） */}
                            {!isReadOnlyShare && savedProjects.length > 0 && (
                                <div className={`pt-2 border-t ${subtleBorder} space-y-1.5`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[11px] font-bold flex items-center gap-1 ${mutedText}`}>
                                            <FolderClock size={12} /> 最近案件（本機自動存檔）
                                        </span>
                                        {onDuplicateAsPlanB && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onDuplicateAsPlanB();
                                                    setMobileExpanded(false);
                                                }}
                                                className="text-[11px] font-bold text-[#2563EB] flex items-center gap-1"
                                            >
                                                <CopyPlus size={12} /> 複製為方案 B
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                                        {savedProjects.slice(0, 5).map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => {
                                                    onLoadProject && onLoadProject(p);
                                                    setMobileExpanded(false);
                                                }}
                                                className={`min-h-[38px] px-2.5 py-1 rounded-xl border text-left shrink-0 text-[11px] font-bold ${
                                                    p.id === currentProjectId
                                                        ? 'bg-[#171614] text-white border-[#171614]'
                                                        : `${surfaceBg} ${subtleBorder}`
                                                }`}
                                            >
                                                <div className="truncate max-w-[110px]">{p.name || '未命名案件'}</div>
                                                <div className="text-[9px] opacity-70 yra-num">{formatNum(p.basePing || 0, 1)} 坪</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    /* =========================================================================
     * 桌機版（≥768px）：固定左側摘要卡片（可收合；圖層抽屜展開時自動平滑下移防打架）
     * ========================================================================= */
    const desktopTopCls = desktopTopOffset ? 'top-[156px]' : 'top-[72px]';

    if (desktopCollapsed) {
        return (
            <div
                className={`fixed left-4 ${desktopTopCls} z-[45] pointer-events-auto no-context-menu transition-all duration-200`}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={() => setDesktopCollapsed(false)}
                    className="yra-card rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 hover:border-[#E85D2A] transition-colors"
                    title="展開結果摘要面板"
                >
                    <MapPin size={15} className="text-[#E85D2A]" />
                    <div className="text-left">
                        <div className="text-xs font-bold">基地 {formatNum(metrics.basePing, 2)} 坪</div>
                        <div className={`text-[11px] yra-num ${mutedText}`}>
                            約 {metrics.cfaRange} 坪 · {metrics.budgetRange} 萬
                        </div>
                    </div>
                    <ChevronRight size={15} className={mutedText} />
                </button>
            </div>
        );
    }

    return (
        <aside
            className={`fixed left-4 ${desktopTopCls} bottom-5 z-[45] w-[312px] pointer-events-none flex flex-col justify-start no-context-menu transition-all duration-200`}
            aria-label="基地評估結果摘要"
        >
            <div
                className="yra-card rounded-3xl pointer-events-auto flex flex-col max-h-full overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                {/* 卡片頂部：基地識別與面積 */}
                <div className={`px-4 pt-3.5 pb-3 border-b ${subtleBorder} flex items-start justify-between gap-2`}>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <MapPin size={15} className="text-[#E85D2A] shrink-0" />
                            <h2 className="font-black text-sm tracking-normal normal-case truncate">
                                {inputs.projectName || activeSite?.name || '基地 A'}
                            </h2>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${surfaceBg} ${mutedText}`}>
                                {inputs.zoneType || '住宅區'}
                            </span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-base font-black yra-num">
                                基地 {formatNum(metrics.basePing, 2)} 坪
                            </span>
                            <span className={`text-[11px] yra-num ${mutedText}`}>
                                ({formatNum(metrics.baseM2, 1)} ㎡)
                            </span>
                        </div>
                        {sites.length > 1 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {sites.map((s, idx) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => onSwitchSite && onSwitchSite(idx)}
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                                            idx === activeSiteIndex
                                                ? 'bg-[#171614] text-white'
                                                : `${surfaceBg} ${mutedText} hover:text-[#171614]`
                                        }`}
                                    >
                                        {s.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setDesktopCollapsed(true)}
                        className={`p-1.5 rounded-xl hover:bg-black/5 transition-colors shrink-0 ${mutedText}`}
                        title="收合結果摘要"
                        aria-label="收合結果摘要"
                    >
                        <ChevronLeft size={16} />
                    </button>
                </div>

                {/* 捲動內容區：4 大核心評估指標 + 白話說明 */}
                <div className="overflow-y-auto px-4 py-3 space-y-3">
                    {/* 1. 總樓地板面積 */}
                    <div className={`rounded-2xl p-3 ${surfaceBg}`}>
                        <div className="flex items-baseline justify-between gap-2">
                            <span className={`text-[11px] font-bold ${mutedText}`}>概估總樓地板面積</span>
                            <span className="text-lg font-black yra-num">
                                {metrics.cfaRange} <span className="text-xs font-bold">坪</span>
                            </span>
                        </div>
                        <p className={`text-[11px] leading-relaxed mt-1 ${mutedText}`}>
                            {metrics.cfaPlainNote}
                        </p>
                    </div>

                    {/* 2. 層數 & 造價雙欄 */}
                    <div className="grid grid-cols-2 gap-2.5">
                        <div className={`rounded-2xl p-3 ${surfaceBg}`}>
                            <div className={`text-[11px] font-bold ${mutedText}`}>建議層數</div>
                            <div className="text-base font-black yra-num mt-0.5">
                                {metrics.floorDisplay}
                                {metrics.floorsBelow > 0 && (
                                    <span className={`text-[11px] font-medium ml-1 ${mutedText}`}>/ B{metrics.floorsBelow}</span>
                                )}
                            </div>
                            <p className={`text-[10px] leading-snug mt-1 ${mutedText}`}>
                                {metrics.floorPlainNote}
                            </p>
                        </div>

                        <div className={`rounded-2xl p-3 ${surfaceBg}`}>
                            <div className={`text-[11px] font-bold ${mutedText}`}>概估造價區間</div>
                            <div className="text-base font-black yra-num text-[#E85D2A] mt-0.5">
                                {metrics.budgetRange} <span className="text-[11px] font-bold">萬</span>
                            </div>
                            <p className={`text-[10px] leading-snug mt-1 ${mutedText}`}>
                                約 {metrics.priceLow}–{metrics.priceHigh} 萬/坪（不含裝修）
                            </p>
                        </div>
                    </div>

                    {/* 3. 建蔽率使用比例 */}
                    <div className={`rounded-2xl p-3 border ${subtleBorder}`}>
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-bold">建蔽率使用比例</span>
                            <span className={`text-xs font-black yra-num ${metrics.covOver ? 'text-[#E85D2A]' : ''}`}>
                                {formatNum(metrics.actualCovPct, 1)}% / 法定 {metrics.covLimit}%
                            </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden mt-2">
                            <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                    width: `${Math.min(100, metrics.covUsageRatio)}%`,
                                    backgroundColor: metrics.covOver ? '#E85D2A' : '#171614'
                                }}
                            />
                        </div>
                        <p className={`text-[11px] leading-relaxed mt-1.5 ${mutedText}`}>
                            {metrics.covPlainNote}
                        </p>
                    </div>

                    {/* 4. 容積率使用比例 */}
                    <div className={`rounded-2xl p-3 border ${subtleBorder}`}>
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-bold">容積率使用比例</span>
                            <span className={`text-xs font-black yra-num ${metrics.farOver ? 'text-[#E85D2A]' : ''}`}>
                                {formatNum(metrics.effectiveFarPct, 1)}% / 法定 {metrics.farLimit}%
                            </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden mt-2">
                            <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                    width: `${Math.min(100, metrics.farUsageRatio)}%`,
                                    backgroundColor: '#E85D2A'
                                }}
                            />
                        </div>
                        <p className={`text-[11px] leading-relaxed mt-1.5 ${mutedText}`}>
                            {metrics.farPlainNote}
                        </p>
                    </div>

                    {/* 假設與車位小補充 */}
                    <div className={`rounded-2xl px-3 py-2.5 flex items-center justify-between text-xs ${surfaceBg}`}>
                        <span className={mutedText}>預估地下停車空間</span>
                        <span className="font-bold yra-num">約 {metrics.parkDisplay}</span>
                    </div>

                    {/* 最近案件與複製為方案 B（桌機首頁左側可直接切換） */}
                    {!isReadOnlyShare && savedProjects.length > 0 && (
                        <div className={`rounded-2xl border ${subtleBorder} overflow-hidden`}>
                            <div className={`px-3 py-2 flex items-center justify-between ${surfaceBg}`}>
                                <button
                                    type="button"
                                    onClick={() => setShowRecentList(prev => !prev)}
                                    className="text-[11px] font-bold flex items-center gap-1.5"
                                >
                                    <FolderClock size={13} className="text-[#E85D2A]" />
                                    <span>最近案件 ({savedProjects.length})</span>
                                    {showRecentList ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                                {onDuplicateAsPlanB && (
                                    <button
                                        type="button"
                                        onClick={onDuplicateAsPlanB}
                                        className="text-[11px] font-bold text-[#2563EB] hover:underline flex items-center gap-1"
                                        title="複製目前案件為方案 B 進行比較"
                                    >
                                        <CopyPlus size={12} /> 複製方案 B
                                    </button>
                                )}
                            </div>
                            {showRecentList && (
                                <div className="p-2 space-y-1 max-h-36 overflow-y-auto">
                                    {savedProjects.slice(0, 6).map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => onLoadProject && onLoadProject(p)}
                                            className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between gap-2 text-xs transition-colors ${
                                                p.id === currentProjectId
                                                    ? 'bg-[#171614] text-white font-bold'
                                                    : 'hover:bg-black/5'
                                            }`}
                                        >
                                            <span className="truncate">{p.name || '未命名案件'}</span>
                                            <span className="text-[10px] opacity-75 yra-num shrink-0">{formatNum(p.basePing || 0, 1)}坪</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 顯眼的法定免責標註 */}
                    <div className={`flex items-start gap-1.5 px-1 text-[11px] leading-relaxed ${mutedText}`}>
                        <Info size={13} className="shrink-0 mt-0.5 text-[#E85D2A]" />
                        <span>概估，非正式法規審查。實際數據依建築師正式套繪為準。</span>
                    </div>
                </div>

                {/* 底部快捷動作 */}
                <div className={`px-4 py-3 border-t ${subtleBorder} flex gap-2`}>
                    <button
                        type="button"
                        onClick={() => (onOpenExport ? onOpenExport() : onOpenPanel && onOpenPanel('results'))}
                        className="flex-1 py-2.5 px-3 rounded-2xl bg-[#E85D2A] text-white text-xs font-bold hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5"
                    >
                        <Share2 size={14} />
                        輸出 / 分享
                    </button>
                    {!isReadOnlyShare && (
                        <button
                            type="button"
                            onClick={() => onOpenPanel && onOpenPanel('info')}
                            className={`py-2.5 px-3 rounded-2xl border ${subtleBorder} text-xs font-bold hover:border-[#171614] transition-colors flex items-center justify-center gap-1`}
                            title="調整基地與法規參數"
                        >
                            <SlidersHorizontal size={14} />
                            設定
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleCopySummary}
                        className={`py-2.5 px-2.5 rounded-2xl border ${subtleBorder} text-xs font-bold hover:border-[#171614] transition-colors flex items-center justify-center`}
                        title="複製文字摘要傳給業主"
                        aria-label="複製文字摘要"
                    >
                        {copied ? <Check size={14} className="text-[#E85D2A]" /> : <Copy size={14} />}
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default ResultSummaryPanel;
