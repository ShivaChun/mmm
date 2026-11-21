import React, { useState } from 'react';
import {
    X,
    MapPin,
    Route,
    Scale,
    Plus,
    Trash2,
    ChevronDown,
    ChevronUp,
    Sparkles,
    ChevronLeft,
    ChevronRight,
    Check
} from 'lucide-react';
import { toPing, formatNum } from '../utils/geometry';

// 內建台灣常見自地自建範例案件，方便建築師與業主快速試算展示
const SAMPLE_CASES = [
    {
        id: 'zhongxing-villa',
        label: '中興新村 99 坪住宅區透天',
        desc: '10m 臨路 · 建蔽 50% / 容積 150%',
        data: {
            name: '基地 A',
            lots: [{ id: 1, lot: '中興段 128 地號', area: 328.4 }],
            inputs: {
                projectName: '中興新村自建宅',
                district: '南投縣中興新村',
                urbanPlanName: '中興新村都市計畫區',
                zoneType: '住宅區',
                coverageRatio: 50,
                floorRatio: 150,
                excavationRatio: 60,
                floorsBelow: 1,
                frontYardDepth: 4,
                sideYardDepth: 1.5,
                sideYardDirection: 'right',
                backYardDepth: 3,
                floorHeight1F: 4.2,
                floorHeightOther: 3.6,
                arcadeDepth: 0,
                incentiveArea: 0,
                transferArea: 0,
                roads: [{ id: 1, name: '向陽路', width: 10, orientation: 'bottom', type: 'primary', edgeIndex: 2 }]
            }
        }
    },
    {
        id: 'taichung-corner',
        label: '台中 72 坪雙面臨路別墅',
        desc: '12m + 8m 角地 · 建蔽 60% / 容積 180%',
        data: {
            name: '基地 A',
            lots: [{ id: 1, lot: '惠民段 56 地號', area: 238.0 }],
            inputs: {
                projectName: '台中雙面臨路電梯宅',
                district: '台中市西屯區',
                urbanPlanName: '台中市主要計畫區',
                zoneType: '第二種住宅區',
                coverageRatio: 60,
                floorRatio: 180,
                excavationRatio: 65,
                floorsBelow: 1,
                frontYardDepth: 4,
                sideYardDepth: 2,
                sideYardDirection: 'right',
                backYardDepth: 3,
                floorHeight1F: 4.2,
                floorHeightOther: 3.5,
                arcadeDepth: 0,
                incentiveArea: 0,
                transferArea: 0,
                roads: [
                    { id: 1, name: '市政北二路', width: 12, orientation: 'bottom', type: 'primary', edgeIndex: 2 },
                    { id: 2, name: '惠中三街', width: 8, orientation: 'right', type: 'secondary', edgeIndex: 1 }
                ]
            }
        }
    },
    {
        id: 'tainan-townhouse',
        label: '台南 45 坪街屋透天',
        desc: '8m 臨路 · 建蔽 60% / 容積 200%',
        data: {
            name: '基地 A',
            lots: [{ id: 1, lot: '安平段 312 地號', area: 148.8 }],
            inputs: {
                projectName: '安平自建街屋',
                district: '台南市安平區',
                urbanPlanName: '台南市安平都市計畫',
                zoneType: '住宅區',
                coverageRatio: 60,
                floorRatio: 200,
                excavationRatio: 0,
                floorsBelow: 0,
                frontYardDepth: 0,
                sideYardDepth: 0,
                sideYardDirection: 'right',
                backYardDepth: 2.5,
                floorHeight1F: 4.0,
                floorHeightOther: 3.4,
                arcadeDepth: 3.5,
                incentiveArea: 0,
                transferArea: 0,
                roads: [{ id: 1, name: '建平七街', width: 8, orientation: 'bottom', type: 'primary', edgeIndex: 2 }]
            }
        }
    }
];

const STEPS = [
    { id: 1, label: '基本資料', icon: MapPin },
    { id: 2, label: '臨路條件', icon: Route },
    { id: 3, label: '法規參數', icon: Scale }
];

export const SiteSettingsSheet = ({
    isOpen,
    onClose,
    isMobile = false,
    isDarkMode = false,
    activeSite,
    lots = [],
    inputs = {},
    totalBaseArea = 0,
    onInputChange,
    onUpdateLot,
    onAddLot,
    onRemoveLot,
    onUpdateRoad,
    onAddRoad,
    onRemoveRoad,
    onLoadSampleCase
}) => {
    const [step, setStep] = useState(1);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showSamplePicker, setShowSamplePicker] = useState(false);

    if (!isOpen) return null;

    const mutedText = isDarkMode ? 'text-[#9E988E]' : 'text-[#767168]';
    const subtleBorder = isDarkMode ? 'border-white/12' : 'border-[#DDD8CE]';
    const surfaceBg = isDarkMode ? 'bg-white/6' : 'bg-[#F4F2EE]';
    const inputCls = `w-full min-h-[44px] px-3 py-2 rounded-xl border ${subtleBorder} bg-transparent text-sm font-bold outline-none focus:border-[#E85D2A] transition-colors yra-num`;
    const labelCls = `block text-xs font-bold mb-1 ${mutedText}`;

    const handleSelectSample = (sample) => {
        if (onLoadSampleCase) onLoadSampleCase(sample.data);
        setShowSamplePicker(false);
    };

    const content = (
        <div className="flex flex-col h-full">
            {/* 頂部標題與載入範例 */}
            <div className={`px-4 pt-3 pb-3 border-b ${subtleBorder} shrink-0`}>
                {isMobile && <div className="w-10 h-1 rounded-full bg-[#C9C3B8] mx-auto mb-2.5" />}
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <h2 className="font-black text-base tracking-normal normal-case truncate">
                            基地與法規設定
                        </h2>
                        <p className={`text-[11px] truncate ${mutedText}`}>
                            {activeSite?.name || '基地 A'} · 目前合計 {formatNum(toPing(totalBaseArea), 2)} 坪
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowSamplePicker(prev => !prev)}
                            className={`min-h-[36px] px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-colors ${
                                showSamplePicker
                                    ? 'bg-[#E85D2A] text-white border-[#E85D2A]'
                                    : `${surfaceBg} ${subtleBorder} hover:border-[#171614]`
                            }`}
                        >
                            <Sparkles size={13} />
                            載入範例案件
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/10 transition-colors"
                            aria-label="關閉設定面板"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* 範例案件快速選單 */}
                {showSamplePicker && (
                    <div className={`mt-2.5 p-2.5 rounded-2xl border ${subtleBorder} ${surfaceBg} space-y-1.5`}>
                        <div className={`text-[11px] font-bold ${mutedText}`}>選擇範例案件（立即帶入 3D 與試算）</div>
                        {SAMPLE_CASES.map(sc => (
                            <button
                                key={sc.id}
                                type="button"
                                onClick={() => handleSelectSample(sc)}
                                className={`w-full min-h-[44px] px-3 py-2 rounded-xl border ${subtleBorder} bg-white/80 dark:bg-black/30 hover:border-[#E85D2A] text-left transition-colors`}
                            >
                                <div className="text-xs font-bold">{sc.label}</div>
                                <div className={`text-[11px] ${mutedText}`}>{sc.desc}</div>
                            </button>
                        ))}
                    </div>
                )}

                {/* 三步驟導覽列 */}
                <div className="grid grid-cols-3 gap-1.5 mt-3">
                    {STEPS.map(s => {
                        const Icon = s.icon;
                        const isActive = step === s.id;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                    setStep(s.id);
                                    setShowAdvanced(false);
                                }}
                                className={`min-h-[40px] px-2 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border ${
                                    isActive
                                        ? 'bg-[#E85D2A] text-white border-[#E85D2A]'
                                        : `${surfaceBg} ${subtleBorder} ${mutedText} hover:text-[#171614]`
                                }`}
                            >
                                <Icon size={13} />
                                <span>{s.id}. {s.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 步驟內容區 */}
            <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4">
                {/* ── STEP 1：基本資料 ── */}
                {step === 1 && (
                    <>
                        <div>
                            <label className={labelCls}>行政區</label>
                            <input
                                type="text"
                                name="district"
                                value={inputs.district || ''}
                                onChange={onInputChange}
                                placeholder="例：南投縣中興新村、台中市西屯區"
                                className={inputCls}
                            />
                            <p className={`text-[11px] mt-1 ${mutedText}`}>用於報告標示基地所在行政區域</p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className={`${labelCls} mb-0`}>地號與面積（㎡）</label>
                                <button
                                    type="button"
                                    onClick={onAddLot}
                                    className="min-h-[34px] px-2.5 rounded-lg text-xs font-bold text-[#2563EB] hover:bg-blue-500/10 flex items-center gap-1"
                                >
                                    <Plus size={14} /> 新增地號
                                </button>
                            </div>
                            <div className="space-y-2">
                                {lots.map((l) => {
                                    const cleanLot = l.lot === '___段___地號' ? '' : l.lot;
                                    return (
                                        <div key={l.id} className="grid grid-cols-[1fr_104px_auto] gap-2 items-center">
                                            <input
                                                type="text"
                                                placeholder="例：中興段 123 地號"
                                                value={cleanLot}
                                                onChange={(e) => onUpdateLot(l.id, 'lot', e.target.value)}
                                                className={inputCls}
                                            />
                                            <input
                                                type="number"
                                                placeholder="面積 ㎡"
                                                value={l.area}
                                                onChange={(e) => onUpdateLot(l.id, 'area', e.target.value)}
                                                className={`${inputCls} text-right`}
                                            />
                                            {lots.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => onRemoveLot(l.id)}
                                                    className="w-10 h-10 rounded-xl border border-[#DDD8CE] text-[#DC2626] flex items-center justify-center hover:bg-red-50"
                                                    aria-label="刪除此地號"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <p className={`text-[11px] ${mutedText}`}>
                                可填寫權狀上之平方公尺面積，系統自動換算坪數並同步更新 3D 基地。
                            </p>
                            <div className={`rounded-2xl px-3.5 py-2.5 flex items-center justify-between ${surfaceBg}`}>
                                <span className={`text-xs font-bold ${mutedText}`}>基地面積合計</span>
                                <span className="text-sm font-black yra-num">
                                    基地 {formatNum(toPing(totalBaseArea), 2)} 坪
                                    <span className={`text-xs font-medium ml-1.5 ${mutedText}`}>({formatNum(totalBaseArea, 1)} ㎡)</span>
                                </span>
                            </div>
                        </div>

                        {/* 進階欄位摺疊區 */}
                        <div className={`rounded-2xl border ${subtleBorder} overflow-hidden`}>
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(prev => !prev)}
                                className={`w-full min-h-[44px] px-3.5 py-2 flex items-center justify-between text-xs font-bold ${surfaceBg}`}
                            >
                                <span>進階資料（專案名稱、都市計畫區）</span>
                                {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                            {showAdvanced && (
                                <div className="p-3.5 space-y-3">
                                    <div>
                                        <label className={labelCls}>專案名稱</label>
                                        <input
                                            type="text"
                                            name="projectName"
                                            value={inputs.projectName || ''}
                                            onChange={onInputChange}
                                            placeholder="例：陳宅自地自建案"
                                            className={inputCls}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>都市計畫名稱</label>
                                        <input
                                            type="text"
                                            name="urbanPlanName"
                                            value={inputs.urbanPlanName || ''}
                                            onChange={onInputChange}
                                            placeholder="例：中興新村都市計畫區"
                                            className={inputCls}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ── STEP 2：臨路條件 ── */}
                {step === 2 && (
                    <>
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <label className={`${labelCls} mb-0`}>面前道路設定</label>
                                <button
                                    type="button"
                                    onClick={onAddRoad}
                                    className="min-h-[34px] px-2.5 rounded-lg text-xs font-bold text-[#2563EB] hover:bg-blue-500/10 flex items-center gap-1"
                                >
                                    <Plus size={14} /> 新增道路
                                </button>
                            </div>
                            {(inputs.roads || []).map(r => (
                                <div key={r.id} className={`rounded-2xl p-3 border ${subtleBorder} ${surfaceBg} space-y-2.5`}>
                                    <div className="grid grid-cols-[1fr_88px] gap-2">
                                        <div>
                                            <label className={labelCls}>路名</label>
                                            <input
                                                type="text"
                                                value={r.name}
                                                placeholder="例：向陽路"
                                                onChange={(e) => onUpdateRoad(r.id, 'name', e.target.value)}
                                                className={`${inputCls} bg-white/80 dark:bg-black/20`}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelCls}>路寬 (m)</label>
                                            <input
                                                type="number"
                                                value={r.width}
                                                onChange={(e) => onUpdateRoad(r.id, 'width', e.target.value)}
                                                className={`${inputCls} text-center bg-white/80 dark:bg-black/20`}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer min-h-[36px]">
                                            <input
                                                type="checkbox"
                                                checked={r.type === 'primary'}
                                                onChange={(e) => onUpdateRoad(r.id, 'type', e.target.checked ? 'primary' : 'secondary')}
                                                className="w-4 h-4 accent-[#E85D2A]"
                                            />
                                            主要面臨道路（高度比基準）
                                        </label>
                                        {inputs.roads.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => onRemoveRoad(r.id)}
                                                className="p-2 text-[#DC2626] rounded-lg hover:bg-red-50"
                                                aria-label="刪除道路"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <p className={`text-[11px] ${mutedText}`}>
                                路寬會直接影響建築物高度比與前院檢討。
                            </p>
                        </div>

                        {/* 進階退縮摺疊區 */}
                        <div className={`rounded-2xl border ${subtleBorder} overflow-hidden`}>
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(prev => !prev)}
                                className={`w-full min-h-[44px] px-3.5 py-2 flex items-center justify-between text-xs font-bold ${surfaceBg}`}
                            >
                                <span>進階退縮（前院 / 側院 / 後院 / 騎樓）</span>
                                {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                            {showAdvanced && (
                                <div className="p-3.5 grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelCls}>前院深度 (m)</label>
                                        <input type="number" name="frontYardDepth" value={inputs.frontYardDepth} onChange={onInputChange} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>後院深度 (m)</label>
                                        <input type="number" name="backYardDepth" value={inputs.backYardDepth} onChange={onInputChange} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>側院深度 (m)</label>
                                        <input type="number" name="sideYardDepth" value={inputs.sideYardDepth || 0} onChange={onInputChange} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>側院方位</label>
                                        <select name="sideYardDirection" value={inputs.sideYardDirection || 'right'} onChange={onInputChange} className={inputCls}>
                                            <option value="right">右側</option>
                                            <option value="left">左側</option>
                                        </select>
                                    </div>
                                    {Number(inputs.frontYardDepth) === 0 && (
                                        <div className="col-span-2">
                                            <label className={labelCls}>騎樓深度 (m)</label>
                                            <input type="number" name="arcadeDepth" value={inputs.arcadeDepth || 0} onChange={onInputChange} className={inputCls} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ── STEP 3：法規參數 ── */}
                {step === 3 && (
                    <>
                        <div>
                            <label className={labelCls}>土地使用分區</label>
                            <input
                                type="text"
                                name="zoneType"
                                value={inputs.zoneType || ''}
                                onChange={onInputChange}
                                placeholder="例：住宅區、第二種住宅區、商業區"
                                className={inputCls}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className={`rounded-2xl p-3 border ${subtleBorder} ${surfaceBg}`}>
                                <label className={labelCls}>法定建蔽率 (%)</label>
                                <input
                                    type="number"
                                    name="coverageRatio"
                                    value={inputs.coverageRatio}
                                    onChange={onInputChange}
                                    className={`${inputCls} text-lg text-[#E85D2A] bg-white/80 dark:bg-black/20`}
                                />
                                <p className={`text-[10px] mt-1 ${mutedText}`}>決定單層最大投影面積</p>
                            </div>
                            <div className={`rounded-2xl p-3 border ${subtleBorder} ${surfaceBg}`}>
                                <label className={labelCls}>法定容積率 (%)</label>
                                <input
                                    type="number"
                                    name="floorRatio"
                                    value={inputs.floorRatio}
                                    onChange={onInputChange}
                                    className={`${inputCls} text-lg text-[#E85D2A] bg-white/80 dark:bg-black/20`}
                                />
                                <p className={`text-[10px] mt-1 ${mutedText}`}>決定總可建樓地板倍數</p>
                            </div>
                        </div>

                        {/* 進階法規摺疊區 */}
                        <div className={`rounded-2xl border ${subtleBorder} overflow-hidden`}>
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(prev => !prev)}
                                className={`w-full min-h-[44px] px-3.5 py-2 flex items-center justify-between text-xs font-bold ${surfaceBg}`}
                            >
                                <span>進階參數（地下室、樓高、獎勵與移轉容積）</span>
                                {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                            {showAdvanced && (
                                <div className="p-3.5 grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelCls}>地下開挖率 (%)</label>
                                        <input type="number" name="excavationRatio" value={inputs.excavationRatio} onChange={onInputChange} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>地下樓層數</label>
                                        <input type="number" name="floorsBelow" value={inputs.floorsBelow} onChange={onInputChange} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>一樓樓高 (m)</label>
                                        <input type="number" step="0.1" name="floorHeight1F" value={inputs.floorHeight1F} onChange={onInputChange} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>標準層高 (m)</label>
                                        <input type="number" step="0.1" name="floorHeightOther" value={inputs.floorHeightOther} onChange={onInputChange} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>獎勵容積 (㎡)</label>
                                        <input type="number" name="incentiveArea" value={inputs.incentiveArea || 0} onChange={onInputChange} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>移轉容積 (㎡)</label>
                                        <input type="number" name="transferArea" value={inputs.transferArea || 0} onChange={onInputChange} className={inputCls} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* 底部步驟切換鈕 */}
            <div className={`px-4 py-3 border-t ${subtleBorder} flex items-center justify-between gap-2 shrink-0`}>
                <button
                    type="button"
                    disabled={step === 1}
                    onClick={() => { setStep(s => Math.max(1, s - 1)); setShowAdvanced(false); }}
                    className={`min-h-[44px] px-3.5 rounded-2xl border ${subtleBorder} text-xs font-bold flex items-center gap-1 transition-opacity ${
                        step === 1 ? 'opacity-35 cursor-not-allowed' : 'hover:border-[#171614]'
                    }`}
                >
                    <ChevronLeft size={15} /> 上一步
                </button>

                {step < 3 ? (
                    <button
                        type="button"
                        onClick={() => { setStep(s => Math.min(3, s + 1)); setShowAdvanced(false); }}
                        className="flex-1 min-h-[44px] rounded-2xl bg-[#171614] text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#2C2A26] transition-colors"
                    >
                        下一步 <ChevronRight size={15} />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 min-h-[44px] rounded-2xl bg-[#E85D2A] text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-95 transition-opacity"
                    >
                        <Check size={15} /> 完成設定並檢視 3D
                    </button>
                )}
            </div>
        </div>
    );

    // 手機：從下滑出的 Bottom Sheet
    if (isMobile) {
        return (
            <div className="fixed inset-0 z-[110] flex flex-col justify-end no-print no-context-menu">
                <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} />
                <div
                    className="relative yra-card rounded-t-3xl rounded-b-none max-h-[85dvh] flex flex-col overflow-hidden pb-safe animate-in slide-in-from-bottom-4 duration-200"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {content}
                </div>
            </div>
        );
    }

    // 桌機：固定尺寸並停靠於右側的浮動停靠面板
    return (
        <aside
            className="fixed right-4 top-[72px] bottom-5 z-[90] w-[388px] pointer-events-auto no-print no-context-menu"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div className="yra-card rounded-3xl h-full overflow-hidden flex flex-col">
                {content}
            </div>
        </aside>
    );
};

export default SiteSettingsSheet;
