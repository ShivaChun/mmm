import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Map as MapIcon,
    Scale,
    Layers,
    Sun,
    Share2,
    ChevronUp,
    ChevronDown,
    X,
    Pencil,
    Upload,
    Plus,
    Play,
    Pause,
    SlidersHorizontal,
    LayoutDashboard,
    Compass,
    Box,
    FileText,
    Copy,
    Check,
    CopyPlus,
    Sparkles,
    Eye
} from 'lucide-react';
import { toPing, formatNum } from '../utils/geometry';
import { formatRange, buildPlainTextSummary } from '../utils/summaryText';
import { computeSunState, formatSunClock } from './SunPathControls';
import { SunShadowMiniSvg } from './SunComparisonModal';

const NAV_TABS = [
    { id: 'site', label: '基地', icon: MapIcon },
    { id: 'reg', label: '法規', icon: Scale },
    { id: 'massing', label: '量體', icon: Layers },
    { id: 'env', label: '環境', icon: Sun },
    { id: 'export', label: '輸出', icon: Share2 }
];

const SEASONS = [
    { key: 'summer', label: '夏至' },
    { key: 'equinox', label: '春秋分' },
    { key: 'winter', label: '冬至' }
];

const SAMPLE_PRESETS = [
    {
        id: 'zhongxing',
        label: '中興新村 99 坪透天',
        desc: '建蔽 50% / 容積 150% · 10m 路',
        data: {
            name: '基地 A',
            lots: [{ id: 1, lot: '中興段 128 地號', area: 328.4 }],
            inputs: {
                projectName: '中興新村自建宅',
                district: '南投縣中興新村',
                zoneType: '住宅區',
                coverageRatio: 50,
                floorRatio: 150,
                excavationRatio: 60,
                floorsBelow: 1,
                frontYardDepth: 4,
                sideYardDepth: 1.5,
                backYardDepth: 3,
                floorHeight1F: 4.2,
                floorHeightOther: 3.6,
                roads: [{ id: 1, name: '向陽路', width: 10, orientation: 'bottom', type: 'primary', edgeIndex: 2 }]
            }
        }
    },
    {
        id: 'taichung',
        label: '台中 72 坪角地別墅',
        desc: '建蔽 60% / 容積 180% · 12m 路',
        data: {
            name: '基地 A',
            lots: [{ id: 1, lot: '惠民段 56 地號', area: 238.0 }],
            inputs: {
                projectName: '台中電梯別墅',
                district: '台中市西屯區',
                zoneType: '第二種住宅區',
                coverageRatio: 60,
                floorRatio: 180,
                excavationRatio: 65,
                floorsBelow: 1,
                frontYardDepth: 4,
                sideYardDepth: 2,
                backYardDepth: 3,
                floorHeight1F: 4.2,
                floorHeightOther: 3.5,
                roads: [{ id: 1, name: '市政北二路', width: 12, orientation: 'bottom', type: 'primary', edgeIndex: 2 }]
            }
        }
    },
    {
        id: 'tainan',
        label: '台南 45 坪街屋透天',
        desc: '建蔽 60% / 容積 200% · 8m 路',
        data: {
            name: '基地 A',
            lots: [{ id: 1, lot: '安平段 312 地號', area: 148.8 }],
            inputs: {
                projectName: '安平自建街屋',
                district: '台南市安平區',
                zoneType: '住宅區',
                coverageRatio: 60,
                floorRatio: 200,
                excavationRatio: 0,
                floorsBelow: 0,
                frontYardDepth: 0,
                sideYardDepth: 0,
                backYardDepth: 2.5,
                floorHeight1F: 4.0,
                floorHeightOther: 3.4,
                roads: [{ id: 1, name: '建平七街', width: 8, orientation: 'bottom', type: 'primary', edgeIndex: 2 }]
            }
        }
    }
];

export const UnifiedMobileSheet = ({
    isCompactLandscape = false,
    isDarkMode = false,
    isReadOnlyShare = false,
    // 基地與計算資料
    activeSite,
    sites = [],
    activeSiteIndex = 0,
    lots = [],
    inputs = {},
    finalRes = {},
    params = {},
    massingSummary = {},
    // 面板與分頁狀態（由外部或內部同步，方便 3D 控制太陽軌跡與自動取景）
    activeTab = 'summary', // 'summary' | 'site' | 'reg' | 'massing' | 'env' | 'export'
    setActiveTab,
    sheetHeight = 'peek', // 'peek' | 'half' | 'full'
    setSheetHeight,
    // 日照與環境控制（直接綁定 3D 狀態，不再開獨立浮窗）
    sunTime = 11.5,
    setSunTime,
    sunSeason = 'summer',
    setSunSeason,
    isSunPlaying = false,
    setIsSunPlaying,
    aoMode = true,
    setAoMode,
    // 3D 控制器與 App 動作
    controller,
    viewAngleX = 55,
    onToggleTopDownView,
    onOpenCadastralImport,
    appActions = {}
}) => {
    const [showSunCompareInline, setShowSunCompareInline] = useState(false);
    const [showEnvAdvanced, setShowEnvAdvanced] = useState(false);
    const [showSamples, setShowSamples] = useState(false);
    const [landscapePanelOpen, setLandscapePanelOpen] = useState(true);
    const [copiedText, setCopiedText] = useState(false);

    // 觸控拖曳把手切換三段高度（peek / half / full）
    const dragStartY = useRef(null);
    const [dragOffsetY, setDragOffsetY] = useState(0);

    const {
        onInputChange,
        onUpdateLot,
        onAddLot,
        onUpdateRoad,
        onSwitchSite,
        onOpenAddSite,
        onOpenPanel,
        onOpenExport,
        onToggleEnvPanel,
        onLoadSampleCase,
        savedProjects = [],
        currentProjectId,
        onLoadProject,
        onDuplicateAsPlanB,
        showCheckLines = false,
        setShowCheckLines,
        showHeightRatio = true,
        setShowHeightRatio,
        showWeiLao = false,
        setShowWeiLao,
        showBackyard = true,
        setShowBackyard
    } = appActions;

    const {
        groupedLayers = [],
        normalizedSelectedFloorId,
        isDrawingSite,
        startDrawingSite,
        cancelDrawingSite,
        setFloorConfig,
        setShowFloorDialog,
        onSelectFloor,
        onCloseFloorEdit,
        unitSettings,
        onUpdateUnitSettings
    } = controller || {};

    // 關鍵評估指標
    const metrics = useMemo(() => {
        const baseM2 = finalRes.base || 0;
        const basePing = toPing(baseM2);
        const totalCfaPing = toPing(finalRes.totalCFA || 0);
        const cfaRange = formatRange(totalCfaPing, 0.05, totalCfaPing >= 100 ? 5 : 2);
        const calcFloors = finalRes.calculatedFloors || 0;
        const visualFloors = massingSummary?.visualFloorsAbove || finalRes.floorsAbove || 1;
        const floorsBelow = parseInt(inputs.floorsBelow || 0, 10);
        const floorLow = Math.max(1, Math.floor(calcFloors || visualFloors));
        const floorHigh = Math.max(floorLow, visualFloors);
        const floorDisplay = floorLow < floorHigh ? `${floorLow}–${floorHigh}F` : `${visualFloors}F`;
        const budgetRange = formatRange(
            finalRes.estimatedBudget || 0,
            0.12,
            (finalRes.estimatedBudget || 0) >= 1000 ? 100 : 50
        );
        return { basePing, cfaRange, floorDisplay, floorsBelow, budgetRange, visualFloors };
    }, [finalRes, inputs.floorsBelow, massingSummary]);

    const sunState = useMemo(
        () => computeSunState(sunTime, sunSeason, inputs.northAngle || 0),
        [sunTime, sunSeason, inputs.northAngle]
    );

    // 通知 3D 畫布目前可視區留白（任務 5 自動取景），僅在數值實際變更時觸發避免無限迴圈
    const lastInsetsSigRef = useRef('');
    const onViewportInsetsChange = appActions.onViewportInsetsChange;

    useEffect(() => {
        if (typeof onViewportInsetsChange !== 'function') return;
        let next;
        if (isCompactLandscape) {
            next = {
                top: 48,
                left: 64,
                right: landscapePanelOpen ? 332 : 16,
                bottom: 12
            };
        } else {
            const navH = 56;
            const vh = typeof window !== 'undefined' ? window.innerHeight : 844;
            const sheetPx = sheetHeight === 'peek'
                ? 112
                : sheetHeight === 'half'
                    ? Math.round(vh * 0.45)
                    : Math.round(vh * 0.84);
            next = {
                top: 52,
                left: 12,
                right: 12,
                bottom: navH + sheetPx
            };
        }
        const sig = `${next.top}|${next.right}|${next.bottom}|${next.left}`;
        if (sig !== lastInsetsSigRef.current) {
            lastInsetsSigRef.current = sig;
            onViewportInsetsChange(next);
        }
    }, [isCompactLandscape, landscapePanelOpen, sheetHeight, onViewportInsetsChange]);

    // 切換分頁：點選同一分頁若已在展開態則收合回摘要 peek，否則切換到該分頁並展開至 half
    const handleSelectTab = (tabId) => {
        if (isCompactLandscape) {
            if (activeTab === tabId && landscapePanelOpen) {
                setActiveTab('summary');
            } else {
                setActiveTab(tabId);
                setLandscapePanelOpen(true);
            }
            return;
        }
        if (activeTab === tabId && sheetHeight !== 'peek') {
            setActiveTab('summary');
            setSheetHeight('peek');
        } else {
            setActiveTab(tabId);
            if (sheetHeight === 'peek') setSheetHeight('half');
        }
    };

    const handleCloseToPeek = () => {
        if (isCompactLandscape) {
            if (activeTab !== 'summary') {
                setActiveTab('summary');
            } else {
                setLandscapePanelOpen(false);
            }
            return;
        }
        setActiveTab('summary');
        setSheetHeight('peek');
    };

    const handleCycleHeight = () => {
        if (sheetHeight === 'peek') setSheetHeight('half');
        else if (sheetHeight === 'half') setSheetHeight('full');
        else {
            setActiveTab('summary');
            setSheetHeight('peek');
        }
    };

    const handleTouchStartHandle = (e) => {
        if (e.touches.length !== 1) return;
        dragStartY.current = e.touches[0].clientY;
        setDragOffsetY(0);
    };
    const handleTouchMoveHandle = (e) => {
        if (dragStartY.current === null || e.touches.length !== 1) return;
        const delta = e.touches[0].clientY - dragStartY.current;
        setDragOffsetY(Math.max(-160, Math.min(160, delta)));
    };
    const handleTouchEndHandle = () => {
        if (dragStartY.current === null) return;
        if (dragOffsetY < -36) {
            if (sheetHeight === 'peek') setSheetHeight('half');
            else if (sheetHeight === 'half') setSheetHeight('full');
        } else if (dragOffsetY > 36) {
            if (sheetHeight === 'full') setSheetHeight('half');
            else if (sheetHeight === 'half') {
                setActiveTab('summary');
                setSheetHeight('peek');
            }
        }
        dragStartY.current = null;
        setDragOffsetY(0);
    };

    const handleCopyPlainText = async () => {
        try {
            const text = buildPlainTextSummary({ activeSite, inputs, finalRes, params, massingSummary });
            await navigator.clipboard.writeText(text);
            setCopiedText(true);
            setTimeout(() => setCopiedText(false), 1800);
        } catch {
            setCopiedText(false);
        }
    };

    const isTopDown = viewAngleX <= 5;
    const muted = isDarkMode ? 'text-[#9E988E]' : 'text-[#767168]';
    const subtleBorder = isDarkMode ? 'border-white/14' : 'border-[#DDD8CE]';
    const surfaceBg = isDarkMode ? 'bg-white/8' : 'bg-[#F4F2EE]';
    const inputCls = `w-full min-h-[44px] px-3 py-2 rounded-xl border ${subtleBorder} bg-transparent text-sm font-medium outline-none focus:border-[#2563EB] yra-num`;

    const primaryRoad = (inputs.roads || []).find(r => r.type === 'primary') || (inputs.roads || [])[0];

    /* ── 各分頁面板內部主體（直向 Bottom Sheet 與橫向右側面板共用，保證單一來源） ── */
    const renderSheetBody = () => {
        // A. 摘要展開內容（任務 3：假設可點擊即時重算、方案 A/B 切換、傳給業主與複製方案 B）
        if (activeTab === 'summary') {
            return (
                <div className="space-y-4 pb-2">
                    {/* 假設區：點擊直接修改即時重算 */}
                    <div className="space-y-2">
                        <div className={`text-xs font-medium ${muted}`}>計算假設（點擊數值可即時修改重算）</div>
                        <div className="grid grid-cols-2 gap-2.5">
                            <label className={`rounded-2xl p-3 border ${subtleBorder} ${surfaceBg} block`}>
                                <span className={`text-xs block ${muted}`}>建蔽率 (%)</span>
                                <input
                                    type="number"
                                    name="coverageRatio"
                                    value={inputs.coverageRatio}
                                    onChange={onInputChange}
                                    className="w-full mt-1 bg-transparent text-base font-medium outline-none focus:text-[#2563EB] yra-num"
                                />
                            </label>
                            <label className={`rounded-2xl p-3 border ${subtleBorder} ${surfaceBg} block`}>
                                <span className={`text-xs block ${muted}`}>容積率 (%)</span>
                                <input
                                    type="number"
                                    name="floorRatio"
                                    value={inputs.floorRatio}
                                    onChange={onInputChange}
                                    className="w-full mt-1 bg-transparent text-base font-medium outline-none focus:text-[#2563EB] yra-num"
                                />
                            </label>
                            <label className={`rounded-2xl p-3 border ${subtleBorder} ${surfaceBg} block`}>
                                <span className={`text-xs block ${muted}`}>前院 / 後院退縮 (m)</span>
                                <div className="flex items-center gap-1 mt-1 min-w-0">
                                    <input
                                        type="number"
                                        name="frontYardDepth"
                                        value={inputs.frontYardDepth}
                                        onChange={onInputChange}
                                        aria-label="前院退縮"
                                        className="w-11 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none focus:text-[#2563EB] yra-num"
                                    />
                                    <span className={`text-xs shrink-0 ${muted}`}>/</span>
                                    <input
                                        type="number"
                                        name="backYardDepth"
                                        value={inputs.backYardDepth}
                                        onChange={onInputChange}
                                        aria-label="後院退縮"
                                        className="w-11 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none focus:text-[#2563EB] yra-num"
                                    />
                                </div>
                            </label>
                            <label className={`rounded-2xl p-3 border ${subtleBorder} ${surfaceBg} block min-w-0`}>
                                <span className={`text-xs block truncate ${muted}`}>一樓 / 標準層高 (m)</span>
                                <div className="flex items-center gap-1 mt-1 min-w-0">
                                    <input
                                        type="number"
                                        step="0.1"
                                        name="floorHeight1F"
                                        value={inputs.floorHeight1F}
                                        onChange={onInputChange}
                                        aria-label="一樓層高"
                                        className="w-11 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none focus:text-[#2563EB] yra-num"
                                    />
                                    <span className={`text-xs shrink-0 ${muted}`}>/</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        name="floorHeightOther"
                                        value={inputs.floorHeightOther}
                                        onChange={onInputChange}
                                        aria-label="標準層高"
                                        className="w-11 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none focus:text-[#2563EB] yra-num"
                                    />
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* 方案 A / B 切換 */}
                    {!isReadOnlyShare && savedProjects.length > 0 && (
                        <div className="space-y-2">
                            <div className={`text-xs font-medium ${muted}`}>方案切換（自動儲存於本機）</div>
                            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                {savedProjects.slice(0, 5).map(p => {
                                    const active = p.id === currentProjectId;
                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => onLoadProject && onLoadProject(p)}
                                            className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-medium shrink-0 transition-colors ${
                                                active
                                                    ? 'bg-[#2563EB] text-white border-[#2563EB]'
                                                    : `${surfaceBg} ${subtleBorder}`
                                            }`}
                                        >
                                            {p.name || '方案 A'} · {formatNum(p.basePing || 0, 1)} 坪
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 兩個主要行動按鈕（≥44px） */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('export');
                                if (!isCompactLandscape) setSheetHeight('half');
                            }}
                            className="min-h-[48px] px-4 rounded-2xl bg-[#E85D2A] text-white text-sm font-medium flex items-center justify-center gap-2"
                        >
                            <Share2 size={16} />
                            傳給業主
                        </button>
                        <button
                            type="button"
                            onClick={() => onDuplicateAsPlanB && onDuplicateAsPlanB()}
                            className={`min-h-[48px] px-4 rounded-2xl border ${subtleBorder} ${surfaceBg} text-sm font-medium flex items-center justify-center gap-2`}
                        >
                            <CopyPlus size={16} />
                            複製成方案 B
                        </button>
                    </div>
                </div>
            );
        }

        // B. 基地分頁
        if (activeTab === 'site') {
            return (
                <div className="space-y-3.5 pb-2">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                handleCloseToPeek();
                                if (isDrawingSite) cancelDrawingSite();
                                else startDrawingSite('current');
                            }}
                            className={`min-h-[46px] px-3 rounded-2xl border text-xs font-medium flex items-center justify-center gap-2 ${
                                isDrawingSite ? 'bg-[#2563EB] text-white border-[#2563EB]' : `${surfaceBg} ${subtleBorder}`
                            }`}
                        >
                            <Pencil size={15} />
                            {isDrawingSite ? '結束繪製' : '點拉線繪基地'}
                        </button>
                        {onOpenCadastralImport && (
                            <button
                                type="button"
                                onClick={() => {
                                    handleCloseToPeek();
                                    onOpenCadastralImport();
                                }}
                                className={`min-h-[46px] px-3 rounded-2xl border text-xs font-medium flex items-center justify-center gap-2 ${surfaceBg} ${subtleBorder}`}
                            >
                                <Upload size={15} />
                                匯入地籍圖
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                handleCloseToPeek();
                                if (normalizedSelectedFloorId === 'base') onCloseFloorEdit();
                                else onSelectFloor('base');
                            }}
                            className={`min-h-[46px] px-3 rounded-2xl border text-xs font-medium flex items-center justify-center gap-2 ${
                                normalizedSelectedFloorId === 'base' ? 'bg-[#2563EB] text-white border-[#2563EB]' : `${surfaceBg} ${subtleBorder}`
                            }`}
                        >
                            <MapIcon size={15} />
                            調整基地形狀
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowSamples(prev => !prev)}
                            className={`min-h-[46px] px-3 rounded-2xl border text-xs font-medium flex items-center justify-center gap-2 ${
                                showSamples ? 'bg-[#2563EB] text-white border-[#2563EB]' : `${surfaceBg} ${subtleBorder}`
                            }`}
                        >
                            <Sparkles size={15} />
                            載入範例案件
                        </button>
                    </div>

                    {showSamples && (
                        <div className={`rounded-2xl p-2.5 border ${subtleBorder} ${surfaceBg} space-y-2`}>
                            {SAMPLE_PRESETS.map(sp => (
                                <button
                                    key={sp.id}
                                    type="button"
                                    onClick={() => {
                                        onLoadSampleCase && onLoadSampleCase(sp.data);
                                        setShowSamples(false);
                                    }}
                                    className={`w-full min-h-[44px] px-3 py-2 rounded-xl border ${subtleBorder} bg-white/80 dark:bg-black/20 text-left`}
                                >
                                    <div className="text-xs font-bold">{sp.label}</div>
                                    <div className={`text-xs ${muted}`}>{sp.desc}</div>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="space-y-2.5">
                        <div>
                            <label className={`text-xs block mb-1 ${muted}`}>行政區</label>
                            <input
                                type="text"
                                name="district"
                                value={inputs.district || ''}
                                onChange={onInputChange}
                                placeholder="例：南投縣中興新村"
                                className={inputCls}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className={`text-xs ${muted}`}>地號與面積 (㎡)</span>
                                <button
                                    type="button"
                                    onClick={onAddLot}
                                    className="min-h-[36px] px-2 text-xs font-medium text-[#2563EB] flex items-center gap-1"
                                >
                                    <Plus size={14} /> 新增地號
                                </button>
                            </div>
                            {lots.map(l => (
                                <div key={l.id} className="grid grid-cols-[1fr_104px] gap-2">
                                    <input
                                        type="text"
                                        placeholder="例：中興段 128 地號"
                                        value={l.lot === '___段___地號' ? '' : l.lot}
                                        onChange={(e) => onUpdateLot(l.id, 'lot', e.target.value)}
                                        className={inputCls}
                                    />
                                    <input
                                        type="number"
                                        placeholder="㎡"
                                        value={l.area}
                                        onChange={(e) => onUpdateLot(l.id, 'area', e.target.value)}
                                        className={`${inputCls} text-right`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 多基地切換 */}
                    <div className="flex flex-wrap gap-2 pt-1">
                        {sites.map((s, idx) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => onSwitchSite && onSwitchSite(idx)}
                                className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-medium ${
                                    idx === activeSiteIndex ? 'bg-[#2563EB] text-white border-[#2563EB]' : `${surfaceBg} ${subtleBorder}`
                                }`}
                            >
                                {s.name}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => onOpenAddSite && onOpenAddSite()}
                            className={`min-h-[44px] px-3.5 rounded-xl border border-dashed ${subtleBorder} text-xs font-medium flex items-center gap-1`}
                        >
                            <Plus size={14} /> 新增基地
                        </button>
                    </div>
                </div>
            );
        }

        // C. 法規分頁
        if (activeTab === 'reg') {
            return (
                <div className="space-y-3.5 pb-2">
                    <div className="grid grid-cols-2 gap-2.5">
                        <div>
                            <label className={`text-xs block mb-1 ${muted}`}>法定建蔽率 (%)</label>
                            <input type="number" name="coverageRatio" value={inputs.coverageRatio} onChange={onInputChange} className={inputCls} />
                        </div>
                        <div>
                            <label className={`text-xs block mb-1 ${muted}`}>法定容積率 (%)</label>
                            <input type="number" name="floorRatio" value={inputs.floorRatio} onChange={onInputChange} className={inputCls} />
                        </div>
                        <div>
                            <label className={`text-xs block mb-1 ${muted}`}>使用分區</label>
                            <input type="text" name="zoneType" value={inputs.zoneType || ''} onChange={onInputChange} placeholder="例：住宅區" className={inputCls} />
                        </div>
                        {primaryRoad && (
                            <div>
                                <label className={`text-xs block mb-1 ${muted}`}>主要路寬 (m)</label>
                                <input
                                    type="number"
                                    value={primaryRoad.width}
                                    onChange={(e) => onUpdateRoad && onUpdateRoad(primaryRoad.id, 'width', e.target.value)}
                                    className={inputCls}
                                />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className={`text-xs ${muted}`}>檢討模式（3D 法規限制面）</div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setShowCheckLines && setShowCheckLines(p => !p)}
                                className={`min-h-[44px] px-3 rounded-2xl border text-xs font-medium flex items-center justify-center gap-1.5 ${
                                    showCheckLines ? 'bg-[#2563EB] text-white border-[#2563EB]' : `${surfaceBg} ${subtleBorder}`
                                }`}
                            >
                                <Eye size={15} />
                                {showCheckLines ? '檢討面：顯示' : '檢討面：隱藏'}
                            </button>
                            <button
                                type="button"
                                disabled={!showCheckLines}
                                onClick={() => setShowHeightRatio && setShowHeightRatio(p => !p)}
                                className={`min-h-[44px] px-3 rounded-2xl border text-xs font-medium ${
                                    showCheckLines && showHeightRatio ? 'bg-[#2563EB] text-white border-[#2563EB]' : `${surfaceBg} ${subtleBorder}`
                                } ${!showCheckLines ? 'opacity-40' : ''}`}
                            >
                                高度比限制面
                            </button>
                            <button
                                type="button"
                                disabled={!showCheckLines}
                                onClick={() => setShowWeiLao && setShowWeiLao(p => !p)}
                                className={`min-h-[44px] px-3 rounded-2xl border text-xs font-medium ${
                                    showCheckLines && showWeiLao ? 'bg-[#2563EB] text-white border-[#2563EB]' : `${surfaceBg} ${subtleBorder}`
                                } ${!showCheckLines ? 'opacity-40' : ''}`}
                            >
                                危老檢討 (1:5)
                            </button>
                            <button
                                type="button"
                                disabled={!showCheckLines}
                                onClick={() => setShowBackyard && setShowBackyard(p => !p)}
                                className={`min-h-[44px] px-3 rounded-2xl border text-xs font-medium ${
                                    showCheckLines && showBackyard ? 'bg-[#2563EB] text-white border-[#2563EB]' : `${surfaceBg} ${subtleBorder}`
                                } ${!showCheckLines ? 'opacity-40' : ''}`}
                            >
                                後院退縮線
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // D. 量體分頁
        if (activeTab === 'massing') {
            return (
                <div className="space-y-3.5 pb-2">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setFloorConfig({
                                    above: Math.max(1, parseInt(controller?.floorsAboveValue || inputs.floorsAbove || '1', 10)),
                                    below: Math.max(0, parseInt(inputs.floorsBelow || '0', 10))
                                });
                                setShowFloorDialog(true);
                            }}
                            className={`min-h-[46px] px-3 rounded-2xl border text-xs font-medium flex items-center justify-center gap-2 ${surfaceBg} ${subtleBorder}`}
                        >
                            <SlidersHorizontal size={15} />
                            樓層數配置
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const firstFloorGroup = (groupedLayers || []).find(g => g.id !== 'base' && g.id !== 'excavation');
                                const currentTarget = (normalizedSelectedFloorId && normalizedSelectedFloorId !== 'base' && normalizedSelectedFloorId !== 'excavation' && !/^B\d+$/.test(normalizedSelectedFloorId))
                                    ? normalizedSelectedFloorId
                                    : (unitSettings?.target ? unitSettings.target.split('-')[0] : (firstFloorGroup ? firstFloorGroup.id : '1F'));
                                onUpdateUnitSettings && onUpdateUnitSettings(prev => ({
                                    ...prev,
                                    enabled: !prev.enabled,
                                    target: currentTarget
                                }));
                            }}
                            className={`min-h-[46px] px-3 rounded-2xl border text-xs font-medium flex items-center justify-center gap-2 ${
                                unitSettings?.enabled ? 'bg-[#2563EB] text-white border-[#2563EB]' : `${surfaceBg} ${subtleBorder}`
                            }`}
                        >
                            <LayoutDashboard size={15} />
                            分戶分割
                        </button>
                    </div>

                    <div className="space-y-2">
                        <div className={`text-xs ${muted}`}>點選樓層於 3D 直接編輯平面</div>
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {groupedLayers.map(group => {
                                const isSel = normalizedSelectedFloorId === group.id;
                                const totalFloorArea = group.units.reduce((sum, u) => sum + (u.realArea || 0), 0);
                                return (
                                    <button
                                        key={group.id}
                                        type="button"
                                        onClick={() => {
                                            handleCloseToPeek();
                                            if (isSel) onCloseFloorEdit();
                                            else onSelectFloor(group.id);
                                        }}
                                        className={`min-h-[52px] min-w-[76px] px-3 py-1.5 rounded-2xl border shrink-0 flex flex-col items-start justify-center ${
                                            isSel ? 'bg-[#2563EB] text-white border-[#2563EB]' : `${surfaceBg} ${subtleBorder}`
                                        }`}
                                    >
                                        <span className="text-xs font-bold">{group.id}</span>
                                        <span className="text-xs opacity-75 yra-num">{formatNum(toPing(totalFloorArea), 1)} 坪</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        }

        // E. 環境（日照）分頁（任務 4 瘦身版：單欄三區塊 + 摺疊進階，所有字級 ≥12px）
        if (activeTab === 'env') {
            return (
                <div className="space-y-4 pb-2">
                    {/* 區塊 1：節氣三段按鈕 */}
                    <div className="space-y-1.5">
                        <div className={`text-xs font-medium ${muted}`}>節氣</div>
                        <div className={`grid grid-cols-3 gap-1.5 p-1 rounded-2xl ${surfaceBg}`}>
                            {SEASONS.map(s => {
                                const active = sunSeason === s.key;
                                return (
                                    <button
                                        key={s.key}
                                        type="button"
                                        onClick={() => setSunSeason && setSunSeason(s.key)}
                                        className={`min-h-[44px] rounded-xl text-xs font-medium transition-colors ${
                                            active
                                                ? 'bg-[#2563EB] text-white'
                                                : `${muted} hover:text-[#171614]`
                                        }`}
                                    >
                                        {s.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 區塊 2：時間滑桿（06:00–18:00）+ 即時時間與仰角 + 播放日照 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium yra-num">
                                {formatSunClock(sunTime)}
                                <span className={`text-xs ml-2 ${muted}`}>
                                    仰角 {Math.max(0, sunState.altDeg).toFixed(0)}°
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsSunPlaying && setIsSunPlaying(p => !p)}
                                className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 ${
                                    isSunPlaying
                                        ? 'bg-[#2563EB] text-white border-[#2563EB]'
                                        : `${surfaceBg} ${subtleBorder}`
                                }`}
                            >
                                {isSunPlaying ? <Pause size={14} /> : <Play size={14} />}
                                {isSunPlaying ? '暫停' : '播放日照'}
                            </button>
                        </div>
                        <input
                            type="range"
                            min="6"
                            max="18"
                            step="0.25"
                            value={Math.max(6, Math.min(18, sunTime))}
                            onChange={(e) => {
                                setIsSunPlaying && setIsSunPlaying(false);
                                setSunTime && setSunTime(parseFloat(e.target.value));
                            }}
                            className="w-full h-2 accent-[#2563EB] cursor-pointer"
                            aria-label="日照時間滑桿"
                        />
                        <div className={`flex justify-between text-xs yra-num ${muted}`}>
                            <span>06:00</span>
                            <span>12:00</span>
                            <span>18:00</span>
                        </div>
                    </div>

                    {/* 區塊 3：日照對比全寬按鈕（同一面板內顯示 9:00 / 12:00 / 15:00 三張快照） */}
                    <div className="space-y-2.5">
                        <button
                            type="button"
                            onClick={() => setShowSunCompareInline(prev => !prev)}
                            className={`w-full min-h-[46px] px-4 rounded-2xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                                showSunCompareInline
                                    ? 'bg-[#2563EB] text-white border-[#2563EB]'
                                    : 'bg-[#171614] text-white border-[#171614]'
                            }`}
                        >
                            <Sun size={16} />
                            {showSunCompareInline ? '收合日照對比快照' : '日照對比（09:00 / 12:00 / 15:00）'}
                        </button>

                        {showSunCompareInline && (
                            <div className="grid grid-cols-3 gap-2">
                                {[9, 12, 15].map(hr => {
                                    const active = Math.abs(sunTime - hr) < 0.6;
                                    return (
                                        <button
                                            key={hr}
                                            type="button"
                                            onClick={() => {
                                                setIsSunPlaying && setIsSunPlaying(false);
                                                setSunTime && setSunTime(hr);
                                                setAoMode && setAoMode(true);
                                            }}
                                            className={`rounded-2xl p-1.5 border text-center transition-colors ${
                                                active
                                                    ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20'
                                                    : subtleBorder
                                            }`}
                                        >
                                            <div className="aspect-square rounded-xl overflow-hidden">
                                                <SunShadowMiniSvg
                                                    basePoints={massingSummary?.basePoints}
                                                    buildingHeight={massingSummary?.totalHeight || finalRes.buildingHeight || 15}
                                                    season={sunSeason}
                                                    hour={hr}
                                                    northAngle={inputs.northAngle || 0}
                                                    size={110}
                                                />
                                            </div>
                                            <div className="text-xs font-medium yra-num mt-1">
                                                {String(hr).padStart(2, '0')}:00
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 摺疊「進階」區（預設收合：基地北向、白模 AO、2D/3D、臨地顯示） */}
                    <div className={`rounded-2xl border ${subtleBorder} overflow-hidden`}>
                        <button
                            type="button"
                            onClick={() => setShowEnvAdvanced(prev => !prev)}
                            className={`w-full min-h-[44px] px-3.5 flex items-center justify-between text-xs font-medium ${surfaceBg}`}
                        >
                            <span>進階（基地北向、白模 AO、視角）</span>
                            {showEnvAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                        {showEnvAdvanced && (
                            <div className="p-3.5 space-y-3">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className={muted}>基地北向角度</span>
                                        <span className="font-medium yra-num">{(inputs.northAngle || 0).toFixed(0)}°</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="360"
                                        step="5"
                                        value={inputs.northAngle || 0}
                                        onChange={(e) => appActions.onUpdateNorthAngle && appActions.onUpdateNorthAngle(parseFloat(e.target.value))}
                                        className="w-full accent-[#2563EB]"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAoMode && setAoMode(v => !v)}
                                        className={`min-h-[44px] px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 ${
                                            aoMode ? 'bg-[#2563EB] text-white border-[#2563EB]' : `${surfaceBg} ${subtleBorder}`
                                        }`}
                                    >
                                        <Box size={14} /> 白模 AO
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onToggleTopDownView && onToggleTopDownView()}
                                        className={`min-h-[44px] px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 ${
                                            isTopDown ? 'bg-[#2563EB] text-white border-[#2563EB]' : `${surfaceBg} ${subtleBorder}`
                                        }`}
                                    >
                                        <Compass size={14} /> {isTopDown ? '3D 視角' : '2D 俯視'}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onToggleEnvPanel && onToggleEnvPanel()}
                                    className={`w-full min-h-[44px] px-3 rounded-xl border text-xs font-medium ${surfaceBg} ${subtleBorder}`}
                                >
                                    臨地與鄰房模擬設定
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // F. 輸出分頁
        return (
            <div className="space-y-2.5 pb-2">
                <button
                    type="button"
                    onClick={() => onOpenExport && onOpenExport()}
                    className="w-full min-h-[48px] px-4 rounded-2xl bg-[#E85D2A] text-white text-sm font-medium flex items-center justify-center gap-2"
                >
                    <Share2 size={16} />
                    產生 LINE 長圖 / 唯讀連結 / A4 PDF
                </button>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={handleCopyPlainText}
                        className={`min-h-[46px] px-3 rounded-2xl border text-xs font-medium flex items-center justify-center gap-1.5 ${surfaceBg} ${subtleBorder}`}
                    >
                        {copiedText ? <Check size={15} className="text-[#E85D2A]" /> : <Copy size={15} />}
                        {copiedText ? '已複製文字' : '複製文字摘要'}
                    </button>
                    <button
                        type="button"
                        onClick={() => onOpenPanel && onOpenPanel('results')}
                        className={`min-h-[46px] px-3 rounded-2xl border text-xs font-medium flex items-center justify-center gap-1.5 ${surfaceBg} ${subtleBorder}`}
                    >
                        <FileText size={15} />
                        詳細計算表
                    </button>
                </div>
            </div>
        );
    };

    /* ── 結果摘要卡（任務 3 Peek 排版：直向收合態 / 橫向右側頂部共用） ── */
    const renderSummaryHeader = () => (
        <div className="px-4 pt-2 pb-2.5">
            {/* 第一行：基地 A · 99.34 坪 (14px, 500) + 右側「概估」與展開箭頭 (≥44px) */}
            <div className="flex items-center justify-between gap-2">
                <div className="text-[14px] font-medium truncate yra-num">
                    {activeSite?.name || '基地 A'} · {formatNum(metrics.basePing, 2)} 坪
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-xs ${muted}`}>概估</span>
                    <button
                        type="button"
                        onClick={() => {
                            if (isCompactLandscape) {
                                setLandscapePanelOpen(prev => !prev);
                            } else if (sheetHeight === 'peek') {
                                setSheetHeight('half');
                            } else {
                                handleCloseToPeek();
                            }
                        }}
                        className="w-11 h-11 -my-2 -mr-2 flex items-center justify-center rounded-xl hover:bg-black/5"
                        aria-label={sheetHeight === 'peek' ? '展開摘要細節' : '收合面板'}
                    >
                        {sheetHeight === 'peek' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                </div>
            </div>

            {/* 第二行：三欄配置（標籤 12px 灰、數字 16–20px/500、單位 12px；造價為唯一橘色數字） */}
            <div className="grid grid-cols-[1.12fr_0.56fr_1.32fr] gap-1.5 mt-1.5 min-w-0">
                <div className="min-w-0">
                    <div className={`text-xs truncate ${muted}`}>可建樓地板</div>
                    <div className={`${isCompactLandscape ? 'text-[15px]' : 'text-[18px] min-[390px]:text-[20px]'} font-medium leading-tight yra-num mt-0.5 whitespace-nowrap`}>
                        {metrics.cfaRange}
                        <span className={`text-xs font-normal ml-0.5 ${muted}`}>坪</span>
                    </div>
                </div>
                <div className="min-w-0">
                    <div className={`text-xs truncate ${muted}`}>層數</div>
                    <div className={`${isCompactLandscape ? 'text-[15px]' : 'text-[18px] min-[390px]:text-[20px]'} font-medium leading-tight yra-num mt-0.5 whitespace-nowrap`}>
                        {metrics.floorDisplay}
                    </div>
                </div>
                <div className="min-w-0">
                    <div className={`text-xs truncate ${muted}`}>概估造價</div>
                    <div className={`${isCompactLandscape ? 'text-[15px]' : 'text-[18px] min-[390px]:text-[20px]'} font-medium leading-tight text-[#E85D2A] yra-num mt-0.5 whitespace-nowrap`}>
                        {metrics.budgetRange}
                        <span className="text-xs font-normal ml-0.5 text-[#767168]">萬</span>
                    </div>
                </div>
            </div>

            {/* 第三行：單獨一行 12px 灰字（含地下層與免責） */}
            <div className={`text-xs mt-1.5 truncate ${muted}`}>
                {metrics.floorsBelow > 0 ? `地下 B${metrics.floorsBelow} · ` : ''}概估，非正式法規審查
            </div>
        </div>
    );

    const tabTitle = activeTab === 'site'
        ? '基地'
        : activeTab === 'reg'
            ? '法規'
            : activeTab === 'massing'
                ? '量體'
                : activeTab === 'env'
                    ? '環境與日照'
                    : activeTab === 'export'
                        ? '輸出與分享'
                        : '評估摘要';

    /* =========================================================================
     * 橫向模式（844×390 等 compact landscape）：左側窄欄導覽 (60px) + 右側面板
     * 絕不旋轉任何文字！
     * ========================================================================= */
    if (isCompactLandscape) {
        return (
            <>
                {/* 左側固定窄欄導覽（寬 60px ≤ 64px，圖示 + 12px 水平文字） */}
                <nav
                    aria-label="橫向主要導覽"
                    className="fixed left-0 top-0 bottom-0 w-[60px] z-[60] yra-card rounded-none border-y-0 border-l-0 flex flex-col justify-center gap-1 py-2 pl-safe no-print no-context-menu"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {NAV_TABS.map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id && landscapePanelOpen;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleSelectTab(tab.id)}
                                className={`min-h-[48px] w-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
                                    active ? 'text-[#2563EB] font-bold' : muted
                                }`}
                                aria-label={tab.label}
                            >
                                <Icon size={18} strokeWidth={active ? 2.4 : 1.9} />
                                <span className="text-xs leading-none">{tab.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* 右側摘要／分頁面板（寬 324px，可收合，無內部水平捲動） */}
                {landscapePanelOpen ? (
                    <aside
                        className="fixed right-2 top-12 bottom-2 w-[324px] max-w-[44vw] z-[58] yra-card rounded-2xl flex flex-col overflow-hidden pr-safe no-print no-context-menu"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {activeTab === 'summary' ? (
                            <div className="flex flex-col h-full overflow-hidden">
                                <div className={`border-b ${subtleBorder} shrink-0`}>
                                    {renderSummaryHeader()}
                                </div>
                                <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
                                    {renderSheetBody()}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full overflow-hidden">
                                <div className={`px-4 py-2 border-b ${subtleBorder} flex items-center justify-between shrink-0`}>
                                    <span className="text-sm font-medium">{tabTitle}</span>
                                    <button
                                        type="button"
                                        onClick={handleCloseToPeek}
                                        className="w-11 h-11 -my-2 -mr-2 flex items-center justify-center rounded-xl hover:bg-black/5"
                                        aria-label="返回摘要"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
                                    {renderSheetBody()}
                                </div>
                            </div>
                        )}
                    </aside>
                ) : (
                    <button
                        type="button"
                        onClick={() => setLandscapePanelOpen(true)}
                        className="fixed right-3 bottom-3 z-[58] min-h-[44px] px-3.5 yra-card rounded-2xl text-xs font-medium flex items-center gap-2 no-print no-context-menu"
                    >
                        <span>{activeSite?.name || '基地 A'}</span>
                        <span className="text-[#E85D2A] yra-num">{metrics.budgetRange} 萬</span>
                    </button>
                )}
            </>
        );
    }

    /* =========================================================================
     * 直向模式（390×844 / 360×800）：
     * 底部固定導覽列（56px）→ 單一底部面板（peek / half / full）→ 3D 視窗
     * ========================================================================= */
    const sheetMaxH = sheetHeight === 'peek'
        ? 'auto'
        : sheetHeight === 'half'
            ? '45dvh'
            : '84dvh';

    return (
        <>
            {/* 單一底部面板（位於 56px 底部導覽列正上方） */}
            <section
                aria-label="評估面板"
                className="fixed left-0 right-0 z-[58] pointer-events-auto no-print no-context-menu transition-transform duration-300 ease-out"
                style={{
                    bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
                    transform: dragOffsetY !== 0 ? `translateY(${dragOffsetY * 0.35}px)` : 'translateY(0)'
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <div
                    className="yra-card rounded-t-3xl rounded-b-none border-x-0 border-b-0 flex flex-col overflow-hidden"
                    style={{
                        height: sheetHeight === 'peek' ? 'auto' : sheetMaxH,
                        maxHeight: '84dvh'
                    }}
                >
                    {/* 頂部拖曳把手（支援拖曳與點擊循環切換高度） */}
                    <div
                        className="pt-2 pb-1 flex justify-center cursor-pointer select-none touch-none shrink-0"
                        onTouchStart={handleTouchStartHandle}
                        onTouchMove={handleTouchMoveHandle}
                        onTouchEnd={handleTouchEndHandle}
                        onClick={handleCycleHeight}
                        role="button"
                        aria-label="調整面板高度"
                    >
                        <div className="w-10 h-1 rounded-full bg-[#C9C3B8]" />
                    </div>

                    {/* 標題與收合態摘要 / 分頁標題列 */}
                    {sheetHeight === 'peek' || activeTab === 'summary' ? (
                        <div className={sheetHeight !== 'peek' ? `border-b ${subtleBorder} shrink-0` : 'shrink-0'}>
                            {renderSummaryHeader()}
                        </div>
                    ) : (
                        <div className={`px-4 pb-2 border-b ${subtleBorder} flex items-center justify-between shrink-0`}>
                            <span className="text-sm font-medium">{tabTitle}</span>
                            <button
                                type="button"
                                onClick={handleCloseToPeek}
                                className="w-11 h-11 -my-2 -mr-2 flex items-center justify-center rounded-xl hover:bg-black/5"
                                aria-label="關閉面板"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    )}

                    {/* 展開後的捲動內容（peek 狀態不顯示，確保 3D 可見高度 ≥55%） */}
                    {sheetHeight !== 'peek' && (
                        <div className="flex-1 overflow-y-auto px-4 py-3">
                            {renderSheetBody()}
                        </div>
                    )}
                </div>
            </section>

            {/* 底部固定導覽列（固定 56px + safe-area-bottom，5 分頁，最小 12px，觸控區 ≥44px） */}
            <nav
                aria-label="主要功能導覽"
                className="fixed bottom-0 left-0 right-0 z-[60] yra-card rounded-none border-x-0 border-b-0 pb-safe no-print no-context-menu"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <div className="h-[56px] grid grid-cols-5 items-center">
                    {NAV_TABS.map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id && sheetHeight !== 'peek';
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleSelectTab(tab.id)}
                                className={`min-h-[48px] min-w-[44px] h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
                                    active ? 'text-[#2563EB] font-medium' : muted
                                }`}
                                aria-label={tab.label}
                                aria-pressed={active}
                            >
                                <Icon size={18} strokeWidth={active ? 2.3 : 1.8} />
                                <span className="text-xs leading-none">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </>
    );
};

export default UnifiedMobileSheet;
