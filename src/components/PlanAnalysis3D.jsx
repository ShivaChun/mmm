import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Box, LayoutTemplate, Sun, Moon, Maximize2, PanelRightOpen, CheckCircle2, AlertTriangle, GripHorizontal, ChevronUp, ChevronDown, Map as MapIcon, Shovel, Layers, Lock, Unlock, Hexagon, Compass, Move, Square, Building2, Car, Bike, X, Eye, ToggleRight, ToggleLeft, CheckSquare } from 'lucide-react';
import { useFloorStore } from '../store/floorStore';
import { useSiteAnalysis } from '../hooks/useSiteAnalysis';
import { generateSvgPath, calculatePolygonArea, getPolygonCentroid, getPolygonBounds, scalePolygon, offsetPolygon, offsetPolygonByArray, getSegmentNormal, getLineIntersection, discretizePolygon, pointInPolygon, allInsidePolygon, polygonSignedArea, clipPolygonByPolygon, fitPolygonWithin, distToSegment, normalizeWithCurves, splitPolygon, splitPolygonByCount, getSplitUnits, constrainPolygonToLegalBoundary } from '../utils/polygon';
import { toPing, formatNum, toSqm } from '../utils/geometry';
import { createSeededRandom } from '../utils/random';
import PlanAnalysis2D from './PlanAnalysis2D';
import { CheckLine, Si } from './Si';
import { FloorInfoCard } from './FloorInfoCard';
import { ArtisticCompass } from './ArtisticCompass';
import { BuildingLayer, SummaryRow } from './SitePolygonEditor';
import { DraggablePanel } from './DraggablePanel';

const getSiteDefaultDims = (site) => {
    const sInputs = site?.inputs || {};
    const lotArea = Array.isArray(site?.lots) ? site.lots.reduce((acc, l) => acc + (parseFloat(l.area) || 0), 0) : 0;
    const area = parseFloat(sInputs.baseArea) || lotArea || 239.12;
    const w = parseFloat(sInputs.baseWidthM || sInputs.baseWidth) || Math.sqrt(area);
    const d = parseFloat(sInputs.baseDepthM || sInputs.baseDepth) || (area / w);
    return { w, d, area };
};

const getSiteDefaultRect = (site) => {
    const { w, d } = getSiteDefaultDims(site);
    return [
        { x: -w / 2, y: -d / 2 },
        { x: w / 2, y: -d / 2 },
        { x: w / 2, y: d / 2 },
        { x: -w / 2, y: d / 2 }
    ];
};

// 半透明灰色特斯拉 (Tesla) 紙片車行駛動畫組件（降低出現頻率、以直立於車道方向之半透明紙片車呈現，抵達盡頭直接消失不縮放，轉視角無破綻）
const RoadVehicles3D = React.memo(({ lanes, scale, w, d, isDarkMode }) => {
    const carRefs = useRef([]);
    const scaleRef = useRef(scale);
    scaleRef.current = scale;

    // 使用幾何特徵簽章穩定化車道資料，避免父層因點選或旋轉視角重繪時重建陣列導致動畫重置
    const lanesSignature = useMemo(() => {
        if (!Array.isArray(lanes) || lanes.length === 0) return '';
        return lanes
            .map((pts, idx) => {
                if (!pts || pts.length < 2) return '';
                const first = pts[0];
                const mid = pts[Math.floor(pts.length / 2)];
                const last = pts[pts.length - 1];
                return `${idx}:${pts.length}:${first.x.toFixed(2)},${first.y.toFixed(2)}:${mid.x.toFixed(2)},${mid.y.toFixed(2)}:${last.x.toFixed(2)},${last.y.toFixed(2)}`;
            })
            .join('|');
    }, [lanes]);

    const preparedVehicles = useMemo(() => {
        if (!lanesSignature) return [];
        const list = [];
        (lanes || []).forEach((lanePts, laneIdx) => {
            if (!lanePts || lanePts.length < 2) return;
            const cumLengths = [0];
            const segAngles = [];
            let totalLen = 0;
            for (let i = 0; i < lanePts.length - 1; i++) {
                const dx = lanePts[i + 1].x - lanePts[i].x;
                const dy = lanePts[i + 1].y - lanePts[i].y;
                const segLen = Math.hypot(dx, dy);
                totalLen += segLen;
                cumLengths.push(totalLen);
                segAngles.push((Math.atan2(dy, dx) * 180) / Math.PI);
            }
            if (totalLen < 8) return;

            // 大幅降低車輛出現頻率：每車道僅配置 1 台（超長道路最多 2 台），並加入長緩衝週期 (cycleLen > totalLen) 形成自然的空檔間隔
            const vehicleCount = totalLen > 145 ? 2 : 1;
            const cycleLen = totalLen + Math.max(75, totalLen * 0.85);
            const baseSpeed = 7.2 + (laneIdx % 2) * 1.1; // m/s
            for (let c = 0; c < vehicleCount; c++) {
                const modelType = (laneIdx % 2 === 1 && c === 0 && totalLen > 90) ? 'cybertruck' : (c % 2 === 0 ? 'model3' : 'modelY');
                list.push({
                    id: `lane-${laneIdx}-car-${c}`,
                    modelType,
                    pts: lanePts.map(p => ({ x: p.x, y: p.y })),
                    cumLengths,
                    segAngles,
                    totalLen,
                    cycleLen,
                    speed: baseSpeed,
                    phaseOffset: (c * 0.52 + (laneIdx % 2) * 0.37) % 1
                });
            }
        });
        return list;
    }, [lanesSignature]);

    useEffect(() => {
        if (preparedVehicles.length === 0) return;
        let frameId = null;

        const normalizeAngleDiff = (a, b) => {
            const diff = ((b - a + 540) % 360) - 180;
            return a + diff;
        };

        const tick = (now) => {
            const elapsedSec = now / 1000;
            const curScale = scaleRef.current || 1;

            preparedVehicles.forEach((v, idx) => {
                const el = carRefs.current[idx];
                if (!el) return;
                const dist = ((elapsedSec * v.speed) + v.phaseOffset * v.cycleLen) % v.cycleLen;
                // 抵達道路盡頭直接消失，不使用縮小過渡
                if (dist > v.totalLen) {
                    el.style.visibility = 'hidden';
                    el.style.transform = 'translate3d(0px, 0px, -9999px)';
                    return;
                }
                el.style.visibility = 'visible';

                let segIdx = 0;
                for (let i = 0; i < v.cumLengths.length - 1; i++) {
                    if (dist >= v.cumLengths[i] && dist <= v.cumLengths[i + 1]) {
                        segIdx = i;
                        break;
                    }
                }
                const s0 = v.cumLengths[segIdx];
                const s1 = v.cumLengths[segIdx + 1];
                const segLen = Math.max(1e-6, s1 - s0);
                const t = (dist - s0) / segLen;
                const p1 = v.pts[segIdx];
                const p2 = v.pts[segIdx + 1];

                const xPx = (p1.x + (p2.x - p1.x) * t) * curScale;
                const yPx = (p1.y + (p2.y - p1.y) * t) * curScale;

                // 平滑曲線轉向角度插值（直接沿 3D 世界座標車道切線方向行駛，轉視角時完全不會翻轉或變形）
                let angleDeg = v.segAngles[segIdx];
                if (t > 0.7 && segIdx + 1 < v.segAngles.length) {
                    const nextA = normalizeAngleDiff(angleDeg, v.segAngles[segIdx + 1]);
                    const blend = ((t - 0.7) / 0.3) * 0.5;
                    angleDeg = angleDeg + (nextA - angleDeg) * blend;
                } else if (t < 0.3 && segIdx > 0) {
                    const prevA = normalizeAngleDiff(angleDeg, v.segAngles[segIdx - 1]);
                    const blend = ((0.3 - t) / 0.3) * 0.5;
                    angleDeg = angleDeg + (prevA - angleDeg) * blend;
                }

                el.style.transform = `translate3d(${xPx}px, ${yPx}px, 0.5px) rotateZ(${angleDeg}deg)`;
            });
            frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
        return () => {
            if (frameId) cancelAnimationFrame(frameId);
        };
    }, [preparedVehicles]);

    if (preparedVehicles.length === 0) return null;

    const svgW = Math.max(24, 5.6 * scale);
    const svgH = svgW * 0.46;

    // 建築模型半透明灰紙片車配色（整體半透明呈現）
    const paperFill = isDarkMode ? 'rgba(182, 194, 210, 0.52)' : 'rgba(138, 150, 168, 0.54)';
    const paperAccent = isDarkMode ? 'rgba(226, 232, 240, 0.62)' : 'rgba(203, 213, 225, 0.64)';
    const windowFill = isDarkMode ? 'rgba(30, 41, 59, 0.38)' : 'rgba(241, 245, 249, 0.45)';
    const paperStroke = isDarkMode ? 'rgba(248, 250, 252, 0.68)' : 'rgba(51, 65, 85, 0.65)';
    const wheelFill = isDarkMode ? 'rgba(30, 41, 59, 0.62)' : 'rgba(51, 65, 85, 0.60)';
    const groundShadowCol = isDarkMode ? 'rgba(15, 23, 42, 0.28)' : 'rgba(30, 41, 59, 0.16)';

    const renderPaperTesla = (modelType) => {
        if (modelType === 'cybertruck') {
            return (
                <svg width={svgW * 1.08} height={svgH * 1.08} viewBox="0 0 120 55" style={{ overflow: 'visible', display: 'block' }}>
                    {/* Cybertruck 半透明紙片車主輪廓（三角折線皮卡造型） */}
                    <polygon
                        points="6,28 50,8 106,24 114,35 108,43 10,43"
                        fill={paperFill}
                        stroke={paperStroke}
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                    />
                    {/* 紙片車窗裁切感幾何窗格 */}
                    <polygon
                        points="28,26 50,13 84,23 82,29 28,29"
                        fill={windowFill}
                        stroke={paperStroke}
                        strokeWidth="1.1"
                        strokeLinejoin="round"
                    />
                    <line x1="55" y1="15" x2="55" y2="29" stroke={paperStroke} strokeWidth="1.2" />
                    {/* 折線腰線與車頭/車尾光條 */}
                    <line x1="8" y1="29" x2="112" y2="33" stroke={paperAccent} strokeWidth="1.1" />
                    <line x1="106" y1="25" x2="113" y2="34" stroke="rgba(248, 250, 252, 0.8)" strokeWidth="2.2" strokeLinecap="round" />
                    <line x1="6" y1="28" x2="9" y2="38" stroke="rgba(244, 63, 94, 0.75)" strokeWidth="2.2" strokeLinecap="round" />
                    {/* 紙片車輪（底部貼齊 y=54 路面） */}
                    <circle cx="28" cy="44" r="9.5" fill={wheelFill} stroke={paperStroke} strokeWidth="1.4" />
                    <circle cx="28" cy="44" r="4" fill={paperAccent} />
                    <circle cx="88" cy="44" r="9.5" fill={wheelFill} stroke={paperStroke} strokeWidth="1.4" />
                    <circle cx="88" cy="44" r="4" fill={paperAccent} />
                </svg>
            );
        }

        const isModelY = modelType === 'modelY';
        const roofPeakY = isModelY ? 8 : 12;
        return (
            <svg width={svgW} height={svgH} viewBox="0 0 120 55" style={{ overflow: 'visible', display: 'block' }}>
                {/* 特斯拉 Model 3 / Y 半透明紙片車側面剪影（流線溜背 Fastback 造型） */}
                <path
                    d={`M 8,32 L 15,24 Q 40,${roofPeakY} 65,${roofPeakY + 1} L 87,23 L 108,29 Q 115,32 114,40 L 107,44 L 13,44 Q 8,41 8,32 Z`}
                    fill={paperFill}
                    stroke={paperStroke}
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                />
                {/* 紙片車溜背窗框（鏤空半透明感） */}
                <path
                    d={`M 25,25 Q 44,${roofPeakY + 4} 64,${roofPeakY + 5} L 83,24 L 80,29 L 25,29 Z`}
                    fill={windowFill}
                    stroke={paperStroke}
                    strokeWidth="1.1"
                    strokeLinejoin="round"
                />
                <line x1="55" y1={roofPeakY + 5} x2="54" y2="29" stroke={paperStroke} strokeWidth="1.2" />
                {/* 紙片車身折線與隱藏式門把 */}
                <line x1="20" y1="34" x2="98" y2="34" stroke={paperAccent} strokeWidth="1.1" strokeLinecap="round" />
                <line x1="45" y1="32" x2="50" y2="32" stroke={paperStroke} strokeWidth="1.1" strokeLinecap="round" />
                <line x1="63" y1="32" x2="68" y2="32" stroke={paperStroke} strokeWidth="1.1" strokeLinecap="round" />
                {/* 車頭日行燈與車尾燈點綴 */}
                <path d="M 103,30 L 112,33 L 105,35 Z" fill="rgba(248, 250, 252, 0.8)" />
                <path d="M 9,28 L 14,27 L 13,34 L 9,34 Z" fill="rgba(244, 63, 94, 0.75)" />
                {/* 紙片車輪（底部貼齊 y=54 路面） */}
                <circle cx="28" cy="44" r="9.2" fill={wheelFill} stroke={paperStroke} strokeWidth="1.4" />
                <circle cx="28" cy="44" r="4.2" fill={paperAccent} />
                <circle cx="88" cy="44" r="9.2" fill={wheelFill} stroke={paperStroke} strokeWidth="1.4" />
                <circle cx="88" cy="44" r="4.2" fill={paperAccent} />
            </svg>
        );
    };

    return (
        <React.Fragment>
            {preparedVehicles.map((v, idx) => {
                const wPx = v.modelType === 'cybertruck' ? svgW * 1.08 : svgW;
                const hPx = v.modelType === 'cybertruck' ? svgH * 1.08 : svgH;
                const carSvg = renderPaperTesla(v.modelType);
                return (
                    <div
                        key={v.id}
                        ref={el => { carRefs.current[idx] = el; }}
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: 0,
                            height: 0,
                            pointerEvents: 'none',
                            transformStyle: 'preserve-3d',
                            willChange: 'transform'
                        }}
                    >
                        {/* 貼合於道路表面的車底柔和半透明陰影 */}
                        <div
                            style={{
                                position: 'absolute',
                                left: -(wPx * 0.88) / 2,
                                top: -(wPx * 0.22) / 2,
                                width: wPx * 0.88,
                                height: wPx * 0.22,
                                borderRadius: '999px',
                                background: groundShadowCol,
                                transform: 'translateZ(0.2px)'
                            }}
                        />
                        {/* 直立於車道方向之半透明紙片車（以車輪底部為基準垂直立在路面上，隨 3D 場景自然旋轉無破綻） */}
                        <div
                            style={{
                                position: 'absolute',
                                left: -wPx / 2,
                                top: -hPx,
                                width: wPx,
                                height: hPx,
                                transformOrigin: '50% 100%',
                                transform: 'rotateX(-90deg)',
                                transformStyle: 'preserve-3d',
                                backfaceVisibility: 'visible'
                            }}
                        >
                            {carSvg}
                        </div>
                    </div>
                );
            })}
        </React.Fragment>
    );
});

// 道路兩側 2.5D 行道樹組件（具備三種樹形變化與三種綠色色階，立牌式 2.5D 建築景觀插畫樹，自動面向鏡頭直立呈現）
const StreetTrees3D = React.memo(({ trees, scale, isDarkMode, rotationZ = 0, viewAngleX = 60 }) => {
    if (!Array.isArray(trees) || trees.length === 0) return null;

    const baseTreeW = Math.max(18, 3.8 * scale);
    const baseTreeH = baseTreeW * 1.35;

    const shadowFill = isDarkMode ? 'rgba(15, 23, 42, 0.38)' : 'rgba(30, 41, 59, 0.18)';
    const trunkStroke = isDarkMode ? '#a18065' : '#6b4f3a';

    // 三種綠意色階（0: 深翠綠階、1: 中草綠階、2: 淺嫩青檸綠階）
    const colorTiers = isDarkMode
        ? [
            {
                back: 'rgba(4, 120, 87, 0.68)',
                main: 'rgba(16, 185, 129, 0.74)',
                light: 'rgba(52, 211, 153, 0.72)',
                stroke: 'rgba(167, 243, 208, 0.78)'
            },
            {
                back: 'rgba(21, 128, 61, 0.66)',
                main: 'rgba(34, 197, 94, 0.72)',
                light: 'rgba(134, 239, 172, 0.72)',
                stroke: 'rgba(220, 252, 231, 0.78)'
            },
            {
                back: 'rgba(77, 124, 15, 0.66)',
                main: 'rgba(132, 204, 22, 0.72)',
                light: 'rgba(190, 242, 100, 0.74)',
                stroke: 'rgba(236, 252, 203, 0.78)'
            }
        ]
        : [
            {
                back: 'rgba(6, 95, 70, 0.68)',
                main: 'rgba(5, 150, 105, 0.74)',
                light: 'rgba(52, 211, 153, 0.76)',
                stroke: 'rgba(6, 78, 59, 0.75)'
            },
            {
                back: 'rgba(22, 101, 52, 0.66)',
                main: 'rgba(22, 163, 74, 0.72)',
                light: 'rgba(74, 222, 128, 0.76)',
                stroke: 'rgba(20, 83, 45, 0.75)'
            },
            {
                back: 'rgba(63, 98, 18, 0.66)',
                main: 'rgba(101, 163, 13, 0.72)',
                light: 'rgba(163, 230, 53, 0.76)',
                stroke: 'rgba(54, 83, 20, 0.75)'
            }
        ];

    const renderTreeShape = (shapeType, palette) => {
        if (shapeType === 1) {
            // 樹形 1：錐形層塔狀喬木（如小葉欖仁 / 落羽松風格）
            return (
                <svg width="100%" height="100%" viewBox="0 0 64 86" style={{ overflow: 'visible', display: 'block' }}>
                    <ellipse cx="32" cy="79" rx="13" ry="4.2" fill={shadowFill} />
                    {/* 底層寬傘冠 */}
                    <path d="M 10,54 Q 32,46 54,54 Q 56,60 48,61 L 16,61 Q 8,60 10,54 Z" fill={palette.back} stroke={palette.stroke} strokeWidth="1.2" strokeLinejoin="round" />
                    {/* 中層錐冠 */}
                    <path d="M 14,41 Q 32,29 50,41 Q 52,47 44,48 L 20,48 Q 12,47 14,41 Z" fill={palette.main} stroke={palette.stroke} strokeWidth="1.3" strokeLinejoin="round" />
                    {/* 頂層尖塔樹冠 */}
                    <path d="M 32,10 L 45,32 Q 46,36 39,36 L 25,36 Q 18,36 19,32 Z" fill={palette.main} stroke={palette.stroke} strokeWidth="1.3" strokeLinejoin="round" />
                    {/* 受光亮面 */}
                    <path d="M 32,13 L 23,33 L 32,33 Z" fill={palette.light} />
                    <ellipse cx="26" cy="42" rx="8" ry="3.5" fill={palette.light} />
                    {/* 貫穿式修長樹幹與上揚枝條 */}
                    <path d="M 32,79 L 32,24" stroke={trunkStroke} strokeWidth="3.4" strokeLinecap="round" />
                    <path d="M 32,58 L 20,51" stroke={trunkStroke} strokeWidth="2.0" strokeLinecap="round" />
                    <path d="M 32,55 L 44,49" stroke={trunkStroke} strokeWidth="2.0" strokeLinecap="round" />
                    <path d="M 32,44 L 23,37" stroke={trunkStroke} strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M 32,41 L 40,35" stroke={trunkStroke} strokeWidth="1.8" strokeLinecap="round" />
                </svg>
            );
        }

        if (shapeType === 2) {
            // 樹形 2：傘形雙冠展開喬木（如櫸木 / 樟樹風格）
            return (
                <svg width="100%" height="100%" viewBox="0 0 64 86" style={{ overflow: 'visible', display: 'block' }}>
                    <ellipse cx="32" cy="79" rx="15" ry="4.5" fill={shadowFill} />
                    {/* 後景深色層 */}
                    <ellipse cx="44" cy="36" rx="15" ry="11" fill={palette.back} stroke={palette.stroke} strokeWidth="1.2" />
                    <ellipse cx="20" cy="38" rx="14" ry="10.5" fill={palette.back} stroke={palette.stroke} strokeWidth="1.2" />
                    {/* 主傘形橫向展開樹冠 */}
                    <ellipse cx="23" cy="29" rx="16" ry="11.5" fill={palette.main} stroke={palette.stroke} strokeWidth="1.3" />
                    <ellipse cx="41" cy="27" rx="16.5" ry="12" fill={palette.main} stroke={palette.stroke} strokeWidth="1.3" />
                    <ellipse cx="32" cy="22" rx="14" ry="10" fill={palette.main} stroke={palette.stroke} strokeWidth="1.2" />
                    {/* 頂部受光層 */}
                    <ellipse cx="26" cy="21" rx="10" ry="6.5" fill={palette.light} />
                    <ellipse cx="40" cy="24" rx="9" ry="5.8" fill={palette.light} opacity="0.85" />
                    {/* 雙分岔優雅傘狀主幹 */}
                    <path d="M 32,79 L 32,54" stroke={trunkStroke} strokeWidth="3.8" strokeLinecap="round" />
                    <path d="M 32,56 Q 26,44 19,33" fill="none" stroke={trunkStroke} strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M 32,56 Q 38,43 44,31" fill="none" stroke={trunkStroke} strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M 27,46 L 31,32" stroke={trunkStroke} strokeWidth="1.7" strokeLinecap="round" />
                </svg>
            );
        }

        // 樹形 0：圓潤雲朵闊葉喬木（經典景觀團簇樹冠）
        return (
            <svg width="100%" height="100%" viewBox="0 0 64 86" style={{ overflow: 'visible', display: 'block' }}>
                <ellipse cx="32" cy="79" rx="14" ry="4.5" fill={shadowFill} />
                {/* 2.5D 背光層樹冠 */}
                <circle cx="38" cy="38" r="18.5" fill={palette.back} stroke={palette.stroke} strokeWidth="1.2" />
                <circle cx="24" cy="41" r="15.5" fill={palette.back} stroke={palette.stroke} strokeWidth="1.2" />
                {/* 2.5D 主樹冠層 */}
                <circle cx="32" cy="30" r="20.5" fill={palette.main} stroke={palette.stroke} strokeWidth="1.4" />
                {/* 2.5D 受光亮部樹冠層 */}
                <circle cx="26" cy="25" r="13" fill={palette.light} />
                <circle cx="40" cy="29" r="9" fill={palette.light} opacity="0.78" />
                {/* 建築插畫風樹幹與內部Y字枝幹 */}
                <path d="M 32,79 L 32,37" stroke={trunkStroke} strokeWidth="3.6" strokeLinecap="round" />
                <path d="M 32,55 L 22,43" stroke={trunkStroke} strokeWidth="2.2" strokeLinecap="round" />
                <path d="M 32,49 L 42,37" stroke={trunkStroke} strokeWidth="2.2" strokeLinecap="round" />
                <path d="M 32,41 L 26,31" stroke={trunkStroke} strokeWidth="1.6" strokeLinecap="round" />
            </svg>
        );
    };

    return (
        <React.Fragment>
            {trees.map((t, idx) => {
                const xPx = t.x * scale;
                const yPx = t.y * scale;
                const sFactor = t.scaleFactor || 1;
                const shapeType = (t.shapeType !== undefined ? t.shapeType : idx) % 3;
                const colorTier = (t.colorTier !== undefined ? t.colorTier : idx) % 3;
                const palette = colorTiers[colorTier];
                const tW = baseTreeW * sFactor;
                const tH = baseTreeH * sFactor;

                return (
                    <div
                        key={`tree-25d-${idx}`}
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: 0,
                            height: 0,
                            pointerEvents: 'none',
                            transformStyle: 'preserve-3d',
                            transform: `translate3d(${xPx}px, ${yPx}px, 0.5px) rotateZ(${-rotationZ}deg) rotateX(${-viewAngleX}deg)`
                        }}
                    >
                        <div
                            style={{
                                position: 'absolute',
                                left: -tW / 2,
                                top: -tH * 0.92,
                                width: tW,
                                height: tH,
                                pointerEvents: 'none'
                            }}
                        >
                            {renderTreeShape(shapeType, palette)}
                        </div>
                    </div>
                );
            })}
        </React.Fragment>
    );
});

// 臨道路退縮人行道與虛擬人行道 2.5D 半透明行人漫步動畫組件（抵達盡頭直接消失不縮放，旋轉視角或點選畫面絕不重置動畫）
const Pedestrians3D = React.memo(({ paths, scale, isDarkMode, rotationZ = 0, viewAngleX = 60 }) => {
    const walkerRefs = useRef([]);
    const leftLegRefs = useRef([]);
    const rightLegRefs = useRef([]);
    const leftArmRefs = useRef([]);
    const rightArmRefs = useRef([]);
    const scaleRef = useRef(scale);
    scaleRef.current = scale;
    const cameraRef = useRef({ rotationZ, viewAngleX });
    cameraRef.current = { rotationZ, viewAngleX };

    const pathsSignature = useMemo(() => {
        if (!Array.isArray(paths) || paths.length === 0) return '';
        return paths
            .map((pts, idx) => {
                if (!pts || pts.length < 2) return '';
                const first = pts[0];
                const mid = pts[Math.floor(pts.length / 2)];
                const last = pts[pts.length - 1];
                return `${idx}:${pts.length}:${first.x.toFixed(2)},${first.y.toFixed(2)}:${mid.x.toFixed(2)},${mid.y.toFixed(2)}:${last.x.toFixed(2)},${last.y.toFixed(2)}`;
            })
            .join('|');
    }, [paths]);

    const preparedWalkers = useMemo(() => {
        if (!pathsSignature) return [];
        const list = [];
        // 半透明人物大衣色盤
        const coatPalette = isDarkMode
            ? [
                'rgba(226, 232, 240, 0.56)',
                'rgba(148, 163, 184, 0.56)',
                'rgba(129, 140, 248, 0.56)',
                'rgba(56, 189, 248, 0.56)'
            ]
            : [
                'rgba(71, 85, 105, 0.56)',
                'rgba(100, 116, 139, 0.56)',
                'rgba(79, 70, 229, 0.54)',
                'rgba(15, 118, 110, 0.54)'
            ];

        (paths || []).forEach((pathPts, pIdx) => {
            if (!pathPts || pathPts.length < 2) return;
            const cumLengths = [0];
            const segAngles = [];
            let totalLen = 0;
            for (let i = 0; i < pathPts.length - 1; i++) {
                const dx = pathPts[i + 1].x - pathPts[i].x;
                const dy = pathPts[i + 1].y - pathPts[i].y;
                const segLen = Math.hypot(dx, dy);
                totalLen += segLen;
                cumLengths.push(totalLen);
                segAngles.push((Math.atan2(dy, dx) * 180) / Math.PI);
            }
            if (totalLen < 5) return;

            const walkerCount = Math.max(1, Math.min(3, Math.round(totalLen / 22)));
            const cycleLen = totalLen + Math.max(6, totalLen * 0.22);
            for (let wIdx = 0; wIdx < walkerCount; wIdx++) {
                const reverseDir = (wIdx + pIdx) % 2 === 1;
                const orderedPts = reverseDir ? [...pathPts].reverse() : pathPts;
                const orderedCum = [0];
                const orderedAngles = [];
                let accL = 0;
                for (let i = 0; i < orderedPts.length - 1; i++) {
                    const dx = orderedPts[i + 1].x - orderedPts[i].x;
                    const dy = orderedPts[i + 1].y - orderedPts[i].y;
                    const l = Math.hypot(dx, dy);
                    accL += l;
                    orderedCum.push(accL);
                    orderedAngles.push((Math.atan2(dy, dx) * 180) / Math.PI);
                }

                list.push({
                    id: `sidewalk-${pIdx}-walker-${wIdx}`,
                    pts: orderedPts,
                    cumLengths: orderedCum,
                    segAngles: orderedAngles,
                    totalLen: accL,
                    cycleLen,
                    speed: 1.25 + ((wIdx * 3 + pIdx) % 3) * 0.18,
                    walkFreq: 5.4 + (wIdx % 2) * 0.7,
                    phaseOffset: (wIdx / walkerCount + pIdx * 0.21) % 1,
                    seed: wIdx * 2.1 + pIdx * 1.3,
                    coatColor: coatPalette[(wIdx + pIdx) % coatPalette.length]
                });
            }
        });
        return list;
    }, [pathsSignature, isDarkMode]);

    useEffect(() => {
        if (preparedWalkers.length === 0) return;
        let frameId = null;

        const normalizeAngleDiff = (a, b) => {
            const diff = ((b - a + 540) % 360) - 180;
            return a + diff;
        };

        const tick = (now) => {
            const elapsedSec = now / 1000;
            const curScale = scaleRef.current || 1;
            const { rotationZ: camRotZ, viewAngleX: camViewX } = cameraRef.current;

            preparedWalkers.forEach((w, idx) => {
                const el = walkerRefs.current[idx];
                if (!el) return;

                const dist = ((elapsedSec * w.speed) + w.phaseOffset * w.cycleLen) % w.cycleLen;
                // 抵達人行道盡頭直接消失，不使用縮小過渡
                if (dist > w.totalLen) {
                    el.style.visibility = 'hidden';
                    el.style.transform = 'translate3d(0px, 0px, -9999px)';
                    return;
                }
                el.style.visibility = 'visible';

                let segIdx = 0;
                for (let i = 0; i < w.cumLengths.length - 1; i++) {
                    if (dist >= w.cumLengths[i] && dist <= w.cumLengths[i + 1]) {
                        segIdx = i;
                        break;
                    }
                }
                const s0 = w.cumLengths[segIdx];
                const s1 = w.cumLengths[segIdx + 1];
                const segLen = Math.max(1e-6, s1 - s0);
                const t = (dist - s0) / segLen;
                const p1 = w.pts[segIdx];
                const p2 = w.pts[segIdx + 1];

                const xPx = (p1.x + (p2.x - p1.x) * t) * curScale;
                const yPx = (p1.y + (p2.y - p1.y) * t) * curScale;

                let angleDeg = w.segAngles[segIdx];
                if (t > 0.7 && segIdx + 1 < w.segAngles.length) {
                    const nextA = normalizeAngleDiff(angleDeg, w.segAngles[segIdx + 1]);
                    angleDeg += (nextA - angleDeg) * ((t - 0.7) / 0.3) * 0.5;
                } else if (t < 0.3 && segIdx > 0) {
                    const prevA = normalizeAngleDiff(angleDeg, w.segAngles[segIdx - 1]);
                    angleDeg += (prevA - angleDeg) * ((0.3 - t) / 0.3) * 0.5;
                }

                // 判斷行人在當前螢幕視角下是往左或往右行走，自動翻轉 2.5D 人像朝向
                const screenDx = Math.cos(((angleDeg + camRotZ) * Math.PI) / 180);
                const facingSign = screenDx < -0.05 ? -1 : 1;

                // 步態上下微幅律動與四肢前後擺動角度
                const walkPhase = elapsedSec * w.walkFreq + w.seed;
                const strideDeg = Math.sin(walkPhase) * 26;
                const bobZ = Math.abs(Math.cos(walkPhase)) * Math.max(0.4, 0.08 * curScale) + 0.5;

                el.style.transform = `translate3d(${xPx}px, ${yPx}px, ${bobZ}px) rotateZ(${-camRotZ}deg) rotateX(${-camViewX}deg) scale3d(${facingSign}, 1, 1)`;

                const lLeg = leftLegRefs.current[idx];
                const rLeg = rightLegRefs.current[idx];
                const lArm = leftArmRefs.current[idx];
                const rArm = rightArmRefs.current[idx];
                if (lLeg) lLeg.setAttribute('transform', `rotate(${strideDeg} 20 28)`);
                if (rLeg) rLeg.setAttribute('transform', `rotate(${-strideDeg} 20 28)`);
                if (lArm) lArm.setAttribute('transform', `rotate(${-strideDeg * 0.85} 20 17)`);
                if (rArm) rArm.setAttribute('transform', `rotate(${strideDeg * 0.85} 20 17)`);
            });

            frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
        return () => {
            if (frameId) cancelAnimationFrame(frameId);
        };
    }, [preparedWalkers]);

    if (preparedWalkers.length === 0) return null;

    const figW = Math.max(13, 2.35 * scale);
    const figH = figW * 1.35;
    // 半透明行人配色
    const pantsCol = isDarkMode ? 'rgba(203, 213, 225, 0.55)' : 'rgba(51, 65, 85, 0.55)';
    const headCol = isDarkMode ? 'rgba(248, 250, 252, 0.62)' : 'rgba(241, 245, 249, 0.68)';
    const strokeCol = isDarkMode ? 'rgba(241, 245, 249, 0.65)' : 'rgba(30, 41, 59, 0.62)';
    const shadowCol = isDarkMode ? 'rgba(15, 23, 42, 0.28)' : 'rgba(30, 41, 59, 0.16)';

    return (
        <React.Fragment>
            {preparedWalkers.map((w, idx) => (
                <div
                    key={w.id}
                    ref={el => { walkerRefs.current[idx] = el; }}
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: 0,
                        height: 0,
                        pointerEvents: 'none',
                        transformStyle: 'preserve-3d',
                        willChange: 'transform'
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            left: -figW / 2,
                            top: -figH * 0.9,
                            width: figW,
                            height: figH,
                            pointerEvents: 'none'
                        }}
                    >
                        <svg width={figW} height={figH} viewBox="0 0 40 54" style={{ overflow: 'visible', display: 'block' }}>
                            {/* 足底 2.5D 半透明陰影 */}
                            <ellipse cx="20" cy="48" rx="9" ry="3.2" fill={shadowCol} />
                            {/* 後側手臂 (左臂) */}
                            <g ref={el => { leftArmRefs.current[idx] = el; }}>
                                <line x1="20" y1="17" x2="20" y2="28" stroke={w.coatColor} strokeWidth="3.4" strokeLinecap="round" />
                            </g>
                            {/* 後側邁步腿 (左腿) */}
                            <g ref={el => { leftLegRefs.current[idx] = el; }}>
                                <line x1="20" y1="28" x2="20" y2="45" stroke={pantsCol} strokeWidth="3.8" strokeLinecap="round" />
                                <ellipse cx="21.8" cy="45.8" rx="3.2" ry="1.6" fill={pantsCol} />
                            </g>
                            {/* 2.5D 半透明軀幹上衣/風衣 */}
                            <path d="M 14,15 Q 20,13 26,15 L 27,30 L 13,30 Z" fill={w.coatColor} stroke={strokeCol} strokeWidth="1.1" strokeLinejoin="round" />
                            {/* 前側邁步腿 (右腿) */}
                            <g ref={el => { rightLegRefs.current[idx] = el; }}>
                                <line x1="20" y1="28" x2="20" y2="45" stroke={pantsCol} strokeWidth="4.0" strokeLinecap="round" />
                                <ellipse cx="22.0" cy="45.8" rx="3.4" ry="1.7" fill={pantsCol} stroke={strokeCol} strokeWidth="0.7" />
                            </g>
                            {/* 前側擺動手臂 (右臂) */}
                            <g ref={el => { rightArmRefs.current[idx] = el; }}>
                                <line x1="20" y1="17" x2="20" y2="28" stroke={w.coatColor} strokeWidth="3.6" strokeLinecap="round" />
                                <circle cx="20" cy="28.5" r="1.7" fill={headCol} stroke={strokeCol} strokeWidth="0.8" />
                            </g>
                            {/* 2.5D 半透明頭部 */}
                            <circle cx="20.5" cy="9" r="5.2" fill={headCol} stroke={strokeCol} strokeWidth="1.2" />
                        </svg>
                    </div>
                </div>
            ))}
        </React.Fragment>
    );
});

const Visualizer3D = ({ isDarkMode, setIsDarkMode, sites, activeSiteId, projectInputs, inputs: inputsProp, res, siteResults, aggregateResults, onUpdateBaseDim, onUpdateSiteSetting, onUpdateRoads, onUpdateInputs, showCheckLines, setShowCheckLines, showHeightRatio, setShowHeightRatio, showWeiLao, setShowWeiLao, showBackyard, setShowBackyard, isConstraintMode, setIsConstraintMode, onUnusedAreaChange, placementMode, placementOffset, setPlacementOffset, onConfirmPlacement, setActiveSiteIndex, showSummaryPanel, setShowSummaryPanel, showEnvPanel, setShowEnvPanel }) => {
    const activeSite = useMemo(() => (sites || []).find(s => s.id === activeSiteId) || (sites || [])[0] || {}, [sites, activeSiteId]);
    const inputs = inputsProp || activeSite.inputs || {};
    const basePoints = activeSite.basePoints || activeSite.baseGeometry?.points;
    const baseCurves = activeSite.baseCurves || activeSite.baseGeometry?.curves;

    // 安全的 Prop 防護：確保 onUpdateSiteSetting 存在時才呼叫，避免灰屏 (Defensive Prop Protection)
    const setBasePoints = (pts) => {
        if (typeof onUpdateSiteSetting === 'function') {
            onUpdateSiteSetting(activeSiteId, 'basePoints', pts);
        } else {
            console.warn('onUpdateSiteSetting is not a function');
        }
    };
    const setBaseCurves = (curves) => {
        if (typeof onUpdateSiteSetting === 'function') {
            onUpdateSiteSetting(activeSiteId, 'baseCurves', curves);
        } else {
            console.warn('onUpdateSiteSetting is not a function');
        }
    };
    const floorSettings = activeSite.floorSettings || {};
    const setFloorSettings = (settings) => {
        if (typeof onUpdateSiteSetting === 'function') {
            if (typeof settings === 'function') {
                onUpdateSiteSetting(activeSiteId, 'floorSettings', (prev) => settings(prev || {}));
            } else {
                onUpdateSiteSetting(activeSiteId, 'floorSettings', settings || {});
            }
        } else {
            console.warn('onUpdateSiteSetting is not a function');
        }
    };
    const adjacentLandGroups = Array.isArray(activeSite.adjacentLandGroups) && activeSite.adjacentLandGroups.length > 0
        ? activeSite.adjacentLandGroups
        : [{ id: 1, edges: [] }];
    const setAdjacentLandGroups = (groups) => {
        if (typeof onUpdateSiteSetting === 'function') {
            if (typeof groups === 'function') {
                onUpdateSiteSetting(activeSiteId, 'adjacentLandGroups', (prev) => {
                    const safePrev = Array.isArray(prev) && prev.length > 0 ? prev : [{ id: 1, edges: [] }];
                    return groups(safePrev);
                });
            } else {
                onUpdateSiteSetting(activeSiteId, 'adjacentLandGroups', Array.isArray(groups) && groups.length > 0 ? groups : [{ id: 1, edges: [] }]);
            }
        } else {
            console.warn('onUpdateSiteSetting is not a function');
        }
    };

    // 新增：用於 3D 模擬區的多基地懸浮與精準放置預覽 State
    const [hoveredSiteId, setHoveredSiteId] = useState(null);
    const [placementPreview, setPlacementPreview] = useState(null);

    // 3D 世界坐標投影至 2D 螢幕坐標演算法 (Screen-Space Projection Algorithm)
    const projectWorldToScreen = (wx, wy, wz) => {
        const centroid = projectBounds.center;
        
        // 1. 本地幾何尺度縮放 (相對於包圍盒中心)
        let x = (wx - centroid.x) * scale;
        let y = (wy - centroid.y) * scale;
        let z = wz * scale;

        // 2. Z 軸旋轉 (rotationZ)
        const radZ = (rotationZ * Math.PI) / 180;
        const cosZ = Math.cos(radZ);
        const sinZ = Math.sin(radZ);
        let rx = x * cosZ - y * sinZ;
        let ry = x * sinZ + y * cosZ;

        // 3. X 軸旋轉 (viewAngleX)
        const radX = (viewAngleX * Math.PI) / 180;
        const cosX = Math.cos(radX);
        const sinX = Math.sin(radX);
        let ry2 = ry * cosX - z * sinX;

        // 4. 加上 zoom 縮放 (只縮放旋轉後的座標，不縮放最外層平移)
        let sx = rx * zoom;
        let sy = ry2 * zoom;

        // 5. 加上最外層 panOffset 平移與 focusOffset 焦點偏移
        let finalX = sx + panOffset.x + focusOffset.x;
        let finalY = sy + panOffset.y + focusOffset.y;

        // 6. 對齊到畫布中心點
        return {
            x: w / 2 + finalX,
            y: d / 2 + finalY
        };
    };

    // WCS 世界坐標轉換 Helper (將米為單位的局部點轉換為相對於包圍盒中心點的世界坐標點，米為單位)
    const toWorldPts = (localPts, layout) => {
        if (!localPts) return [];
        const cosS = Math.cos(layout.rotation || 0);
        const sinS = Math.sin(layout.rotation || 0);
        return localPts.map(p => ({
            x: (layout.x - projectBounds.center.x) + (p.x * cosS - p.y * sinS),
            y: (layout.y - projectBounds.center.y) + (p.x * sinS + p.y * cosS)
        }));
    };

    const [animate, setAnimate] = useState(false);
    // Internal constraint mode state removed (lifted to parent) 
    const [viewMode, setViewMode] = useState('3d');
    const [selectedFloor, setSelectedFloor] = useState(null);
    const [focusOffset, setFocusOffset] = useState({ x: 0, y: 0, z: 0 });
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [showFallingCurve, setShowFallingCurve] = useState(false);
    const [randomSlabEnabled, setRandomSlabEnabled] = useState(false);
    const [randomSlabSeed, setRandomSlabSeed] = useState(0);
    const [unusedPromptKey, setUnusedPromptKey] = useState(null);
    const [showUnusedPrompt, setShowUnusedPrompt] = useState(false);
    const [randomSlabShapeMode, setRandomSlabShapeMode] = useState('all');
    // Task: Unit Settings State
    const [unitSettings, setUnitSettings] = useState({ enabled: false, axis: 'x', ratio: 0.5, gap: 0, mode: 'ratio', count: 2, areaPerUnit: 20 });

    const floorsBelow = Math.max(0, parseInt(inputs.floorsBelow) || 0);
    const [basementState, setBasementState] = useState({});
    const [parkingOn1F, setParkingOn1F] = useState(true);
    const volumeLimit = res.totalCFA;
    const carsPerBasement = (res.basementAreaPerFloor || 0) / (inputs.avgCarArea || 35);
    const recommendedBasementCount = carsPerBasement > 0 ? Math.ceil(res.statutoryParking / carsPerBasement) : 0;

    const [excavationPoints, setExcavationPoints] = useState(null);
    const [excavationCurves, setExcavationCurves] = useState(null);
    const [manualFloorsOverride, setManualFloorsOverride] = useState(null);

    const [frontageIndices, setFrontageIndices] = useState(new Set());
    const [edgeTypes, setEdgeTypes] = useState({});
    const [adjacentLandEnabled, setAdjacentLandEnabled] = useState(false);

    const [view2D, setView2D] = useState({ x: 0, y: 0, k: 1 });
    const inputFloorsAbove = parseFloat(inputs.floorsAbove || 0);
    const targetFloorsAbove = manualFloorsOverride !== null ? manualFloorsOverride : (inputFloorsAbove > 0 ? inputFloorsAbove : res.floorsAbove);
    const floorHeight1F = parseFloat(inputs.floorHeight1F) || 4.2;
    const floorHeightOther = parseFloat(inputs.floorHeightOther) || 3.6;

    const minRandomAreaM2 = toSqm(15);

    const basements = useMemo(() => Array.from({ length: floorsBelow }).map((_, i) => ({ id: `B${i + 1}`, area: res.basementAreaPerFloor, active: true, recommended: (i + 1) <= recommendedBasementCount })), [floorsBelow, res.basementAreaPerFloor, recommendedBasementCount]);
    const activeBasementArea = basements.filter(b => b.active).reduce((acc, b) => acc + b.area, 0);
    const toggleBasement = (id) => { }; // Removed toggle
    const toggleParkingLocation = () => setParkingOn1F(prev => !prev);

    useEffect(() => {
        if (selectedFloor && selectedFloor.id.startsWith('B')) {
            const bNum = parseInt(selectedFloor.id.substring(1));
            if (bNum > floorsBelow) setSelectedFloor(null);
        }
    }, [floorsBelow]);

    useEffect(() => {
        if (basePoints) {
            const scaleRate = Math.sqrt(inputs.excavationRatio / 100);
            const { points: newPts, curves: newCurves } = scalePolygon(basePoints, baseCurves, scaleRate);
            setExcavationPoints(newPts);
            setExcavationCurves(newCurves);
        }
    }, [basePoints, baseCurves, inputs.excavationRatio]);

    useEffect(() => {
        const bw = parseFloat(inputs.baseWidthM);
        const bd = parseFloat(inputs.baseDepthM);
        if (bw > 0 && bd > 0) {
            const newScale3d = Math.min(600 / bw, 600 / bd);
            const currentScale3d = parseFloat(inputs.scale3d);
            if (isNaN(currentScale3d) || Math.abs(currentScale3d - newScale3d) > 0.001) {
                onUpdateInputs('scale3d', parseFloat(newScale3d.toFixed(4)));
            }
        }
    }, [inputs.baseWidthM, inputs.baseDepthM]);

    const toggleConstraints = () => { setIsConstraintMode(!isConstraintMode); if (!isConstraintMode) setShowCheckLines(true); };
    const [rotationZ, setRotationZ] = useState(-45);
    const [viewAngleX, setViewAngleX] = useState(58);
    const [isSettingNorth, setIsSettingNorth] = useState(false);
    const compassRef = useRef(null);
    const [zoom, setZoom] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const lastPinchDist = useRef(null);
    const lastTouchCenter = useRef(null);
    const dragModeRef = useRef(null);
    const viewportRef = useRef(null);
    const [isMobile, setIsMobile] = useState(false);
    const [isSummaryOpen, setIsSummaryOpen] = useState(true);
    const [isProjectSummaryVisible, setIsProjectSummaryVisible] = useState(true);
    const isLandscapeMode = isMobile && !isSummaryOpen;
    const rafRef = useRef(null);

    // Helper: 取得 site 的 basePoints（相容兩種資料結構）
    const getSiteBasePoints = (site) => site.basePoints || site.baseGeometry?.points || null;
    const getSiteBaseCurves = (site) => site.baseCurves || site.baseGeometry?.curves || null;
    const getSiteRoads = (site) => {
        const ownRoads = site?.roads ?? site?.inputs?.roads;
        if (Array.isArray(ownRoads)) return ownRoads;
        const primarySite = (sites || [])[0];
        return primarySite?.roads || primarySite?.inputs?.roads || [];
    };

    // Layout Engine: Calculate world positions for all sites
    const siteLayouts = useMemo(() => {
        const computed = new Map();
        const processed = new Set();
        const safeSites = sites || [];
        const processSite = (siteId) => {
            if (computed.has(siteId)) return computed.get(siteId);
            if (processed.has(siteId)) return { x: 0, y: 0, rotation: 0 }; // Avoid circular
            processed.add(siteId);
            
            const site = safeSites.find(s => s.id === siteId);
            if (!site) return { x: 0, y: 0, rotation: 0 };
            
            // 相容：site 可能沒有 layout 屬性（App 用 position 代替）
            const siteLayout = site.layout || {};
            if (!siteLayout.type || siteLayout.type === 'origin' || !siteLayout.targetId) {
                // 使用 position fallback
                const pos = site.position || { x: 0, y: 0, rotation: 0 };
                const res = { x: pos.x || 0, y: pos.y || 0, rotation: pos.rotation || 0 };
                computed.set(siteId, res);
                return res;
            }
            
            const targetLayout = processSite(siteLayout.targetId);
            const targetSite = safeSites.find(s => s.id === siteLayout.targetId);
            const targetBasePoints = targetSite ? getSiteBasePoints(targetSite) : null;
            if (!targetSite || !targetBasePoints || targetBasePoints.length < 2) {
                const res = { x: 0, y: 0, rotation: 0 };
                computed.set(siteId, res);
                return res;
            }

            const tPts = targetBasePoints;
            const tIdx = siteLayout.targetEdge || 0;
            const tp1 = tPts[tIdx % tPts.length];
            const tp2 = tPts[(tIdx + 1) % tPts.length];
            
            const tMid = { x: (tp1.x + tp2.x) / 2, y: (tp1.y + tp2.y) / 2 };
            const tNormal = getSegmentNormal(tp1, tp2);
            
            const cosTR = Math.cos(targetLayout.rotation);
            const sinTR = Math.sin(targetLayout.rotation);
            const gap = siteLayout.gap || 0;
            
            const contactPointLocal = {
                x: tMid.x + tNormal.x * gap,
                y: tMid.y + tNormal.y * gap
            };
            
            const worldContactX = targetLayout.x + (contactPointLocal.x * cosTR - contactPointLocal.y * sinTR);
            const worldContactY = targetLayout.y + (contactPointLocal.x * sinTR + contactPointLocal.y * cosTR);
            
            const selfPts = getSiteBasePoints(site) || getSiteDefaultRect(site);
            const sp1 = selfPts[0];
            const sp2 = selfPts[1];
            const sMid = { x: (sp1.x + sp2.x) / 2, y: (sp1.y + sp2.y) / 2 };
            const sNormal = getSegmentNormal(sp1, sp2);
            
            const tNormalWorldAngle = Math.atan2(tNormal.y, tNormal.x) + targetLayout.rotation;
            const desiredSelfNormalWorldAngle = tNormalWorldAngle + Math.PI;
            const sNormalLocalAngle = Math.atan2(sNormal.y, sNormal.x);
            
            const selfRotation = desiredSelfNormalWorldAngle - sNormalLocalAngle;
            
            const cosSR = Math.cos(selfRotation);
            const sinSR = Math.sin(selfRotation);
            const worldSelfX = worldContactX - (sMid.x * cosSR - sMid.y * sinSR);
            const worldSelfY = worldContactY - (sMid.x * sinSR + sMid.y * cosSR);

            const res = { x: worldSelfX, y: worldSelfY, rotation: selfRotation };
            computed.set(siteId, res);
            return res;
        };
        
        safeSites.forEach(s => processSite(s.id));
        return computed;
    }, [sites]);

    const canvasSize = isMobile ? (isLandscapeMode ? 320 : 200) : 280;
    
    const projectBounds = useMemo(() => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const safeSites = sites || [];
        safeSites.forEach(site => {
            const layout = siteLayouts.get(site.id) || { x: 0, y: 0, rotation: 0 };
            const pts = getSiteBasePoints(site);
            const curves = getSiteBaseCurves(site);
            const normalized = pts ? normalizeWithCurves(pts, curves) : { points: getSiteDefaultRect(site), curves: null, centroid: {x:0, y:0} };
            if (normalized && normalized.points) {
                normalized.points.forEach(p => {
                    const cos = Math.cos(layout.rotation);
                    const sin = Math.sin(layout.rotation);
                    const wx = layout.x + (p.x * cos - p.y * sin);
                    const wy = layout.y + (p.x * sin + p.y * cos);
                    minX = Math.min(minX, wx);
                    minY = Math.min(minY, wy);
                    maxX = Math.max(maxX, wx);
                    maxY = Math.max(maxY, wy);
                });
            }
        });
        if (minX === Infinity) return { minX: -20, minY: -20, maxX: 20, maxY: 20, center: {x:0, y:0}, width: 40, depth: 40 };
        return {
            minX, minY, maxX, maxY,
            center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
            width: maxX - minX,
            depth: maxY - minY
        };
    }, [sites, siteLayouts]);

    const globalScale = useMemo(() => {
        const manual = parseFloat(projectInputs?.scale3d || inputs.scale3d);
        if (manual > 0) return manual;
        return canvasSize / Math.max(projectBounds.width, projectBounds.depth, 1);
    }, [projectBounds, projectInputs, inputs.scale3d, canvasSize]);

    const scale = globalScale;
    // Unified viewport canvas size for the scene
    const w = Math.max(600, projectBounds.width * scale + 100);
    const d = Math.max(600, projectBounds.depth * scale + 100);

    // Process each site's geometry and massing (Unified for multi-site rendering)
    const processedSites = useMemo(() => {
        const safeSites = sites || [];
        return safeSites.map(site => {
            const siteResultItem = Array.isArray(siteResults) 
                ? siteResults.find(r => r.siteId === site.id) 
                : siteResults?.[site.id];
            const siteResult = siteResultItem?.finalRes || siteResultItem?.results || (activeSiteId === site.id ? res : null);
            if (!siteResult) return null;

            const siteBasePoints = getSiteBasePoints(site);
            const siteBaseCurves = getSiteBaseCurves(site);
            const normalized = siteBasePoints 
                ? normalizeWithCurves(siteBasePoints, siteBaseCurves)
                : { points: getSiteDefaultRect(site), curves: null, centroid: {x:0,y:0} };
            
            const layout = siteLayouts.get(site.id) || { x: 0, y: 0, rotation: 0 };
            
            // Edge identification (consistent with 2D & setback rendering even before basePoints is edited)
            const primaryIndices = new Set();
            const secondaryIndices = new Set();
            const siteRoads = getSiteRoads(site);
            siteRoads.forEach(r => {
                const indices = new Set();
                if (r.edgeIndices) r.edgeIndices.forEach(i => indices.add(i));
                if (r.edgeIndex !== undefined && r.edgeIndex !== "") indices.add(parseInt(r.edgeIndex));
                if (r.type === 'primary') indices.forEach(i => primaryIndices.add(i));
                else indices.forEach(i => secondaryIndices.add(i));
            });
            
            const ptsForEdges = normalized.points || [];
            const edgeCount = ptsForEdges.length;
            const frontIndices = new Set();
            if (site.id === activeSiteId && frontageIndices && frontageIndices.size > 0) {
                frontageIndices.forEach(i => { if (i >= 0 && i < edgeCount) frontIndices.add(i); });
            } else {
                const src = primaryIndices.size > 0 ? primaryIndices : secondaryIndices;
                src.forEach(i => { if (i >= 0 && i < edgeCount) frontIndices.add(i); });
            }
            if (frontIndices.size === 0 && edgeCount >= 3) {
                frontIndices.add(Math.min(2, edgeCount - 1));
            }

            const combinedEdgeTypes = {};
            if (site.id === activeSiteId && edgeTypes) {
                Object.keys(edgeTypes).forEach(k => {
                    const idx = parseInt(k);
                    if (!Number.isNaN(idx) && idx >= 0 && idx < edgeCount && !frontIndices.has(idx)) {
                        combinedEdgeTypes[idx] = edgeTypes[k];
                    }
                });
            }
            ptsForEdges.forEach((_, i) => {
                if (!frontIndices.has(i) && !combinedEdgeTypes[i]) {
                    if (secondaryIndices.has(i)) combinedEdgeTypes[i] = 'side';
                }
            });

            // Auto-detect back & side edges when not explicitly set so massing never shifts off-center before editing site
            const siteIn = site.inputs || inputs;
            const sSideM = parseFloat(siteIn.sideYardDepth) || 0;
            const sSideDir = siteIn.sideYardDirection || 'right';
            const hasExplicitBack = Object.values(combinedEdgeTypes).includes('back');
            if ((!hasExplicitBack || sSideM > 0) && ptsForEdges.length > 2 && frontIndices.size > 0) {
                const centroid = getPolygonCentroid(ptsForEdges);
                let frontNormal = { x: 0, y: 0 };
                let count = 0;
                ptsForEdges.forEach((p, i) => {
                    if (frontIndices.has(i)) {
                        const p2 = ptsForEdges[(i + 1) % ptsForEdges.length];
                        const n = getSegmentNormal(p, p2, centroid);
                        frontNormal.x += n.x;
                        frontNormal.y += n.y;
                        count++;
                    }
                });
                if (count > 0) {
                    const len = Math.hypot(frontNormal.x, frontNormal.y);
                    if (len > 0) {
                        frontNormal.x /= len;
                        frontNormal.y /= len;
                        if (!hasExplicitBack) {
                            let bestBackIdx = -1;
                            let minDot = -0.25;
                            ptsForEdges.forEach((p, i) => {
                                if (!frontIndices.has(i) && !combinedEdgeTypes[i]) {
                                    const p2 = ptsForEdges[(i + 1) % ptsForEdges.length];
                                    const n = getSegmentNormal(p, p2, centroid);
                                    const dot = n.x * frontNormal.x + n.y * frontNormal.y;
                                    if (dot < minDot) {
                                        minDot = dot;
                                        bestBackIdx = i;
                                    }
                                }
                            });
                            if (bestBackIdx !== -1) combinedEdgeTypes[bestBackIdx] = 'back';
                        }
                        const hasExplicitSide = Object.values(combinedEdgeTypes).includes('side');
                        if (!hasExplicitSide && sSideM > 0) {
                            const desiredSign = sSideDir === 'left' ? 1 : -1;
                            const candidates = [];
                            ptsForEdges.forEach((p, i) => {
                                if (frontIndices.has(i) || combinedEdgeTypes[i]) return;
                                const p2 = ptsForEdges[(i + 1) % ptsForEdges.length];
                                const n = getSegmentNormal(p, p2, centroid);
                                const dot = n.x * frontNormal.x + n.y * frontNormal.y;
                                const cross = frontNormal.x * n.y - frontNormal.y * n.x;
                                candidates.push({ origIdx: i, dot, cross });
                            });
                            let selected = candidates
                                .filter(c => desiredSign * c.cross > 0)
                                .sort((a, b) => Math.abs(a.dot) - Math.abs(b.dot));
                            if (selected.length > 0) {
                                combinedEdgeTypes[selected[0].origIdx] = 'side';
                            }
                        }
                    }
                }
            }

            // We wrap buildMassingLayers logic in a helper that can be called per site
            const massing = buildMassingLayersForSite(site, siteResult, normalized, frontIndices, combinedEdgeTypes);
            
            return {
                site,
                layout,
                res: siteResult,
                normalized,
                massing,
                frontIndices,
                combinedEdgeTypes
            };
        }).filter(Boolean);
    }, [sites, siteResults, res, activeSiteId, siteLayouts, frontageIndices, edgeTypes, unitSettings, showCheckLines, showHeightRatio, showWeiLao, showBackyard, isConstraintMode, manualFloorsOverride, randomSlabEnabled, randomSlabSeed, randomSlabShapeMode, showFallingCurve]);

    // Helper to build massing for a specific site
    // Helper: 為指定 site 建立量體層
    function buildMassingLayersForSite(site, siteRes, normalizedData, siteEffectiveFrontIndices, siteCombinedEdgeTypes) {
        const siteInputs = site.inputs || inputs;
        const inputFloorsAboveVal = parseFloat(siteInputs.floorsAbove || 0);
        const targetFAbove = (site.id === activeSiteId && manualFloorsOverride !== null) 
            ? manualFloorsOverride : (inputFloorsAboveVal > 0 ? inputFloorsAboveVal : (siteRes.floorsAbove || 4));
        return buildMassingLayers(siteRes, site, normalizedData, siteEffectiveFrontIndices, siteCombinedEdgeTypes, targetFAbove);
    }

    useEffect(() => { const checkMobile = () => setIsMobile(window.innerWidth < 768); checkMobile(); window.addEventListener('resize', checkMobile); return () => window.removeEventListener('resize', checkMobile); }, []);
    useEffect(() => { if (isMobile) { setIsSummaryOpen(false); setIsProjectSummaryVisible(true); } }, [isMobile]);
    useEffect(() => { setAnimate(true); const timer = setTimeout(() => setAnimate(false), 1000); return () => clearTimeout(timer); }, [res.floorsAbove]);

    useEffect(() => {
        const element = viewportRef.current;
        if (!element) return;
        const handleNativeWheel = (e) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            const sensitivity = 0.002;
            const delta = -e.deltaY * sensitivity;

            if (viewMode === '2d') {
                setView2D(v => {
                    const newK = Math.min(5, Math.max(0.5, v.k + delta * 200)); // Adjusted sensitivity for 2D
                    return { ...v, k: newK };
                });
            } else {
                setZoom(prev => Math.min(3, Math.max(0.2, prev + delta)));
            }
        };
        element.addEventListener('wheel', handleNativeWheel, { passive: false });
        return () => element.removeEventListener('wheel', handleNativeWheel);
    }, [viewMode]);

    const getTouchDistance = (touches) => Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
    const getTouchCenter = (touches) => ({ x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 });
    const handleMouseDown = (e) => {
        if (viewMode === '2d') return;
        if (e.button === 1) {
            e.preventDefault();
            dragModeRef.current = 'rotate';
        } else if (e.button === 0) {
            dragModeRef.current = 'pan';
        } else {
            return;
        }
        setIsDragging(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };
    const updateNorthFromEvent = (e) => {
        if (!compassRef.current) return;
        const rect = compassRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        if (angle < 0) angle += 360;
        onUpdateInputs('northAngle', parseFloat(angle.toFixed(1)));
    };
    const handleCompassPointerDown = (e) => {
        e.stopPropagation();
        if (e.currentTarget?.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
        setViewAngleX(90);
        setIsSettingNorth(true);
        updateNorthFromEvent(e);
    };
    const handleCompassPointerMove = (e) => {
        if (!isSettingNorth) return;
        e.stopPropagation();
        updateNorthFromEvent(e);
    };
    const handleCompassPointerUp = (e) => {
        if (e.currentTarget?.releasePointerCapture) e.currentTarget.releasePointerCapture(e.pointerId);
        setIsSettingNorth(false);
    };
    const handleTouchStart = (e) => {
        if (viewMode === '2d') {
            if (e.touches.length === 2) { lastPinchDist.current = getTouchDistance(e.touches); }
            return;
        }
        if (e.touches.length === 2) {
            lastPinchDist.current = getTouchDistance(e.touches);
            lastTouchCenter.current = getTouchCenter(e.touches);
            dragModeRef.current = 'pan';
            setIsDragging(true);
        } else if (e.touches.length === 1) {
            dragModeRef.current = 'rotate';
            setIsDragging(true);
            lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    };
    const handleMouseMove = (e) => {
        // Placement Mode logic
        if (placementMode === 'independent' && viewportRef.current) {
            const rect = viewportRef.current.getBoundingClientRect();
            // Simple mapping from screen to 3D center at Z=0
            const rawX = e.clientX - rect.left - rect.width / 2;
            const rawY = e.clientY - rect.top - rect.height / 2;
            
            // Undo transforms (approximation)
            const rZ = -rotationZ * Math.PI / 180;
            const sX = rawX / zoom;
            const rX = viewAngleX * Math.PI / 180;
            const sY = (rawY / zoom) / Math.cos(rX);
            
            // Un-rotate Z
            let worldX = sX * Math.cos(rZ) - sY * Math.sin(rZ);
            let worldY = sX * Math.sin(rZ) + sY * Math.cos(rZ);
            
            worldX = worldX - panOffset.x;
            worldY = worldY - panOffset.y;
            
            // World coordinate mapping relative to scale
            let mapX = worldX / globalScale;
            let mapY = worldY / globalScale;
            
            // Auto-snapping & Collision Detection (精準吸附與重疊檢測，支援弧線邊界與道路自適應)
            const activeSite = sites.find(s => s.id === activeSiteId) || sites[0];
            const lotArea = Array.isArray(activeSite?.lots)
                ? activeSite.lots.reduce((acc, l) => acc + (parseFloat(l.area) || 0), 0)
                : 0;
            const initArea = lotArea || 239.12;
            const newW = Math.sqrt(initArea);
            const newD = initArea / newW;
            
            // 收集所有可以吸附的邊段 (Collect snap segments, including curve info & extended roads)
            const snapSegments = [];
            const roadWorldPolygons = [];

            for (const s of sites) {
                if (s.id === activeSiteId && sites.length === 1) continue;
                
                const sLayout = siteLayouts.get(s.id) || { x: s.position?.x || 0, y: s.position?.y || 0, rotation: 0 };
                const sNorm = getSiteNormalizedData(s);
                const ptsLocal = sNorm.points || [];
                const curvesLocal = sNorm.curves || [];
                if (ptsLocal.length < 3) continue;

                const cosS = Math.cos(sLayout.rotation);
                const sinS = Math.sin(sLayout.rotation);
                const toWorld = (p) => ({
                    x: sLayout.x + (p.x * cosS - p.y * sinS),
                    y: sLayout.y + (p.x * sinS + p.y * cosS)
                });

                const ptsWorld = ptsLocal.map(toWorld);
                const curvesWorld = Array.isArray(curvesLocal)
                    ? curvesLocal.map(c => c ? toWorld(c) : null)
                    : ptsLocal.map((_, idx) => curvesLocal?.[idx] ? toWorld(curvesLocal[idx]) : null);
                const centroidWorld = getPolygonCentroid(ptsWorld);
                const sRoads = getSiteRoads(s);

                for (let i = 0; i < ptsWorld.length; i++) {
                    const p1 = ptsWorld[i];
                    const p2 = ptsWorld[(i + 1) % ptsWorld.length];
                    const ctrl = curvesWorld[i];
                    const roadOnEdge = sRoads.find(r => r.edgeIndex === i || r.edgeIndices?.includes(i));
                    const rw = roadOnEdge ? (parseFloat(roadOnEdge.width) || 0) : 0;

                    const inN = getSegmentNormal(p1, p2, centroidWorld);
                    const outN = { x: -inN.x, y: -inN.y };

                    // 1. 基地邊段（若該邊無道路，可直接吸附基地邊；若有道路，吸附道路外側邊及延伸段）
                    if (rw <= 0.01) {
                        snapSegments.push({
                            p1,
                            p2,
                            ctrl,
                            outN
                        });
                    } else {
                        const roadOutP1 = { x: p1.x + outN.x * rw, y: p1.y + outN.y * rw };
                        const roadOutP2 = { x: p2.x + outN.x * rw, y: p2.y + outN.y * rw };
                        const roadOutCtrl = ctrl ? { x: ctrl.x + outN.x * rw, y: ctrl.y + outN.y * rw } : null;
                        snapSegments.push({
                            p1: roadOutP1,
                            p2: roadOutP2,
                            ctrl: roadOutCtrl,
                            outN
                        });

                        // 建構弧形道路世界多邊形（含兩端 50m 延伸段）供重疊檢查與對齊
                        const steps = ctrl ? 18 : 1;
                        const samplePts = [];
                        for (let st = 0; st <= steps; st++) {
                            const t = st / steps;
                            const mt = 1 - t;
                            const bx = ctrl ? (mt * mt * p1.x + 2 * mt * t * ctrl.x + t * t * p2.x) : (p1.x + (p2.x - p1.x) * t);
                            const by = ctrl ? (mt * mt * p1.y + 2 * mt * t * ctrl.y + t * t * p2.y) : (p1.y + (p2.y - p1.y) * t);
                            samplePts.push({ x: bx, y: by });
                        }
                        const EXT_LEN = 50;
                        const fullChain = [...samplePts];
                        if (samplePts.length >= 2) {
                            const s0 = samplePts[0];
                            const s1 = samplePts[1];
                            const dStart = { x: s1.x - s0.x, y: s1.y - s0.y };
                            const lStart = Math.hypot(dStart.x, dStart.y);
                            if (lStart > 1e-6) {
                                const extStart = { x: s0.x - (dStart.x / lStart) * EXT_LEN, y: s0.y - (dStart.y / lStart) * EXT_LEN };
                                fullChain.unshift(extStart);
                                const extInN = getSegmentNormal(extStart, s0, centroidWorld);
                                snapSegments.push({ p1: extStart, p2: s0, ctrl: null, outN: extInN });
                            }
                            const sn = samplePts[samplePts.length - 1];
                            const sn1 = samplePts[samplePts.length - 2];
                            const dEnd = { x: sn.x - sn1.x, y: sn.y - sn1.y };
                            const lEnd = Math.hypot(dEnd.x, dEnd.y);
                            if (lEnd > 1e-6) {
                                const extEnd = { x: sn.x + (dEnd.x / lEnd) * EXT_LEN, y: sn.y + (dEnd.y / lEnd) * EXT_LEN };
                                fullChain.push(extEnd);
                                const extInN = getSegmentNormal(sn, extEnd, centroidWorld);
                                snapSegments.push({ p1: sn, p2: extEnd, ctrl: null, outN: extInN });
                            }
                        }
                        const outerArc = fullChain.map(pt => ({ x: pt.x + outN.x * rw, y: pt.y + outN.y * rw }));
                        roadWorldPolygons.push([...fullChain, ...outerArc.reverse()]);
                    }
                }
            }

            let snapped = false;
            let snapX = mapX;
            let snapY = mapY;
            let snapRotation = 0;
            let adaptedPoints = null;
            let adaptedCurves = null;
            const snapThreshold = 4.5 / globalScale;

            for (const seg of snapSegments) {
                const dist = distToSegment({ x: mapX, y: mapY }, seg.p1, seg.p2);
                if (dist < snapThreshold) {
                    snapped = true;
                    const dx = seg.p2.x - seg.p1.x;
                    const dy = seg.p2.y - seg.p1.y;
                    const L = Math.sqrt(dx * dx + dy * dy) || 1;
                    let nx = seg.outN ? seg.outN.x : -dy / L;
                    let ny = seg.outN ? seg.outN.y : dx / L;

                    if (seg.ctrl) {
                        // 當吸附邊有弧線時，僅貼合邊 (Edge 2: V2->V3) 配合弧線，其餘三邊維持初始直線矩形
                        const v3_FL = { x: seg.p1.x, y: seg.p1.y };
                        const v2_FR = { x: seg.p2.x, y: seg.p2.y };
                        const v1_BR = { x: seg.p2.x + nx * newD, y: seg.p2.y + ny * newD };
                        const v0_BL = { x: seg.p1.x + nx * newD, y: seg.p1.y + ny * newD };
                        const worldPoly = [v0_BL, v1_BR, v2_FR, v3_FL];
                        const center = getPolygonCentroid(worldPoly);
                        snapX = center.x;
                        snapY = center.y;
                        snapRotation = 0;
                        adaptedPoints = worldPoly.map(p => ({ x: p.x - center.x, y: p.y - center.y }));
                        adaptedCurves = {
                            2: { x: seg.ctrl.x - center.x, y: seg.ctrl.y - center.y }
                        };
                    } else {
                        const l2 = (seg.p1.x - seg.p2.x) ** 2 + (seg.p1.y - seg.p2.y) ** 2;
                        let t = 0.5;
                        if (l2 > 0.0001) {
                            t = ((mapX - seg.p1.x) * (seg.p2.x - seg.p1.x) + (mapY - seg.p1.y) * (seg.p2.y - seg.p1.y)) / l2;
                            t = Math.max(0, Math.min(1, t));
                        }
                        snapX = seg.p1.x + t * (seg.p2.x - seg.p1.x);
                        snapY = seg.p1.y + t * (seg.p2.y - seg.p1.y);
                        if (nx * (mapX - snapX) + ny * (mapY - snapY) < 0) {
                            nx = -nx;
                            ny = -ny;
                        }
                        snapX = snapX + nx * (newD / 2 + 0.05);
                        snapY = snapY + ny * (newD / 2 + 0.05);
                        snapRotation = Math.atan2(ny, nx) - Math.PI / 2;
                    }
                    break;
                }
            }

            const shrinkPolygonTowardCentroid = (poly, inset = 0.12) => {
                if (!poly || poly.length < 3) return poly;
                const c = getPolygonCentroid(poly);
                return poly.map(p => {
                    const vx = p.x - c.x;
                    const vy = p.y - c.y;
                    const d = Math.hypot(vx, vy);
                    const factor = d > inset ? (d - inset) / d : 0.9;
                    return { x: c.x + vx * factor, y: c.y + vy * factor };
                });
            };

            const checkOverlapLocal = (rawPolyA, rawPolyB) => {
                const polyA = shrinkPolygonTowardCentroid(rawPolyA, 0.12);
                const polyB = shrinkPolygonTowardCentroid(rawPolyB, 0.12);
                const segmentsIntersect = (p1, p2, p3, p4) => {
                    const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
                    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
                };
                for (let i = 0; i < polyA.length; i++) {
                    const a1 = polyA[i];
                    const a2 = polyA[(i + 1) % polyA.length];
                    for (let j = 0; j < polyB.length; j++) {
                        const b1 = polyB[j];
                        const b2 = polyB[(j + 1) % polyB.length];
                        if (segmentsIntersect(a1, a2, b1, b2)) return true;
                    }
                }
                const isPointInPolygon = (pt, poly) => {
                    let inside = false;
                    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                        const xi = poly[i].x, yi = poly[i].y;
                        const xj = poly[j].x, yj = poly[j].y;
                        const intersect = ((yi > pt.y) !== (yj > pt.y))
                            && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
                        if (intersect) inside = !inside;
                    }
                    return inside;
                };
                if (polyA.length > 0 && isPointInPolygon(polyA[0], polyB)) return true;
                if (polyB.length > 0 && isPointInPolygon(polyB[0], polyA)) return true;
                if (polyA.length > 0 && isPointInPolygon(getPolygonCentroid(polyA), polyB)) return true;
                if (polyB.length > 0 && isPointInPolygon(getPolygonCentroid(polyB), polyA)) return true;
                return false;
            };

            const previewLocalPts = adaptedPoints || [
                { x: -newW/2, y: -newD/2 },
                { x: newW/2, y: -newD/2 },
                { x: newW/2, y: newD/2 },
                { x: -newW/2, y: newD/2 }
            ];
            const previewDiscretized = adaptedCurves
                ? discretizePolygon(previewLocalPts, adaptedCurves, 14).points
                : previewLocalPts;
            const cosP = Math.cos(snapRotation);
            const sinP = Math.sin(snapRotation);
            const worldPtsPreview = previewDiscretized.map(p => ({
                x: snapX + (p.x * cosP - p.y * sinP),
                y: snapY + (p.x * sinP + p.y * cosP)
            }));

            let isOverlapping = false;
            for (const s of sites) {
                if (s.id === activeSiteId && sites.length === 1) continue;
                
                const sLayout = siteLayouts.get(s.id) || { x: s.position?.x || 0, y: s.position?.y || 0, rotation: 0 };
                const sNorm = getSiteNormalizedData(s);
                const sDisc = discretizePolygon(sNorm.points || [], sNorm.curves || [], 14).points;
                const cosS = Math.cos(sLayout.rotation);
                const sinS = Math.sin(sLayout.rotation);
                const worldPtsS = sDisc.map(p => ({
                    x: sLayout.x + (p.x * cosS - p.y * sinS),
                    y: sLayout.y + (p.x * sinS + p.y * cosS)
                }));

                if (checkOverlapLocal(worldPtsPreview, worldPtsS)) {
                    isOverlapping = true;
                    break;
                }
            }

            // 納入所有道路（含曲線道路）重疊檢查
            if (!isOverlapping) {
                for (const rPoly of roadWorldPolygons) {
                    if (checkOverlapLocal(worldPtsPreview, rPoly)) {
                        isOverlapping = true;
                        break;
                    }
                }
            }
            
            setPlacementPreview({ 
                x: snapX, 
                y: snapY, 
                rotation: snapRotation, 
                isSnapped: snapped, 
                width: newW, 
                depth: newD,
                adaptedPoints,
                adaptedCurves,
                isOverlapping: isOverlapping
            });
            setPlacementOffset({
                x: snapX,
                y: snapY,
                rotation: snapRotation,
                adaptedPoints,
                adaptedCurves
            });
        }

        if (!isDragging) return;
        const deltaX = e.clientX - lastMousePos.current.x;
        const deltaY = e.clientY - lastMousePos.current.y;
        let effectiveDeltaX = isLandscapeMode ? deltaY : deltaX;
        let effectiveDeltaY = isLandscapeMode ? -deltaX : deltaY;
        if (dragModeRef.current === 'rotate') {
            setRotationZ(prev => prev + effectiveDeltaX * 0.5);
            setViewAngleX(prev => Math.min(85, Math.max(10, prev - effectiveDeltaY * 0.5)));
        } else if (dragModeRef.current === 'pan') {
            setPanOffset(prev => ({ x: prev.x + effectiveDeltaX, y: prev.y + effectiveDeltaY }));
        }
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };
    const handleTouchMove = (e) => {
        if (e.touches.length === 2 && lastPinchDist.current !== null) {
            const currentDist = getTouchDistance(e.touches);
            const currentCenter = getTouchCenter(e.touches);
            const delta = currentDist - lastPinchDist.current;
            if (viewMode === '2d') {
                setView2D(v => ({ ...v, k: Math.min(5, Math.max(0.5, v.k + delta * 0.005)) }));
            } else if (Math.abs(delta) > 1.5) {
                setZoom(prev => Math.min(3, Math.max(0.2, prev + delta * 0.005)));
            }
            if (lastTouchCenter.current) {
                const dX = currentCenter.x - lastTouchCenter.current.x;
                const dY = currentCenter.y - lastTouchCenter.current.y;
                let effectiveDeltaX = isLandscapeMode ? dY : dX;
                let effectiveDeltaY = isLandscapeMode ? -dX : dY;
                setPanOffset(prev => ({ x: prev.x + effectiveDeltaX, y: prev.y + effectiveDeltaY }));
            }
            lastPinchDist.current = currentDist;
            lastTouchCenter.current = currentCenter;
            return;
        }
        if (!isDragging || e.touches.length !== 1) return;
        if (rafRef.current) return;
                const clientX = e.touches[0].clientX; const clientY = e.touches[0].clientY;
                rafRef.current = requestAnimationFrame(() => {
                    const deltaX = clientX - lastMousePos.current.x; const deltaY = clientY - lastMousePos.current.y; let effectiveDeltaX = isLandscapeMode ? deltaY : deltaX; let effectiveDeltaY = isLandscapeMode ? -deltaX : deltaY; setRotationZ(prev => prev + effectiveDeltaX * 0.5); setViewAngleX(prev => Math.min(85, Math.max(10, prev - effectiveDeltaY * 0.5))); lastMousePos.current = { x: clientX, y: clientY }; rafRef.current = null;
                });
            };
            const handleMouseUp = () => { setIsDragging(false); lastPinchDist.current = null; lastTouchCenter.current = null; dragModeRef.current = null; };
            const handleZoomIn = () => { if (viewMode === '2d') { setView2D(v => ({ ...v, k: Math.min(5, v.k * 1.2) })); } else { setZoom(prev => Math.min(3, prev + 0.2)); } };
            const handleZoomOut = () => { if (viewMode === '2d') { setView2D(v => ({ ...v, k: Math.max(0.5, v.k / 1.2) })); } else { setZoom(prev => Math.max(0.2, prev - 0.2)); } };
            const handleLayerClick = (e, layer) => {
                e.stopPropagation();
                if (selectedFloor && selectedFloor.id === layer.id) {
                    setSelectedFloor(null);
                    setFocusOffset({ x: 0, y: 0, z: 0 });
                    setZoom(1);
                    return;
                }
                const baseId = (layer.id && layer.id.includes('-')) ? layer.id.split('-')[0] : layer.id;
                const settings = floorSettings[layer.id] || floorSettings[baseId] || {};
                setSelectedFloor({
                    ...layer,
                    rotation: layer.rotation || 0,
                    pivot: settings.pivot || { x: 0, y: 0 },
                    alignment: settings.alignment || { x: 'left', y: 'back' },
                    violations: layer.violations || [],
                    points: settings.points || layer.unsplitPoints || layer.points || null,
                    curves: settings.curves || layer.unsplitCurves || layer.curves || null
                });

                // 計算選中樓層在 3D 場景中的真實中心座標，使視角中心精準對準該樓層
                const activeLayout = siteLayouts.get(activeSiteId) || { x: 0, y: 0, rotation: 0 };
                const siteOffsetX = (activeLayout.x - projectBounds.center.x) * scale;
                const siteOffsetY = (activeLayout.y - projectBounds.center.y) * scale;

                let localCenterX = layer.shiftX || 0;
                let localCenterY = layer.shiftYPx || 0;
                if (layer.points && layer.points.length >= 3) {
                    const polyCenter = getPolygonCentroid(layer.points);
                    const rotRad = ((layer.rotation || 0) * Math.PI) / 180;
                    const cosR = Math.cos(rotRad);
                    const sinR = Math.sin(rotRad);
                    localCenterX += (polyCenter.x * cosR - polyCenter.y * sinR) * scale;
                    localCenterY += (polyCenter.x * sinR + polyCenter.y * cosR) * scale;
                }

                const cosS = Math.cos(activeLayout.rotation || 0);
                const sinS = Math.sin(activeLayout.rotation || 0);
                const worldFloorX = siteOffsetX + (localCenterX * cosS - localCenterY * sinS);
                const worldFloorY = siteOffsetY + (localCenterX * sinS + localCenterY * cosS);
                const targetZ = (layer.z || 0) + (layer.height || 0) * 0.5;

                setPanOffset({ x: 0, y: 0 });
                setFocusOffset({ x: -worldFloorX, y: -worldFloorY, z: -targetZ });

                // 以約 6 層樓高的垂直範圍與當層平面投影動態計算鏡頭縮放距離，避免拉得太近
                const viewportH = viewportRef.current?.clientHeight || window.innerHeight || 800;
                const viewportW = viewportRef.current?.clientWidth || window.innerWidth || 1200;
                const fH = parseFloat(inputs.floorHeightOther) || 3.6;
                const sixFloorsHeightPx = 6 * fH * scale;
                const radX = (viewAngleX * Math.PI) / 180;
                const footprintSpanPx = Math.max(layer.widthPx || baseWidthM * scale, layer.depthPx || baseDepthM * scale);
                const projected6FloorsSpanY = sixFloorsHeightPx * Math.sin(radX) + footprintSpanPx * Math.cos(radX) * 0.65;
                const projectedSpanX = footprintSpanPx * 1.25;
                const zoomFor6FloorsY = (viewportH * 0.68) / Math.max(projected6FloorsSpanY, 1);
                const zoomFor6FloorsX = (viewportW * 0.65) / Math.max(projectedSpanX, 1);
                const targetZoom = Math.min(1.25, Math.max(0.45, Math.min(zoomFor6FloorsY, zoomFor6FloorsX)));
                setZoom(targetZoom);
            };
            const handleBgClick = () => {
                if (selectedFloor) {
                    setSelectedFloor(null);
                    setFocusOffset({ x: 0, y: 0, z: 0 });
                    setZoom(1);
                }
            };
            const toggleFullscreen = () => { if (isSummaryOpen) { setIsSummaryOpen(false); } else { setIsSummaryOpen(true); } };

            // 更新樓層設定 (Update floor settings)
            // 處理來自平面分析區的數據更新 (Handle data updates from 2D analysis)
            const updateFloorSetting = (rawFloorId, field, value) => {
                const floorId = (rawFloorId && rawFloorId !== 'base' && rawFloorId !== 'excavation' && !/^B\d+$/.test(rawFloorId) && rawFloorId.includes('-'))
                    ? rawFloorId.split('-')[0]
                    : rawFloorId;
                if (isConstraintMode && !(floorId && floorId.startsWith('B'))) return;
                if (floorId === 'base') {
                    const resetFloorOverridesOnBaseChange = () => {
                        setFloorSettings(prev => {
                            const next = { ...prev };
                            Object.keys(next).forEach(k => {
                                if (k !== 'base' && next[k]) {
                                    const updated = { ...next[k] };
                                    delete updated.points;
                                    delete updated.curves;
                                    delete updated.units;
                                    delete updated.splitBasePoints;
                                    delete updated.splitBaseCurves;
                                    delete updated.manualArea;
                                    delete updated.manualDim;
                                    delete updated.width;
                                    delete updated.depth;
                                    delete updated.offset;
                                    delete updated.rotation;
                                    delete updated.pivot;
                                    delete updated.alignment;
                                    next[k] = updated;
                                }
                            });
                            return next;
                        });
                        setExcavationPoints(null);
                        setExcavationCurves(null);
                    };

                    if (field === 'points') {
                        setBasePoints(value);
                        if (value) {
                            resetFloorOverridesOnBaseChange();
                        }
                    } else if (field === 'curves') {
                        setBaseCurves(value);
                        resetFloorOverridesOnBaseChange();
                    } else if (field === 'reset') {
                        setBasePoints(null);
                        setBaseCurves(null);
                        setFrontageIndices(new Set());
                        setEdgeTypes({});
                        resetFloorOverridesOnBaseChange();
                    }
                    return;
                }
                if (floorId === 'excavation') {
                    if (field === 'points') setExcavationPoints(value);
                    if (field === 'curves') setExcavationCurves(value);
                    if (field === 'reset') { setExcavationPoints(null); setExcavationCurves(null); }
                    return;
                }
                if (field === 'reset') {
                    setFloorSettings(prev => {
                        const copy = { ...prev };
                        delete copy[floorId];
                        return copy;
                    });
                    return;
                }
                setFloorSettings(prev => {
                    const current = prev[floorId] || {};
                    let newData = { ...current };
                    if (field.startsWith('align_')) {
                        const axis = field.split('_')[1];
                        const alignment = { ...(current.alignment || { x: 'left', y: 'back' }), [axis]: value };
                        newData.alignment = alignment;
                    } else if (field.startsWith('pivot')) {
                        const axis = field === 'pivotX' ? 'x' : 'y';
                        const pivot = { ...(current.pivot || { x: 0, y: 0 }), [axis]: value };
                        newData.pivot = pivot;
                    } else if (field === 'area') {
                        newData.area = value;
                        newData.manualArea = true;
                    } else if (field === 'points') {
                        if (value && value.length >= 3) {
                            let area = calculatePolygonArea(value, newData.curves);
                            newData.area = area;
                            newData.manualArea = true;
                        }
                        newData.points = value;
                        newData.splitBasePoints = value;
                    } else if (field === 'curves') {
                        newData.curves = value;
                        newData.splitBaseCurves = value;
                        if (newData.points && newData.points.length >= 3) {
                            newData.area = calculatePolygonArea(newData.points, value);
                        }
                    } else if (field === 'unitConfig') {
                        if (value) {
                            newData.unitConfig = value;
                        } else {
                            delete newData.unitConfig;
                        }
                    } else if (field === 'units') {
                        if (value && value.length > 0) {
                            newData.units = value;
                            if (!newData.splitBasePoints && newData.points) {
                                newData.splitBasePoints = newData.points;
                            }
                        } else {
                            delete newData.units;
                            delete newData.unitConfig;
                            const cleanedAll = { ...prev, [floorId]: newData };
                            Object.keys(cleanedAll).forEach(k => {
                                if (/^\d+F$/.test(k) && cleanedAll[k]) {
                                    const copyF = { ...cleanedAll[k] };
                                    delete copyF.units;
                                    delete copyF.unitConfig;
                                    cleanedAll[k] = copyF;
                                }
                            });
                            return cleanedAll;
                        }
                    } else if (field === 'offset_delta') {
                        const currentOff = current.offset || { x: 0, y: 0 };
                        newData.offset = { x: currentOff.x + value.x, y: currentOff.y + value.y };
                    } else {
                        newData[field] = value;
                        if (field === 'width' || field === 'depth') newData.manualDim = true;
                    }
                    return { ...prev, [floorId]: newData };
                });
            };

            const handleBaseEditEnd = (floorId, points) => {
                if (floorId === 'base' && points) {
                    const normalized = normalizeWithCurves(points, baseCurves);
                    if (normalized.points) {
                        setBasePoints(normalized.points);
                        setBaseCurves(normalized.curves);
                    }
                    const shift = normalized.centroid || { x: 0, y: 0 };
                    if (Math.abs(shift.x) > 0.0001 || Math.abs(shift.y) > 0.0001) {
                        setFloorSettings(prev => {
                            const next = { ...prev };
                            let changed = false;
                            Object.keys(next).forEach(k => {
                                if (k === 'base') return;
                                const cur = next[k];
                                if (!cur) return;
                                let updated = null;
                                if (cur.points && cur.points.length > 0) {
                                    const shiftedPoints = cur.points.map(p => ({ x: p.x - shift.x, y: p.y - shift.y }));
                                    updated = { ...(updated || cur), points: shiftedPoints };
                                }
                                if (cur.splitBasePoints && cur.splitBasePoints.length > 0) {
                                    const shiftedSplitBase = cur.splitBasePoints.map(p => ({ x: p.x - shift.x, y: p.y - shift.y }));
                                    updated = { ...(updated || cur), splitBasePoints: shiftedSplitBase };
                                }
                                if (cur.units && cur.units.length > 0) {
                                    const shiftedUnits = cur.units.map(uPts => uPts.map(p => ({ x: p.x - shift.x, y: p.y - shift.y })));
                                    updated = { ...(updated || cur), units: shiftedUnits };
                                }
                                if (cur.curves) {
                                    const shiftedCurves = {};
                                    Object.keys(cur.curves).forEach(idx => {
                                        const cp = cur.curves[idx];
                                        shiftedCurves[idx] = { x: cp.x - shift.x, y: cp.y - shift.y };
                                    });
                                    updated = { ...(updated || cur), curves: shiftedCurves };
                                }
                                if (updated) {
                                    next[k] = updated;
                                    changed = true;
                                }
                            });
                            return changed ? next : prev;
                        });
                        setExcavationPoints(prev => {
                            if (!prev || prev.length === 0) return prev;
                            return prev.map(p => ({ x: p.x - shift.x, y: p.y - shift.y }));
                        });
                        setExcavationCurves(prev => {
                            if (!prev) return prev;
                            const next = {};
                            Object.keys(prev).forEach(k => {
                                const cp = prev[k];
                                next[k] = { x: cp.x - shift.x, y: cp.y - shift.y };
                            });
                            return next;
                        });
                    }
                    const area = calculatePolygonArea(points, baseCurves);
                    const currentArea = parseFloat(inputs.baseArea || 0);
                    if (Math.abs(area - currentArea) > 0.01) {
                        onUpdateBaseDim('baseArea', parseFloat(area.toFixed(2)));
                    }
                    const xs = points.map(p => p.x); const w = Math.max(...xs) - Math.min(...xs);
                    const currentW = parseFloat(inputs.baseWidth || 0);
                    if (Math.abs(w - currentW) > 0.01) {
                        onUpdateInputs('baseWidth', parseFloat(w.toFixed(2)));
                    }
                    const bounds = getPolygonBounds(points);
                    if (bounds) {
                        const baseWidthM = bounds.maxX - bounds.minX;
                        const baseDepthM = bounds.maxY - bounds.minY;
                        onUpdateInputs('baseWidthM', parseFloat(baseWidthM.toFixed(2)));
                        onUpdateInputs('baseDepthM', parseFloat(baseDepthM.toFixed(2)));
                    }
                }
            };

    const resetFloor = (floorId) => {
        const baseId = (floorId && floorId.includes('-')) ? floorId.split('-')[0] : floorId;
        setFloorSettings(prev => {
            const copy = { ...prev };
            delete copy[floorId];
            delete copy[baseId];
            return copy;
        });
    };

    const updateEdgeTypes = (index, type) => { setEdgeTypes(prev => { if (index === null && typeof type === 'object') { return type; } const next = { ...prev }; if (next[index] === type) { delete next[index]; } else { next[index] = type; } return next; }); };


    // Shorthands for active site (backward compatibility for some components)
    const activeDefaultDims = getSiteDefaultDims(activeSite);
    const baseWidthM = activeDefaultDims.w;
    const baseDepthM = activeDefaultDims.d;
    const frontM = parseFloat(inputs.frontYardDepth) || 0;
    const backM = parseFloat(inputs.backYardDepth) || 0;
    const sideM = parseFloat(inputs.sideYardDepth) || 0;
    const sideDir = inputs.sideYardDirection || 'right';
    const arcadeM = (inputs.frontYardDepth == 0 && inputs.arcadeDepth) ? parseFloat(inputs.arcadeDepth) : 0;


    const prevActiveSiteIdRef = useRef(activeSiteId);

    useEffect(() => {
        const siteSwitched = prevActiveSiteIdRef.current !== activeSiteId;
        if (siteSwitched) {
            prevActiveSiteIdRef.current = activeSiteId;
        }

        const roadList = inputs.roads || [];
        const primaryIndices = new Set();
        const secondaryIndices = new Set();

        roadList.forEach(r => {
            const indices = new Set();
            if (r.edgeIndices) r.edgeIndices.forEach(i => indices.add(i));
            if (r.edgeIndex !== undefined && r.edgeIndex !== "") indices.add(parseInt(r.edgeIndex));

            if (r.type === 'primary') {
                indices.forEach(i => primaryIndices.add(i));
            } else {
                indices.forEach(i => secondaryIndices.add(i));
            }
        });

        const workingPoints = (basePoints && basePoints.length > 2) ? basePoints : [{ x: -baseWidthM / 2, y: -baseDepthM / 2 }, { x: baseWidthM / 2, y: -baseDepthM / 2 }, { x: baseWidthM / 2, y: baseDepthM / 2 }, { x: -baseWidthM / 2, y: baseDepthM / 2 }];
        const workingCurves = (basePoints && basePoints.length > 2) ? baseCurves : null;
        const edgeCount = workingPoints.length;

        const nextFront = new Set();
        if (primaryIndices.size > 0) {
            primaryIndices.forEach(i => nextFront.add(i));
        } else if (secondaryIndices.size > 0) {
            secondaryIndices.forEach(i => nextFront.add(i));
        } else if (!siteSwitched && frontageIndices && frontageIndices.size > 0) {
            frontageIndices.forEach(i => nextFront.add(i));
        } else if (edgeCount >= 3) {
            nextFront.add(Math.min(2, edgeCount - 1));
        }

        const filteredFront = new Set();
        nextFront.forEach(i => {
            if (Number.isInteger(i) && i >= 0 && i < edgeCount) filteredFront.add(i);
        });

        const nextEdgeTypes = {};
        if (!siteSwitched) {
            Object.keys(edgeTypes || {}).forEach(k => {
                const idx = parseInt(k);
                if (!Number.isNaN(idx) && idx >= 0 && idx < edgeCount && !filteredFront.has(idx)) {
                    nextEdgeTypes[idx] = edgeTypes[k];
                }
            });
        }

        secondaryIndices.forEach(idx => {
            if (idx >= 0 && idx < edgeCount && !filteredFront.has(idx) && !nextEdgeTypes[idx]) {
                nextEdgeTypes[idx] = 'side';
            }
        });

        const hasBack = Object.values(nextEdgeTypes).includes('back');
        const hasSide = Object.values(nextEdgeTypes).includes('side');
        if ((!hasBack || (!hasSide && sideM > 0)) && filteredFront.size > 0) {
            const normalized = normalizeWithCurves(workingPoints, workingCurves);
            const rawPts = normalized.points || [];
            if (rawPts.length > 2) {
                const centroid = getPolygonCentroid(rawPts);
                let frontNormal = { x: 0, y: 0 };
                let count = 0;

                rawPts.forEach((p, i) => {
                    if (filteredFront.has(i)) {
                        const p2 = rawPts[(i + 1) % rawPts.length];
                        const n = getSegmentNormal(p, p2, centroid);
                        frontNormal.x += n.x;
                        frontNormal.y += n.y;
                        count++;
                    }
                });

                if (count > 0) {
                    const len = Math.sqrt(frontNormal.x * frontNormal.x + frontNormal.y * frontNormal.y);
                    if (len > 0) {
                        frontNormal.x /= len;
                        frontNormal.y /= len;

                        if (!hasBack) {
                            let bestBackIdx = -1;
                            let minDot = -0.25;
                            rawPts.forEach((p, i) => {
                                if (filteredFront.has(i) || nextEdgeTypes[i]) return;
                                const p2 = rawPts[(i + 1) % rawPts.length];
                                const n = getSegmentNormal(p, p2, centroid);
                                const dot = n.x * frontNormal.x + n.y * frontNormal.y;
                                if (dot < minDot) {
                                    minDot = dot;
                                    bestBackIdx = i;
                                }
                            });
                            if (bestBackIdx !== -1) {
                                nextEdgeTypes[bestBackIdx] = 'back';
                            }
                        }

                        if (!hasSide && sideM > 0) {
                            const desiredSign = sideDir === 'left' ? 1 : -1;
                            const candidates = [];
                            rawPts.forEach((p, i) => {
                                if (filteredFront.has(i) || nextEdgeTypes[i]) return;
                                const p2 = rawPts[(i + 1) % rawPts.length];
                                const n = getSegmentNormal(p, p2, centroid);
                                const dot = n.x * frontNormal.x + n.y * frontNormal.y;
                                const cross = frontNormal.x * n.y - frontNormal.y * n.x;
                                candidates.push({ origIdx: i, dot, cross });
                            });
                            const selected = candidates
                                .filter(c => desiredSign * c.cross > 0)
                                .sort((a, b) => Math.abs(a.dot) - Math.abs(b.dot));
                            if (selected.length > 0) {
                                nextEdgeTypes[selected[0].origIdx] = 'side';
                            }
                        }
                    }
                }
            }
        }

        const sameFront = (a, b) => {
            if (!a || !b || a.size !== b.size) return false;
            for (const v of a) if (!b.has(v)) return false;
            return true;
        };
        const sameEdgeTypes = (a, b) => {
            const aKeys = Object.keys(a || {});
            const bKeys = Object.keys(b || {});
            if (aKeys.length !== bKeys.length) return false;
            for (const k of aKeys) if (a[k] !== b[k]) return false;
            return true;
        };

        if (!sameFront(frontageIndices || new Set(), filteredFront)) setFrontageIndices(filteredFront);
        if (!sameEdgeTypes(edgeTypes || {}, nextEdgeTypes)) setEdgeTypes(nextEdgeTypes);
    }, [activeSiteId, basePoints, baseCurves, baseWidthM, baseDepthM, inputs.roads, sideM, sideDir, frontageIndices, edgeTypes]);

    // 標準化點座標 (Normalize points)
    const normalizePoints = (points) => {
        if (!points) return null;
        const centroid = getPolygonCentroid(points);
        return points.map(p => ({ x: p.x - centroid.x, y: p.y - centroid.y }));
    };

    // 核心修正: 預先計算標準化的基地數據 (Core Fix: Pre-calculate normalized base data)
    // 確保所有樓層和退縮計算都基於同一個中心點 (0,0)，避免基地形狀改變時發生位移
    const normalizedData = useMemo(() => {
        if (!basePoints) {
            const hw = baseWidthM / 2; const hd = baseDepthM / 2;
            const pts = [{ x: -hw, y: -hd }, { x: hw, y: -hd }, { x: hw, y: hd }, { x: -hw, y: hd }];
            return { points: pts, curves: null, centroid: { x: 0, y: 0 } };
        }
        return normalizeWithCurves(basePoints, baseCurves);
    }, [basePoints, baseCurves, baseWidthM, baseDepthM]);

    // 樓層量體生成邏輯 (Massing generation logic - Refactored for multi-site)
    function buildMassingLayers(siteRes, site, normalizedData, effectiveFrontIndices, combinedEdgeTypes, targetFAbove, applyFallingCurve = false, fallingCurveValue = 0) {
        const inputs = site.inputs;
        const floorSettings = site.floorSettings || {};
        const layers = [];
        const limitCFA = siteRes.totalCFA;
        const floorsBelow = Math.max(0, parseInt(inputs.floorsBelow) || 0);
        const basementAreaPerFloor = siteRes.basementAreaPerFloor || 0;
        const exemptBasement = siteRes.exemptBasement || 0;
        const activeBasementArea = Array.from({ length: floorsBelow }).length * basementAreaPerFloor;
        const taxableBasementArea = Math.max(0, activeBasementArea - exemptBasement);
        const availableForSuperstructure = Math.max(0, limitCFA - taxableBasementArea);

        let remainingAreaM2 = availableForSuperstructure;

        let currentZM = 0;
        let floorCount = 0;
        let currentTotalUsed = taxableBasementArea;

        const targetFloorsAbove = targetFAbove;
        const fullFloorsTarget = Math.floor(targetFloorsAbove);
        const isFloorConfigSet = (site.id === activeSiteId && manualFloorsOverride !== null);
        const fractionalFloorRatio = Math.max(0, targetFloorsAbove - fullFloorsTarget);
        const maxSimulatedFloors = Math.min(targetFloorsAbove, 100);
        const targetFloorsInt = Math.max(1, Math.round(targetFloorsAbove || 1));

        let actualMinRandomArea = minRandomAreaM2;
        if (site.id === activeSiteId && manualFloorsOverride !== null) {
            actualMinRandomArea = Math.min(minRandomAreaM2, availableForSuperstructure / targetFloorsInt);
        }
        const minRandomTotal = actualMinRandomArea * targetFloorsInt;
        const useRandomSizes = (site.id === activeSiteId) && randomSlabEnabled && (availableForSuperstructure >= minRandomTotal || manualFloorsOverride !== null);
        const randomFn = useRandomSizes ? createSeededRandom(randomSlabSeed || 1) : null;
        const siteDefaultDims = getSiteDefaultDims(site);
        const baseWidthM = siteDefaultDims.w;
        const baseDepthM = siteDefaultDims.d;
        const frontM = parseFloat(inputs.frontYardDepth) || 0;
        const backM = parseFloat(inputs.backYardDepth) || 0;
        const sideM = parseFloat(inputs.sideYardDepth) || 0;
        const arcadeM = (inputs.frontYardDepth == 0 && inputs.arcadeDepth) ? parseFloat(inputs.arcadeDepth) : 0;
        const roadW_M = parseFloat(getSiteRoads(site).find(r => r.type === 'primary')?.width || 6);
        const byRatio = parseFloat(inputs.minBackyardDepthRatio) || 0;
        const sideDir = inputs.sideYardDirection || 'right';

        const oneFFrontM = arcadeM > 0 ? Math.max(frontM, arcadeM) : frontM;
        let oneFFootprint = null;
        let oneFFootprintCurves = null;
        if (normalizedData.points) {
            const res = offsetPolygon(normalizedData.points, combinedEdgeTypes, { front: oneFFrontM, back: backM, side: sideM }, effectiveFrontIndices, normalizedData.curves);
            oneFFootprint = res ? res.points : null;
            oneFFootprintCurves = res ? res.curves : null;
        }
        const oneFFootprintArea = oneFFootprint ? calculatePolygonArea(oneFFootprint, oneFFootprintCurves) : 0;
        const projectionBoxWidthM = Math.max(0, baseWidthM - sideM);
        const projectionBoxDepthM = Math.max(0, baseDepthM - oneFFrontM - backM);
        const projectionBoxArea = projectionBoxWidthM * projectionBoxDepthM;
        const shouldClampToProjection = (site.id === activeSiteId && isConstraintMode) || (showCheckLines && (showHeightRatio || showWeiLao || showBackyard || showFallingCurve));
        const projectionAreaLimit = normalizedData.points ? oneFFootprintArea : projectionBoxArea;
        let firstFloorFinalArea = null;

        while ((remainingAreaM2 > 0.1 || floorCount < targetFloorsAbove || (useRandomSizes && isFloorConfigSet && floorCount < targetFloorsAbove)) && floorCount < maxSimulatedFloors) {
            if (currentTotalUsed >= limitCFA - 0.1 && (!isFloorConfigSet || floorCount >= targetFloorsAbove)) break;
            if (currentTotalUsed >= limitCFA && isFloorConfigSet && useRandomSizes) break; 

            if (remainingAreaM2 <= 0.1 && !isFloorConfigSet) break;
            const floorId = `${floorCount + 1}F`;
            const settings = floorSettings[floorId] || {};
            const h = (floorCount === 0) ? (parseFloat(inputs.floorHeight1F) || 4.2) : (parseFloat(inputs.floorHeightOther) || 3.6);

            // IMPORTANT: Check constraints at the TOP of the current floor
            const checkZ = currentZM + h;

            // --- Dynamic Setback Calculation ---
            let currentFrontM = frontM;
            let effectiveBackM = backM;
            let effectiveSideM = sideM;

            // Base Setbacks (Without Review Lines) for comparison
            let baseFrontM = frontM;
            let baseBackM = backM;

            // Arcade handling
            if (floorCount === 0 && arcadeM > 0) {
                currentFrontM = Math.max(currentFrontM, arcadeM);
                baseFrontM = Math.max(baseFrontM, arcadeM);
            }

            if (isConstraintMode || showCheckLines) {
                if (showHeightRatio && byRatio <= 0) {
                    const reqFrontHR = (checkZ / 3.6) - roadW_M;
                    if (reqFrontHR > currentFrontM) currentFrontM = reqFrontHR;
                }
                if (showWeiLao) {
                    const reqFrontWL = (checkZ / 5.0) - (roadW_M / 2);
                    if (reqFrontWL > currentFrontM) currentFrontM = reqFrontWL;
                }
            }

            if ((isConstraintMode || showCheckLines) && byRatio > 0) {
                const reqBack = checkZ / byRatio;
                if (effectiveBackM < reqBack) effectiveBackM = reqBack;
            }

            const requireFallingCurve = applyFallingCurve && checkZ > 50;
            if (requireFallingCurve && fallingCurveValue > 0) {
                if (currentFrontM < fallingCurveValue) currentFrontM = fallingCurveValue;
                if (effectiveBackM < fallingCurveValue) effectiveBackM = fallingCurveValue;
                if (effectiveSideM < fallingCurveValue) effectiveSideM = fallingCurveValue;
            }

            const maxBaseBackM = Math.max(0, baseDepthM - baseFrontM);
            if (baseBackM > maxBaseBackM) baseBackM = maxBaseBackM;

            const maxFrontM = Math.max(0, baseDepthM - baseBackM);
            if (currentFrontM > maxFrontM) currentFrontM = maxFrontM;

            const maxBackM = Math.max(0, baseDepthM - currentFrontM);
            if (effectiveBackM > maxBackM) effectiveBackM = maxBackM;

            // Recalculate polygon OR Box dimensions based on dynamic setbacks
            let floorPolygon = null;
            let floorCurves = null;
            let floorPolygonArea = 0;

            // Calculate Static Polygon (Before Review Cuts) for Unused Area display
            let staticPolygon = null;
            let staticArea = 0;

            // --- Box Mode Calculation Variables ---
            let boxWidthM = 0;
            let boxDepthM = 0;
            let shiftX_M = 0;
            let shiftY_M = 0;

            if (normalizedData.points) {
                // Polygon Mode
                // 1. Calculate Actual Floor (Dynamic)
                if (isConstraintMode || (showCheckLines && byRatio > 0) || currentFrontM > frontM || effectiveBackM > backM || effectiveSideM > sideM || (floorCount === 0 && arcadeM > 0)) {
                    const res = offsetPolygon(normalizedData.points, combinedEdgeTypes, { front: currentFrontM, back: effectiveBackM, side: effectiveSideM }, effectiveFrontIndices, normalizedData.curves);
                    floorPolygon = res ? res.points : null;
                    floorCurves = res ? res.curves : null;
                } else {
                    floorPolygon = oneFFootprint; // Reuse 1F if no change
                    floorCurves = oneFFootprintCurves;
                }
                floorPolygonArea = floorPolygon ? calculatePolygonArea(floorPolygon, floorCurves) : 0;

                // 2. Calculate Static Floor (Base Constraints Only)
                if (currentFrontM > baseFrontM || effectiveBackM > baseBackM || effectiveSideM > sideM) {
                    const staticRes = offsetPolygon(normalizedData.points, combinedEdgeTypes, { front: baseFrontM, back: baseBackM, side: sideM }, effectiveFrontIndices, normalizedData.curves);
                    staticPolygon = staticRes ? staticRes.points : null;
                    staticArea = staticPolygon ? calculatePolygonArea(staticPolygon, staticRes?.curves) : 0;
                } else {
                    staticPolygon = floorPolygon;
                    staticArea = floorPolygonArea;
                }
                if (shouldClampToProjection && oneFFootprint) {
                    staticPolygon = oneFFootprint;
                    staticArea = oneFFootprintArea;
                }
            } else {
                // Box Mode
                // Dynamic
                boxWidthM = Math.max(0, baseWidthM - effectiveSideM);
                boxDepthM = Math.max(0, baseDepthM - currentFrontM - effectiveBackM);
                if (shouldClampToProjection && projectionBoxDepthM > 0 && boxDepthM > projectionBoxDepthM) {
                    boxDepthM = projectionBoxDepthM;
                }
                floorPolygonArea = boxWidthM * boxDepthM;

                // Static
                const staticDepthM = Math.max(0, baseDepthM - baseFrontM - baseBackM);
                staticArea = boxWidthM * staticDepthM;
                if (shouldClampToProjection && projectionBoxArea > 0) {
                    staticArea = projectionBoxArea;
                }

                // Calculate Shift for Box (Relative to Center)
                shiftY_M = (effectiveBackM - currentFrontM) / 2;

                // X Shift: Based on Side Direction
                if (sideDir === 'left') shiftX_M = effectiveSideM / 2;
                else if (sideDir === 'right') shiftX_M = -effectiveSideM / 2;
            }

            let allowedPolygon = floorPolygon;
            if (shouldClampToProjection && floorCount > 0 && firstFloorFinalArea && allowedPolygon && !allInsidePolygon(allowedPolygon, firstFloorFinalArea)) {
                allowedPolygon = clipPolygonByPolygon(allowedPolygon, firstFloorFinalArea);
                if (allowedPolygon !== floorPolygon) {
                    floorPolygon = allowedPolygon;
                    floorPolygonArea = floorPolygon ? calculatePolygonArea(floorPolygon, floorCurves) : 0;
                }
            }

            const coverageRatioFrac = (parseFloat(inputs.coverageRatio) || 60) / 100;
            const actualBaseAreaM2 = normalizedData.points
                ? calculatePolygonArea(normalizedData.points, normalizedData.curves)
                : (parseFloat(siteRes.base) || (baseWidthM * baseDepthM));
            const coverageLimit = actualBaseAreaM2 > 0
                ? (actualBaseAreaM2 * coverageRatioFrac)
                : (parseFloat(siteRes.maxBuildingArea) || parseFloat(res.maxBuildingArea) || 0);
            let maxFloorAreaM2 = coverageLimit > 0 ? Math.min(floorPolygonArea, coverageLimit) : floorPolygonArea;
            if (shouldClampToProjection && projectionAreaLimit > 0) {
                maxFloorAreaM2 = Math.min(maxFloorAreaM2, projectionAreaLimit);
            }

            // Task 2: Do not generate tiny fragments (Unused Area rule), unless we MUST generate the target number of floors
            if (maxFloorAreaM2 <= 3.0 && !settings.manualDim && !settings.manualArea) {
                const mustGenerateMore = randomSlabEnabled && isFloorConfigSet && floorCount < targetFloorsAbove;
                if (!mustGenerateMore) {
                    break;
                }
            }

            let visualWidthM = boxWidthM;
            let visualDepthM = boxDepthM;
            let rotation = settings.rotation || 0;
            let usedAreaM2 = 0;

            const useEvenArea = manualFloorsOverride !== null && targetFloorsAbove > 0 && !randomSlabEnabled;
            const evenAreaPerFloor = useEvenArea ? (availableForSuperstructure / targetFloorsAbove) : null;
            // Determine Area Usage (始終受當前基地形狀、道路退縮與建蔽率/容積率上限約束；若啟用隨機造型則優先採用隨機面積與造型)
            if (!useRandomSizes && settings.manualDim && settings.width !== undefined && settings.depth !== undefined) {
                visualWidthM = settings.width; visualDepthM = settings.depth; usedAreaM2 = Math.min(visualWidthM * visualDepthM, maxFloorAreaM2, remainingAreaM2);
            }
            else if (!useRandomSizes && settings.manualArea && settings.area !== undefined) {
                usedAreaM2 = Math.min(settings.area, maxFloorAreaM2, remainingAreaM2);
            }
            else {
                if (useEvenArea && Number.isFinite(evenAreaPerFloor)) {
                    const perFloorAreaCap = Math.min(maxFloorAreaM2, evenAreaPerFloor);
                    usedAreaM2 = Math.min(remainingAreaM2, perFloorAreaCap);
                } else if (useRandomSizes && randomFn) {
                    const isFractionalFloor = fractionalFloorRatio > 0 && floorCount === fullFloorsTarget;
                    const perFloorAreaCap = isFractionalFloor ? maxFloorAreaM2 * fractionalFloorRatio : maxFloorAreaM2;

                    let currentMin = minRandomAreaM2;
                    if (manualFloorsOverride !== null) {
                        currentMin = Math.min(minRandomAreaM2, availableForSuperstructure / Math.max(1, targetFloorsAbove));
                    }
                    const minAllowed = Math.min(currentMin, perFloorAreaCap);

                    const mustGenerateMore = randomSlabEnabled && isFloorConfigSet && floorCount < targetFloorsAbove;
                    let randArea = minAllowed + (perFloorAreaCap - minAllowed) * randomFn();

                    if (mustGenerateMore && remainingAreaM2 <= minAllowed) {
                        // Strictly cap borrow amount so we do not exceed total CFA
                        const maxBorrowable = limitCFA - currentTotalUsed;
                        usedAreaM2 = Math.min(randArea, maxBorrowable);
                    } else {
                        usedAreaM2 = Math.min(remainingAreaM2, randArea);
                    }
                } else {
                    const isFractionalFloor = fractionalFloorRatio > 0 && floorCount === fullFloorsTarget;
                    const perFloorAreaCap = isFractionalFloor ? maxFloorAreaM2 * fractionalFloorRatio : maxFloorAreaM2;
                    usedAreaM2 = Math.min(remainingAreaM2, perFloorAreaCap);
                }
            }

            if (shouldClampToProjection && projectionAreaLimit > 0) {
                usedAreaM2 = Math.min(usedAreaM2, projectionAreaLimit);
            }

            // 始終強制不超過當前樓層之法規最大可建面積 (建蔽率與退縮包絡線限制)
            usedAreaM2 = Math.min(usedAreaM2, maxFloorAreaM2);

            // 隨機造型演算輔助函式：支援『縮放 (scale)、變形 (morph)、弧形 (arc)、偏移 (offset)、全部 (all)』，可針對單棟或分棟各別獨立施作並嚴格限制於各自的法規邊界內
            const applyRandomSlabStyling = (rawBasePts, rawBaseCurves, legalBoundPts, legalBoundCurves, targetArea, shapeMode, rFn) => {
                if (!rawBasePts || rawBasePts.length < 3 || !rFn) {
                    return { points: rawBasePts, curves: rawBaseCurves || null };
                }
                const boundPts = (legalBoundPts && legalBoundPts.length >= 3) ? legalBoundPts : rawBasePts;
                const boundCurves = legalBoundCurves || null;
                const discBound = discretizePolygon(boundPts, boundCurves, 12).points;
                const baseArea = calculatePolygonArea(rawBasePts, rawBaseCurves);
                if (baseArea <= 0.01) {
                    return { points: rawBasePts, curves: rawBaseCurves || null };
                }

                const mode = shapeMode || 'all';
                const doMorph = mode === 'morph' || mode === 'all';
                const doArc = mode === 'arc' || mode === 'all';
                const doOffset = mode === 'offset' || mode === 'all';

                let pts = rawBasePts.map(p => ({ x: p.x, y: p.y }));
                let curves = rawBaseCurves ? { ...rawBaseCurves } : null;

                // 1. 多邊形變形 (Morph): 針對該棟/該層中心進行非均向縮放與頂點切角/放射擾動
                if (doMorph) {
                    let workPts = curves ? discretizePolygon(pts, curves, 4).points : pts;
                    if (workPts.length <= 4 && rFn() > 0.25) {
                        const subdivided = [];
                        for (let i = 0; i < workPts.length; i++) {
                            const pA = workPts[i];
                            const pB = workPts[(i + 1) % workPts.length];
                            subdivided.push(pA);
                            if (Math.hypot(pB.x - pA.x, pB.y - pA.y) > 2.2) {
                                subdivided.push({ x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 });
                            }
                        }
                        workPts = subdivided;
                    }
                    const mCenter = getPolygonCentroid(workPts);
                    const phi = rFn() * Math.PI;
                    const cosP = Math.cos(phi);
                    const sinP = Math.sin(phi);
                    const ax = 0.74 + 0.44 * rFn();
                    const ay = 0.74 + 0.44 * rFn();
                    const morphedPts = workPts.map(p => {
                        const vx = p.x - mCenter.x;
                        const vy = p.y - mCenter.y;
                        const rx = (vx * cosP + vy * sinP) * ax;
                        const ry = (-vx * sinP + vy * cosP) * ay;
                        const rMod = 0.76 + 0.36 * rFn();
                        return {
                            x: mCenter.x + (rx * cosP - ry * sinP) * rMod,
                            y: mCenter.y + (rx * sinP + ry * cosP) * rMod
                        };
                    });
                    const constrainedMorph = constrainPolygonToLegalBoundary(morphedPts, null, boundPts, boundCurves);
                    if (constrainedMorph.points && constrainedMorph.points.length >= 3 && calculatePolygonArea(constrainedMorph.points) > 0.5) {
                        pts = constrainedMorph.points;
                        curves = null;
                    }
                }

                // 2. 面積縮放 (Scale): 依據目標隨機面積或為偏移/弧形預留活動空間進行縮放
                let desiredArea = Math.max(0.5, targetArea);
                if (doOffset) {
                    desiredArea = Math.min(desiredArea, baseArea * (0.58 + 0.22 * rFn()));
                } else if (doArc) {
                    desiredArea = Math.min(desiredArea, baseArea * (0.68 + 0.20 * rFn()));
                }
                const curAreaBeforeScale = calculatePolygonArea(pts, curves);
                if (curAreaBeforeScale > 0.05) {
                    const scaleRate = Math.min(0.98, Math.sqrt(desiredArea / curAreaBeforeScale));
                    const sCenter = getPolygonCentroid(pts);
                    const scaled = scalePolygon(pts, curves, scaleRate, sCenter);
                    pts = scaled.points;
                    curves = scaled.curves;
                }

                // 3. 錯層位移 (Offset): 在不超出該棟/該層法定邊界的前提下向隨機方向懸挑偏移
                if (doOffset && pts.length >= 3) {
                    const bBounds = getPolygonBounds(boundPts);
                    const maxSpan = bBounds ? Math.hypot(bBounds.maxX - bBounds.minX, bBounds.maxY - bBounds.minY) * 0.38 : 6;
                    const shiftAngle = rFn() * Math.PI * 2;
                    const ux = Math.cos(shiftAngle);
                    const uy = Math.sin(shiftAngle);
                    let bestShift = 0;
                    const testSteps = 8;
                    for (let step = 1; step <= testSteps; step++) {
                        const candDist = (maxSpan * step) / testSteps;
                        const allInside = pts.every(p => pointInPolygon({ x: p.x + ux * candDist, y: p.y + uy * candDist }, discBound));
                        if (allInside) {
                            bestShift = candDist;
                        } else {
                            break;
                        }
                    }
                    const finalShiftDist = bestShift * (0.65 + 0.35 * rFn());
                    if (finalShiftDist > 0.05) {
                        pts = pts.map(p => ({ x: p.x + ux * finalShiftDist, y: p.y + uy * finalShiftDist }));
                        if (curves) {
                            const shiftedC = {};
                            Object.keys(curves).forEach(k => {
                                if (curves[k]) shiftedC[k] = { x: curves[k].x + ux * finalShiftDist, y: curves[k].y + uy * finalShiftDist };
                            });
                            curves = shiftedC;
                        }
                    }
                }

                // 先確保多邊形頂點完全位於法定邊界內
                const preConstrained = constrainPolygonToLegalBoundary(pts, curves, boundPts, boundCurves);
                if (preConstrained.points && preConstrained.points.length >= 3) {
                    pts = preConstrained.points;
                    curves = preConstrained.curves;
                }

                // 4. 弧形造型 (Arc): 為各邊產生平滑貝茲曲線控制點，並檢驗曲線取樣點皆位於該棟法定邊界內
                if (doArc && pts.length >= 3) {
                    const polyCenter = getPolygonCentroid(pts);
                    const arcCurves = {};
                    for (let i = 0; i < pts.length; i++) {
                        const p1 = pts[i];
                        const p2 = pts[(i + 1) % pts.length];
                        const edgeLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                        if (edgeLen < 1.2) continue;
                        const inN = getSegmentNormal(p1, p2, polyCenter);
                        const outN = { x: -inN.x, y: -inN.y };
                        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                        const baseAmp = edgeLen * (0.16 + 0.22 * rFn());
                        const preferSign = rFn() > 0.32 ? 1 : -1;
                        const candidateMultipliers = [preferSign * 1.0, preferSign * 0.6, -preferSign * 0.65, -0.4];

                        for (const mult of candidateMultipliers) {
                            const cp = {
                                x: mid.x + outN.x * baseAmp * mult,
                                y: mid.y + outN.y * baseAmp * mult
                            };
                            const sampleTs = [0.2, 0.35, 0.5, 0.65, 0.8];
                            const curveValid = sampleTs.every(t => {
                                const mt = 1 - t;
                                const qx = mt * mt * p1.x + 2 * mt * t * cp.x + t * t * p2.x;
                                const qy = mt * mt * p1.y + 2 * mt * t * cp.y + t * t * p2.y;
                                return pointInPolygon({ x: qx, y: qy }, discBound);
                            });
                            if (curveValid) {
                                arcCurves[i] = cp;
                                break;
                            }
                        }
                    }
                    if (Object.keys(arcCurves).length > 0) {
                        curves = arcCurves;
                    }
                }

                // 若非弧形模式且縮放後面積偏離目標面積，校正回目標面積上限內
                const finalAreaNow = calculatePolygonArea(pts, curves);
                if (finalAreaNow > targetArea + 0.05 && targetArea > 0) {
                    const fixRate = Math.sqrt(targetArea / finalAreaNow);
                    const fCenter = getPolygonCentroid(pts);
                    const fixed = scalePolygon(pts, curves, fixRate, fCenter);
                    pts = fixed.points;
                    curves = fixed.curves;
                }

                return { points: pts, curves };
            };

            // Calculate Final Geometry
            let layerPoints = (!useRandomSizes && settings.points) ? settings.points : null;
            let layerCurves = (!useRandomSizes && settings.curves) ? settings.curves : (layerPoints ? null : floorCurves) || null;

            if (layerPoints && normalizedData.centroid) {
                const c = normalizedData.centroid;
                layerPoints = layerPoints.map(p => ({ x: p.x - c.x, y: p.y - c.y }));
                if (settings.curves) {
                    const newC = {};
                    Object.keys(settings.curves).forEach(k => {
                        const cp = settings.curves[k];
                        newC[k] = { x: cp.x - c.x, y: cp.y - c.y };
                    });
                    layerCurves = newC;
                }
            }

            if (layerPoints && shouldClampToProjection && oneFFootprint) {
                const fitted = fitPolygonWithin(layerPoints, layerCurves, oneFFootprint);
                layerPoints = fitted.points;
                layerCurves = fitted.curves;
                usedAreaM2 = Math.min(usedAreaM2, calculatePolygonArea(layerPoints, layerCurves));
            }

            if (!layerPoints && floorPolygon) {
                layerPoints = floorPolygon;
                layerCurves = floorCurves;
                // 若未啟用隨機造型或為單棟標準縮放，依使用面積調整
                if (!useRandomSizes && usedAreaM2 < floorPolygonArea - 0.1) {
                    const scaleRate = Math.sqrt(usedAreaM2 / floorPolygonArea);
                    const polyCentroid = getPolygonCentroid(floorPolygon);
                    const { points: newPts, curves: newCurves } = scalePolygon(floorPolygon, floorCurves, scaleRate, polyCentroid);
                    layerPoints = newPts;
                    layerCurves = newCurves;
                }
                if (shouldClampToProjection && oneFFootprint) {
                    const fitted = fitPolygonWithin(layerPoints, layerCurves, oneFFootprint);
                    layerPoints = fitted.points;
                    layerCurves = fitted.curves;
                    if (!useRandomSizes) {
                        const clampedArea = calculatePolygonArea(layerPoints, layerCurves);
                        usedAreaM2 = Math.min(usedAreaM2, clampedArea);
                    }
                }
            } else if (!layerPoints && !normalizedData.points) {
                // Box Mode Scaling (if using less than max area)
                const usageRatio = maxFloorAreaM2 > 0 ? usedAreaM2 / maxFloorAreaM2 : 0;
                const scaleFactor = Math.sqrt(usageRatio);
                visualWidthM = boxWidthM * scaleFactor;
                visualDepthM = boxDepthM * scaleFactor;
                const visualArea = visualWidthM * visualDepthM;
                if (shouldClampToProjection && projectionAreaLimit > 0 && visualArea > projectionAreaLimit + 0.01) {
                    const scaleRate = Math.sqrt(projectionAreaLimit / visualArea);
                    visualWidthM *= scaleRate;
                    visualDepthM *= scaleRate;
                    usedAreaM2 = Math.min(usedAreaM2, projectionAreaLimit);
                }
            }

            // 確保所有手動編輯或套用的樓板多邊形皆嚴格受限於當前基地形狀、道路退縮與法規包絡線內
            if (!useRandomSizes && settings.points && layerPoints && allowedPolygon) {
                const constrained = constrainPolygonToLegalBoundary(layerPoints, layerCurves, allowedPolygon, floorCurves);
                layerPoints = constrained.points;
                layerCurves = constrained.curves;
                if (layerPoints && layerPoints.length >= 3) {
                    const curPolyArea = calculatePolygonArea(layerPoints, layerCurves);
                    if (curPolyArea > usedAreaM2 + 0.05 && usedAreaM2 > 0) {
                        const scaleRate = Math.sqrt(usedAreaM2 / curPolyArea);
                        const polyCentroid = getPolygonCentroid(layerPoints);
                        const scaled = scalePolygon(layerPoints, layerCurves, scaleRate, polyCentroid);
                        layerPoints = scaled.points;
                        layerCurves = scaled.curves;
                    }
                    usedAreaM2 = Math.min(usedAreaM2, calculatePolygonArea(layerPoints, layerCurves));
                } else {
                    usedAreaM2 = 0;
                }
            }

            // Task 3: Unit Division Support (始終依循當前基地形狀、曲線道路退縮與法規限制面積動態切割，並支援分割分棟後各棟獨立隨機造型)
            const unsplitFloorPoints = layerPoints || floorPolygon;
            const unsplitFloorCurves = layerCurves || floorCurves || null;
            let splitUnits = null;
            let isAutoSplit = false;

            // 尋找當前基地是否已設定分割分棟（若單層未獨立指定，自動繼承 1F 或其他已設定分棟之樓層配置，確保全棟分棟一致性）
            const inheritedSplitFloor = floorSettings['1F'] || Object.keys(floorSettings)
                .filter(k => /^\d+F$/.test(k))
                .map(k => floorSettings[k])
                .find(fs => fs && (fs.unitConfig || (Array.isArray(fs.units) && fs.units.length > 0))) || null;

            const effectiveUnitConfig = settings.unitConfig || inheritedSplitFloor?.unitConfig || null;
            const effectiveSavedUnits = settings.units || (!effectiveUnitConfig ? inheritedSplitFloor?.units : null);

            // 分割基準多邊形：當啟用隨機造型時，先以當層完整合法退縮包絡線 (floorPolygon / allowedPolygon) 切割出各分棟領地，再由各棟獨立進行隨機造型
            const baseForSplittingPts = useRandomSizes ? (floorPolygon || unsplitFloorPoints) : unsplitFloorPoints;
            const baseForSplittingCurves = useRandomSizes ? (floorCurves || unsplitFloorCurves) : unsplitFloorCurves;

            const targetSplitFloorId = unitSettings?.target ? unitSettings.target.split('-')[0] : '1F';
            if (site.id === activeSiteId && unitSettings?.enabled && baseForSplittingPts && (targetSplitFloorId === floorId || useRandomSizes)) {
                splitUnits = getSplitUnits(baseForSplittingPts, unitSettings, baseForSplittingCurves, allowedPolygon, floorCurves);
                isAutoSplit = true;
            } else if (effectiveUnitConfig && baseForSplittingPts) {
                splitUnits = getSplitUnits(baseForSplittingPts, effectiveUnitConfig, baseForSplittingCurves, allowedPolygon, floorCurves);
            } else if (effectiveSavedUnits && effectiveSavedUnits.length > 0) {
                const c = normalizedData.centroid || { x: 0, y: 0 };
                splitUnits = effectiveSavedUnits
                    .map(uPts => {
                        const normUPts = Array.isArray(uPts) ? uPts.map(p => ({ x: p.x - c.x, y: p.y - c.y })) : uPts;
                        return allowedPolygon
                            ? constrainPolygonToLegalBoundary(normUPts, null, allowedPolygon, floorCurves).points
                            : normUPts;
                    })
                    .filter(uPts => uPts && uPts.length >= 3);
            }

            // 若未進行分割分棟且啟用隨機造型，對整層樓板施作隨機造型 (縮放/變形/弧形/偏移/全部)
            if ((!splitUnits || splitUnits.length === 0) && useRandomSizes && randomFn && layerPoints && layerPoints.length >= 3) {
                const legalBoundForFloor = (shouldClampToProjection && oneFFootprint) ? oneFFootprint : (allowedPolygon || floorPolygon);
                const legalCurvesForFloor = (shouldClampToProjection && oneFFootprint) ? oneFFootprintCurves : floorCurves;
                const styledFloor = applyRandomSlabStyling(
                    layerPoints,
                    layerCurves,
                    legalBoundForFloor,
                    legalCurvesForFloor,
                    usedAreaM2,
                    randomSlabShapeMode,
                    randomFn
                );
                layerPoints = styledFloor.points;
                layerCurves = styledFloor.curves;
                if (layerPoints && layerPoints.length >= 3) {
                    usedAreaM2 = Math.min(maxFloorAreaM2, remainingAreaM2, calculatePolygonArea(layerPoints, layerCurves));
                }
            }

            if (layerPoints && layerPoints.length >= 3) {
                const lBounds = getPolygonBounds(layerPoints);
                if (lBounds) {
                    visualWidthM = lBounds.maxX - lBounds.minX;
                    visualDepthM = lBounds.maxY - lBounds.minY;
                }
            }

            if (floorCount === 0 && layerPoints) {
                firstFloorFinalArea = layerPoints;
            }

            // Manual Offsets (User dragging)
            const alignPref = settings.alignment || { x: 'left', y: 'back' };
            const getOffsets = () => {
                if (settings.offset) return settings.offset;
                return { x: 0, y: 0 };
            }
            const userOff = getOffsets();

            let finalShiftYPx, finalShiftX;
            if (layerPoints) {
                // Polygon Mode
                finalShiftYPx = userOff.y * scale;
                finalShiftX = userOff.x * scale;
            } else {
                // Box Mode: Combine calculated shift with user offset
                finalShiftX = (shiftX_M * scale) + (settings.offset?.x || 0);
                finalShiftYPx = (shiftY_M * scale) + (settings.offset?.y || 0);
            }

            const violations = [];

            if (splitUnits && splitUnits.length > 0) {
                // 計算各分棟包絡面積總和與比例
                const unitRawAreas = splitUnits.map(uPts => calculatePolygonArea(uPts));
                const totalRawUnitArea = unitRawAreas.reduce((acc, a) => acc + a, 0);
                const maxAllowedSplitArea = Math.min(usedAreaM2, maxFloorAreaM2, remainingAreaM2);
                const unitScaleFactor = (!useRandomSizes && totalRawUnitArea > maxAllowedSplitArea + 0.05 && maxAllowedSplitArea > 0)
                    ? Math.sqrt(maxAllowedSplitArea / totalRawUnitArea)
                    : 1;

                splitUnits.forEach((uPts, uIdx) => {
                    let finalUPts = uPts;
                    let finalUCurves = null;
                    const uRawArea = unitRawAreas[uIdx] || 0;
                    const uShare = totalRawUnitArea > 0 ? (uRawArea / totalRawUnitArea) : (1 / splitUnits.length);

                    if (useRandomSizes && randomFn) {
                        // 分割分棟隨機造型：每一分棟 (A棟、B棟...) 以其自身分棟邊界 (uPts) 與自身中心點獨立進行隨機縮放、變形、弧形與錯層偏移
                        const uCapArea = Math.min(uRawArea, maxFloorAreaM2 * uShare);
                        const uMinArea = Math.min(uCapArea * 0.42, (minRandomAreaM2 * uShare));
                        const uRandArea = uMinArea + (uCapArea - uMinArea) * (0.35 + 0.65 * randomFn());
                        const mustGenMoreUnit = randomSlabEnabled && isFloorConfigSet && floorCount < targetFloorsAbove;
                        const maxUnitBorrowable = Math.max(0, limitCFA - currentTotalUsed);
                        const uTargetArea = (mustGenMoreUnit && remainingAreaM2 <= uMinArea)
                            ? Math.min(uRandArea, maxUnitBorrowable)
                            : Math.min(remainingAreaM2, uRandArea);

                        const styledUnit = applyRandomSlabStyling(
                            uPts,
                            null,
                            uPts,
                            null,
                            uTargetArea,
                            randomSlabShapeMode,
                            randomFn
                        );
                        finalUPts = styledUnit.points;
                        finalUCurves = styledUnit.curves;
                    } else {
                        if (unitScaleFactor < 0.9999) {
                            const uCenter = getPolygonCentroid(finalUPts);
                            finalUPts = scalePolygon(finalUPts, null, unitScaleFactor, uCenter).points;
                        }
                        if (allowedPolygon) {
                            finalUPts = constrainPolygonToLegalBoundary(finalUPts, null, allowedPolygon, floorCurves).points;
                        }
                    }

                    const uBounds = getPolygonBounds(finalUPts);
                    const uW = uBounds ? (uBounds.maxX - uBounds.minX) : visualWidthM;
                    const uD = uBounds ? (uBounds.maxY - uBounds.minY) : visualDepthM;

                    const uArea = calculatePolygonArea(finalUPts, finalUCurves);
                    const uUsed = Math.min(uArea, Math.max(0, limitCFA - currentTotalUsed)); // Cap by FAR
                    const uLabel = String.fromCharCode(65 + uIdx);

                    layers.push({
                        id: `${floorId}-${uLabel}`, // A, B, C...
                        unitLabel: uLabel,
                        unitArea: uUsed,
                        z: currentZM * scale,
                        height: h * scale,
                        widthPx: uW * scale,
                        depthPx: uD * scale,
                        shiftX: finalShiftX,
                        shiftYPx: finalShiftYPx,
                        rotation: rotation,
                        pivot: settings.pivot,
                        realArea: uUsed,
                        realWidth: uW,
                        realDepth: uD,
                        realHeight: h,
                        maxGeometricArea: uRawArea,
                        isViolation: violations.length > 0,
                        violations: violations,
                        points: finalUPts,
                        curves: finalUCurves,
                        unsplitPoints: unsplitFloorPoints,
                        unsplitCurves: unsplitFloorCurves,
                        allowedPoints: uPts,
                        allowedCurves: null,
                        staticPoints: null,
                        unusedReviewArea: 0
                    });

                    let areaToDeduct = uUsed;
                    if (randomSlabEnabled && isFloorConfigSet && remainingAreaM2 <= 0 && uUsed > 0) {
                        areaToDeduct = 0;
                    }
                    remainingAreaM2 -= areaToDeduct;
                    currentTotalUsed += uUsed;
                });
            } else {
                layers.push({
                    id: floorId,
                    z: currentZM * scale,
                    height: h * scale,

                    widthPx: visualWidthM * scale,
                    depthPx: visualDepthM * scale,

                    shiftX: finalShiftX,
                    shiftYPx: finalShiftYPx,

                    rotation: rotation,
                    pivot: settings.pivot,
                    realArea: usedAreaM2,
                    realWidth: visualWidthM,
                    realDepth: visualDepthM,
                    realHeight: h,
                    maxGeometricArea: maxFloorAreaM2,
                    isViolation: violations.length > 0,
                    violations: violations,
                    points: layerPoints,
                    curves: layerCurves,
                    unsplitPoints: unsplitFloorPoints,
                    unsplitCurves: unsplitFloorCurves,
                    allowedPoints: allowedPolygon,
                    allowedCurves: floorCurves,

                    // Task 2 Data
                    staticPoints: staticPolygon,
                    unusedReviewArea: Math.max(0, staticArea - usedAreaM2)
                });

                let areaToDeduct = usedAreaM2;
                if (randomSlabEnabled && isFloorConfigSet && remainingAreaM2 <= 0 && usedAreaM2 > 0) {
                    areaToDeduct = 0;
                }
                remainingAreaM2 -= areaToDeduct;
                currentTotalUsed += usedAreaM2;
            }
            currentZM += h; floorCount++;
        }
        return { layers, totalFloors: floorCount, totalHeight: currentZM, currentTotalUsed, remainingArea: Math.max(0, remainingAreaM2) };
    };

    const baseMassingLayers = useMemo(() => buildMassingLayers(res, activeSite, normalizedData, frontageIndices, edgeTypes, targetFloorsAbove, false, 0), [res, activeSite, normalizedData, frontageIndices, edgeTypes, unitSettings, targetFloorsAbove, inputs, floorSettings, showCheckLines, showHeightRatio, showWeiLao, showBackyard, showFallingCurve, isConstraintMode, manualFloorsOverride, randomSlabEnabled, randomSlabSeed, randomSlabShapeMode]);
    const baseHeight = baseMassingLayers.totalHeight;
    const fallingCurveRequired = baseHeight > 50;
    const fallingCurveD = fallingCurveRequired ? Math.sqrt(baseHeight) / 2 : 0;

    const massingLayers = useMemo(() => buildMassingLayers(res, activeSite, normalizedData, frontageIndices, edgeTypes, targetFloorsAbove, fallingCurveRequired, fallingCurveD), [res, activeSite, normalizedData, frontageIndices, edgeTypes, unitSettings, targetFloorsAbove, fallingCurveRequired, fallingCurveD, inputs, floorSettings, showCheckLines, showHeightRatio, showWeiLao, showBackyard, showFallingCurve, isConstraintMode, manualFloorsOverride, randomSlabEnabled, randomSlabSeed, randomSlabShapeMode]);

    useEffect(() => {
        if (fallingCurveRequired) {
            if (!showFallingCurve) setShowFallingCurve(true);
            setShowCheckLines(true);
        } else if (showFallingCurve) {
            setShowFallingCurve(false);
        }
    }, [fallingCurveRequired, showFallingCurve]);

    const handleAddFloor = () => {
        if (massingLayers.currentTotalUsed >= res.totalCFA) {
            alert("已達最大允建總樓地板面積 (Total CFA) 上限，無法新增樓層。");
            return;
        }
        setManualFloorsOverride((prev) => { const base = prev !== null ? prev : massingLayers.totalFloors; const next = base + 1; onUpdateInputs('floorsAbove', next); return next; });
    };
    const handleRemoveFloor = () => { const newFloorsAbove = Math.max(1, (manualFloorsOverride !== null ? manualFloorsOverride : massingLayers.totalFloors) - 1); setManualFloorsOverride(newFloorsAbove); onUpdateInputs('floorsAbove', newFloorsAbove); if (selectedFloor && !['base', 'excavation'].includes(selectedFloor.id)) { const floorNum = parseInt(selectedFloor.id); if (!isNaN(floorNum) && floorNum > newFloorsAbove) { setSelectedFloor(null); } } };
    const handleSetFloorsAbove = (value) => { const numeric = Number.isFinite(value) ? value : parseFloat(value); const safe = Math.max(1, Number.isFinite(numeric) ? numeric : 1); setManualFloorsOverride(safe); onUpdateInputs('floorsAbove', safe); if (selectedFloor && !['base', 'excavation'].includes(selectedFloor.id)) { const floorNum = parseInt(selectedFloor.id); if (!isNaN(floorNum) && floorNum > safe) { setSelectedFloor(null); } } };
    const handleApplyAllFloors = (payload) => {
        if (!payload || !payload.area || payload.area <= 0) return;
        const taxableBasementArea = Math.max(0, activeBasementArea - res.exemptBasement);
        const availableForSuperstructure = Math.max(0, res.totalCFA - taxableBasementArea);
        const targetFloors = Math.max(1, Math.round(manualFloorsOverride !== null ? manualFloorsOverride : (parseFloat(inputs.floorsAbove || 0) || res.floorsAbove || 1)));
        let areaPerFloor = payload.area;
        if (availableForSuperstructure > 0) areaPerFloor = availableForSuperstructure / targetFloors;
        const finalFloors = targetFloors;
        setManualFloorsOverride(finalFloors);
        onUpdateInputs('floorsAbove', finalFloors);
        setFloorSettings(prev => {
            const next = { ...prev };
            const offset = payload.offset || { x: 0, y: 0 };
            const c = normalizedData.centroid || { x: 0, y: 0 };
            for (let i = 1; i <= finalFloors; i++) {
                const floorId = `${i}F`;
                const current = next[floorId] || {};
                if (payload.mode === 'polygon' && payload.points && payload.points.length >= 3) {
                    let points = payload.points;
                    let curves = payload.curves || null;
                    let scaleRate = 1;
                    const currentArea = calculatePolygonArea(payload.points, payload.curves);
                    const polyCenter = getPolygonCentroid(payload.points);
                    if (currentArea > 0 && Math.abs(currentArea - areaPerFloor) > 0.01) {
                        scaleRate = Math.sqrt(areaPerFloor / currentArea);
                        const scaled = scalePolygon(payload.points, payload.curves || null, scaleRate, polyCenter);
                        points = scaled.points;
                        curves = scaled.curves;
                    }
                    const worldPoints = points.map(p => ({ x: p.x + c.x, y: p.y + c.y }));
                    let worldCurves = null;
                    if (curves) {
                        worldCurves = {};
                        Object.keys(curves).forEach(k => {
                            const cp = curves[k];
                            worldCurves[k] = { x: cp.x + c.x, y: cp.y + c.y };
                        });
                    }
                    let nextUnits = undefined;
                    if (payload.units && payload.units.length > 0) {
                        const worldCenter = { x: polyCenter.x + c.x, y: polyCenter.y + c.y };
                        nextUnits = payload.units.map(uPts => {
                            if (Math.abs(scaleRate - 1) > 0.001) {
                                return scalePolygon(uPts, null, scaleRate, worldCenter).points;
                            }
                            return uPts.map(p => ({ x: p.x, y: p.y }));
                        });
                    }
                    next[floorId] = {
                        ...current,
                        points: payload.unitConfig ? undefined : worldPoints,
                        curves: payload.unitConfig ? undefined : worldCurves,
                        splitBasePoints: worldPoints,
                        splitBaseCurves: worldCurves,
                        area: areaPerFloor,
                        manualArea: true,
                        manualDim: false,
                        offset
                    };
                    if (payload.unitConfig) {
                        next[floorId].unitConfig = { ...payload.unitConfig };
                        delete next[floorId].points;
                        delete next[floorId].curves;
                        delete next[floorId].units;
                    } else if (nextUnits) {
                        next[floorId].units = nextUnits;
                    } else {
                        delete next[floorId].units;
                        delete next[floorId].unitConfig;
                    }
                    delete next[floorId].width;
                    delete next[floorId].depth;
                } else {
                    const baseW = payload.width || baseWidthM;
                    const baseD = payload.depth || baseDepthM;
                    const baseArea = baseW * baseD;
                    let width = baseW;
                    let depth = baseD;
                    if (baseArea > 0 && Math.abs(baseArea - areaPerFloor) > 0.01) {
                        const scaleRate = Math.sqrt(areaPerFloor / baseArea);
                        width = baseW * scaleRate;
                        depth = baseD * scaleRate;
                    }
                    next[floorId] = { ...current, width, depth, manualDim: true, manualArea: false, area: width * depth, offset };
                    delete next[floorId].points;
                    delete next[floorId].curves;
                    delete next[floorId].units;
                    delete next[floorId].splitBasePoints;
                    delete next[floorId].splitBaseCurves;
                }
            }
            Object.keys(next).forEach(k => {
                const m = /^(\d+)F$/.exec(k);
                if (m && parseInt(m[1]) > finalFloors) delete next[k];
            });
            return next;
        });
        if (selectedFloor && !['base', 'excavation'].includes(selectedFloor.id)) {
            const floorNum = parseInt(selectedFloor.id);
            if (!isNaN(floorNum) && floorNum > finalFloors) setSelectedFloor(null);
        }
    };

    const handleAutoDistributeUnusedArea = () => {
        const remainingTotal = Math.max(0, unusedArea);
        if (remainingTotal <= 0.1) return;
        const layerMap = new Map();
        massingLayers.layers.forEach(layer => {
            if (/^\d+F$/.test(layer.id)) layerMap.set(layer.id, layer);
        });
        const candidateIds = Array.from(layerMap.keys()).sort((a, b) => parseInt(a) - parseInt(b));
        if (candidateIds.length === 0) return;
        const slackById = new Map();
        candidateIds.forEach(id => {
            const layer = layerMap.get(id);
            const maxArea = Math.max(0, layer?.maxGeometricArea || 0);
            const currentArea = Math.max(0, layer?.realArea || 0);
            const slack = Math.max(0, maxArea - currentArea);
            if (slack > 0.1) slackById.set(id, slack);
        });
        const activeCandidates = Array.from(slackById.keys());
        if (activeCandidates.length === 0) return;
        const allocations = {};
        let remaining = remainingTotal;
        let active = activeCandidates.slice();
        let guard = 0;
        while (remaining > 0.01 && active.length > 0 && guard < 10) {
            const per = remaining / active.length;
            const next = [];
            active.forEach(id => {
                const slack = (slackById.get(id) || 0) - (allocations[id] || 0);
                const add = Math.min(slack, per);
                if (add > 0) {
                    allocations[id] = (allocations[id] || 0) + add;
                    remaining -= add;
                }
                if (slack - add > 0.01) next.push(id);
            });
            active = next;
            guard += 1;
        }
        const floorEntries = Object.entries(allocations).filter(([, v]) => v > 0.01);
        if (floorEntries.length === 0) return;
        setFloorSettings(prev => {
            const next = { ...prev };
            floorEntries.forEach(([id, addArea]) => {
                const layer = layerMap.get(id);
                if (!layer) return;
                const currentArea = Math.max(0, layer.realArea || 0);
                const newArea = currentArea + addArea;
                const current = next[id] || {};
                if (layer.points && layer.points.length >= 3) {
                    const basePoints = current.points || layer.points;
                    const baseCurves = current.curves || layer.curves || null;
                    const baseArea = calculatePolygonArea(basePoints);
                    if (baseArea > 0) {
                        const scaleRate = Math.sqrt(newArea / baseArea);
                        const scaled = scalePolygon(basePoints, baseCurves, scaleRate);
                        next[id] = { ...current, points: scaled.points, curves: scaled.curves, area: newArea, manualArea: true, manualDim: false };
                        delete next[id].width;
                        delete next[id].depth;
                    }
                } else {
                    const baseW = current.width || layer.realWidth || 0;
                    const baseD = current.depth || layer.realDepth || 0;
                    const baseArea = baseW * baseD;
                    if (baseArea > 0) {
                        const scaleRate = Math.sqrt(newArea / baseArea);
                        const width = baseW * scaleRate;
                        const depth = baseD * scaleRate;
                        next[id] = { ...current, width, depth, manualDim: true, manualArea: false, area: width * depth };
                        delete next[id].points;
                        delete next[id].curves;
                    }
                }
            });
            return next;
        });
    };

    useEffect(() => { if (selectedFloor) { const layer = massingLayers.layers.find(l => l.id === selectedFloor.id); if (layer) { setSelectedFloor({ ...layer, rotation: floorSettings[layer.id]?.rotation || 0, pivot: floorSettings[layer.id]?.pivot || { x: 0, y: 0 }, alignment: floorSettings[layer.id]?.alignment || { x: 'left', y: 'back' }, violations: layer.violations, points: floorSettings[layer.id]?.points || null, curves: floorSettings[layer.id]?.curves || null }); } } }, [floorSettings, isConstraintMode]);

    const floorLayers = massingLayers.layers;
    const colors = { bg: isDarkMode ? "#0f172a" : "#fafaf9", grid: isDarkMode ? "linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)" : "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)", floor: showCheckLines ? (isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.3)") : (isDarkMode ? "rgba(255, 255, 255, 0.9)" : "#ffffff"), stroke: showCheckLines ? "#fb923c" : (isDarkMode ? "#94a3b8" : "#a8a29e") };
    const visualTotalH_Px = massingLayers.totalHeight * scale;
    const visualFloorsAbove = massingLayers.totalFloors;
    const floorsAboveValue = manualFloorsOverride !== null ? manualFloorsOverride : (parseFloat(inputs.floorsAbove || 0) || res.floorsAbove);
    const totalAreaViolation = massingLayers.currentTotalUsed > volumeLimit;
    const unusedArea = massingLayers.remainingArea;

    useEffect(() => {
        if (onUnusedAreaChange) onUnusedAreaChange(unusedArea);
    }, [unusedArea, onUnusedAreaChange]);

    useEffect(() => {
        if (unusedArea > 0.1) {
            const key = `${Math.round(unusedArea * 10)}-${visualFloorsAbove}-${inputs.floorsBelow}-${Math.round(res.totalCFA)}`;
            if (key !== unusedPromptKey) {
                setUnusedPromptKey(key);
                setShowUnusedPrompt(true);
            }
        } else if (showUnusedPrompt) {
            setShowUnusedPrompt(false);
        }
    }, [unusedArea, visualFloorsAbove, inputs.floorsBelow, res.totalCFA, unusedPromptKey, showUnusedPrompt]);

    // Pre-calculate Normalized Base Points for the entire visualization context
    // This ensures all layers share the same "Site Center" origin.
    // OLD: const normalizedBasePoints = useMemo(...) -> Replaced by normalizedData above

    const renderRoads = (ps) => {
        const site = ps.site;
        const originSiteId = sites[0]?.id || 1;
        // 由基準基地統一串接並繪製連續道路網，避免新增基地重複繪製道路或產生多餘交叉道路
        if (site.id !== originSiteId) return null;

        const normalizedData = ps.normalized;
        const normalizedPoints = normalizedData.points;
        const N = normalizedPoints ? normalizedPoints.length : 0;
        if (!normalizedPoints || N === 0) return null;
        const siteCentroid = getPolygonCentroid(normalizedPoints);

        const allSegments = [];
        (getSiteRoads(site)).forEach(road => {
            const indices = road.edgeIndices || (road.edgeIndex !== undefined && road.edgeIndex !== "" ? [parseInt(road.edgeIndex)] : []);
            indices.forEach(idx => {
                if (Number.isInteger(idx) && idx >= 0 && idx < N) {
                    allSegments.push({
                        edgeIdx: idx,
                        width: parseFloat(road.width) || 6,
                        name: road.name || (road.type === 'primary' ? '主要道路' : '次要道路'),
                        roadId: road.id,
                        type: road.type
                    });
                }
            });
        });

        if (allSegments.length === 0) return null;
        allSegments.sort((a, b) => a.edgeIdx - b.edgeIdx);

        const groups = [];
        if (allSegments.length > 0) {
            let curGroup = [allSegments[0]];
            for (let i = 1; i < allSegments.length; i++) {
                const prev = curGroup[curGroup.length - 1];
                const curr = allSegments[i];
                if (curr.edgeIdx === prev.edgeIdx + 1 && Math.abs(curr.width - prev.width) < 0.01) {
                    curGroup.push(curr);
                } else {
                    groups.push(curGroup);
                    curGroup = [curr];
                }
            }
            if (groups.length > 0) {
                const first = groups[0][0];
                const last = curGroup[curGroup.length - 1];
                if (last.edgeIdx === N - 1 && first.edgeIdx === 0 && Math.abs(last.width - first.width) < 0.01) {
                    groups[0] = [...curGroup, ...groups[0]];
                } else {
                    groups.push(curGroup);
                }
            } else {
                groups.push(curGroup);
            }
        }

        // 收集其餘基地與主道路相連的臨路邊段（轉換至基準基地局部座標系）
        const otherSiteRoadChains = [];
        processedSites.forEach(otherPs => {
            if (!otherPs || otherPs.site.id === site.id) return;
            const oPts = otherPs.normalized?.points || [];
            const oCurves = otherPs.normalized?.curves || null;
            const oN = oPts.length;
            if (oN < 3) return;

            const dLayoutX = (otherPs.layout?.x || 0) - (ps.layout?.x || 0);
            const dLayoutY = (otherPs.layout?.y || 0) - (ps.layout?.y || 0);
            const cosO = Math.cos(otherPs.layout?.rotation || 0);
            const sinO = Math.sin(otherPs.layout?.rotation || 0);
            const cosP = Math.cos(-(ps.layout?.rotation || 0));
            const sinP = Math.sin(-(ps.layout?.rotation || 0));
            const toOriginLocal = (pt) => {
                const wx = dLayoutX + (pt.x * cosO - pt.y * sinO);
                const wy = dLayoutY + (pt.x * sinO + pt.y * cosO);
                return {
                    x: wx * cosP - wy * sinP,
                    y: wx * sinP + wy * cosP
                };
            };

            (getSiteRoads(otherPs.site)).forEach(r => {
                const indices = r.edgeIndices || (r.edgeIndex !== undefined && r.edgeIndex !== "" ? [parseInt(r.edgeIndex)] : []);
                indices.forEach(rawIdx => {
                    if (!Number.isInteger(rawIdx) || rawIdx < 0 || rawIdx >= oN) return;
                    const p1 = oPts[rawIdx];
                    const p2 = oPts[(rawIdx + 1) % oN];
                    const ctrl = oCurves?.[rawIdx];
                    const steps = ctrl ? 18 : 1;
                    const chain = [];
                    for (let st = 0; st <= steps; st++) {
                        const t = st / steps;
                        if (ctrl) {
                            const mt = 1 - t;
                            chain.push(toOriginLocal({
                                x: mt * mt * p1.x + 2 * mt * t * ctrl.x + t * t * p2.x,
                                y: mt * mt * p1.y + 2 * mt * t * ctrl.y + t * t * p2.y
                            }));
                        } else {
                            chain.push(toOriginLocal({
                                x: p1.x + (p2.x - p1.x) * t,
                                y: p1.y + (p2.y - p1.y) * t
                            }));
                        }
                    }
                    otherSiteRoadChains.push({ chain, used: false });
                });
            });
        });

        // 收集所有基地（包含自身與其他基地）在當前基地局部座標系下的離散化多邊形，確保基地內絕不配置行道樹與虛擬人行道
        const allSitePolysInLocal = [];
        processedSites.forEach(otherPs => {
            const oPts = otherPs?.normalized?.points;
            if (!oPts || oPts.length < 3) return;
            const disc = discretizePolygon(oPts, otherPs.normalized?.curves, 18).points;
            if (otherPs.site.id === site.id) {
                allSitePolysInLocal.push(disc);
            } else {
                const dLayoutX = (otherPs.layout?.x || 0) - (ps.layout?.x || 0);
                const dLayoutY = (otherPs.layout?.y || 0) - (ps.layout?.y || 0);
                const cosO = Math.cos(otherPs.layout?.rotation || 0);
                const sinO = Math.sin(otherPs.layout?.rotation || 0);
                const cosP = Math.cos(-(ps.layout?.rotation || 0));
                const sinP = Math.sin(-(ps.layout?.rotation || 0));
                allSitePolysInLocal.push(
                    disc.map(pt => {
                        const wx = dLayoutX + (pt.x * cosO - pt.y * sinO);
                        const wy = dLayoutY + (pt.x * sinO + pt.y * cosO);
                        return {
                            x: wx * cosP - wy * sinP,
                            y: wx * sinP + wy * cosP
                        };
                    })
                );
            }
        });

        const isPointInsideAnySite = (pt, marginM = 0.4) => {
            for (const poly of allSitePolysInLocal) {
                if (pointInPolygon(pt, poly)) return true;
                if (marginM > 0) {
                    const dirs = [
                        { x: marginM, y: 0 },
                        { x: -marginM, y: 0 },
                        { x: 0, y: marginM },
                        { x: 0, y: -marginM },
                        { x: marginM * 0.7, y: marginM * 0.7 },
                        { x: -marginM * 0.7, y: marginM * 0.7 },
                        { x: marginM * 0.7, y: -marginM * 0.7 },
                        { x: -marginM * 0.7, y: -marginM * 0.7 }
                    ];
                    for (const dVec of dirs) {
                        if (pointInPolygon({ x: pt.x + dVec.x, y: pt.y + dVec.y }, poly)) return true;
                    }
                }
            }
            return false;
        };

        const paths = [];
        const svgLabels = [];
        const vehicleLanes = [];
        const streetTrees = [];
        const virtualSidewalkPaths = [];
        const vSidewalkPatternId = `virtual-sidewalk-tile-${ps.site.id}`;
        const vTileSize = Math.max(7, Math.min(15, scale * 0.95));

        // 2D 平面行道樹圖示的三種綠色色階（與 2.5D 行道樹三色階呼應）
        const planTreeTiers = isDarkMode
            ? [
                { outerFill: 'rgba(16, 185, 129, 0.38)', outerStroke: '#34d399', innerFill: 'rgba(52, 211, 153, 0.40)', innerStroke: 'rgba(167, 243, 208, 0.65)', dot: '#a7f3d0' },
                { outerFill: 'rgba(34, 197, 94, 0.36)', outerStroke: '#4ade80', innerFill: 'rgba(134, 239, 172, 0.38)', innerStroke: 'rgba(220, 252, 231, 0.65)', dot: '#bbf7d0' },
                { outerFill: 'rgba(132, 204, 22, 0.36)', outerStroke: '#a3e635', innerFill: 'rgba(190, 242, 100, 0.38)', innerStroke: 'rgba(236, 252, 203, 0.65)', dot: '#d9f99d' }
            ]
            : [
                { outerFill: 'rgba(5, 150, 105, 0.34)', outerStroke: '#047857', innerFill: 'rgba(16, 185, 129, 0.36)', innerStroke: 'rgba(6, 95, 70, 0.50)', dot: '#065f46' },
                { outerFill: 'rgba(22, 163, 74, 0.32)', outerStroke: '#15803d', innerFill: 'rgba(74, 222, 128, 0.35)', innerStroke: 'rgba(20, 83, 45, 0.48)', dot: '#14532d' },
                { outerFill: 'rgba(101, 163, 13, 0.32)', outerStroke: '#4d7c0f', innerFill: 'rgba(163, 230, 53, 0.36)', innerStroke: 'rgba(54, 83, 20, 0.48)', dot: '#365314' }
            ];

        groups.forEach((grp, gIdx) => {
            const roadRW = grp[0].width;
            const isLoop = (grp.length === N);
            const shouldExtend = !isLoop;
            const EXT_LEN = 50;

            // 針對曲線邊界進行高密度平滑採樣，確保道路內外緣、中線與 3D 高度比檢討面完全貼合無縫隙
            let samplePts = [];
            grp.forEach((seg, sIdx) => {
                const eIdx = seg.edgeIdx % N;
                const p1 = normalizedPoints[eIdx];
                const p2 = normalizedPoints[(eIdx + 1) % N];
                const ctrl = normalizedData.curves?.[eIdx];
                const steps = ctrl ? 18 : 1;
                for (let st = (sIdx === 0 ? 0 : 1); st <= steps; st++) {
                    const t = st / steps;
                    if (ctrl) {
                        const mt = 1 - t;
                        samplePts.push({
                            x: mt * mt * p1.x + 2 * mt * t * ctrl.x + t * t * p2.x,
                            y: mt * mt * p1.y + 2 * mt * t * ctrl.y + t * t * p2.y
                        });
                    } else {
                        samplePts.push({
                            x: p1.x + (p2.x - p1.x) * t,
                            y: p1.y + (p2.y - p1.y) * t
                        });
                    }
                }
            });

            if (samplePts.length < 2) return;

            // 將相鄰基地的臨路邊段串入同一條道路內緣鏈，使整條道路連續延伸
            let merged = true;
            while (merged && samplePts.length >= 2) {
                merged = false;
                for (const item of otherSiteRoadChains) {
                    if (item.used || item.chain.length < 2) continue;
                    const cStart = item.chain[0];
                    const cEnd = item.chain[item.chain.length - 1];
                    const curStart = samplePts[0];
                    const curEnd = samplePts[samplePts.length - 1];

                    if (Math.hypot(cStart.x - curEnd.x, cStart.y - curEnd.y) < 1.0) {
                        samplePts = [...samplePts, ...item.chain.slice(1)];
                        item.used = true;
                        merged = true;
                    } else if (Math.hypot(cEnd.x - curStart.x, cEnd.y - curStart.y) < 1.0) {
                        samplePts = [...item.chain.slice(0, -1), ...samplePts];
                        item.used = true;
                        merged = true;
                    }
                }
            }

            let finalPoints = [...samplePts];
            if (shouldExtend) {
                const p0 = samplePts[0];
                const p1 = samplePts[1];
                const startDir = { x: p1.x - p0.x, y: p1.y - p0.y };
                const lenStart = Math.hypot(startDir.x, startDir.y);
                if (lenStart > 1e-6) {
                    finalPoints.unshift({
                        x: p0.x - (startDir.x / lenStart) * EXT_LEN,
                        y: p0.y - (startDir.y / lenStart) * EXT_LEN
                    });
                }
                const pn = samplePts[samplePts.length - 1];
                const pn1 = samplePts[samplePts.length - 2];
                const endDir = { x: pn.x - pn1.x, y: pn.y - pn1.y };
                const lenEnd = Math.hypot(endDir.x, endDir.y);
                if (lenEnd > 1e-6) {
                    finalPoints.push({
                        x: pn.x + (endDir.x / lenEnd) * EXT_LEN,
                        y: pn.y + (endDir.y / lenEnd) * EXT_LEN
                    });
                }
            }

            // 計算各分段向外法向量並平滑化頂點法向量
            const segOutNormals = [];
            for (let i = 0; i < finalPoints.length - 1; i++) {
                const inN = getSegmentNormal(finalPoints[i], finalPoints[i + 1], siteCentroid);
                segOutNormals.push({ x: -inN.x, y: -inN.y });
            }

            const vertOutNormals = [];
            for (let i = 0; i < finalPoints.length; i++) {
                if (isLoop && !shouldExtend) {
                    const nPrev = segOutNormals[(i - 1 + segOutNormals.length) % segOutNormals.length];
                    const nCurr = segOutNormals[i % segOutNormals.length];
                    const nx = nPrev.x + nCurr.x;
                    const ny = nPrev.y + nCurr.y;
                    const len = Math.hypot(nx, ny);
                    vertOutNormals.push(len > 1e-6 ? { x: nx / len, y: ny / len } : nCurr);
                } else if (i === 0) {
                    vertOutNormals.push(segOutNormals[0]);
                } else if (i === finalPoints.length - 1) {
                    vertOutNormals.push(segOutNormals[segOutNormals.length - 1]);
                } else {
                    const nPrev = segOutNormals[i - 1];
                    const nCurr = segOutNormals[i];
                    const nx = nPrev.x + nCurr.x;
                    const ny = nPrev.y + nCurr.y;
                    const len = Math.hypot(nx, ny);
                    vertOutNormals.push(len > 1e-6 ? { x: nx / len, y: ny / len } : nCurr);
                }
            }

            const outerPoints = finalPoints.map((p, i) => ({
                x: p.x + vertOutNormals[i].x * roadRW,
                y: p.y + vertOutNormals[i].y * roadRW
            }));
            const centerPoints = finalPoints.map((p, i) => ({
                x: p.x + vertOutNormals[i].x * (roadRW * 0.5),
                y: p.y + vertOutNormals[i].y * (roadRW * 0.5)
            }));

            // 建立雙向或單向車道軌跡點供 3D 半透明灰特斯拉紙片車動畫行駛
            if (roadRW >= 5) {
                const lane1 = finalPoints.map((p, i) => ({
                    x: p.x + vertOutNormals[i].x * (roadRW * 0.27),
                    y: p.y + vertOutNormals[i].y * (roadRW * 0.27)
                }));
                const lane2 = finalPoints.map((p, i) => ({
                    x: p.x + vertOutNormals[i].x * (roadRW * 0.73),
                    y: p.y + vertOutNormals[i].y * (roadRW * 0.73)
                })).reverse();
                vehicleLanes.push(lane1, lane2);
            } else {
                vehicleLanes.push(centerPoints);
            }

            let innerPathD = "";
            let outerPathD = "";
            let centerPathD = "";
            finalPoints.forEach((p, i) => {
                const x = p.x * scale + w / 2;
                const y = p.y * scale + d / 2;
                innerPathD += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
            });
            for (let i = outerPoints.length - 1; i >= 0; i--) {
                const p = outerPoints[i];
                const x = p.x * scale + w / 2;
                const y = p.y * scale + d / 2;
                outerPathD += `L ${x} ${y} `;
            }
            centerPoints.forEach((p, i) => {
                const x = p.x * scale + w / 2;
                const y = p.y * scale + d / 2;
                centerPathD += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
            });

            paths.push(<path key={`road-path-${ps.site.id}-${gIdx}`} d={`${innerPathD}${outerPathD}Z`} fill={isDarkMode ? "rgba(71, 85, 105, 0.55)" : "rgba(148, 163, 184, 0.55)"} stroke={isDarkMode ? "#64748b" : "#94a3b8"} strokeWidth="1.5" strokeDasharray="5,5" />);
            if (centerPathD) {
                paths.push(<path key={`road-center-${ps.site.id}-${gIdx}`} d={centerPathD.trim()} fill="none" stroke={isDarkMode ? "rgba(226, 232, 240, 0.35)" : "rgba(255, 255, 255, 0.7)"} strokeWidth="1.2" strokeDasharray="8,6" />);
            }

            // 計算道路累積長度與法向插值輔助函式
            const roadCumLen = [0];
            let totalRoadLen = 0;
            for (let i = 0; i < finalPoints.length - 1; i++) {
                const segL = Math.hypot(finalPoints[i + 1].x - finalPoints[i].x, finalPoints[i + 1].y - finalPoints[i].y);
                totalRoadLen += segL;
                roadCumLen.push(totalRoadLen);
            }

            const sampleRoadAtDist = (distM) => {
                let sIdx = 0;
                for (let i = 0; i < roadCumLen.length - 1; i++) {
                    if (distM >= roadCumLen[i] && distM <= roadCumLen[i + 1]) {
                        sIdx = i;
                        break;
                    }
                }
                const s0 = roadCumLen[sIdx];
                const s1 = roadCumLen[sIdx + 1];
                const u = (distM - s0) / Math.max(1e-6, s1 - s0);
                const pA = finalPoints[sIdx];
                const pB = finalPoints[sIdx + 1];
                const nA = vertOutNormals[sIdx];
                const nB = vertOutNormals[sIdx + 1];
                const baseX = pA.x + (pB.x - pA.x) * u;
                const baseY = pA.y + (pB.y - pA.y) * u;
                const nx = nA.x + (nB.x - nA.x) * u;
                const ny = nA.y + (nB.y - nA.y) * u;
                const nLen = Math.hypot(nx, ny) || 1;
                return {
                    baseX,
                    baseY,
                    outUx: nx / nLen,
                    outUy: ny / nLen
                };
            };

            // 沿道路兩側探測「非基地內」之區段，於有樹的地方繪製虛擬人行道，並在虛擬人行道上配置三種樹形與三色階行道樹
            const virtualSidewalkW = 2.4; // 虛擬人行道寬度 (m)
            const treeCurbOffsetM = 1.15; // 行道樹位於虛擬人行道中央偏路緣處
            const treeSpacingM = 13.5;
            const treeEdgeMarginM = 6.0;
            const treePlanR = Math.max(4.2, 1.25 * scale);
            const pitHalf = Math.max(2.6, 0.75 * scale);
            const sampleStepM = 1.8;
            const numSteps = Math.max(2, Math.ceil(totalRoadLen / sampleStepM));

            // sideIdx = 0: 道路內側（僅在基地範圍外的延伸段有效，基地內絕不種樹）
            // sideIdx = 1: 道路外側（對向側整條路緣，若無其他基地重疊則全程有效）
            [0, 1].forEach(sideIdx => {
                const samples = [];
                for (let k = 0; k <= numSteps; k++) {
                    const distM = (k / numSteps) * totalRoadLen;
                    const { baseX, baseY, outUx, outUy } = sampleRoadAtDist(distM);
                    const curbDist = sideIdx === 0 ? 0 : roadRW;
                    const dirSign = sideIdx === 0 ? -1 : 1;

                    const curbPt = {
                        x: baseX + outUx * curbDist,
                        y: baseY + outUy * curbDist
                    };
                    const midPt = {
                        x: baseX + outUx * (curbDist + dirSign * treeCurbOffsetM),
                        y: baseY + outUy * (curbDist + dirSign * treeCurbOffsetM)
                    };
                    const backPt = {
                        x: baseX + outUx * (curbDist + dirSign * virtualSidewalkW),
                        y: baseY + outUy * (curbDist + dirSign * virtualSidewalkW)
                    };

                    // 嚴格排除任何進入基地內部的點位（確保基地內不要有樹）
                    const insideSite = isPointInsideAnySite(midPt, 0.45) || isPointInsideAnySite(backPt, 0.25);
                    samples.push({ distM, curbPt, midPt, backPt, valid: !insideSite });
                }

                // 將連續 valid 的採樣點聚合為虛擬人行道區段 (segments)
                const validRuns = [];
                let curRun = [];
                samples.forEach(sp => {
                    if (sp.valid) {
                        curRun.push(sp);
                    } else {
                        if (curRun.length >= 2) validRuns.push(curRun);
                        curRun = [];
                    }
                });
                if (curRun.length >= 2) validRuns.push(curRun);

                validRuns.forEach((run, runIdx) => {
                    const runStartM = run[0].distM;
                    const runEndM = run[run.length - 1].distM;
                    const runLenM = runEndM - runStartM;
                    if (runLenM < treeEdgeMarginM * 1.6) return;

                    // 先確認此區段內是否有配置行道樹（有樹的地方才增加虛擬人行道）
                    const runTrees = [];
                    for (let dM = runStartM + treeEdgeMarginM, tLocalIdx = 0; dM <= runEndM - treeEdgeMarginM; dM += treeSpacingM, tLocalIdx++) {
                        const { baseX, baseY, outUx, outUy } = sampleRoadAtDist(dM);
                        const curbDist = sideIdx === 0 ? 0 : roadRW;
                        const dirSign = sideIdx === 0 ? -1 : 1;
                        const tp = {
                            x: baseX + outUx * (curbDist + dirSign * treeCurbOffsetM),
                            y: baseY + outUy * (curbDist + dirSign * treeCurbOffsetM),
                            scaleFactor: 0.92 + ((tLocalIdx + sideIdx) % 3) * 0.08,
                            shapeType: (tLocalIdx + sideIdx * 2 + gIdx) % 3,
                            colorTier: (tLocalIdx * 2 + sideIdx + gIdx) % 3
                        };
                        if (!isPointInsideAnySite(tp, 0.85)) {
                            runTrees.push({ tp, tLocalIdx });
                        }
                    }

                    if (runTrees.length === 0) return;

                    // 1. 繪製此行道樹區段對應之「虛擬人行道」鋪面帶與路緣石邊線
                    let swPathD = "";
                    let curbLineD = "";
                    let outerBorderD = "";
                    run.forEach((sp, i) => {
                        const cx = sp.curbPt.x * scale + w / 2;
                        const cy = sp.curbPt.y * scale + d / 2;
                        swPathD += `${i === 0 ? 'M' : 'L'} ${cx} ${cy} `;
                        curbLineD += `${i === 0 ? 'M' : 'L'} ${cx} ${cy} `;
                    });
                    for (let i = run.length - 1; i >= 0; i--) {
                        const bx = run[i].backPt.x * scale + w / 2;
                        const by = run[i].backPt.y * scale + d / 2;
                        swPathD += `L ${bx} ${by} `;
                        outerBorderD += `${i === run.length - 1 ? 'M' : 'L'} ${bx} ${by} `;
                    }
                    swPathD += "Z";

                    paths.push(
                        <g key={`virtual-sidewalk-${ps.site.id}-${gIdx}-${sideIdx}-${runIdx}`}>
                            <path
                                d={swPathD}
                                fill={`url(#${vSidewalkPatternId})`}
                                stroke="none"
                            />
                            {/* 虛擬人行道臨路緣石實線 */}
                            <path
                                d={curbLineD}
                                fill="none"
                                stroke={isDarkMode ? "rgba(203, 213, 225, 0.55)" : "rgba(100, 116, 139, 0.65)"}
                                strokeWidth="1.4"
                            />
                            {/* 虛擬人行道外側虛線邊界 */}
                            <path
                                d={outerBorderD}
                                fill="none"
                                stroke={isDarkMode ? "rgba(148, 163, 184, 0.45)" : "rgba(100, 116, 139, 0.45)"}
                                strokeWidth="1"
                                strokeDasharray="4,3"
                            />
                        </g>
                    );

                    // 將虛擬人行道中線加入行人漫步動線
                    virtualSidewalkPaths.push(run.map(sp => sp.midPt));

                    // 2. 配置此區段之行道樹（平面圖示 + 2.5D 三樹形三色階立體樹）
                    runTrees.forEach(({ tp, tLocalIdx }) => {
                        streetTrees.push(tp);
                        const cx = tp.x * scale + w / 2;
                        const cy = tp.y * scale + d / 2;
                        const r = treePlanR * tp.scaleFactor;
                        const tier = planTreeTiers[tp.colorTier % 3];
                        paths.push(
                            <g key={`road-tree-icon-${ps.site.id}-${gIdx}-${sideIdx}-${runIdx}-${tLocalIdx}`}>
                                {/* 植栽樹穴方框 */}
                                <rect
                                    x={cx - pitHalf}
                                    y={cy - pitHalf}
                                    width={pitHalf * 2}
                                    height={pitHalf * 2}
                                    rx="1.5"
                                    fill={isDarkMode ? "rgba(30, 41, 59, 0.72)" : "rgba(120, 113, 108, 0.28)"}
                                    stroke={isDarkMode ? "rgba(148, 163, 184, 0.55)" : "rgba(87, 83, 78, 0.52)"}
                                    strokeWidth="0.9"
                                />
                                {/* 行道樹外圈樹冠圖示（依三色階變化） */}
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    r={r}
                                    fill={tier.outerFill}
                                    stroke={tier.outerStroke}
                                    strokeWidth="1.2"
                                />
                                {/* 行道樹內圈樹冠層次 */}
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    r={r * 0.62}
                                    fill={tier.innerFill}
                                    stroke={tier.innerStroke}
                                    strokeWidth="0.8"
                                    strokeDasharray="2,1.5"
                                />
                                {/* 景觀平面圖枝幹十字分岔線 */}
                                <line x1={cx - r * 0.55} y1={cy - r * 0.55} x2={cx + r * 0.55} y2={cy + r * 0.55} stroke={tier.innerStroke} strokeWidth="0.8" />
                                <line x1={cx + r * 0.55} y1={cy - r * 0.55} x2={cx - r * 0.55} y2={cy + r * 0.55} stroke={tier.innerStroke} strokeWidth="0.8" />
                                <circle cx={cx} cy={cy} r={Math.max(1.2, r * 0.16)} fill={tier.dot} />
                            </g>
                        );
                    });
                });
            });

            const midIdx = Math.floor(samplePts.length / 2);
            const pMid = samplePts[midIdx];
            const pNext = samplePts[Math.min(samplePts.length - 1, midIdx + 1)];
            const pPrev = samplePts[Math.max(0, midIdx - 1)];
            const seg = grp[Math.floor(grp.length / 2)];
            if (seg && pMid) {
                const inN = getSegmentNormal(pPrev, pNext, siteCentroid);
                const outN = { x: -inN.x, y: -inN.y };
                const labelX = (pMid.x + outN.x * roadRW * 0.65) * scale + w / 2;
                const labelY = (pMid.y + outN.y * roadRW * 0.65) * scale + d / 2;
                let edgeAngle = Math.atan2(pNext.y - pPrev.y, pNext.x - pPrev.x) * (180 / Math.PI);
                const totalScreenAngle = (((edgeAngle + rotationZ + ((ps.layout?.rotation || 0) * 180 / Math.PI)) % 360) + 360) % 360;
                if (totalScreenAngle > 90 && totalScreenAngle < 270) {
                    edgeAngle += 180;
                }
                const textStr = `${seg.name} ${seg.width}m`;
                const boxW = Math.max(64, textStr.length * 9 + 14);
                const boxH = 18;
                svgLabels.push(
                    <g key={`road-svg-lbl-${ps.site.id}-${gIdx}`} transform={`translate(${labelX}, ${labelY}) rotate(${edgeAngle})`}>
                        <rect x={-boxW / 2} y={-boxH / 2} width={boxW} height={boxH} rx="3" fill={isDarkMode ? "rgba(15, 23, 42, 0.82)" : "rgba(255, 255, 255, 0.88)"} stroke={isDarkMode ? "#475569" : "#64748b"} strokeWidth="1" />
                        <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="800" fill={isDarkMode ? "#e2e8f0" : "#334155"} className="select-none">
                            {textStr}
                        </text>
                    </g>
                );
            }
        });

        const siteWorldRotDeg = rotationZ + ((ps.layout?.rotation || 0) * 180 / Math.PI);
        return (
            <React.Fragment>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
                    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${d}`} style={{ overflow: 'visible' }}>
                        <defs>
                            {/* 虛擬人行道石材磚格鋪面樣式 */}
                            <pattern id={vSidewalkPatternId} x="0" y="0" width={vTileSize} height={vTileSize} patternUnits="userSpaceOnUse">
                                <rect width={vTileSize} height={vTileSize} fill={isDarkMode ? "rgba(100, 116, 139, 0.30)" : "rgba(226, 232, 240, 0.68)"} />
                                <path d={`M ${vTileSize} 0 L 0 0 0 ${vTileSize}`} fill="none" stroke={isDarkMode ? "rgba(203, 213, 225, 0.25)" : "rgba(148, 163, 184, 0.42)"} strokeWidth="0.9" />
                            </pattern>
                        </defs>
                        {paths}
                        {svgLabels}
                    </svg>
                </div>
                <StreetTrees3D trees={streetTrees} scale={scale} isDarkMode={isDarkMode} rotationZ={siteWorldRotDeg} viewAngleX={viewAngleX} />
                <Pedestrians3D paths={virtualSidewalkPaths} scale={scale} isDarkMode={isDarkMode} rotationZ={siteWorldRotDeg} viewAngleX={viewAngleX} />
                <RoadVehicles3D lanes={vehicleLanes} scale={scale} w={w} d={d} isDarkMode={isDarkMode} rotationZ={siteWorldRotDeg} viewAngleX={viewAngleX} />
            </React.Fragment>
        );
    };

    const renderPolygonSetbacks = (ps) => {
        const site = ps.site;
        const normalizedData = ps.normalized;
        const siteIn = site.inputs || inputs;
        const rawNormalized = normalizedData.points;
        if (!rawNormalized) return null;

        const sFrontM = parseFloat(siteIn.frontYardDepth) || 0;
        const sBackM = parseFloat(siteIn.backYardDepth) || 0;
        const sSideM = parseFloat(siteIn.sideYardDepth) || 0;
        const sSideDir = siteIn.sideYardDirection || 'right';
        const sArcadeM = (siteIn.frontYardDepth == 0 && siteIn.arcadeDepth) ? parseFloat(siteIn.arcadeDepth) : 0;

        let { points: normalizedPoints, edgeMap } = discretizePolygon(rawNormalized, normalizedData.curves, 15);
        const frontIndices = ps.frontIndices || new Set();
        const combinedEdgeTypes = { ...(ps.combinedEdgeTypes || {}) };

        const centroid = getPolygonCentroid(normalizedPoints);
        const getDepthByType = (type) => {
            if (type === 'front') return sArcadeM > 0 ? sArcadeM : sFrontM;
            if (type === 'back') return sBackM;
            if (type === 'side') return sSideM;
            return 0;
        };
        const getRegionType = (origIdx) => {
            if (frontIndices.has(origIdx)) return 'front';
            if (combinedEdgeTypes[origIdx] === 'back') return 'back';
            if (combinedEdgeTypes[origIdx] === 'side') return 'side';
            return null;
        };
        const buildOffsetPoints = (activeType) => {
            const shiftedLines = [];
            for (let i = 0; i < normalizedPoints.length; i++) {
                const p1 = normalizedPoints[i];
                const p2 = normalizedPoints[(i + 1) % normalizedPoints.length];
                const origIdx = edgeMap[i];
                const regionType = getRegionType(origIdx);
                const depth = regionType === activeType ? getDepthByType(regionType) : 0;
                const n = getSegmentNormal(p1, p2, centroid);
                shiftedLines.push({
                    p1: { x: p1.x + n.x * depth, y: p1.y + n.y * depth },
                    p2: { x: p2.x + n.x * depth, y: p2.y + n.y * depth }
                });
            }
            const newPoints = [];
            for (let i = 0; i < shiftedLines.length; i++) {
                const l1 = shiftedLines[i];
                const l2 = shiftedLines[(i + 1) % shiftedLines.length];
                const intersect = getLineIntersection(l1.p1, l1.p2, l2.p1, l2.p2);
                newPoints.push(intersect || l1.p2);
            }
            return newPoints;
        };
        const buildRingPath = (innerPts) => {
            if (!innerPts || innerPts.length < 3) return null;
            let dPath = "";
            normalizedPoints.forEach((p, i) => {
                const x = p.x * scale + w / 2;
                const y = p.y * scale + d / 2;
                if (i === 0) dPath += `M ${x} ${y}`;
                else dPath += ` L ${x} ${y}`;
            });
            dPath += " Z";
            const inner = [...innerPts].reverse();
            inner.forEach((p, i) => {
                const x = p.x * scale + w / 2;
                const y = p.y * scale + d / 2;
                if (i === 0) dPath += ` M ${x} ${y}`;
                else dPath += ` L ${x} ${y}`;
            });
            dPath += " Z";
            return dPath;
        };

        const paths = [];
        const hatchPalette = {
            front: {
                base: isDarkMode ? "rgba(148, 163, 184, 0.28)" : "rgba(226, 232, 240, 0.65)",
                stripe: isDarkMode ? "rgba(226, 232, 240, 0.35)" : "rgba(148, 163, 184, 0.45)"
            },
            back: {
                base: isDarkMode ? "rgba(16, 185, 129, 0.22)" : "rgba(16, 185, 129, 0.18)",
                stripe: isDarkMode ? "rgba(16, 185, 129, 0.55)" : "rgba(16, 185, 129, 0.35)"
            },
            side: {
                base: isDarkMode ? "rgba(59, 130, 246, 0.22)" : "rgba(59, 130, 246, 0.18)",
                stripe: isDarkMode ? "rgba(59, 130, 246, 0.55)" : "rgba(59, 130, 246, 0.35)"
            }
        };
        const hatchSize = Math.max(6, Math.min(16, scale * 0.8));
        const tileSize = Math.max(8, Math.min(18, scale * 1.1));
        const regionTypes = ['front', 'back', 'side'];
        const fillIds = { front: `setback-front-hatch-${ps.site.id}`, back: `setback-back-hatch-${ps.site.id}`, side: `setback-side-hatch-${ps.site.id}` };
        
        regionTypes.forEach(type => {
            const depth = getDepthByType(type);
            if (depth <= 0) return;
            let hasEdge = false;
            for (let i = 0; i < edgeMap.length; i++) {
                if (getRegionType(edgeMap[i]) === type) { hasEdge = true; break; }
            }
            if (!hasEdge) return;
            const innerPts = buildOffsetPoints(type);
            const dPath = buildRingPath(innerPts);
            if (!dPath) return;
            
            paths.push(
                <React.Fragment key={`setback-area-${ps.site.id}-${type}`}>
                    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${d}`} style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0 }}>
                        <defs>
                            {type === 'front' ? (
                                /* 臨道路面退縮範圍：人行道石材/透水磚格網鋪面樣式 */
                                <pattern id={fillIds[type]} x="0" y="0" width={tileSize} height={tileSize} patternUnits="userSpaceOnUse">
                                    <rect width={tileSize} height={tileSize} fill={hatchPalette.front.base} />
                                    <path d={`M ${tileSize} 0 L 0 0 0 ${tileSize}`} fill="none" stroke={hatchPalette.front.stripe} strokeWidth="1" />
                                    <line x1="0" y1="0" x2={tileSize} y2={tileSize} stroke={isDarkMode ? "rgba(244, 63, 94, 0.25)" : "rgba(244, 63, 94, 0.20)"} strokeWidth="0.7" />
                                </pattern>
                            ) : (
                                <pattern id={fillIds[type]} x="0" y="0" width={hatchSize} height={hatchSize} patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                    <rect width={hatchSize} height={hatchSize} fill={hatchPalette[type].base} />
                                    <rect width={hatchSize / 2} height={hatchSize} fill={hatchPalette[type].stripe} />
                                </pattern>
                            )}
                        </defs>
                        <path
                            d={dPath}
                            fill={`url(#${fillIds[type]})`}
                            stroke={type === 'front' ? (isDarkMode ? "rgba(244, 63, 94, 0.55)" : "rgba(244, 63, 94, 0.45)") : "none"}
                            strokeWidth={type === 'front' ? "1" : "0"}
                            strokeDasharray={type === 'front' ? "3,2" : "none"}
                            fillRule="evenodd"
                        />
                    </svg>
                </React.Fragment>
            );
        });

        // 計算臨道路退縮範圍（人行道）之行人漫步動線軌跡（自動貼合直線與曲線基地邊界）
        const pedestrianPaths = [];
        const frontDepthForWalk = getDepthByType('front');
        if (frontDepthForWalk > 0.4 && rawNormalized.length >= 3 && frontIndices.size > 0) {
            const rawN = rawNormalized.length;
            const walkOffsetM = Math.min(Math.max(0.7, frontDepthForWalk * 0.5), Math.max(0.7, frontDepthForWalk - 0.35));
            frontIndices.forEach(eIdx => {
                if (eIdx < 0 || eIdx >= rawN) return;
                const p1 = rawNormalized[eIdx];
                const p2 = rawNormalized[(eIdx + 1) % rawN];
                const ctrl = normalizedData.curves?.[eIdx];
                const steps = ctrl ? 16 : 1;
                const edgeSamples = [];
                for (let s = 0; s <= steps; s++) {
                    const t = s / steps;
                    if (ctrl) {
                        const mt = 1 - t;
                        edgeSamples.push({
                            x: mt * mt * p1.x + 2 * mt * t * ctrl.x + t * t * p2.x,
                            y: mt * mt * p1.y + 2 * mt * t * ctrl.y + t * t * p2.y
                        });
                    } else {
                        edgeSamples.push({
                            x: p1.x + (p2.x - p1.x) * t,
                            y: p1.y + (p2.y - p1.y) * t
                        });
                    }
                }
                const walkChain = [];
                for (let s = 0; s <= steps; s++) {
                    const qA = edgeSamples[Math.max(0, s - 1)];
                    const qB = edgeSamples[Math.min(steps, s + 1)];
                    const inN = getSegmentNormal(qA, qB, centroid);
                    walkChain.push({
                        x: edgeSamples[s].x + inN.x * walkOffsetM,
                        y: edgeSamples[s].y + inN.y * walkOffsetM
                    });
                }
                if (walkChain.length >= 2) {
                    pedestrianPaths.push(walkChain);
                }
            });
        }

        const labels = [];
        const colorByType = { front: "#f43f5e", back: "#10b981", side: "#3b82f6" };
        const labelByType = { front: arcadeM > 0 ? "騎樓 (人行道)" : "前院 (人行道)", back: "後院", side: "側院" };
        const segmentsByOrig = new globalThis.Map();
        for (let i = 0; i < edgeMap.length; i++) {
            const orig = edgeMap[i];
            if (!segmentsByOrig.has(orig)) segmentsByOrig.set(orig, []);
            segmentsByOrig.get(orig).push(i);
        }
        segmentsByOrig.forEach((segments, origIdx) => {
            const regionType = getRegionType(origIdx);
            if (!regionType) return;
            const depth = getDepthByType(regionType);
            if (depth <= 0) return;
            const midSeg = segments[Math.floor(segments.length / 2)];
            const p1 = normalizedPoints[midSeg];
            const p2 = normalizedPoints[(midSeg + 1) % normalizedPoints.length];
            if (!p1 || !p2) return;
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const n = getSegmentNormal(p1, p2, centroid);
            labels.push({
                x: mid.x + n.x * depth * 0.5,
                y: mid.y + n.y * depth * 0.5,
                text: labelByType[regionType],
                color: colorByType[regionType],
                key: `${regionType}-${origIdx}`
            });
        });

        const siteWorldRotDeg = rotationZ + ((ps.layout?.rotation || 0) * 180 / Math.PI);
        return (
            <React.Fragment>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
                    {paths}
                    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${d}`} style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0 }}>
                        {labels.map(label => (
                            <text key={label.key} x={label.x * scale + w / 2} y={label.y * scale + d / 2} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="700" fill={label.color} opacity={0.95} className="select-none">
                                {label.text}
                            </text>
                        ))}
                    </svg>
                </div>
                <Pedestrians3D paths={pedestrianPaths} scale={scale} isDarkMode={isDarkMode} rotationZ={siteWorldRotDeg} viewAngleX={viewAngleX} />
            </React.Fragment>
        );
    };

    const renderReviewSurfaces = () => {
        // 地面退縮範圍已由 renderPolygonSetbacks 繪製，3D 高度比檢討面已由 renderHeightRatioSurface3D 繪製；
        // 移除舊版地面 front-review-path 以避免在弧形道路上產生錯誤的紅色弦月區塊。
        return null;
    };

    const calculateCheckLines = (ps) => {
        const targetSite = ps?.site || activeSite;
        const targetInputs = targetSite?.inputs || inputs;
        const targetNormalized = ps?.normalized || normalizedData;
        const targetMassing = ps?.massing || massingLayers;
        const targetDims = getSiteDefaultDims(targetSite);

        const lines = [];
        const offX = w / 2;
        const offY = d / 2;

        const siteRoads = getSiteRoads(targetSite);
        const getPrimaryRoadInfo = () => {
            let road = siteRoads.find(r => r.type === 'primary') || siteRoads[0];
            if (!road) return { widthPx: 6 * scale, widthM: 6, isDefault: true, roadObj: null };
            const rw = parseFloat(road.width) || 6;
            return { widthPx: rw * scale, widthM: rw, isDefault: false, roadObj: road };
        };

        const { widthM: primRoadW_M, roadObj: primRoad } = getPrimaryRoadInfo();

        let workingPoints = [];
        let workingEdgeIndices = [];

        if (targetNormalized.points && targetNormalized.points.length > 2) {
            const discretized = discretizePolygon(targetNormalized.points, targetNormalized.curves, 20);
            workingPoints = discretized.points;
            workingEdgeIndices = discretized.edgeMap;
        } else {
            const hw = targetDims.w / 2; const hd = targetDims.d / 2;
            workingPoints = [{ x: -hw, y: -hd }, { x: hw, y: -hd }, { x: hw, y: hd }, { x: -hw, y: hd }];
            workingEdgeIndices = [0, 1, 2, 3];
        }

        if (!workingPoints || workingPoints.length < 3) return [];
        const sFloorHeight1F = parseFloat(targetInputs.floorHeight1F) || 4.2;
        const sFloorHeightOther = parseFloat(targetInputs.floorHeightOther) || 3.6;
        const sFrontM = parseFloat(targetInputs.frontYardDepth) || 0;
        const sBackM = parseFloat(targetInputs.backYardDepth) || 0;
        const sSideM = parseFloat(targetInputs.sideYardDepth) || 0;
        const sByRatio = parseFloat(targetInputs.minBackyardDepthRatio) || 0;

        const heightAt50 = (() => {
            const target = 50;
            if (target <= 0) return 0;
            if (target <= sFloorHeight1F) return Math.min(target, Math.max(0, targetMassing.totalHeight));
            const remaining = target - sFloorHeight1F;
            const floorsNeeded = remaining / Math.max(0.01, sFloorHeightOther);
            return Math.min(Math.max(0, targetMassing.totalHeight), sFloorHeight1F + floorsNeeded * sFloorHeightOther);
        })();
        const getSetbacksAtHeight = (checkZ) => {
            let currentFrontM = sFrontM;
            let effectiveBackM = sBackM;
            let effectiveSideM = sSideM;
            let baseFrontM = sFrontM;
            let baseBackM = sBackM;
            if (isConstraintMode || showCheckLines) {
                if (showHeightRatio && sByRatio <= 0) {
                    const reqFrontHR = (checkZ / 3.6) - primRoadW_M;
                    if (reqFrontHR > currentFrontM) currentFrontM = reqFrontHR;
                }
                if (showWeiLao) {
                    const reqFrontWL = (checkZ / 5.0) - (primRoadW_M / 2);
                    if (reqFrontWL > currentFrontM) currentFrontM = reqFrontWL;
                }
            }
            if ((isConstraintMode || showCheckLines) && sByRatio > 0) {
                const reqBack = checkZ / sByRatio;
                if (effectiveBackM < reqBack) effectiveBackM = reqBack;
            }
            const maxBaseBackM = Math.max(0, targetDims.d - baseFrontM);
            if (baseBackM > maxBaseBackM) baseBackM = maxBaseBackM;
            const maxFrontM = Math.max(0, targetDims.d - baseBackM);
            if (currentFrontM > maxFrontM) currentFrontM = maxFrontM;
            const maxBackM = Math.max(0, targetDims.d - currentFrontM);
            if (effectiveBackM > maxBackM) effectiveBackM = maxBackM;
            return { front: currentFrontM, back: effectiveBackM, side: effectiveSideM };
        };
        const getSetbackForEdge = (origIdx, setbackSet, combinedEdgeTypesRef, frontIdxSet, autoBackIdxSet) => {
            if (frontIdxSet.has(origIdx)) return setbackSet.front;
            if (combinedEdgeTypesRef[origIdx] === 'back' || autoBackIdxSet.has(origIdx)) return setbackSet.back;
            if (combinedEdgeTypesRef[origIdx] === 'side') return setbackSet.side;
            return 0;
        };

        const primaryIndices = new Set();
        const secondaryIndices = new Set();

        if (siteRoads) {
            siteRoads.forEach(r => {
                const indices = new Set();
                if (r.edgeIndices) r.edgeIndices.forEach(i => indices.add(i));
                if (r.edgeIndex !== undefined && r.edgeIndex !== "") indices.add(parseInt(r.edgeIndex));

                if (r.type === 'primary') {
                    indices.forEach(i => primaryIndices.add(i));
                } else {
                    indices.forEach(i => secondaryIndices.add(i));
                }
            });
        }

        const frontIndices = ps?.frontIndices ? new Set(ps.frontIndices) : new Set();
        if (frontIndices.size === 0) {
            if (targetSite.id === activeSiteId && frontageIndices && frontageIndices.size > 0) {
                frontageIndices.forEach(i => frontIndices.add(i));
            } else {
                primaryIndices.forEach(i => frontIndices.add(i));
                if (primaryIndices.size === 0 && secondaryIndices.size > 0) {
                    secondaryIndices.forEach(i => frontIndices.add(i));
                }
            }
        }

        const combinedEdgeTypes = ps?.combinedEdgeTypes
            ? { ...ps.combinedEdgeTypes }
            : (targetSite.id === activeSiteId ? { ...edgeTypes } : {});
        secondaryIndices.forEach(idx => {
            if (!frontIndices.has(idx) && !combinedEdgeTypes[idx]) {
                combinedEdgeTypes[idx] = 'side';
            }
        });

        const centroid = getPolygonCentroid(workingPoints);
        const linesByEdge = {};

        const hasExplicitBack = Object.values(combinedEdgeTypes).includes('back');
        const autoBackIndices = new Set();

        if (!hasExplicitBack && frontIndices.size > 0 && targetNormalized.points && targetNormalized.points.length > 2) {
            const rawPts = targetNormalized.points;
            const rawCentroid = getPolygonCentroid(rawPts);
            let frontNormal = { x: 0, y: 0 };
            let count = 0;

            rawPts.forEach((p, i) => {
                if (frontIndices.has(i)) {
                    const p2 = rawPts[(i + 1) % rawPts.length];
                    const n = getSegmentNormal(p, p2, rawCentroid);
                    frontNormal.x += n.x;
                    frontNormal.y += n.y;
                    count++;
                }
            });

            if (count > 0) {
                const len = Math.sqrt(frontNormal.x * frontNormal.x + frontNormal.y * frontNormal.y);
                if (len > 0) {
                    frontNormal.x /= len; frontNormal.y /= len;
                    let bestBackIdx = -1;
                    let minDot = -0.25;
                    rawPts.forEach((p, i) => {
                        if (frontIndices.has(i) || combinedEdgeTypes[i]) return;
                        const p2 = rawPts[(i + 1) % rawPts.length];
                        const n = getSegmentNormal(p, p2, rawCentroid);
                        const dot = n.x * frontNormal.x + n.y * frontNormal.y;
                        if (dot < minDot) {
                            minDot = dot;
                            bestBackIdx = i;
                        }
                    });
                    if (bestBackIdx !== -1) {
                        autoBackIndices.add(bestBackIdx);
                    }
                }
            }
        }

        for (let i = 0; i < workingPoints.length; i++) {
            const p1 = workingPoints[i];
            const p2 = workingPoints[(i + 1) % workingPoints.length];
            const originalIdx = workingEdgeIndices[i];

            const normal = getSegmentNormal(p1, p2, centroid);
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

            if (!linesByEdge[originalIdx]) linesByEdge[originalIdx] = [];
            const minBYRatio = parseFloat(targetInputs.minBackyardDepthRatio || 0);
            const showFalling = fallingCurveRequired && showFallingCurve && showCheckLines && fallingCurveD > 0;
            const setbackAt50 = showFalling ? getSetbacksAtHeight(heightAt50) : null;

            // 1. 面前道路：高度比檢討線 (從主要道路外側邊界起算) & 危老檢討線 (從主要道路中心線起算)
            if (frontIndices.has(originalIdx)) {
                const fD = parseFloat(targetInputs.frontYardDepth || 0);

                // normal 指向基地內側，因此 -normal 指向面前道路外側
                const p_out_M = { x: mid.x - normal.x * primRoadW_M, y: mid.y - normal.y * primRoadW_M };
                const p_center_M = { x: mid.x - normal.x * (primRoadW_M / 2), y: mid.y - normal.y * (primRoadW_M / 2) };
                const p_setback_M = { x: mid.x + normal.x * fD, y: mid.y + normal.y * fD };

                if (showCheckLines && showWeiLao) {
                    const wlH = 5 * (0.5 * primRoadW_M + fD) * scale;
                    linesByEdge[originalIdx].push({
                        id: `weilao-${targetSite.id}-${i}`,
                        type: 'weilao',
                        start: { x: offX + p_center_M.x * scale, y: offY + p_center_M.y * scale, z: 0 },
                        end: { x: offX + p_setback_M.x * scale, y: offY + p_setback_M.y * scale, z: wlH },
                        label: "危老檢討",
                        color: isDarkMode ? "#60a5fa" : "#3b82f6",
                        dashed: true,
                        thick: true
                    });
                }
            }

            // 2. 後院深度比檢討線 (Back)
            const isBack = combinedEdgeTypes[originalIdx] === 'back' || autoBackIndices.has(originalIdx);

            if (showCheckLines && isBack && (showBackyard || (minBYRatio > 0 && showHeightRatio))) {
                const startM = mid;
                const vizHeight = 30;
                const effectiveRatio = minBYRatio > 0 ? minBYRatio : (sBackM > 0 ? (vizHeight / sBackM) : 2);
                const reqDist = vizHeight / effectiveRatio;

                const p_envelope_M = { x: mid.x + normal.x * reqDist, y: mid.y + normal.y * reqDist };

                if (showBackyard) {
                    linesByEdge[originalIdx].push({
                        id: `backyard-${targetSite.id}-${i}`,
                        type: 'backyard',
                        start: { x: offX + startM.x * scale, y: offY + startM.y * scale, z: 0 },
                        end: { x: offX + p_envelope_M.x * scale, y: offY + p_envelope_M.y * scale, z: vizHeight * scale },
                        label: minBYRatio > 0 ? `後院檢討 (1:${minBYRatio})` : `後院檢討 (${sBackM}m)`,
                        color: "#22c55e",
                        dashed: true,
                        thick: true
                    });
                }
            }

            if (showFalling) {
                const fallTop = Math.max(0, targetMassing.totalHeight);
                const fallBottom = Math.max(0, heightAt50);
                if (fallTop > fallBottom) {
                    const startSetback = getSetbackForEdge(originalIdx, setbackAt50, combinedEdgeTypes, frontIndices, autoBackIndices);
                    const endSetback = Math.max(fallingCurveD, startSetback);
                    const p_start_M = { x: mid.x + normal.x * startSetback, y: mid.y + normal.y * startSetback };
                    const p_end_M = { x: mid.x + normal.x * endSetback, y: mid.y + normal.y * endSetback };
                    linesByEdge[originalIdx].push({
                        id: `falling-${targetSite.id}-${i}`,
                        type: 'falling',
                        start: { x: offX + p_start_M.x * scale, y: offY + p_start_M.y * scale, z: fallBottom * scale },
                        end: { x: offX + p_end_M.x * scale, y: offY + p_end_M.y * scale, z: fallTop * scale },
                        label: "50m",
                        color: "#f59e0b",
                        dashed: true,
                        thick: true
                    });
                }
            }
        }

        Object.values(linesByEdge).forEach(groupLines => {
            const byType = {};
            groupLines.forEach(l => {
                if (!byType[l.type]) byType[l.type] = [];
                byType[l.type].push(l);
            });

            Object.values(byType).forEach(subGroup => {
                const midIdx = Math.floor(subGroup.length / 2);
                subGroup.forEach((l, idx) => {
                    if (idx !== midIdx) l.label = null;
                    lines.push(l);
                });
            });
        });

        return lines;
    };

    // 將高度比檢討線改為單一連接的 3D 斜面（支援直線與曲線面前道路）
    const renderHeightRatioSurface3D = (ps, baseRotDeg) => {
        if (!showCheckLines || !showHeightRatio) return null;
        const targetSite = ps?.site || activeSite;
        const targetInputs = targetSite?.inputs || inputs;
        const targetNormalized = ps?.normalized || normalizedData;
        const targetDims = getSiteDefaultDims(targetSite);

        const offX = w / 2;
        const offY = d / 2;
        const siteRoads = getSiteRoads(targetSite);
        if (!siteRoads || siteRoads.length === 0) return null;
        let primRoad = siteRoads.find(r => r.type === 'primary') || siteRoads[0];
        const primRoadW_M = primRoad ? (parseFloat(primRoad.width) || 6) : 6;
        const fD = parseFloat(targetInputs.frontYardDepth || 0);
        const hRatioH = 3.6 * (primRoadW_M + fD) * scale;
        if (hRatioH <= 0) return null;

        let basePts = targetNormalized.points;
        let baseCrvs = targetNormalized.curves;
        if (!basePts || basePts.length < 3) {
            const hw = targetDims.w / 2; const hd = targetDims.d / 2;
            basePts = [{ x: -hw, y: -hd }, { x: hw, y: -hd }, { x: hw, y: hd }, { x: -hw, y: hd }];
            baseCrvs = [];
        }

        const primaryIndices = new Set();
        const secondaryIndices = new Set();
        siteRoads.forEach(r => {
            const indices = new Set();
            if (r.edgeIndices) r.edgeIndices.forEach(i => indices.add(i));
            if (r.edgeIndex !== undefined && r.edgeIndex !== "") indices.add(parseInt(r.edgeIndex));
            if (r.type === 'primary') indices.forEach(i => primaryIndices.add(i));
            else indices.forEach(i => secondaryIndices.add(i));
        });

        const frontIndices = new Set();
        if (primaryIndices.size > 0) {
            primaryIndices.forEach(i => frontIndices.add(i));
        } else if (secondaryIndices.size > 0) {
            secondaryIndices.forEach(i => frontIndices.add(i));
        } else if (targetSite.id === activeSiteId && frontageIndices && frontageIndices.size > 0) {
            frontageIndices.forEach(i => frontIndices.add(i));
        }
        if (frontIndices.size === 0) return null;

        const centroid = getPolygonCentroid(basePts);
        const surfaces = [];
        const frontArr = Array.from(frontIndices);

        frontArr.forEach((edgeIdx, fGroupIdx) => {
            if (edgeIdx < 0 || edgeIdx >= basePts.length) return;
            const p1 = basePts[edgeIdx];
            const p2 = basePts[(edgeIdx + 1) % basePts.length];
            const ctrl = baseCrvs?.[edgeIdx];
            const M = ctrl ? 18 : 1;

            const verts = [];
            for (let j = 0; j <= M; j++) {
                const t = j / M;
                if (ctrl) {
                    const mt = 1 - t;
                    verts.push({
                        x: mt * mt * p1.x + 2 * mt * t * ctrl.x + t * t * p2.x,
                        y: mt * mt * p1.y + 2 * mt * t * ctrl.y + t * t * p2.y
                    });
                } else {
                    verts.push({
                        x: p1.x + (p2.x - p1.x) * t,
                        y: p1.y + (p2.y - p1.y) * t
                    });
                }
            }

            const segNormals = [];
            for (let j = 0; j < M; j++) {
                segNormals.push(getSegmentNormal(verts[j], verts[j + 1], centroid));
            }

            const vertNormals = [];
            for (let j = 0; j <= M; j++) {
                if (j === 0) vertNormals.push(segNormals[0]);
                else if (j === M) vertNormals.push(segNormals[M - 1]);
                else {
                    const nx = segNormals[j - 1].x + segNormals[j].x;
                    const ny = segNormals[j - 1].y + segNormals[j].y;
                    const len = Math.hypot(nx, ny);
                    vertNormals.push(len > 1e-6 ? { x: nx / len, y: ny / len } : segNormals[j]);
                }
            }

            const bottomPts = verts.map((v, j) => ({
                x: offX + (v.x - vertNormals[j].x * primRoadW_M) * scale,
                y: offY + (v.y - vertNormals[j].y * primRoadW_M) * scale,
                z: 0
            }));
            const topPts = verts.map((v, j) => ({
                x: offX + (v.x + vertNormals[j].x * fD) * scale,
                y: offY + (v.y + vertNormals[j].y * fD) * scale,
                z: hRatioH
            }));

            const midStripIdx = Math.floor(M / 2);

            for (let j = 0; j < M; j++) {
                const S1 = bottomPts[j];
                const S2 = bottomPts[j + 1];
                const E1 = topPts[j];
                const E2 = topPts[j + 1];

                const midS = { x: (S1.x + S2.x) / 2, y: (S1.y + S2.y) / 2 };
                const midE = { x: (E1.x + E2.x) / 2, y: (E1.y + E2.y) / 2 };
                const dx = midE.x - midS.x;
                const dy = midE.y - midS.y;
                const horizDist = Math.hypot(dx, dy);
                if (horizDist < 1e-4) continue;

                const slopeLen = Math.hypot(horizDist, hRatioH);
                const ux = dx / horizDist;
                const uy = dy / horizDist;
                const tx = -uy;
                const ty = ux;

                const angleZ = (Math.atan2(dy, dx) * 180) / Math.PI;
                const angleY = -(Math.atan2(hRatioH, horizDist) * 180) / Math.PI;

                const s1_x = (S1.x - midS.x) * ux + (S1.y - midS.y) * uy;
                const s1_y = (S1.x - midS.x) * tx + (S1.y - midS.y) * ty;
                const s2_x = (S2.x - midS.x) * ux + (S2.y - midS.y) * uy;
                const s2_y = (S2.x - midS.x) * tx + (S2.y - midS.y) * ty;

                const e1_x = slopeLen + ((E1.x - midE.x) * ux + (E1.y - midE.y) * uy);
                const e1_y = (E1.x - midS.x) * tx + (E1.y - midS.y) * ty;
                const e2_x = slopeLen + ((E2.x - midE.x) * ux + (E2.y - midE.y) * uy);
                const e2_y = (E2.x - midS.x) * tx + (E2.y - midS.y) * ty;

                const showLabelHere = fGroupIdx === 0 && j === midStripIdx;

                surfaces.push(
                    <div
                        key={`hr-surf-${targetSite.id}-${edgeIdx}-${j}`}
                        className="pointer-events-none"
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: `${slopeLen}px`,
                            height: '1px',
                            transformOrigin: '0 0',
                            transform: `translate3d(${midS.x}px, ${midS.y}px, 0px) rotateZ(${angleZ}deg) rotateY(${angleY}deg)`,
                            transformStyle: 'preserve-3d'
                        }}
                    >
                        <svg
                            width={slopeLen}
                            height="1"
                            style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0 }}
                        >
                            <polygon
                                points={`${s1_x},${s1_y} ${s2_x},${s2_y} ${e2_x},${e2_y} ${e1_x},${e1_y}`}
                                fill={isDarkMode ? "rgba(244, 63, 94, 0.24)" : "rgba(244, 63, 94, 0.20)"}
                                stroke="rgba(244, 63, 94, 0.22)"
                                strokeWidth="0.75"
                            />
                            {/* 底部起算邊界線 (道路外側) */}
                            <line x1={s1_x} y1={s1_y} x2={s2_x} y2={s2_y} stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" />
                            {/* 頂部高度比包絡邊界線 */}
                            <line x1={e1_x} y1={e1_y} x2={e2_x} y2={e2_y} stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" />
                            {/* 僅在曲面兩端繪製側邊實線，形成單一完整連接面 */}
                            {j === 0 && (
                                <line x1={s1_x} y1={s1_y} x2={e1_x} y2={e1_y} stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" />
                            )}
                            {j === M - 1 && (
                                <line x1={s2_x} y1={s2_y} x2={e2_x} y2={e2_y} stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" />
                            )}
                        </svg>
                        {showLabelHere && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: `${slopeLen * 0.28}px`,
                                    top: '0px',
                                    transformStyle: 'preserve-3d',
                                    transform: `rotateY(${-angleY}deg) rotateZ(${-angleZ}deg)`
                                }}
                            >
                                <Si
                                    text="高度比"
                                    x={0}
                                    y={0}
                                    z={8}
                                    rotationZ={rotationZ + baseRotDeg}
                                    viewAngleX={viewAngleX}
                                    color="#f43f5e"
                                    bgColor={isDarkMode ? "rgba(15, 23, 42, 0.9)" : "rgba(255, 255, 255, 0.95)"}
                                    borderColor="#f43f5e"
                                    scale={0.8}
                                />
                            </div>
                        )}
                    </div>
                );
            }
        });

        return surfaces;
    };

    const skyBgColor = isDarkMode ? '#0f172a' : '#e0f2fe';
    const groundColor = isDarkMode ? '#1e293b' : '#e7e5e4';
    const landscapeStyle = isLandscapeMode
        ? { position: 'fixed', top: 0, left: '100vw', width: '100dvh', height: '100vw', transform: 'rotate(90deg)', transformOrigin: 'top left', zIndex: 9999, margin: 0, borderRadius: 0, touchAction: 'none', backgroundColor: skyBgColor }
        : { touchAction: 'none', backgroundColor: skyBgColor };
    const controlBarClass = isLandscapeMode ? "absolute top-6 right-6 z-30 flex flex-col items-end gap-2" : "absolute top-4 right-4 z-30 flex flex-col items-end gap-2 sm:flex-row sm:items-center";
    const viewTransition = isDragging ? 'none' : 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)';

    return (
        <div className="w-full h-full flex flex-col relative overflow-hidden font-['GenYoGothic',_sans-serif]">
            {showUnusedPrompt && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setShowUnusedPrompt(false)}></div>
                    <div className="relative bg-white rounded-lg shadow-xl border border-stone-200 w-72 p-4">
                        <h3 className="font-bold text-sm mb-2 text-stone-700">未用容積</h3>
                        {randomSlabEnabled ? (
                            <>
                                <div className="text-xs text-stone-600 mb-3">還有 {formatNum(toPing(unusedArea))} 坪未使用，是否自動增加樓層？</div>
                                <div className="flex gap-2">
                                    <button onClick={() => {
                                        setShowUnusedPrompt(false);
                                        const avgArea = massingLayers.currentTotalUsed / Math.max(1, massingLayers.totalFloors);
                                        const addFloors = Math.max(1, Math.round(unusedArea / avgArea));
                                        const nextFloors = massingLayers.totalFloors + addFloors;
                                        setManualFloorsOverride(nextFloors);
                                        onUpdateInputs('floorsAbove', nextFloors);
                                    }} className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700">是</button>
                                    <button onClick={() => setShowUnusedPrompt(false)} className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-600 text-xs font-bold hover:bg-stone-50">否</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-xs text-stone-600 mb-3">還有 {formatNum(toPing(unusedArea))} 坪未使用，是否平均分配至所有地上樓層？</div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setShowUnusedPrompt(false); handleAutoDistributeUnusedArea(); }} className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700">是</button>
                                    <button onClick={() => setShowUnusedPrompt(false)} className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-600 text-xs font-bold hover:bg-stone-50">否</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            <div className="w-full h-full relative flex flex-col flex-1">
                <div ref={viewportRef} className={`flex-1 relative flex flex-col items-center justify-center perspective-1000 w-full h-full overflow-hidden transition-colors duration-500 touch-none ${isDragging ? 'cursor-grabbing' : (placementMode === 'independent' ? 'cursor-crosshair' : 'cursor-grab')}`} style={landscapeStyle} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleMouseUp} onClick={(e) => {
                    if (placementMode === 'independent' && onConfirmPlacement) {
                        onConfirmPlacement();
                    } else {
                        handleBgClick(e);
                    }
                }}>
                    <div className="absolute top-4 left-4 z-40 flex flex-col gap-2">
                        <div className="flex theme-panel-glass backdrop-blur rounded-lg border theme-border shadow-sm p-1 gap-1">
                            <button onClick={() => setViewMode('3d')} className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold transition-colors ${viewMode === '3d' ? 'theme-btn-active' : 'theme-text-muted hover:opacity-80'}`}><Box size={14} /> 3D 模擬</button>
                            <button onClick={() => setViewMode('2d')} className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold transition-colors ${viewMode === '2d' ? 'theme-btn-active' : 'theme-text-muted hover:opacity-80'}`}><LayoutTemplate size={14} /> 平面分析</button>
                        </div>
                    </div>
                    <div className={controlBarClass}>
                        <div className="theme-panel-glass p-1.5 rounded-full border shadow-lg flex flex-row items-center gap-2 backdrop-blur-md transition-colors duration-300">
                            <button onClick={() => setIsDarkMode(prev => !prev)} className="p-2 rounded-full transition-all theme-text hover:text-[var(--text-accent)] hover:opacity-80" title={isDarkMode ? "切換為亮色模式" : "切換為夜間模式"}>{isDarkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
                            <button onClick={() => setShowSummaryPanel && setShowSummaryPanel(prev => !prev)} className="p-2 rounded-full transition-all theme-text hover:text-[var(--text-accent)] hover:opacity-80" title="開啟/關閉專案摘要"><PanelRightOpen size={18} /></button>
                        </div>
                    </div>
                    {isConstraintMode && viewMode === '3d' && (<div className="absolute bottom-24 right-6 z-20 pointer-events-none"><div className="bg-emerald-600/90 text-white px-3 py-1.5 rounded-full shadow-lg text-sm font-bold flex items-center gap-2 backdrop-blur border border-emerald-400 animate-pulse"><CheckCircle2 size={16} fill="white" className="text-emerald-700" />鎖定編輯 (法規檢討中)</div></div>)}
                    {viewMode === '2d' ? (
                        <PlanAnalysis2D layers={floorLayers} baseWidthM={baseWidthM} baseDepthM={baseDepthM} onSelectFloor={(id) => { if (id === 'base' || id === 'excavation' || /^B\d+$/.test(id)) { setSelectedFloor({ id }); } else if (id) { const l = floorLayers.find(f => f.id === id); if (l) handleLayerClick({ stopPropagation: () => { } }, l); } }} selectedFloorId={selectedFloor?.id} isDarkMode={isDarkMode} onUpdateSetting={updateFloorSetting} floorSettings={floorSettings} inputs={inputs} scale3d={scale} basements={basements} onToggleBasement={toggleBasement} activeBasementArea={activeBasementArea} totalAllowedArea={parseFloat(res.totalCFA) || 0} showCheckLines={showCheckLines} volumeLimit={volumeLimit} parkingOn1F={parkingOn1F} onToggleParkingLocation={toggleParkingLocation} onClose={() => { if (selectedFloor) { setSelectedFloor(null); } else { setViewMode('3d'); } }} basePoints={basePoints} baseCurves={baseCurves} excavationPoints={excavationPoints} excavationCurves={excavationCurves} onAddRoad={onUpdateRoads} frontageIndices={frontageIndices} onUpdateFrontageIndices={setFrontageIndices} onAddFloor={handleAddFloor} onRemoveFloor={handleRemoveFloor} edgeTypes={edgeTypes} onUpdateEdgeTypes={updateEdgeTypes} view={view2D} onUpdateView={setView2D} onUpdateInputs={onUpdateInputs} onUpdateRoads={onUpdateRoads} onEditEnd={handleBaseEditEnd} unitSettings={unitSettings} onUpdateUnitSettings={setUnitSettings} onApplyAll={handleApplyAllFloors} floorsAboveValue={floorsAboveValue} onUpdateFloorsAbove={handleSetFloorsAbove} />
                    ) : (
                        <>
                            {!isConstraintMode && <FloorInfoCard data={selectedFloor} isDarkMode={isDarkMode} onReset={resetFloor} isConstraintMode={isConstraintMode} inputs={inputs} />}

                            <div ref={compassRef} onPointerDown={handleCompassPointerDown} onPointerMove={handleCompassPointerMove} onPointerUp={handleCompassPointerUp} onPointerLeave={handleCompassPointerUp} className={`absolute bottom-8 right-6 z-20 pointer-events-auto transition-opacity duration-300 ${isDragging ? 'opacity-40' : 'opacity-100'}`}>
                                <ArtisticCompass className="w-16 h-16" rotation={rotationZ - (inputs.northAngle || 0)} isDarkMode={isDarkMode} />
                            </div>

                            {totalAreaViolation && <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none animate-pulse"><div className="bg-red-500/90 text-white px-3 py-1.5 rounded-full shadow-lg text-sm font-bold flex items-center gap-2 backdrop-blur"><AlertTriangle size={16} fill="white" className="text-red-500" />總容積超限! (量體 {formatNum(toPing(massingLayers.currentTotalUsed))} &gt; 法定 {formatNum(toPing(volumeLimit))}坪)</div></div>}
                            {isConstraintMode && unusedArea > 0.1 && (
                                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
                                    <div className="bg-emerald-600/90 text-white px-3 py-1.5 rounded-full shadow-lg text-sm font-bold flex items-center gap-2 backdrop-blur border border-emerald-400">
                                        <CheckCircle2 size={16} fill="white" className="text-emerald-700" />
                                        剩餘容積: {formatNum(toPing(unusedArea))} 坪 (可再增加樓層)
                                    </div>
                                </div>
                            )}
                            <div className="relative w-full h-full flex items-center justify-center pointer-events-none" style={{ perspective: '2500px', transformStyle: 'preserve-3d' }}>
                                <div style={{ transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0px) scale(${zoom}) rotateX(${viewAngleX}deg) rotateZ(${rotationZ}deg) translate3d(${focusOffset.x}px, ${focusOffset.y}px, ${focusOffset.z}px)`, transformStyle: 'preserve-3d', transition: viewTransition, willChange: 'transform', backfaceVisibility: 'hidden' }}>
                                    {/* SketchUp-style Ground Plane forming horizon with Sky */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            width: '12000px',
                                            height: '12000px',
                                            marginLeft: '-6000px',
                                            marginTop: '-6000px',
                                            backgroundColor: groundColor,
                                            transform: 'translateZ(-1px)',
                                            pointerEvents: 'none',
                                            transition: 'background-color 0.5s'
                                        }}
                                    />
                                    <div style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -w/2, marginTop: -d/2, width: `${w}px`, height: `${d}px`, backgroundColor: 'transparent', transformStyle: 'preserve-3d', transition: 'background-color 0.5s', pointerEvents: 'auto' }} onMouseDown={handleMouseDown} onTouchStart={handleTouchStart}>
                                    </div>

                                    <div style={{ position: 'absolute', top: 0, left: 0, transformStyle: 'preserve-3d' }}>
                                        {processedSites.map((ps, siteIdx) => {
                                            const layout = ps.layout;
                                            const isPrimary = ps.site.id === activeSiteId;
                                            const isHovered = hoveredSiteId === ps.site.id;
                                            const baseRotDeg = ((layout.rotation || 0) * 180) / Math.PI;
                                            const roofZ = (ps.massing.totalHeight || 0) * scale;
                                            const labelZ = roofZ + 28 + (siteIdx % 2) * 14;

                                            return (
                                                <div 
                                                    key={ps.site.id} 
                                                    onMouseEnter={() => setHoveredSiteId(ps.site.id)}
                                                    onMouseLeave={() => setHoveredSiteId(null)}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '50%', left: '50%',
                                                        width: w, height: d,
                                                        marginLeft: -w/2, marginTop: -d/2,
                                                        transform: `translate3d(${(layout.x - projectBounds.center.x) * scale}px, ${(layout.y - projectBounds.center.y) * scale}px, 0) rotateZ(${layout.rotation}rad)`,
                                                        transformStyle: 'preserve-3d'
                                                    }}
                                                >
                                                    {ps.normalized.points && ps.normalized.points.length > 0 && (
                                                        <svg width="100%" height="100%" viewBox={`0 0 ${w} ${d}`} style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 }}>
                                                            <path
                                                                d={generateSvgPath(ps.normalized.points, ps.normalized.curves, scale, w / 2, d / 2)}
                                                                fill={isDarkMode ? 'rgba(30, 41, 59, 0.45)' : 'rgba(255, 255, 255, 0.55)'}
                                                                stroke={isPrimary ? '#0284c7' : (isDarkMode ? '#64748b' : '#78716c')}
                                                                strokeWidth={isPrimary ? '2' : '1.5'}
                                                            />
                                                        </svg>
                                                    )}
                                                    {renderRoads(ps)}
                                                    {renderReviewSurfaces(ps)}
                                                    {renderPolygonSetbacks(ps)}
                                                    
                                                    {/* Render Adjacent Lands (獨立向外偏移並貼合弧形基地/道路，絕不與基地重疊) */}
                                                    {adjacentLandEnabled && (ps.site.adjacentLandGroups || []).some(g => {
                                                        if (!g || !g.edges) return false;
                                                        if (Array.isArray(g.edges)) return g.edges.length > 0;
                                                        if (typeof g.edges.size === 'number') return g.edges.size > 0;
                                                        if (typeof g.edges.length === 'number') return g.edges.length > 0;
                                                        return false;
                                                    }) && (() => {
                                                        const pts = ps.normalized.points;
                                                        const curves = ps.normalized.curves;
                                                        if (!pts || pts.length < 3) return null;
                                                        const N = pts.length;
                                                        const siteCentroid = getPolygonCentroid(pts);
                                                        const buildingCoverage = Math.min(0.9, Math.max(0.2, parseFloat(ps.site.inputs.buildingCoverage || ps.site.inputs.coverageRatio || 60) / 100));
                                                        const totalH = ps.massing.totalHeight || 15;
                                                        const parcelDepth = 20;
                                                        const minGapFromSite = 0.5;
                                                        const parcels = [];

                                                        const siteRoads = getSiteRoads(ps.site);
                                                        const primRoad = siteRoads.find(r => r.type === 'primary') || siteRoads[0];
                                                        const defaultRoadW = primRoad ? (parseFloat(primRoad.width) || 6) : 6;
                                                        const getEdgeRoadWidth = (idx) => {
                                                            const matched = siteRoads.find(r =>
                                                                parseInt(r.edgeIndex, 10) === idx ||
                                                                (Array.isArray(r.edgeIndices) && r.edgeIndices.some(ei => parseInt(ei, 10) === idx))
                                                            );
                                                            if (matched) return parseFloat(matched.width) || defaultRoadW;
                                                            if (ps.frontIndices && ps.frontIndices.has(idx)) return defaultRoadW;
                                                            return 0;
                                                        };

                                                        const getRoadExtensionDir = (rEdgeIdx, atEnd) => {
                                                            const rp1 = pts[rEdgeIdx];
                                                            const rp2 = pts[(rEdgeIdx + 1) % N];
                                                            const rCtrl = curves?.[rEdgeIdx];
                                                            const rSteps = rCtrl ? 18 : 1;
                                                            const evalRoadPt = (t) => {
                                                                if (rCtrl) {
                                                                    const mt = 1 - t;
                                                                    return {
                                                                        x: mt * mt * rp1.x + 2 * mt * t * rCtrl.x + t * t * rp2.x,
                                                                        y: mt * mt * rp1.y + 2 * mt * t * rCtrl.y + t * t * rp2.y
                                                                    };
                                                                }
                                                                return {
                                                                    x: rp1.x + (rp2.x - rp1.x) * t,
                                                                    y: rp1.y + (rp2.y - rp1.y) * t
                                                                };
                                                            };
                                                            const qA = evalRoadPt(atEnd ? (rSteps - 1) / rSteps : 1 / rSteps);
                                                            const qB = evalRoadPt(atEnd ? 1 : 0);
                                                            const dx = qB.x - qA.x;
                                                            const dy = qB.y - qA.y;
                                                            const len = Math.hypot(dx, dy);
                                                            return len > 1e-6 ? { x: dx / len, y: dy / len } : null;
                                                        };

                                                        (ps.site.adjacentLandGroups || []).forEach((group, gIdx) => {
                                                            const edgesArr = (Array.isArray(group.edges) ? group.edges : Array.from(group.edges || []))
                                                                .filter(eIdx => typeof eIdx === 'number' && eIdx >= 0 && eIdx < N);
                                                            if (edgesArr.length === 0) return;

                                                            edgesArr.forEach((eIdx, subIdx) => {
                                                                const p1 = pts[eIdx];
                                                                const p2 = pts[(eIdx + 1) % N];
                                                                const ctrl = curves?.[eIdx];
                                                                const rw = getEdgeRoadWidth(eIdx);

                                                                const prevEdgeIdx = (eIdx - 1 + N) % N;
                                                                const nextEdgeIdx = (eIdx + 1) % N;
                                                                const prevHasRoad = rw === 0 && getEdgeRoadWidth(prevEdgeIdx) > 0;
                                                                const nextHasRoad = rw === 0 && getEdgeRoadWidth(nextEdgeIdx) > 0;

                                                                const chordInN = getSegmentNormal(p1, p2, siteCentroid);
                                                                const chordOutN = { x: -chordInN.x, y: -chordInN.y };

                                                                let dirStart = chordOutN;
                                                                let dirEnd = chordOutN;
                                                                const prevRoadDir = prevHasRoad ? getRoadExtensionDir(prevEdgeIdx, true) : null;
                                                                const nextRoadDir = nextHasRoad ? getRoadExtensionDir(nextEdgeIdx, false) : null;
                                                                if (prevRoadDir && nextRoadDir) {
                                                                    if (prevRoadDir.x * chordOutN.x + prevRoadDir.y * chordOutN.y > 0.15) dirStart = prevRoadDir;
                                                                    if (nextRoadDir.x * chordOutN.x + nextRoadDir.y * chordOutN.y > 0.15) dirEnd = nextRoadDir;
                                                                } else if (prevRoadDir && (prevRoadDir.x * chordOutN.x + prevRoadDir.y * chordOutN.y > 0.15)) {
                                                                    dirStart = prevRoadDir;
                                                                    dirEnd = prevRoadDir;
                                                                } else if (nextRoadDir && (nextRoadDir.x * chordOutN.x + nextRoadDir.y * chordOutN.y > 0.15)) {
                                                                    dirStart = nextRoadDir;
                                                                    dirEnd = nextRoadDir;
                                                                }

                                                                const segSteps = ctrl ? 18 : 1;
                                                                const edgeSamplePts = [];
                                                                for (let s = 0; s <= segSteps; s++) {
                                                                    const t = s / segSteps;
                                                                    if (ctrl) {
                                                                        const mt = 1 - t;
                                                                        edgeSamplePts.push({
                                                                            x: mt * mt * p1.x + 2 * mt * t * ctrl.x + t * t * p2.x,
                                                                            y: mt * mt * p1.y + 2 * mt * t * ctrl.y + t * t * p2.y
                                                                        });
                                                                    } else {
                                                                        edgeSamplePts.push({
                                                                            x: p1.x + (p2.x - p1.x) * t,
                                                                            y: p1.y + (p2.y - p1.y) * t
                                                                        });
                                                                    }
                                                                }

                                                                const outNormals = [];
                                                                for (let s = 0; s < segSteps; s++) {
                                                                    const inN = getSegmentNormal(edgeSamplePts[s], edgeSamplePts[s + 1], siteCentroid);
                                                                    outNormals.push({ x: -inN.x, y: -inN.y });
                                                                }

                                                                const vertOutNormals = [];
                                                                for (let s = 0; s <= segSteps; s++) {
                                                                    if (s === 0) vertOutNormals.push(outNormals[0]);
                                                                    else if (s === segSteps) vertOutNormals.push(outNormals[segSteps - 1]);
                                                                    else {
                                                                        const nx = outNormals[s - 1].x + outNormals[s].x;
                                                                        const ny = outNormals[s - 1].y + outNormals[s].y;
                                                                        const len = Math.hypot(nx, ny);
                                                                        vertOutNormals.push(len > 1e-6 ? { x: nx / len, y: ny / len } : outNormals[s]);
                                                                    }
                                                                }

                                                                const getSampleRayDir = (u) => {
                                                                    const rx = dirStart.x * (1 - u) + dirEnd.x * u;
                                                                    const ry = dirStart.y * (1 - u) + dirEnd.y * u;
                                                                    const rLen = Math.hypot(rx, ry);
                                                                    return rLen > 1e-6 ? { x: rx / rLen, y: ry / rLen } : chordOutN;
                                                                };

                                                                const innerChain = edgeSamplePts.map((pt, s) => {
                                                                    const u = s / segSteps;
                                                                    const rayDir = getSampleRayDir(u);
                                                                    const vn = vertOutNormals[s];
                                                                    const roadShiftX = rw > 0 ? vn.x * rw : 0;
                                                                    const roadShiftY = rw > 0 ? vn.y * rw : 0;
                                                                    return {
                                                                        x: pt.x + roadShiftX + rayDir.x * minGapFromSite,
                                                                        y: pt.y + roadShiftY + rayDir.y * minGapFromSite
                                                                    };
                                                                });

                                                                let maxBowOut = 0;
                                                                innerChain.forEach((pt, s) => {
                                                                    const u = s / segSteps;
                                                                    const chordPt = {
                                                                        x: innerChain[0].x * (1 - u) + innerChain[innerChain.length - 1].x * u,
                                                                        y: innerChain[0].y * (1 - u) + innerChain[innerChain.length - 1].y * u
                                                                    };
                                                                    const bow = (pt.x - chordPt.x) * chordOutN.x + (pt.y - chordPt.y) * chordOutN.y;
                                                                    if (bow > maxBowOut) maxBowOut = bow;
                                                                });

                                                                const effectiveDepth = Math.max(parcelDepth, maxBowOut + 12);
                                                                const outerStart = {
                                                                    x: innerChain[0].x + dirStart.x * effectiveDepth,
                                                                    y: innerChain[0].y + dirStart.y * effectiveDepth
                                                                };
                                                                const outerEnd = {
                                                                    x: innerChain[innerChain.length - 1].x + dirEnd.x * effectiveDepth,
                                                                    y: innerChain[innerChain.length - 1].y + dirEnd.y * effectiveDepth
                                                                };
                                                                const outerChain = edgeSamplePts.map((_, s) => {
                                                                    const u = s / segSteps;
                                                                    return {
                                                                        x: outerStart.x * (1 - u) + outerEnd.x * u,
                                                                        y: outerStart.y * (1 - u) + outerEnd.y * u
                                                                    };
                                                                });

                                                                const patchPts = [...innerChain, ...[...outerChain].reverse()];
                                                                const parcelCenter = getPolygonCentroid(patchPts);
                                                                const innerMid = innerChain[Math.floor(innerChain.length / 2)] || parcelCenter;

                                                                // 若該邊外側已緊鄰其他基地，自動跳過繪製此邊的臨地，避免臨地壓到相鄰基地
                                                                const cosCur = Math.cos(ps.layout?.rotation || 0);
                                                                const sinCur = Math.sin(ps.layout?.rotation || 0);
                                                                const toWorldCur = (pt) => ({
                                                                    x: (ps.layout?.x || 0) + (pt.x * cosCur - pt.y * sinCur),
                                                                    y: (ps.layout?.y || 0) + (pt.x * sinCur + pt.y * cosCur)
                                                                });
                                                                const worldTestPts = [toWorldCur(parcelCenter), toWorldCur(innerMid)];
                                                                const overlapsOtherSite = processedSites.some(otherPs => {
                                                                    if (!otherPs || otherPs.site.id === ps.site.id || !otherPs.normalized?.points) return false;
                                                                    const oLayout = otherPs.layout || { x: 0, y: 0, rotation: 0 };
                                                                    const cosInv = Math.cos(-(oLayout.rotation || 0));
                                                                    const sinInv = Math.sin(-(oLayout.rotation || 0));
                                                                    const oPoly = discretizePolygon(otherPs.normalized.points, otherPs.normalized.curves, 14).points;
                                                                    return worldTestPts.some(wPt => {
                                                                        const dx = wPt.x - (oLayout.x || 0);
                                                                        const dy = wPt.y - (oLayout.y || 0);
                                                                        const localPt = { x: dx * cosInv - dy * sinInv, y: dx * sinInv + dy * cosInv };
                                                                        return pointInPolygon(localPt, oPoly);
                                                                    });
                                                                });
                                                                if (overlapsOtherSite) return;

                                                                const gPath = patchPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${w / 2 + p.x * scale} ${d / 2 + p.y * scale}`).join(' ') + ' Z';

                                                                // 鄰房量體同樣依照曲線法向量偏移與切線端點內縮，確保彎曲邊界時鄰房完全貼合弧形且不壓到基地
                                                                const coverageScale = Math.sqrt(buildingCoverage) * 0.85;
                                                                const depthRatioMin = Math.max(0.08, (1 - coverageScale) * 0.5);
                                                                const depthRatioMax = Math.min(0.92, 1 - depthRatioMin);
                                                                const tTrim = (1 - coverageScale) * 0.45;

                                                                const bldgInnerChain = [];
                                                                const bldgOuterChain = [];
                                                                for (let s = 0; s <= segSteps; s++) {
                                                                    const u = tTrim + (1 - 2 * tTrim) * (s / segSteps);
                                                                    let bx, by;
                                                                    if (ctrl) {
                                                                        const mu = 1 - u;
                                                                        bx = mu * mu * p1.x + 2 * mu * u * ctrl.x + u * u * p2.x;
                                                                        by = mu * mu * p1.y + 2 * mu * u * ctrl.y + u * u * p2.y;
                                                                    } else {
                                                                        bx = p1.x + (p2.x - p1.x) * u;
                                                                        by = p1.y + (p2.y - p1.y) * u;
                                                                    }
                                                                    const vn = vertOutNormals[s];
                                                                    const rayDir = getSampleRayDir(u);
                                                                    const roadShiftX = rw > 0 ? vn.x * rw : 0;
                                                                    const roadShiftY = rw > 0 ? vn.y * rw : 0;
                                                                    const inPt = { x: bx + roadShiftX + rayDir.x * minGapFromSite, y: by + roadShiftY + rayDir.y * minGapFromSite };
                                                                    const outPt = { x: outerStart.x * (1 - u) + outerEnd.x * u, y: outerStart.y * (1 - u) + outerEnd.y * u };
                                                                    bldgInnerChain.push({ x: inPt.x + (outPt.x - inPt.x) * depthRatioMin, y: inPt.y + (outPt.y - inPt.y) * depthRatioMin });
                                                                    bldgOuterChain.push({ x: inPt.x + (outPt.x - inPt.x) * depthRatioMax, y: inPt.y + (outPt.y - inPt.y) * depthRatioMax });
                                                                }
                                                                const bldgPts = [...bldgInnerChain, ...bldgOuterChain.reverse()];

                                                                parcels.push(
                                                                    <React.Fragment key={`adj-${ps.site.id}-${group.id}-${eIdx}`}>
                                                                        <svg width="100%" height="100%" viewBox={`0 0 ${w} ${d}`} style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                                                                            <path d={gPath} fill={isDarkMode ? 'rgba(168,85,247,0.14)' : 'rgba(168,85,247,0.09)'} stroke="#a855f7" strokeWidth="1.2" strokeDasharray="4,4" />
                                                                            {subIdx === 0 && (
                                                                                <text x={w / 2 + parcelCenter.x * scale} y={d / 2 + parcelCenter.y * scale} textAnchor="middle" fontSize="10" fill="#a855f7" fontWeight="bold" opacity="0.85">臨地 {gIdx + 1}</text>
                                                                            )}
                                                                        </svg>
                                                                        <BuildingLayer points={bldgPts} height={totalH * scale} x={0} y={0} z={0} rotation={0} scale={scale} color={isDarkMode ? 'rgba(168,85,247,0.16)' : 'rgba(168,85,247,0.12)'} strokeColor="#a855f7" showFrame={true} opacity={0.45} visible={true} isSlabMode={false} isDarkMode={isDarkMode} isViolation={false} />
                                                                    </React.Fragment>
                                                                );
                                                            });
                                                        });
                                                        return parcels;
                                                    })()}

                                                    {/* Render Connected 3D Height Ratio Surface & Other CheckLines for Active Site */}
                                                    {isPrimary && renderHeightRatioSurface3D(ps, baseRotDeg)}
                                                    {isPrimary && calculateCheckLines(ps).map(line => (
                                                        <CheckLine key={line.id} {...line} baseRotation={baseRotDeg} viewAngleX={viewAngleX} rotationZ={rotationZ} visible={true} dashed={line.dashed} thick={line.thick} isDarkMode={isDarkMode} labelPosRatio={0.25} />
                                                    ))}

                                                    {/* Render Massing Layers (支援選中樓層亮顯、其餘樓層黯淡顯示) */}
                                                    {(() => {
                                                        const hasFloorFocus = Boolean(
                                                            selectedFloor &&
                                                            selectedFloor.id &&
                                                            selectedFloor.id !== 'base' &&
                                                            selectedFloor.id !== 'excavation'
                                                        );
                                                        return ps.massing.layers.map((layer) => {
                                                            const baseLayerId = (layer.id && layer.id.includes('-')) ? layer.id.split('-')[0] : layer.id;
                                                            const isLayerSelected = isPrimary && hasFloorFocus && (
                                                                selectedFloor.id === layer.id ||
                                                                selectedFloor.id === baseLayerId
                                                            );

                                                            let layerColor = isPrimary ? colors.floor : "rgba(148, 163, 184, 0.4)";
                                                            let layerStroke = isPrimary ? colors.stroke : "rgba(100, 116, 139, 0.5)";
                                                            let layerOpacity = layer.opacity || 1;

                                                            if (hasFloorFocus) {
                                                                if (isLayerSelected) {
                                                                    layerColor = isDarkMode ? "rgba(56, 189, 248, 0.85)" : "rgba(251, 146, 60, 0.82)";
                                                                    layerStroke = isDarkMode ? "#38bdf8" : "#ea580c";
                                                                    layerOpacity = 1;
                                                                } else {
                                                                    layerColor = isDarkMode ? "rgba(51, 65, 85, 0.14)" : "rgba(214, 211, 209, 0.18)";
                                                                    layerStroke = isDarkMode ? "rgba(100, 116, 139, 0.22)" : "rgba(168, 162, 158, 0.28)";
                                                                    layerOpacity = 0.22;
                                                                }
                                                            }

                                                            return (
                                                                <BuildingLayer 
                                                                    key={`fl-${ps.site.id}-${layer.id}`} 
                                                                    width={layer.widthPx} 
                                                                    depth={layer.depthPx} 
                                                                    height={layer.height} 
                                                                    x={layer.shiftX} 
                                                                    y={layer.shiftYPx} 
                                                                    z={layer.z} 
                                                                    rotation={layer.rotation} 
                                                                    pivot={isPrimary && isLayerSelected ? selectedFloor.pivot : (ps.site.floorSettings?.[layer.id]?.pivot || {x: 0, y: 0})} 
                                                                    scale={scale} 
                                                                    points={layer.points} 
                                                                    curves={layer.curves} 
                                                                    color={layerColor} 
                                                                    strokeColor={layerStroke} 
                                                                    showFrame={true} 
                                                                    opacity={layerOpacity}
                                                                    visible={layer.visible !== false}
                                                                    isSelected={isLayerSelected}
                                                                    isSlabMode={false}
                                                                    isDarkMode={isDarkMode}
                                                                    isViolation={layer.isViolation} 
                                                                    onClick={(e) => isPrimary && handleLayerClick(e, layer)} 
                                                                />
                                                            );
                                                        });
                                                    })()}

                                                    {/* 3D-Anchored Site Label (Locked to Roof Center like CheckLine/Si - Never Drifts!) */}
                                                    <div
                                                        className="absolute origin-left pointer-events-none"
                                                        style={{
                                                            left: 0,
                                                            top: 0,
                                                            width: `${labelZ - roofZ}px`,
                                                            height: '2px',
                                                            backgroundColor: isPrimary ? '#10b981' : '#94a3b8',
                                                            transform: `translate3d(${w / 2}px, ${d / 2}px, ${roofZ}px) rotateY(-90deg)`,
                                                            zIndex: 7500
                                                        }}
                                                    />
                                                    <div
                                                        className="absolute pointer-events-auto cursor-pointer"
                                                        style={{
                                                            left: 0,
                                                            top: 0,
                                                            transform: `translate3d(${w / 2}px, ${d / 2}px, ${labelZ}px) rotateZ(${-(rotationZ + baseRotDeg)}deg) rotateX(${-viewAngleX}deg)`,
                                                            zIndex: isHovered || isPrimary ? 8500 : 8000
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const sIdx = sites.findIndex(s => s.id === ps.site.id);
                                                            if (sIdx !== -1 && typeof setActiveSiteIndex === 'function') {
                                                                setActiveSiteIndex(sIdx);
                                                            }
                                                        }}
                                                    >
                                                        <div
                                                            style={{ transform: 'translate(-50%, -100%)' }}
                                                            className={`px-2.5 py-1 rounded-md border-2 text-xs font-black shadow-md flex items-center gap-1.5 whitespace-nowrap transition-colors duration-200 ${
                                                                isHovered
                                                                    ? 'bg-[var(--text-accent)] text-white border-black shadow-[2px_2px_0_#000]'
                                                                    : (isPrimary
                                                                        ? 'bg-slate-900 text-white border-black shadow-[2px_2px_0_#000]'
                                                                        : 'bg-white/95 text-slate-800 border-slate-400 hover:border-black shadow-sm'
                                                                    )
                                                            }`}
                                                        >
                                                            <span className={`w-2 h-2 rounded-full ${isPrimary ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                                                            <span>{ps.site.name}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        
                                        {/* 獨立放置精準預覽 (Independent Placement Preview，支援弧線邊界自適應) */}
                                        {placementMode === 'independent' && placementPreview && (() => {
                                            const pW = placementPreview.width;
                                            const pD = placementPreview.depth;
                                            const previewPoints = placementPreview.adaptedPoints || [
                                                { x: -pW/2, y: -pD/2 },
                                                { x: pW/2, y: -pD/2 },
                                                { x: pW/2, y: pD/2 },
                                                { x: -pW/2, y: pD/2 }
                                            ];
                                            const previewCurves = placementPreview.adaptedCurves || null;
                                            const previewColor = placementPreview.isOverlapping ? "rgba(239, 68, 68, 0.4)" : "rgba(16, 185, 129, 0.4)";
                                            const previewStrokeColor = placementPreview.isOverlapping ? "#ef4444" : "#10b981";
                                            const previewRotDeg = ((placementPreview.rotation || 0) * 180) / Math.PI;
                                            
                                            return (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '50%', left: '50%',
                                                    width: w, height: d,
                                                    marginLeft: -w/2, marginTop: -d/2,
                                                    transform: `translate3d(${(placementPreview.x - projectBounds.center.x) * scale}px, ${(placementPreview.y - projectBounds.center.y) * scale}px, 0) rotateZ(${placementPreview.rotation}rad)`,
                                                    transformStyle: 'preserve-3d',
                                                    pointerEvents: 'none',
                                                    zIndex: 100
                                                }}>
                                                    <BuildingLayer 
                                                        width={pW * scale} 
                                                        depth={pD * scale} 
                                                        height={15 * scale} 
                                                        x={0} 
                                                        y={0} 
                                                        z={0} 
                                                        rotation={0} 
                                                        scale={scale} 
                                                        points={previewPoints} 
                                                        curves={previewCurves}
                                                        color={previewColor} 
                                                        strokeColor={previewStrokeColor} 
                                                        showFrame={true} 
                                                        opacity={0.6}
                                                        visible={true}
                                                        isSlabMode={false}
                                                        isDarkMode={isDarkMode}
                                                        isViolation={placementPreview.isOverlapping} 
                                                    />
                                                    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${d}`} style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 12 }}>
                                                        <path
                                                            d={generateSvgPath(previewPoints, previewCurves, scale, w / 2, d / 2)}
                                                            fill={previewColor}
                                                            stroke={previewStrokeColor}
                                                            strokeWidth="3"
                                                            strokeDasharray="5,5"
                                                        />
                                                    </svg>
                                                    <div
                                                        className="absolute pointer-events-none"
                                                        style={{
                                                            left: 0,
                                                            top: 0,
                                                            transform: `translate3d(${w / 2}px, ${d / 2}px, ${15 * scale + 28}px) rotateZ(${-(rotationZ + previewRotDeg)}deg) rotateX(${-viewAngleX}deg)`,
                                                            zIndex: 9000
                                                        }}
                                                    >
                                                        <div
                                                            style={{ transform: 'translate(-50%, -100%)' }}
                                                            className={`px-3 py-1.5 border-2 text-xs font-black shadow-md whitespace-nowrap transition-all duration-300 animate-pulse ${
                                                                placementPreview.isOverlapping
                                                                    ? 'bg-red-600 text-white border-black shadow-[3px_3px_0_#000]'
                                                                    : 'bg-emerald-600 text-white border-black shadow-[3px_3px_0_#000]'
                                                            }`}
                                                        >
                                                            {placementPreview.isOverlapping ? '🚨 基地重疊/佔用道路！' : '📍 點擊畫布放置基地'}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* 專案摘要 Floating DraggablePanel */}
            {showSummaryPanel && (
                <DraggablePanel title="專案摘要 / Project Summary" onClose={() => setShowSummaryPanel && setShowSummaryPanel(false)}>
                    <div className="space-y-4 min-w-[280px]">
                        <div className="space-y-2">
                            <SummaryRow label="專案名稱" value={inputs.projectName || '未命名專案'} />
                            <SummaryRow label="目前基地" value={activeSite.name || '基地 A'} />
                            <SummaryRow label="工程預算" value={`${formatNum(res.estimatedBudget)} 萬`} highlight />
                            <SummaryRow label="建築物高度" value={`${formatNum(massingLayers.totalHeight)} m`} />
                            <SummaryRow label="模擬樓層" value={`${visualFloorsAbove} 層`} subtext="(含退縮)" />
                            {showCheckLines && showHeightRatio && <SummaryRow label="高度比" value={formatNum(res.heightRatio, 2)} isAlert={res.isHighRise} alertText={res.isSuperHighRise ? "超高" : "高層"} />}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="theme-panel p-3 rounded-lg border theme-border">
                                <div className="theme-text-muted text-[10px] uppercase mb-1">樓層配置</div>
                                <div className="font-bold text-lg num-font text-indigo-600">{visualFloorsAbove}F <span className="text-xs font-sans font-normal theme-text-muted">/ B{inputs.floorsBelow}</span></div>
                            </div>
                            <div className="theme-panel p-3 rounded-lg border theme-border">
                                <div className="theme-text-muted text-[10px] uppercase mb-1">預估車位</div>
                                <div className="font-bold text-lg num-font theme-text">{res.possibleParking} <span className="text-xs font-sans font-normal theme-text-muted">部</span></div>
                            </div>
                        </div>
                        <div className="p-4 theme-panel border theme-border rounded-lg">
                            <div className="theme-text-muted text-xs font-bold uppercase mb-3 flex items-center gap-2"><Car size={14} /> 停車空間預估</div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3"><div className="p-2 theme-panel-glass rounded theme-text"><Car size={18} /></div><div><div className="text-xs theme-text-muted">汽車位</div><div className="font-bold theme-text text-lg num-font">{res.possibleParking}</div></div></div>
                                <div className="h-8 w-[1px] theme-border"></div>
                                <div className="flex items-center gap-3"><div className="p-2 theme-panel-glass rounded theme-text"><Bike size={18} /></div><div><div className="text-xs theme-text-muted">機車位</div><div className="font-bold theme-text text-lg num-font">{Math.floor(res.possibleParking * 1.2)}</div></div></div>
                            </div>
                        </div>
                    </div>
                </DraggablePanel>
            )}

            {/* 臨地與簡易造型 Floating DraggablePanel */}
            {showEnvPanel && (
                <DraggablePanel title="臨地顯示與簡易造型模擬" onClose={() => setShowEnvPanel && setShowEnvPanel(false)}>
                    <div className="space-y-4 min-w-[300px]">
                        <div className="theme-panel p-4 rounded-lg border theme-border">
                            <div className="theme-text-muted text-xs font-bold uppercase mb-1">隨機簡易造型</div>
                            <div className="theme-text-muted text-xs mb-3">隨機調整各層樓板大小、形狀（多邊形/弧形）及位置偏移，限制在退縮線與最大容積內。</div>
                            <div className="grid grid-cols-5 gap-1 mb-3">
                                {[['scale','縮放'],['morph','變形'],['arc','弧形'],['offset','偏移'],['all','全部']].map(([mode, label]) => (
                                    <button
                                        key={mode}
                                        onClick={() => setRandomSlabShapeMode(mode)}
                                        className={`px-2 py-1.5 rounded text-xs font-bold border transition-colors ${
                                            randomSlabShapeMode === mode
                                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                                                : 'theme-panel theme-text-muted theme-border hover:opacity-80'
                                        }`}
                                    >{label}</button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setRandomSlabEnabled(true); setRandomSlabSeed(Date.now()); setFloorSettings(prev => { const next = { ...prev }; Object.keys(next).forEach(k => { if (/^\d+F$/.test(k)) { delete next[k].manualArea; delete next[k].manualDim; delete next[k].width; delete next[k].depth; delete next[k].area; delete next[k].offset; } }); return next; }); }} className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-sm hover:bg-indigo-700">{randomSlabEnabled ? '重新隨機造型' : '啟用隨機造型'}</button>
                                {randomSlabEnabled && (
                                    <button onClick={() => setRandomSlabEnabled(false)} className="px-3 py-2 rounded-lg border border-stone-300 text-xs font-bold theme-text hover:opacity-80">還原標準量體</button>
                                )}
                            </div>
                        </div>

                        <div className="p-4 theme-panel border theme-border rounded-lg">
                            <div className="theme-text-muted text-xs font-bold uppercase mb-3 flex items-center justify-between">
                                <span className="flex items-center gap-2"><MapIcon size={14} /> 臨地顯示模擬</span>
                                <button onClick={() => {
                                    const nextEnabled = !adjacentLandEnabled;
                                    setAdjacentLandEnabled(nextEnabled);
                                    if (nextEnabled) {
                                        const hasAnyEdge = adjacentLandGroups.some(g => Array.isArray(g.edges) && g.edges.length > 0);
                                        if (!hasAnyEdge) {
                                            const ptsCount = (normalizedData.points || []).length || 4;
                                            const roadEdgeSet = new Set();
                                            (getSiteRoads(activeSite) || []).forEach(r => {
                                                if (r.edgeIndex !== undefined && r.edgeIndex !== "") roadEdgeSet.add(parseInt(r.edgeIndex));
                                                if (Array.isArray(r.edgeIndices)) r.edgeIndices.forEach(idx => roadEdgeSet.add(idx));
                                            });
                                            const defaultEdges = [];
                                            for (let idx = 0; idx < ptsCount; idx++) {
                                                if (!roadEdgeSet.has(idx)) defaultEdges.push(idx);
                                            }
                                            setAdjacentLandGroups([{ id: 1, edges: defaultEdges.length > 0 ? defaultEdges : [0] }]);
                                        }
                                    }
                                }} className={`px-3 py-1 rounded-full border shadow-sm flex items-center gap-2 text-xs font-bold transition-colors ${adjacentLandEnabled ? 'bg-purple-50 border-purple-200 text-purple-600' : 'theme-panel theme-border theme-text-muted'}`}>
                                    {adjacentLandEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                    {adjacentLandEnabled ? '開啟' : '關閉'}
                                </button>
                            </div>
                            {adjacentLandEnabled && (
                                <div className="mt-2">
                                    <div className="text-xs theme-text-muted mb-2">設定臨地組合（點選邊線產生鄰房量體）：</div>
                                    {adjacentLandGroups.map((group, gIdx) => (
                                        <div key={group.id} className="mb-2 p-2 theme-panel-glass rounded border theme-border">
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="text-xs font-bold theme-text">臨地組合 {gIdx + 1}</div>
                                                {gIdx > 0 && (
                                                    <button onClick={() => setAdjacentLandGroups(prev => prev.filter(g => g.id !== group.id))} className="text-red-500 hover:text-red-600 px-1"><X size={12}/></button>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {(normalizedData.points || []).map((_, i) => {
                                                    const inOtherGroup = adjacentLandGroups.some(g => g.id !== group.id && (Array.isArray(g.edges) ? g.edges.includes(i) : (g.edges && typeof g.edges.includes === 'function' ? g.edges.includes(i) : false)));
                                                    const isActive = Array.isArray(group.edges) ? group.edges.includes(i) : (group.edges && typeof group.edges.includes === 'function' ? group.edges.includes(i) : false);
                                                    return (
                                                        <button key={`adj-edge-${group.id}-${i}`}
                                                            disabled={inOtherGroup}
                                                            onClick={() => {
                                                                setAdjacentLandGroups(prev => prev.map(g => {
                                                                    if (g.id === group.id) {
                                                                        const next = Array.isArray(g.edges) ? [...g.edges] : Array.from(g.edges || []);
                                                                        if (next.includes(i)) next.splice(next.indexOf(i), 1); else next.push(i);
                                                                        return { ...g, edges: next };
                                                                    }
                                                                    return g;
                                                                }));
                                                            }}
                                                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                                                                isActive ? 'bg-purple-600 text-white border-purple-700 shadow-sm' : 
                                                                inOtherGroup ? 'opacity-30 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400' :
                                                                'theme-panel theme-text-muted theme-border hover:opacity-80'
                                                            }`}
                                                        >邊 {i}</button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={() => setAdjacentLandGroups(prev => [...prev, { id: Date.now(), edges: [] }])} className="w-full py-1.5 text-xs font-bold theme-text-muted border mt-1 rounded border-dashed hover:opacity-80 transition-opacity">
                                        + 新增臨地組合
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </DraggablePanel>
            )}
        </div>
    );
};

export default Visualizer3D;
