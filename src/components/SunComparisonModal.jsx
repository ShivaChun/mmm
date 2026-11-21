import React, { useMemo } from 'react';
import { X, Sun, CheckSquare, Square, ArrowUpRight } from 'lucide-react';
import { computeSunState } from './SunPathControls';

const SNAPSHOT_SEASONS = [
    { key: 'winter', label: '冬至 12/21', short: '冬至' },
    { key: 'summer', label: '夏至 6/21', short: '夏至' }
];
const SNAPSHOT_HOURS = [9, 12, 15];

/**
 * 單張日照陰影微型俯視圖（SVG，供互動快照格與 A4 PDF 共用）
 */
export const SunShadowMiniSvg = ({
    basePoints,
    buildingHeight = 15,
    season = 'winter',
    hour = 12,
    northAngle = 0,
    size = 140
}) => {
    const sunState = useMemo(
        () => computeSunState(hour, season, northAngle),
        [hour, season, northAngle]
    );

    const { sitePath, bldgPath, shadowPath, sunArrow } = useMemo(() => {
        const pts = (Array.isArray(basePoints) && basePoints.length >= 3)
            ? basePoints
            : [
                { x: -7.5, y: -7.5 },
                { x: 7.5, y: -7.5 },
                { x: 7.5, y: 7.5 },
                { x: -7.5, y: 7.5 }
            ];

        const xs = pts.map(p => p.x);
        const ys = pts.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const span = Math.max(12, maxX - minX, maxY - minY);

        // 縮小 0.72 作為建築主量體投影（示意白模）
        const bldgPts = pts.map(p => ({
            x: cx + (p.x - cx) * 0.72,
            y: cy + (p.y - cy) * 0.72
        }));

        // 陰影投影位移（以建築高度 70% 有效遮蔽高度計算）
        const effH = Math.min(28, Math.max(6, buildingHeight * 0.72));
        const dxM = sunState.shadowDxPerM * effH;
        const dyM = sunState.shadowDyPerM * effH;

        const pad = span * 0.95;
        const viewHalf = span * 0.5 + pad;
        const toSvg = (p) => ({
            x: ((p.x - cx + viewHalf) / (viewHalf * 2)) * size,
            y: ((p.y - cy + viewHalf) / (viewHalf * 2)) * size
        });

        const siteSvg = pts.map(toSvg);
        const bldgSvg = bldgPts.map(toSvg);
        const topProjSvg = bldgPts.map(p => toSvg({ x: p.x + dxM, y: p.y + dyM }));

        const toPath = (arr) =>
            arr.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';

        // 牆面掃掠投影 + 屋頂投影合成
        const quads = [];
        for (let i = 0; i < bldgSvg.length; i++) {
            const ni = (i + 1) % bldgSvg.length;
            const b1 = bldgSvg[i];
            const b2 = bldgSvg[ni];
            const t2 = topProjSvg[ni];
            const t1 = topProjSvg[i];
            quads.push(`M ${b1.x.toFixed(1)} ${b1.y.toFixed(1)} L ${b2.x.toFixed(1)} ${b2.y.toFixed(1)} L ${t2.x.toFixed(1)} ${t2.y.toFixed(1)} L ${t1.x.toFixed(1)} ${t1.y.toFixed(1)} Z`);
        }
        quads.push(toPath(topProjSvg));

        // 太陽入射方向指示點
        const arrowR = size * 0.41;
        const sunX = size / 2 + sunState.horizX * arrowR;
        const sunY = size / 2 + sunState.horizY * arrowR;

        return {
            sitePath: toPath(siteSvg),
            bldgPath: toPath(bldgSvg),
            shadowPath: quads.join(' '),
            sunArrow: { x: sunX, y: sunY }
        };
    }, [basePoints, buildingHeight, sunState, size]);

    return (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full block select-none">
            <rect x="0" y="0" width={size} height={size} fill="#F7F5F1" rx="10" />
            {/* 柔和格線 */}
            <line x1={size / 2} y1="8" x2={size / 2} y2={size - 8} stroke="#E6E2D8" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="8" y1={size / 2} x2={size - 8} y2={size / 2} stroke="#E6E2D8" strokeWidth="1" strokeDasharray="3 3" />

            {/* 基地邊界 */}
            <path d={sitePath} fill="#EDEAE3" stroke="#A8A39B" strokeWidth="1.2" />

            {/* 投射陰影 */}
            <path d={shadowPath} fill="#171614" opacity="0.22" />

            {/* 白模建築量體 */}
            <path d={bldgPath} fill="#FFFFFF" stroke="#171614" strokeWidth="1.5" />

            {/* 太陽方向指示 */}
            <line
                x1={sunArrow.x}
                y1={sunArrow.y}
                x2={size / 2}
                y2={size / 2}
                stroke="#E85D2A"
                strokeWidth="1.1"
                strokeDasharray="2.5 2.5"
                opacity="0.6"
            />
            <circle cx={sunArrow.x} cy={sunArrow.y} r="4.5" fill="#E85D2A" stroke="#FFFFFF" strokeWidth="1.5" />

            {/* 仰角標記 */}
            <text x="8" y={size - 8} fontSize="9" fontWeight="700" fill="#767168" className="yra-num">
                仰角 {Math.max(0, sunState.altDeg).toFixed(0)}°
            </text>
            <text x={size - 12} y="14" fontSize="9" fontWeight="800" fill="#767168" textAnchor="end">
                N
            </text>
        </svg>
    );
};

export const SunComparisonModal = ({
    isOpen,
    onClose,
    basePoints,
    buildingHeight = 15,
    northAngle = 0,
    currentSeason,
    currentSunTime,
    onSelectSnapshot,
    includeInReport = true,
    onToggleIncludeInReport
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 no-print no-context-menu"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            <div
                className="relative yra-card rounded-3xl w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 標題列 */}
                <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
                    <div>
                        <h2 className="font-black text-base flex items-center gap-2 normal-case tracking-normal">
                            <Sun size={18} className="text-[#E85D2A]" />
                            日照陰影對比快照（冬至 vs 夏至）
                        </h2>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            點選任一時段可立即切回即時 3D 檢視 · 台灣緯度 25°N · 基地北向 {(northAngle || 0).toFixed(0)}°
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-black/10 transition-colors shrink-0"
                        aria-label="關閉日照對比"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 6 格並排快照 */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {SNAPSHOT_SEASONS.map(s => (
                        <div key={s.key} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black px-2.5 py-1 rounded-full bg-[#F4F2EE] text-[#171614]">
                                    {s.label}
                                </span>
                                <span className="text-[11px] text-[var(--text-muted)]">
                                    {s.key === 'winter' ? '日照角度偏低，陰影較長' : '日照角度偏高，陰影較短'}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                                {SNAPSHOT_HOURS.map(hr => {
                                    const isCurrent = currentSeason === s.key && Math.abs((currentSunTime || 0) - hr) < 0.6;
                                    return (
                                        <button
                                            key={`${s.key}-${hr}`}
                                            type="button"
                                            onClick={() => {
                                                onSelectSnapshot && onSelectSnapshot(s.key, hr);
                                                onClose();
                                            }}
                                            className={`group rounded-2xl p-2 border text-left transition-all hover:border-[#E85D2A] active:scale-[0.98] ${
                                                isCurrent
                                                    ? 'border-[#E85D2A] ring-2 ring-[#E85D2A]/25 bg-[#FFF9F6]'
                                                    : 'border-[var(--border-subtle)] bg-white/80 dark:bg-white/5'
                                            }`}
                                        >
                                            <div className="aspect-square w-full overflow-hidden rounded-xl mb-1.5">
                                                <SunShadowMiniSvg
                                                    basePoints={basePoints}
                                                    buildingHeight={buildingHeight}
                                                    season={s.key}
                                                    hour={hr}
                                                    northAngle={northAngle}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between px-0.5">
                                                <span className="text-xs font-black yra-num">
                                                    {String(hr).padStart(2, '0')}:00
                                                </span>
                                                <span className="text-[10px] font-bold text-[#2563EB] flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                                                    切至 3D <ArrowUpRight size={11} />
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* 底部：加入輸出報告開關 */}
                <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-wrap items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => onToggleIncludeInReport && onToggleIncludeInReport(!includeInReport)}
                        className="min-h-[40px] flex items-center gap-2 text-xs font-bold"
                    >
                        {includeInReport ? (
                            <CheckSquare size={16} className="text-[#E85D2A]" />
                        ) : (
                            <Square size={16} className="text-[var(--text-muted)]" />
                        )}
                        將此日照對比快照加入輸出報告（LINE 長圖 / 唯讀連結 / A4 PDF）
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-[40px] px-4 rounded-xl bg-[#171614] text-white text-xs font-bold hover:bg-[#2C2A26]"
                    >
                        完成
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SunComparisonModal;
