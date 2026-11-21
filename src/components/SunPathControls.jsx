import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Sun, Moon, Play, Pause, Compass, Eye, X, GripHorizontal, LayoutGrid } from 'lucide-react';
import { getPolygonCentroid, discretizePolygon } from '../utils/polygon';

// 預設採用台灣緯度 (25.03°N) 計算真實太陽高度角與方位角
const LATITUDE_DEG = 25.03;

const SEASON_DECLINATION = {
    summer: { deg: 23.44, label: '夏至 6/21' },
    equinox: { deg: 0.0, label: '春秋分 3/21' },
    winter: { deg: -23.44, label: '冬至 12/21' }
};

/**
 * 依據時間 (0~24)、季節與基地指北針方位角計算太陽 3D 向量、日夜狀態與地面陰影投影向量
 */
export function computeSunState(sunTime = 10.5, season = 'summer', northAngle = 0) {
    const phi = (LATITUDE_DEG * Math.PI) / 180;
    const decDeg = (SEASON_DECLINATION[season] || SEASON_DECLINATION.summer).deg;
    const delta = (decDeg * Math.PI) / 180;
    const hourAngle = ((sunTime - 12) * 15 * Math.PI) / 180;

    const sinAlt = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle);
    const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const altDeg = (altRad * 180) / Math.PI;

    // 方位角 (北=0°, 東=90°, 南=180°, 西=270°)
    const eastComp = -Math.cos(delta) * Math.sin(hourAngle);
    const northComp = Math.cos(phi) * Math.sin(delta) - Math.sin(phi) * Math.cos(delta) * Math.cos(hourAngle);
    const azimuthRad = Math.atan2(eastComp, northComp);
    const azimuthDeg = ((azimuthRad * 180) / Math.PI + 360) % 360;

    // 轉換至基地平面座標 (X向右, Y向下, -Y為北並順時針旋轉 northAngle)
    const northRad = ((northAngle || 0) * Math.PI) / 180;
    const worldAngle = azimuthRad + northRad;
    const horizX = Math.sin(worldAngle);
    const horizY = -Math.cos(worldAngle);
    const cosAlt = Math.cos(altRad);

    const sunVec = {
        x: horizX * cosAlt,
        y: horizY * cosAlt,
        z: Math.sin(altRad)
    };

    // 日夜平滑權重：仰角 <= 0° 為完全夜晚 (nightFactor = 1)，>= 10° 為完全白天 (nightFactor = 0)
    const nightFactor = Math.max(0, Math.min(1, (8 - altDeg) / 10));
    const isNight = altDeg <= 1.5;

    // 地面投影陰影偏移向量（每 1 公尺高度在地面投射的位移公尺數）
    const clampedAltDeg = Math.max(14, Math.min(82, altDeg));
    const tanAlt = Math.tan((clampedAltDeg * Math.PI) / 180);
    const shadowScale = Math.min(3.4, 1 / Math.max(0.24, tanAlt));
    const shadowDxPerM = isNight ? 0 : -horizX * shadowScale;
    const shadowDyPerM = isNight ? 0 : -horizY * shadowScale;

    return {
        sunTime,
        season,
        altDeg,
        altRad,
        azimuthDeg,
        azimuthRad,
        horizX,
        horizY,
        sunVec,
        isNight,
        nightFactor,
        shadowDxPerM,
        shadowDyPerM
    };
}

export function formatSunClock(hours) {
    const wrapped = ((hours % 24) + 24) % 24;
    const h = Math.floor(wrapped);
    const m = Math.round((wrapped - h) * 60) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 3D 場景內極簡立體太陽軌跡（真正 3D 空間拱弧線 + 單一太陽點，無大虛線圓與散點）
 */
export const SunPathArc3D = React.memo(({ sunState, season, northAngle, scale, w, d, radiusM = 24 }) => {
    const rPx = Math.max(120, radiusM * scale);
    const cx = w / 2;
    const cy = d / 2;

    // 採樣 05:30 ~ 18:30 的太陽日間 3D 空間軌跡點（以基地中心為原點，含真實 Z 高度）
    const arcSamples = [];
    for (let t = 5.5; t <= 18.51; t += 0.35) {
        const st = computeSunState(t, season, northAngle);
        if (st.altDeg >= 0) {
            arcSamples.push({
                x: st.sunVec.x * rPx,
                y: st.sunVec.y * rPx,
                z: Math.max(2, st.sunVec.z * rPx)
            });
        }
    }

    // 將相鄰 3D 空間點轉為真正立體連接的 3D 線段（translate3d + rotateZ(yaw) + rotateY(pitch)）
    const segments3D = [];
    for (let i = 0; i < arcSamples.length - 1; i++) {
        const a = arcSamples[i];
        const b = arcSamples[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dy, dz);
        if (len < 0.5) continue;
        const yawDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        const pitchDeg = (-Math.asin(Math.max(-1, Math.min(1, dz / len))) * 180) / Math.PI;
        segments3D.push({
            key: `seg-${i}`,
            x: a.x,
            y: a.y,
            z: a.z,
            len: len + 0.8,
            yawDeg,
            pitchDeg
        });
    }

    const curX = sunState.sunVec.x * rPx;
    const curY = sunState.sunVec.y * rPx;
    const curZ = Math.max(8, sunState.sunVec.z * rPx);
    const isNight = sunState.isNight;
    const arcColor = isNight ? 'rgba(118, 113, 104, 0.35)' : 'rgba(232, 93, 42, 0.72)';

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${w}px`,
                height: `${d}px`,
                pointerEvents: 'none',
                transformStyle: 'preserve-3d',
                zIndex: 6000
            }}
        >
            {/* 真正立體懸浮於 3D 空間的太陽軌跡細弧線（交叉雙片確保俯視與側視皆清晰） */}
            {segments3D.map(seg => (
                <div
                    key={seg.key}
                    style={{
                        position: 'absolute',
                        left: `${cx}px`,
                        top: `${cy}px`,
                        width: `${seg.len.toFixed(1)}px`,
                        height: '2px',
                        marginTop: '-1px',
                        transformOrigin: '0 50%',
                        transformStyle: 'preserve-3d',
                        transform: `translate3d(${seg.x.toFixed(1)}px, ${seg.y.toFixed(1)}px, ${seg.z.toFixed(1)}px) rotateZ(${seg.yawDeg.toFixed(2)}deg) rotateY(${seg.pitchDeg.toFixed(2)}deg)`
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: arcColor,
                            borderRadius: '2px'
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: arcColor,
                            borderRadius: '2px',
                            transform: 'rotateX(90deg)'
                        }}
                    />
                </div>
            ))}

            {/* 當前太陽往地面投影的極細 3D 高度垂線（強化立體空間高度感） */}
            {!isNight && curZ > 12 && (
                <div
                    style={{
                        position: 'absolute',
                        left: `${cx}px`,
                        top: `${cy}px`,
                        width: `${curZ.toFixed(1)}px`,
                        height: '1px',
                        transformOrigin: '0 50%',
                        transformStyle: 'preserve-3d',
                        transform: `translate3d(${curX.toFixed(1)}px, ${curY.toFixed(1)}px, 0px) rotateY(-90deg)`
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            borderTop: '1px dashed rgba(232, 93, 42, 0.35)'
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            borderTop: '1px dashed rgba(232, 93, 42, 0.35)',
                            transform: 'rotateX(90deg)'
                        }}
                    />
                </div>
            )}

            {/* 單一太陽／月亮立體球點 */}
            <div
                style={{
                    position: 'absolute',
                    left: `${cx}px`,
                    top: `${cy}px`,
                    width: isNight ? '14px' : '18px',
                    height: isNight ? '14px' : '18px',
                    marginLeft: isNight ? '-7px' : '-9px',
                    marginTop: isNight ? '-7px' : '-9px',
                    borderRadius: '999px',
                    backgroundColor: isNight ? '#767168' : '#E85D2A',
                    border: '2px solid #FFFFFF',
                    boxShadow: isNight
                        ? '0 0 12px rgba(118, 113, 104, 0.4)'
                        : '0 0 16px rgba(232, 93, 42, 0.55)',
                    transform: isNight
                        ? `translate3d(0px, 0px, ${Math.max(100, rPx * 0.7)}px)`
                        : `translate3d(${curX}px, ${curY}px, ${curZ}px)`,
                    transition: 'transform 0.1s linear'
                }}
            />
        </div>
    );
});

/**
 * AO 模式地面投影陰影與建築底部接觸 AO 光暈 (AOGroundShadows)
 */
export const AOGroundShadows = React.memo(({ layers, sunState, scale, w, d, siteId }) => {
    if (!layers || layers.length === 0) return null;
    const cx = w / 2;
    const cy = d / 2;
    const isNight = sunState.isNight;

    // 計算每個樓層在地面上的精準幾何投影多邊形（包含牆面投影四邊形與頂面投影多邊形）
    const shadowPaths = [];
    const baseFootprintPaths = [];

    layers.forEach((layer, lIdx) => {
        if (layer.visible === false) return;
        let pts = layer.points;
        if (!pts || pts.length < 3) {
            const halfW = (layer.widthPx || 0) / (2 * scale);
            const halfD = (layer.depthPx || 0) / (2 * scale);
            if (halfW <= 0 || halfD <= 0) return;
            pts = [
                { x: -halfW, y: -halfD },
                { x: halfW, y: -halfD },
                { x: halfW, y: halfD },
                { x: -halfW, y: halfD }
            ];
        } else if (layer.curves && Object.keys(layer.curves).length > 0) {
            pts = discretizePolygon(pts, layer.curves, 8).points;
        }

        const shiftXM = (layer.shiftX || 0) / scale;
        const shiftYM = (layer.shiftYPx || 0) / scale;
        const rotRad = ((layer.rotation || 0) * Math.PI) / 180;
        const cosR = Math.cos(rotRad);
        const sinR = Math.sin(rotRad);

        const worldPts = pts.map(p => ({
            x: (p.x * cosR - p.y * sinR) + shiftXM,
            y: (p.x * sinR + p.y * cosR) + shiftYM
        }));

        const zBotM = (layer.z || 0) / scale;
        const zTopM = ((layer.z || 0) + (layer.height || 0)) / scale;

        // 地面接觸 AO（針對 1F 或最底層）
        if (zBotM < 0.5) {
            const fpD = worldPts
                .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(cx + p.x * scale).toFixed(1)} ${(cy + p.y * scale).toFixed(1)}`)
                .join(' ') + ' Z';
            baseFootprintPaths.push(<path key={`ao-fp-${lIdx}`} d={fpD} />);
        }

        if (!isNight) {
            const botOffX = sunState.shadowDxPerM * zBotM;
            const botOffY = sunState.shadowDyPerM * zBotM;
            const topOffX = sunState.shadowDxPerM * zTopM;
            const topOffY = sunState.shadowDyPerM * zTopM;

            const botProj = worldPts.map(p => ({ x: cx + (p.x + botOffX) * scale, y: cy + (p.y + botOffY) * scale }));
            const topProj = worldPts.map(p => ({ x: cx + (p.x + topOffX) * scale, y: cy + (p.y + topOffY) * scale }));

            // 1. 頂面投影
            const topD = topProj.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
            shadowPaths.push(<path key={`sh-top-${lIdx}`} d={topD} />);

            // 2. 每面牆的掃掠投影四邊形
            for (let i = 0; i < worldPts.length; i++) {
                const nextI = (i + 1) % worldPts.length;
                const b1 = botProj[i];
                const b2 = botProj[nextI];
                const t2 = topProj[nextI];
                const t1 = topProj[i];
                const quadD = `M ${b1.x.toFixed(1)} ${b1.y.toFixed(1)} L ${b2.x.toFixed(1)} ${b2.y.toFixed(1)} L ${t2.x.toFixed(1)} ${t2.y.toFixed(1)} L ${t1.x.toFixed(1)} ${t1.y.toFixed(1)} Z`;
                shadowPaths.push(<path key={`sh-w-${lIdx}-${i}`} d={quadD} />);
            }
        }
    });

    const shadowFilterId = `ao-shadow-blur-${siteId}`;
    const contactFilterId = `ao-contact-blur-${siteId}`;
    const dayShadowOpacity = Math.max(0.06, Math.min(0.34, 0.32 * (1 - sunState.nightFactor)));

    return (
        <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${w} ${d}`}
            style={{
                overflow: 'visible',
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                zIndex: 14,
                transform: 'translateZ(0.35px)'
            }}
        >
            <defs>
                <filter id={shadowFilterId} x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="1.8" />
                </filter>
                <filter id={contactFilterId} x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation={isNight ? '9' : '5.5'} />
                </filter>
            </defs>

            {/* 1. 建築底部環境光遮蔽接觸陰影 (Ground Contact AO) */}
            {baseFootprintPaths.length > 0 && (
                <g
                    fill={isNight ? '#000000' : '#0f172a'}
                    stroke={isNight ? '#000000' : '#0f172a'}
                    strokeWidth={isNight ? '16' : '9'}
                    strokeLinejoin="round"
                    opacity={isNight ? 0.62 : 0.24}
                    filter={`url(#${contactFilterId})`}
                >
                    {baseFootprintPaths}
                </g>
            )}

            {/* 2. 太陽方向性投射陰影 (Directional Cast Shadow) */}
            {!isNight && shadowPaths.length > 0 && (
                <g
                    fill="#1e293b"
                    opacity={dayShadowOpacity.toFixed(3)}
                    filter={`url(#${shadowFilterId})`}
                >
                    {shadowPaths}
                </g>
            )}
        </svg>
    );
});

/**
 * Environment · 太陽軌跡與 AO 視覺控制面板 (仿附圖 1 & 2 深色建築軟體介面風格)
 */
export const SunPathPanel = ({
    isOpen,
    onClose,
    aoMode,
    setAoMode,
    sunTime,
    setSunTime,
    season,
    setSeason,
    isPlaying,
    setIsPlaying,
    northAngle,
    onUpdateNorthAngle,
    sunState,
    onOpenComparison
}) => {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const posRef = useRef(pos);
    posRef.current = pos;
    const dragRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });
    const dialSvgRef = useRef(null);
    const isDialDragging = useRef(false);

    const handleDragMove = useCallback((e) => {
        if (!dragRef.current.active) return;
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        setPos({
            x: dragRef.current.origX + (cx - dragRef.current.startX),
            y: dragRef.current.origY + (cy - dragRef.current.startY)
        });
    }, []);

    const handleDragEnd = useCallback(() => {
        dragRef.current.active = false;
        isDialDragging.current = false;
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
    }, [handleDragMove]);

    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
        };
    }, [handleDragMove, handleDragEnd]);

    const startPanelDrag = (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        e.stopPropagation();
        dragRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            origX: posRef.current.x,
            origY: posRef.current.y
        };
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
    };

    // 互動式圓弧時鐘點擊／拖曳調整時間
    const updateTimeFromDialEvent = (e) => {
        if (!dialSvgRef.current) return;
        const rect = dialSvgRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        // 頂部 (12:00) 為 -90deg，順時針一圈 = 24 小時
        let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        if (angleDeg < 0) angleDeg += 360;
        const hours = (angleDeg / 360) * 24;
        setSunTime(Math.round(hours * 12) / 12);
    };

    if (!isOpen) return null;

    const dialAngleRad = (((sunTime / 24) * 360 - 90) * Math.PI) / 180;
    const dialR = 32;
    const knobX = 44 + Math.cos(dialAngleRad) * dialR;
    const knobY = 44 + Math.sin(dialAngleRad) * dialR;

    const compassAngleRad = ((((sunState.azimuthDeg + (northAngle || 0)) % 360) - 90) * Math.PI) / 180;
    const cKnobX = 44 + Math.cos(compassAngleRad) * 28;
    const cKnobY = 44 + Math.sin(compassAngleRad) * 28;

    return (
        <div
            className="absolute top-[72px] right-4 z-[65] w-[280px] max-w-[calc(100vw-24px)] yra-card rounded-3xl select-none pointer-events-auto no-context-menu no-print overflow-hidden"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* 頂部可拖曳標題列（統一 Design Token） */}
            <div
                className="px-4 py-3 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex items-center justify-between cursor-grab active:cursor-grabbing"
                onMouseDown={startPanelDrag}
            >
                <div className="flex items-center gap-2">
                    <GripHorizontal size={14} className="text-[var(--text-muted)]" />
                    <span className="text-xs font-black tracking-normal flex items-center gap-1.5">
                        {sunState.isNight ? <Moon size={14} className="text-[#2563EB]" /> : <Sun size={14} className="text-[#E85D2A]" />}
                        <span>日照與環境控制</span>
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 transition-colors"
                    title="關閉日照與環境面板"
                    aria-label="關閉日照與環境面板"
                >
                    <X size={15} />
                </button>
            </div>

            <div className="p-3.5 space-y-3 text-xs">
                {/* 雙圓盤控制區：時間錶盤 + 太陽方位羅盤 */}
                <div className="flex items-center justify-around rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] py-2 px-1">
                    {/* 時間互動圓盤 */}
                    <div className="flex flex-col items-center">
                        <svg
                            ref={dialSvgRef}
                            width="84"
                            height="84"
                            viewBox="0 0 88 88"
                            className="cursor-pointer"
                            onMouseDown={(e) => {
                                isDialDragging.current = true;
                                updateTimeFromDialEvent(e);
                            }}
                            onMouseMove={(e) => {
                                if (isDialDragging.current) updateTimeFromDialEvent(e);
                            }}
                            onMouseUp={() => { isDialDragging.current = false; }}
                            onMouseLeave={() => { isDialDragging.current = false; }}
                        >
                            <circle cx="44" cy="44" r={dialR} fill="none" stroke="#DDD8CE" strokeWidth="5" />
                            <circle cx="44" cy="44" r={dialR} fill="none" stroke="#E85D2A" strokeWidth="3.5" strokeDasharray="100 101" strokeDashoffset="50" opacity="0.65" />
                            <line x1="44" y1="44" x2={knobX} y2={knobY} stroke="#767168" strokeWidth="1.5" />
                            <circle cx="44" cy="44" r="2.5" fill="#171614" />
                            <circle
                                cx={knobX}
                                cy={knobY}
                                r="5.5"
                                fill={sunState.isNight ? '#2563EB' : '#E85D2A'}
                                stroke="#FFFFFF"
                                strokeWidth="1.5"
                            />
                        </svg>
                        <div className="yra-num font-black text-xs -mt-1">
                            {formatSunClock(sunTime)}
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 bg-black/5 text-[var(--text-muted)] yra-num">
                            {sunState.isNight ? '夜間聚光' : `仰角 ${Math.max(0, sunState.altDeg).toFixed(0)}°`}
                        </span>
                    </div>

                    {/* 方位羅盤顯示 */}
                    <div className="flex flex-col items-center">
                        <svg width="84" height="84" viewBox="0 0 88 88">
                            <circle cx="44" cy="44" r="32" fill="none" stroke="#DDD8CE" strokeWidth="1.5" strokeDasharray="3,3" />
                            <text x="44" y="19" textAnchor="middle" fontSize="9" fontWeight="900" fill="#171614">N</text>
                            <text x="44" y="75" textAnchor="middle" fontSize="9" fontWeight="700" fill="#767168">S</text>
                            <text x="71" y="47" textAnchor="middle" fontSize="9" fontWeight="700" fill="#767168">E</text>
                            <text x="17" y="47" textAnchor="middle" fontSize="9" fontWeight="700" fill="#767168">W</text>
                            <line x1="44" y1="44" x2={cKnobX} y2={cKnobY} stroke={sunState.isNight ? '#767168' : '#2563EB'} strokeWidth="1.6" />
                            <circle cx={cKnobX} cy={cKnobY} r="4.2" fill={sunState.isNight ? '#767168' : '#2563EB'} stroke="#FFFFFF" strokeWidth="1.2" />
                        </svg>
                        <div className="yra-num font-bold text-[10px] text-[var(--text-secondary)] -mt-1">
                            方位 {sunState.azimuthDeg.toFixed(0)}°
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] mt-0.5 yra-num">
                            北向 {(northAngle || 0).toFixed(0)}°
                        </span>
                    </div>
                </div>

                {/* 日照對比快照一鍵入口（任務 5） */}
                {onOpenComparison && (
                    <button
                        type="button"
                        onClick={onOpenComparison}
                        className="w-full min-h-[42px] px-3 py-2 rounded-2xl bg-[#171614] text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#2C2A26] transition-colors"
                    >
                        <LayoutGrid size={14} className="text-[#E85D2A]" />
                        日照對比（冬至 / 夏至 6 時段快照）
                    </button>
                )}

                {/* 時間滑桿 + 播放按鈕 */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[var(--text-muted)]">日照時間軸</span>
                        <button
                            type="button"
                            onClick={() => setIsPlaying(p => !p)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-colors ${
                                isPlaying
                                    ? 'bg-[#E85D2A] text-white border-[#E85D2A]'
                                    : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[#171614]'
                            }`}
                        >
                            {isPlaying ? <Pause size={11} /> : <Play size={11} />}
                            <span>{isPlaying ? '暫停' : '播放日照'}</span>
                        </button>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="24"
                        step="0.1"
                        value={sunTime}
                        onChange={(e) => setSunTime(parseFloat(e.target.value))}
                        className="w-full accent-[#E85D2A] cursor-pointer"
                    />
                    <div className="grid grid-cols-5 gap-1">
                        {[
                            { label: '09:00', t: 9.0 },
                            { label: '12:00', t: 12.0 },
                            { label: '15:00', t: 15.0 },
                            { label: '傍晚', t: 17.5 },
                            { label: '夜晚', t: 21.0 }
                        ].map(preset => (
                            <button
                                key={preset.label}
                                type="button"
                                onClick={() => { setIsPlaying(false); setSunTime(preset.t); }}
                                className={`py-1.5 rounded-lg text-[10px] font-bold border transition-colors yra-num ${
                                    Math.abs(sunTime - preset.t) < 0.6
                                        ? 'bg-[#E85D2A] text-white border-[#E85D2A]'
                                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[#171614]'
                                }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 季節切換 */}
                <div className="space-y-1">
                    <span className="text-[11px] font-bold text-[var(--text-muted)] block">節氣（台灣 25°N）</span>
                    <div className="grid grid-cols-3 gap-1.5">
                        {Object.entries(SEASON_DECLINATION).map(([key, info]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setSeason(key)}
                                className={`py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                                    season === key
                                        ? 'bg-[#2563EB] text-white border-[#2563EB]'
                                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[#171614]'
                                }`}
                            >
                                {info.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 北向方位角快調 */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                    <span className="text-[11px] font-bold text-[var(--text-muted)] flex items-center gap-1 whitespace-nowrap">
                        <Compass size={13} /> 基地北向
                    </span>
                    <input
                        type="range"
                        min="0"
                        max="360"
                        step="5"
                        value={northAngle || 0}
                        onChange={(e) => onUpdateNorthAngle && onUpdateNorthAngle(parseFloat(e.target.value))}
                        className="flex-1 accent-[#2563EB] cursor-pointer"
                    />
                    <span className="yra-num text-[11px] font-bold w-8 text-right">{(northAngle || 0).toFixed(0)}°</span>
                </div>

                {/* 白模 AO 開關 */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                    <span className="text-[11px] font-bold text-[var(--text-muted)] flex items-center gap-1">
                        <Eye size={13} /> 白模 AO 陰影
                    </span>
                    <button
                        type="button"
                        onClick={() => setAoMode(v => !v)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                            aoMode
                                ? 'bg-[#E85D2A] text-white border-[#E85D2A]'
                                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                        }`}
                    >
                        {aoMode ? '白模開啟中' : '切換白模'}
                    </button>
                </div>
            </div>
        </div>
    );
};
