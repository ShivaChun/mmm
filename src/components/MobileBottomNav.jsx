import React, { useState } from 'react';
import {
    Map as MapIcon,
    Scale,
    Layers,
    Sun,
    Share2,
    Menu,
    X,
    Pencil,
    Upload,
    Shovel,
    Plus,
    SlidersHorizontal,
    LayoutDashboard,
    Box,
    Compass,
    RotateCw,
    Hand,
    Moon,
    Maximize2,
    FileText,
    Table,
    Copy,
    Check,
    Printer,
    Grid3X3,
    Settings2,
    Eye
} from 'lucide-react';
import { toPing, formatNum } from '../utils/geometry';
import { calculatePolygonArea } from '../utils/polygon';
import { buildPlainTextSummary } from '../utils/summaryText';

const NAV_TABS = [
    { id: 'site', label: '基地', icon: MapIcon },
    { id: 'reg', label: '法規', icon: Scale },
    { id: 'massing', label: '量體', icon: Layers },
    { id: 'env', label: '環境', icon: Sun },
    { id: 'export', label: '輸出', icon: Share2 }
];

export const MobileBottomNav = ({
    controller,
    isDarkMode,
    setIsDarkMode,
    viewAngleX,
    onToggleTopDownView,
    primaryDragMode,
    onTogglePrimaryDragMode,
    aoMode,
    onToggleAoMode,
    sunPathOpen,
    onToggleSunPath,
    onOpenCadastralImport,
    // 來自 App.jsx 的面板與狀態控制
    appActions = {}
}) => {
    const [activeTab, setActiveTab] = useState(null); // null | 'site' | 'reg' | 'massing' | 'env' | 'export' | 'more'
    const [copied, setCopied] = useState(false);

    const {
        groupedLayers = [],
        basements = [],
        normalizedSelectedFloorId,
        currentBasePoints,
        isDrawingSite,
        startDrawingSite,
        cancelDrawingSite,
        setFloorConfig,
        setShowFloorDialog,
        onSelectFloor,
        onCloseFloorEdit,
        unitSettings,
        onUpdateUnitSettings,
        inputs = {},
        floorSettings = {}
    } = controller || {};

    const {
        sites = [],
        activeSiteIndex = 0,
        activeSite,
        finalRes = {},
        params = {},
        massingSummary = {},
        onSwitchSite,
        onOpenAddSite,
        onOpenPanel,
        onOpenExport,
        onOpenSunComparison,
        onToggleEnvPanel,
        onToggleLandscape,
        showCheckLines = true,
        setShowCheckLines,
        showHeightRatio = true,
        setShowHeightRatio,
        showWeiLao = false,
        setShowWeiLao,
        showBackyard = true,
        setShowBackyard
    } = appActions;

    const isTopDown = viewAngleX <= 5;
    const baseAreaM2 = finalRes.base || calculatePolygonArea(currentBasePoints, inputs.baseCurves) || inputs.baseArea || 0;
    const basePing = toPing(baseAreaM2);

    const toggleTab = (tabId) => {
        setActiveTab(prev => (prev === tabId ? null : tabId));
    };

    const closeDrawer = () => setActiveTab(null);

    const handleCopyText = async () => {
        try {
            const text = buildPlainTextSummary({ activeSite, inputs, finalRes, params, massingSummary });
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            setCopied(false);
        }
    };

    const mutedText = isDarkMode ? 'text-[#A8A39B]' : 'text-[#767168]';
    const subtleBorder = isDarkMode ? 'border-white/12' : 'border-[#E6E2D8]';
    const surfaceBg = isDarkMode ? 'bg-white/8' : 'bg-[#F7F5F1]';

    const actionBtnCls = (isActive = false) =>
        `min-h-[44px] px-3 py-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-colors active:scale-[0.98] ${
            isActive
                ? 'bg-[#171614] text-white border-[#171614]'
                : `${surfaceBg} ${subtleBorder} hover:border-[#171614]`
        }`;

    return (
        <>
            {/* ── 手機極簡頂部列：品牌 + 基地坪數 + 右上「更多」按鈕 (≥44px) ── */}
            <div
                className="fixed top-3 left-3 right-3 z-[60] flex items-center justify-between gap-2 pointer-events-none no-context-menu"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <div className="yra-card rounded-full pl-3.5 pr-3 py-1.5 flex items-center gap-2 pointer-events-auto max-w-[calc(100vw-76px)]">
                    <span className="font-black text-sm tracking-tight shrink-0">YRA.</span>
                    <span className={`w-px h-3.5 ${isDarkMode ? 'bg-white/20' : 'bg-[#D8D3C9]'}`} />
                    <span className="text-xs font-bold truncate yra-num">
                        基地 {formatNum(basePing, 2)} 坪
                    </span>
                </div>

                <button
                    type="button"
                    onClick={() => toggleTab('more')}
                    className={`yra-card w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center pointer-events-auto transition-colors ${
                        activeTab === 'more' ? '!bg-[#171614] !text-white !border-[#171614]' : ''
                    }`}
                    aria-label="更多功能"
                    title="更多功能"
                >
                    {activeTab === 'more' ? <X size={19} /> : <Menu size={19} />}
                </button>
            </div>

            {/* ── 功能抽屜背景點擊關閉層 ── */}
            {activeTab && (
                <div
                    className="fixed inset-0 z-[56] bg-black/15"
                    onClick={closeDrawer}
                    onPointerDown={(e) => e.stopPropagation()}
                />
            )}

            {/* ── 分頁對應動作抽屜（位於底部導覽列上方） ── */}
            {activeTab && (
                <div
                    className="fixed left-3 right-3 z-[58] pointer-events-auto no-context-menu animate-in fade-in slide-in-from-bottom-2 duration-150"
                    style={{ bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))' }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="yra-card rounded-3xl p-4 max-h-[60dvh] overflow-y-auto space-y-3">
                        {/* 抽屜標題 */}
                        <div className={`flex items-center justify-between pb-2 border-b ${subtleBorder}`}>
                            <span className="font-black text-sm">
                                {activeTab === 'site' && '基地工具'}
                                {activeTab === 'reg' && '法規設定與檢討線'}
                                {activeTab === 'massing' && '量體與樓層調整'}
                                {activeTab === 'env' && '日照、白模與視角'}
                                {activeTab === 'export' && '報表與結果輸出'}
                                {activeTab === 'more' && '更多設定'}
                            </span>
                            <button
                                type="button"
                                onClick={closeDrawer}
                                className="w-11 h-11 -my-2 -mr-2 rounded-full flex items-center justify-center"
                                aria-label="關閉選單"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* 1. 基地分頁 */}
                        {activeTab === 'site' && (
                            <div className="space-y-2.5">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeDrawer();
                                            if (isDrawingSite) cancelDrawingSite();
                                            else startDrawingSite('current');
                                        }}
                                        className={actionBtnCls(isDrawingSite)}
                                    >
                                        <Pencil size={17} className="shrink-0 text-[#E85D2A]" />
                                        <span className="text-xs font-bold">{isDrawingSite ? '結束繪製' : '點拉線繪基地'}</span>
                                    </button>

                                    {onOpenCadastralImport && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                closeDrawer();
                                                onOpenCadastralImport();
                                            }}
                                            className={actionBtnCls(false)}
                                        >
                                            <Upload size={17} className="shrink-0 text-[#E85D2A]" />
                                            <span className="text-xs font-bold">匯入地籍圖</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeDrawer();
                                            if (isDrawingSite) cancelDrawingSite();
                                            if (normalizedSelectedFloorId === 'base') onCloseFloorEdit();
                                            else onSelectFloor('base');
                                        }}
                                        className={actionBtnCls(normalizedSelectedFloorId === 'base')}
                                    >
                                        <MapIcon size={17} className="shrink-0" />
                                        <span className="text-xs font-bold">編輯基地形狀</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeDrawer();
                                            if (isDrawingSite) cancelDrawingSite();
                                            if (normalizedSelectedFloorId === 'excavation') onCloseFloorEdit();
                                            else onSelectFloor('excavation');
                                        }}
                                        className={actionBtnCls(normalizedSelectedFloorId === 'excavation')}
                                    >
                                        <Shovel size={17} className="shrink-0" />
                                        <span className="text-xs font-bold">開挖範圍編輯</span>
                                    </button>
                                </div>

                                {/* 多基地切換與新增 */}
                                <div className={`pt-2 border-t ${subtleBorder}`}>
                                    <div className={`text-[11px] font-bold mb-2 ${mutedText}`}>基地切換與管理</div>
                                    <div className="flex flex-wrap gap-2">
                                        {sites.map((site, idx) => (
                                            <button
                                                key={site.id}
                                                type="button"
                                                onClick={() => {
                                                    onSwitchSite && onSwitchSite(idx);
                                                    closeDrawer();
                                                }}
                                                className={`min-h-[44px] px-3.5 rounded-2xl text-xs font-bold border transition-colors ${
                                                    idx === activeSiteIndex
                                                        ? 'bg-[#171614] text-white border-[#171614]'
                                                        : `${surfaceBg} ${subtleBorder}`
                                                }`}
                                            >
                                                {site.name}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                closeDrawer();
                                                onOpenAddSite && onOpenAddSite();
                                            }}
                                            className={`min-h-[44px] px-3.5 rounded-2xl text-xs font-bold border border-dashed ${subtleBorder} flex items-center gap-1`}
                                        >
                                            <Plus size={15} /> 新增基地
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. 法規分頁 */}
                        {activeTab === 'reg' && (
                            <div className="space-y-2.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        closeDrawer();
                                        onOpenPanel && onOpenPanel('info');
                                    }}
                                    className="w-full min-h-[48px] px-4 rounded-2xl bg-[#171614] text-white text-xs font-bold flex items-center justify-between"
                                >
                                    <span className="flex items-center gap-2">
                                        <SlidersHorizontal size={16} className="text-[#E85D2A]" />
                                        開啟基地與法規參數設定
                                    </span>
                                    <span className="text-[11px] opacity-75">
                                        建蔽 {inputs.coverageRatio}% / 容積 {inputs.floorRatio}%
                                    </span>
                                </button>

                                <div className={`pt-2 border-t ${subtleBorder} space-y-2`}>
                                    <div className={`text-[11px] font-bold ${mutedText}`}>3D 法規檢討線顯示</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowCheckLines && setShowCheckLines(prev => !prev)}
                                            className={actionBtnCls(showCheckLines)}
                                        >
                                            <Eye size={16} className="shrink-0" />
                                            <span className="text-xs font-bold">檢討線總開關</span>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!showCheckLines}
                                            onClick={() => setShowHeightRatio && setShowHeightRatio(prev => !prev)}
                                            className={`${actionBtnCls(showCheckLines && showHeightRatio)} ${!showCheckLines ? 'opacity-40' : ''}`}
                                        >
                                            <Scale size={16} className="shrink-0" />
                                            <span className="text-xs font-bold">高度比檢討線</span>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!showCheckLines}
                                            onClick={() => setShowWeiLao && setShowWeiLao(prev => !prev)}
                                            className={`${actionBtnCls(showCheckLines && showWeiLao)} ${!showCheckLines ? 'opacity-40' : ''}`}
                                        >
                                            <Scale size={16} className="shrink-0" />
                                            <span className="text-xs font-bold">危老檢討 (1:5)</span>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!showCheckLines}
                                            onClick={() => setShowBackyard && setShowBackyard(prev => !prev)}
                                            className={`${actionBtnCls(showCheckLines && showBackyard)} ${!showCheckLines ? 'opacity-40' : ''}`}
                                        >
                                            <Scale size={16} className="shrink-0" />
                                            <span className="text-xs font-bold">後院退縮檢討</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. 量體分頁 */}
                        {activeTab === 'massing' && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeDrawer();
                                            setFloorConfig({
                                                above: Math.max(1, parseInt(controller.floorsAboveValue || inputs.floorsAbove || '1', 10)),
                                                below: Math.max(0, parseInt(inputs.floorsBelow || '0', 10))
                                            });
                                            setShowFloorDialog(true);
                                        }}
                                        className={actionBtnCls(false)}
                                    >
                                        <SlidersHorizontal size={17} className="shrink-0 text-[#E85D2A]" />
                                        <span className="text-xs font-bold">樓層數配置</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeDrawer();
                                            const firstFloorGroup = (groupedLayers || []).find(g => g.id !== 'base' && g.id !== 'excavation');
                                            const currentTarget = (normalizedSelectedFloorId && normalizedSelectedFloorId !== 'base' && normalizedSelectedFloorId !== 'excavation' && !/^B\d+$/.test(normalizedSelectedFloorId))
                                                ? normalizedSelectedFloorId
                                                : (unitSettings?.target ? unitSettings.target.split('-')[0] : (firstFloorGroup ? firstFloorGroup.id : '1F'));
                                            onUpdateUnitSettings(prev => ({
                                                ...prev,
                                                enabled: !prev.enabled,
                                                target: currentTarget
                                            }));
                                        }}
                                        className={actionBtnCls(Boolean(unitSettings?.enabled))}
                                    >
                                        <LayoutDashboard size={17} className="shrink-0" />
                                        <span className="text-xs font-bold">分戶 / 分棟切割</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeDrawer();
                                            onToggleEnvPanel && onToggleEnvPanel();
                                        }}
                                        className={`${actionBtnCls(false)} col-span-2`}
                                    >
                                        <Grid3X3 size={17} className="shrink-0 text-[#E85D2A]" />
                                        <span className="text-xs font-bold">隨機量體造型與臨地模擬</span>
                                    </button>
                                </div>

                                {/* 各層平面快速選擇 */}
                                <div className={`pt-2 border-t ${subtleBorder}`}>
                                    <div className={`text-[11px] font-bold mb-2 ${mutedText}`}>點選樓層直接編輯平面</div>
                                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                        {basements.filter(b => b.active).map(b => {
                                            const isSel = normalizedSelectedFloorId === b.id;
                                            const customPts = floorSettings?.[b.id]?.points;
                                            const customCurves = floorSettings?.[b.id]?.curves;
                                            const area = customPts ? calculatePolygonArea(customPts, customCurves) : b.area;
                                            return (
                                                <button
                                                    key={b.id}
                                                    type="button"
                                                    onClick={() => {
                                                        closeDrawer();
                                                        if (isSel) onCloseFloorEdit();
                                                        else onSelectFloor(b.id);
                                                    }}
                                                    className={`min-h-[48px] min-w-[68px] px-3 py-1.5 rounded-2xl border shrink-0 flex flex-col items-start justify-center ${
                                                        isSel ? 'bg-[#171614] text-white border-[#171614]' : `${surfaceBg} ${subtleBorder}`
                                                    }`}
                                                >
                                                    <span className="text-xs font-black">{b.id}</span>
                                                    <span className="text-[10px] opacity-75 yra-num">{formatNum(toPing(area), 1)}坪</span>
                                                </button>
                                            );
                                        })}
                                        {groupedLayers.map(group => {
                                            const isSel = normalizedSelectedFloorId === group.id;
                                            const totalFloorArea = group.units.reduce((sum, u) => sum + (u.realArea || 0), 0);
                                            return (
                                                <button
                                                    key={group.id}
                                                    type="button"
                                                    onClick={() => {
                                                        closeDrawer();
                                                        if (isSel) onCloseFloorEdit();
                                                        else onSelectFloor(group.id);
                                                    }}
                                                    className={`min-h-[48px] min-w-[68px] px-3 py-1.5 rounded-2xl border shrink-0 flex flex-col items-start justify-center ${
                                                        isSel ? 'bg-[#E85D2A] text-white border-[#E85D2A]' : `${surfaceBg} ${subtleBorder}`
                                                    }`}
                                                >
                                                    <span className="text-xs font-black">{group.id}</span>
                                                    <span className="text-[10px] opacity-80 yra-num">{formatNum(toPing(totalFloorArea), 1)}坪</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 4. 環境分頁 */}
                        {activeTab === 'env' && (
                            <div className="space-y-2">
                                {onOpenSunComparison && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeDrawer();
                                            onOpenSunComparison();
                                        }}
                                        className="w-full min-h-[48px] px-4 rounded-2xl bg-[#171614] text-white text-xs font-bold flex items-center justify-center gap-2"
                                    >
                                        <Sun size={16} className="text-[#E85D2A]" />
                                        日照對比快照（冬至 vs 夏至）
                                    </button>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeDrawer();
                                            onToggleSunPath && onToggleSunPath();
                                        }}
                                        className={actionBtnCls(sunPathOpen)}
                                    >
                                        <Sun size={17} className="shrink-0 text-[#E85D2A]" />
                                        <span className="text-xs font-bold">日照時間軸</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeDrawer();
                                            onToggleAoMode && onToggleAoMode();
                                        }}
                                        className={actionBtnCls(aoMode)}
                                    >
                                        <Box size={17} className="shrink-0" />
                                        <span className="text-xs font-bold">建築白模模式</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeDrawer();
                                            onToggleTopDownView && onToggleTopDownView();
                                        }}
                                        className={actionBtnCls(isTopDown)}
                                    >
                                        <Compass size={17} className="shrink-0" />
                                        <span className="text-xs font-bold">{isTopDown ? '切回 3D 透視' : '切換 2D 俯視'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeDrawer();
                                            onToggleEnvPanel && onToggleEnvPanel();
                                        }}
                                        className={actionBtnCls(false)}
                                    >
                                        <Grid3X3 size={17} className="shrink-0" />
                                        <span className="text-xs font-bold">臨地與鄰房模擬</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 5. 輸出分頁 */}
                        {activeTab === 'export' && (
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        closeDrawer();
                                        onOpenExport && onOpenExport();
                                    }}
                                    className="w-full min-h-[48px] px-4 rounded-2xl bg-[#E85D2A] text-white text-xs font-bold flex items-center justify-center gap-2"
                                >
                                    <Share2 size={16} />
                                    產生 LINE 長圖 / 唯讀連結 / A4 PDF
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCopyText}
                                    className="w-full min-h-[44px] px-4 rounded-2xl bg-[#171614] text-white text-xs font-bold flex items-center justify-center gap-2"
                                >
                                    {copied ? <Check size={16} className="text-[#E85D2A]" /> : <Copy size={16} />}
                                    {copied ? '已複製評估摘要（可直接貼給業主）' : '快速複製純文字摘要'}
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeDrawer();
                                            onOpenPanel && onOpenPanel('results');
                                        }}
                                        className={actionBtnCls(false)}
                                    >
                                        <FileText size={17} className="shrink-0 text-[#E85D2A]" />
                                        <span className="text-xs font-bold">詳細計算表</span>
                                    </button>
                                    {sites.length > 1 ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                closeDrawer();
                                                onOpenPanel && onOpenPanel('combined');
                                            }}
                                            className={actionBtnCls(false)}
                                        >
                                            <Table size={17} className="shrink-0" />
                                            <span className="text-xs font-bold">多基地合併表</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                closeDrawer();
                                                window.print();
                                            }}
                                            className={actionBtnCls(false)}
                                        >
                                            <Printer size={17} className="shrink-0" />
                                            <span className="text-xs font-bold">列印 / 存 PDF</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 6. 更多（次要功能收合區） */}
                        {activeTab === 'more' && (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onTogglePrimaryDragMode && onTogglePrimaryDragMode();
                                        closeDrawer();
                                    }}
                                    className={actionBtnCls(primaryDragMode === 'pan')}
                                >
                                    {primaryDragMode === 'rotate' ? <RotateCw size={17} className="shrink-0" /> : <Hand size={17} className="shrink-0 text-[#E85D2A]" />}
                                    <span className="text-xs font-bold">
                                        拖曳：{primaryDragMode === 'rotate' ? '旋轉視角' : '平移畫布'}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsDarkMode && setIsDarkMode(prev => !prev);
                                        closeDrawer();
                                    }}
                                    className={actionBtnCls(isDarkMode)}
                                >
                                    {isDarkMode ? <Sun size={17} className="shrink-0 text-[#E85D2A]" /> : <Moon size={17} className="shrink-0" />}
                                    <span className="text-xs font-bold">{isDarkMode ? '切換淺色模式' : '切換深色模式'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        closeDrawer();
                                        onOpenPanel && onOpenPanel('project');
                                    }}
                                    className={actionBtnCls(false)}
                                >
                                    <Settings2 size={17} className="shrink-0" />
                                    <span className="text-xs font-bold">專案名稱設定</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        closeDrawer();
                                        onToggleLandscape && onToggleLandscape();
                                    }}
                                    className={actionBtnCls(false)}
                                >
                                    <Maximize2 size={17} className="shrink-0" />
                                    <span className="text-xs font-bold">橫置全螢幕</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── 底部固定導覽列：5 個主分頁（觸控區 ≥44px，附中文標籤） ── */}
            <nav
                aria-label="主要功能導覽"
                className="fixed bottom-2 left-3 right-3 z-[60] pointer-events-auto pb-safe no-context-menu"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <div className="yra-card rounded-full px-1.5 py-1 grid grid-cols-5 items-center">
                    {NAV_TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => toggleTab(tab.id)}
                                className={`relative min-h-[48px] min-w-[44px] flex flex-col items-center justify-center gap-0.5 rounded-full transition-colors ${
                                    isActive
                                        ? 'text-[#E85D2A] font-black'
                                        : isDarkMode
                                            ? 'text-[#B8B3AA] hover:text-white font-medium'
                                            : 'text-[#6E6A63] hover:text-[#171614] font-medium'
                                }`}
                                aria-label={tab.label}
                                aria-pressed={isActive}
                            >
                                <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
                                <span className="text-[11px] leading-none">{tab.label}</span>
                                {isActive && (
                                    <span className="absolute bottom-1 w-5 h-0.5 rounded-full bg-[#E85D2A]" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </nav>
        </>
    );
};

export default MobileBottomNav;
