import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    Layers, Map as MapIcon, RotateCw, Hexagon, Maximize2, Minimize2, Move, Box,
    CheckCircle2, ChevronDown, ChevronUp, Lock, Unlock, AlertTriangle,
    Edit2, Undo2, Shovel, LayoutDashboard, Pencil, Plus, Check, X,
    Compass, Hand, Eye, Magnet, CornerDownLeft, Sparkles, SlidersHorizontal, CheckSquare, Sun, Moon, Upload
} from 'lucide-react';
import { EditableInput, EditMenu2D, CoordinatePopup, ToolIconBtn, useHoverTipsPreference } from './SitePolygonEditor';
import { MobileBottomNav } from './MobileBottomNav';
import {
    generateSvgPath, getPolygonCentroid, getPolygonBounds, calculatePolygonArea,
    scalePolygon, discretizePolygon, getSegmentNormal, getLineIntersection,
    offsetPolygon, constrainPolygonToLegalBoundary, getSplitUnits,
    polygonSignedArea, distToSegment
} from '../utils/polygon';
import { toPing, formatNum } from '../utils/geometry';

/**
 * 整合式 2D/3D 幾何與點拉線編輯控制器 Hook
 * 將原本獨立的 2D 平面分析與 3D 模擬完全合一，支援在任意 3D 視角或正射俯視下：
 * 1. 點拉線繪製基地（支援正交鎖定、節點/道路吸附、精確米數輸入、即時面積與邊長預覽）
 * 2. 直接於 3D 場景中的基地面、開挖面或各樓層樓板面上拖曳頂點、拉動弧線、雙擊新增頂點、框選多點与設定退縮/道路/分戶
 */
export function useUnifiedEditorController({
    layers,
    baseWidthM,
    baseDepthM,
    selectedFloorId,
    onSelectFloor,
    onCloseFloorEdit,
    onUpdateSetting,
    floorSettings,
    inputs,
    scale3d,
    basements,
    basePoints,
    baseCurves,
    excavationPoints,
    excavationCurves,
    frontageIndices,
    onUpdateFrontageIndices,
    edgeTypes,
    onUpdateEdgeTypes,
    onUpdateInputs,
    onUpdateRoads,
    onEditEnd,
    unitSettings,
    onUpdateUnitSettings,
    onApplyAll,
    floorsAboveValue,
    onUpdateFloorsAbove,
    screenToSiteLocal,
    projectLocalToScreen,
    snapCandidates = [],
    onCreateDrawnSite,
    activeSiteName = '基地 A',
    nextSiteLabel = 'B'
}) {
    // 預設矩形頂點（當基地尚未自訂多邊形時使用）
    const defaultBasePts = useMemo(() => {
        const w = baseWidthM || 15;
        const d = baseDepthM || 15;
        return [
            { x: -w / 2, y: -d / 2 },
            { x: w / 2, y: -d / 2 },
            { x: w / 2, y: d / 2 },
            { x: -w / 2, y: d / 2 }
        ];
    }, [baseWidthM, baseDepthM]);

    const [showFloorDialog, setShowFloorDialog] = useState(false);
    const [showApplyAllDialog, setShowApplyAllDialog] = useState(false);
    const [floorConfig, setFloorConfig] = useState({
        above: Math.max(1, parseInt(floorsAboveValue || '1')),
        below: Math.max(0, parseInt(inputs.floorsBelow || '0'))
    });

    const currentBasePoints = basePoints && basePoints.length >= 3 ? basePoints : defaultBasePts;
    const baseCentroid = useMemo(() => getPolygonCentroid(currentBasePoints), [currentBasePoints]);

    // 依樓層分組（合併分戶如 1F-A, 1F-B 為 1F 群組）
    const groupedLayers = useMemo(() => {
        const map = {};
        const order = [];
        (layers || []).forEach(layer => {
            const baseId = layer.id.split('-')[0];
            if (!map[baseId]) {
                map[baseId] = { id: baseId, units: [] };
                order.push(baseId);
            }
            map[baseId].units.push(layer);
        });
        return order.map(id => map[id]);
    }, [layers]);

    const normalizedSelectedFloorId = useMemo(() => {
        if (!selectedFloorId) return null;
        if (selectedFloorId === 'base' || selectedFloorId === 'excavation' || /^B\d+$/.test(selectedFloorId)) {
            return selectedFloorId;
        }
        return selectedFloorId.includes('-') ? selectedFloorId.split('-')[0] : selectedFloorId;
    }, [selectedFloorId]);

    // 計算當前正在場景中編輯的目標圖層資料 (displayLayer)
    const displayLayer = useMemo(() => {
        if (!normalizedSelectedFloorId) return null;
        if (normalizedSelectedFloorId === 'base') {
            return {
                id: 'base',
                points: currentBasePoints,
                realWidth: baseWidthM,
                realDepth: baseDepthM,
                realArea: calculatePolygonArea(currentBasePoints, baseCurves) || inputs.baseArea,
                isViolation: false,
                curves: baseCurves,
                z: 0,
                height: 0
            };
        }
        if (normalizedSelectedFloorId === 'excavation') {
            const scaleRate = Math.sqrt((inputs.excavationRatio || 70) / 100);
            const defaultExcavationW = baseWidthM * scaleRate;
            const defaultExcavationD = baseDepthM * scaleRate;
            let excPts = excavationPoints;
            let excCurvs = excavationCurves || null;
            if (!excPts && currentBasePoints) {
                const scaled = scalePolygon(currentBasePoints, baseCurves, scaleRate, getPolygonCentroid(currentBasePoints));
                excPts = scaled.points;
                excCurvs = excCurvs || scaled.curves;
            }
            return {
                id: 'excavation',
                points: excPts,
                realWidth: defaultExcavationW,
                realDepth: defaultExcavationD,
                realArea: excPts ? calculatePolygonArea(excPts, excCurvs) : (defaultExcavationW * defaultExcavationD),
                isViolation: false,
                curves: excCurvs,
                z: 0,
                height: 0
            };
        }
        if (/^B\d+$/.test(normalizedSelectedFloorId)) {
            const basement = (basements || []).find(b => b.id === normalizedSelectedFloorId);
            if (basement) {
                let fallbackPts = excavationPoints;
                let fallbackCurves = excavationCurves || null;
                if (!fallbackPts && currentBasePoints) {
                    const scaleRate = Math.sqrt((inputs.excavationRatio || 70) / 100);
                    const scaled = scalePolygon(currentBasePoints, baseCurves, scaleRate, getPolygonCentroid(currentBasePoints));
                    fallbackPts = scaled.points;
                    fallbackCurves = scaled.curves;
                }
                const setting = floorSettings?.[normalizedSelectedFloorId] || {};
                const pts = setting.points || fallbackPts;
                const curves = setting.curves || fallbackCurves || null;
                const defaultW = baseWidthM * Math.sqrt((inputs.excavationRatio || 70) / 100);
                const defaultD = baseDepthM * Math.sqrt((inputs.excavationRatio || 70) / 100);
                const area = pts ? calculatePolygonArea(pts, curves) : basement.area;
                return {
                    id: normalizedSelectedFloorId,
                    points: pts,
                    curves,
                    realWidth: defaultW,
                    realDepth: defaultD,
                    realArea: area,
                    isViolation: false,
                    z: 0,
                    height: 0
                };
            }
        }
        const exactLayer = (layers || []).find(l => l.id === normalizedSelectedFloorId);
        const splitLayer = exactLayer || (layers || []).find(l => l.id.startsWith(`${normalizedSelectedFloorId}-`));
        if (splitLayer) {
            const setting = floorSettings?.[normalizedSelectedFloorId] || {};
            const isSplitUnit = splitLayer.id.includes('-') || Boolean(setting.units && setting.units.length > 0) || Boolean(setting.unitConfig);
            const basePts = splitLayer.unsplitPoints || (!isSplitUnit ? splitLayer.points : null) || setting.points || splitLayer.points || null;
            const baseCurvs = splitLayer.unsplitCurves || (!isSplitUnit ? splitLayer.curves : null) || setting.curves || splitLayer.curves || null;
            const baseArea = basePts ? calculatePolygonArea(basePts, baseCurvs) : splitLayer.realArea;
            return {
                ...splitLayer,
                id: normalizedSelectedFloorId,
                points: basePts,
                curves: baseCurvs,
                realArea: baseArea
            };
        }
        return null;
    }, [
        normalizedSelectedFloorId,
        currentBasePoints,
        baseWidthM,
        baseDepthM,
        baseCurves,
        inputs.baseArea,
        inputs.excavationRatio,
        excavationPoints,
        excavationCurves,
        basements,
        floorSettings,
        layers
    ]);

    const savedUnits = useMemo(() => {
        if (!normalizedSelectedFloorId) return null;
        const unitLayers = (layers || []).filter(l => l.id.startsWith(`${normalizedSelectedFloorId}-`) && l.points);
        if (unitLayers.length > 0) {
            return unitLayers.map(l => l.points);
        }
        return floorSettings?.[normalizedSelectedFloorId]?.units || null;
    }, [layers, floorSettings, normalizedSelectedFloorId]);

    // ── 點拉線繪製基地狀態 (Point-to-Point Site Drawing State) ──
    const [isDrawingSite, setIsDrawingSite] = useState(false);
    const [drawTarget, setDrawTarget] = useState('current'); // 'current' | 'new'
    const [drawnPoints, setDrawnPoints] = useState([]);
    const [cursorPoint, setCursorPoint] = useState(null);
    const [snappedInfo, setSnappedInfo] = useState(null); // { pt, label, type }
    const [isOrthoLocked, setIsOrthoLocked] = useState(false);
    const [isSnapEnabled, setIsSnapEnabled] = useState(true);
    const [customLengthInput, setCustomLengthInput] = useState('');

    // ── 形狀與控制點編輯狀態 ──
    const [isRoadSelectMode, setIsRoadSelectMode] = useState(false);
    const [interactionMode, setInteractionMode] = useState('none');
    const [selectedPointForEdit, setSelectedPointForEdit] = useState(null);
    const [selectedCurveForEdit, setSelectedCurveForEdit] = useState(null);
    const [isAreaLocked, setIsAreaLocked] = useState(false);
    const lockedAreaRef = useRef(null);

    const [selectedIndices, setSelectedIndices] = useState(new Set());
    const selectedIndicesRef = useRef(selectedIndices);
    selectedIndicesRef.current = selectedIndices;
    const [lockedEdgeIndices, setLockedEdgeIndices] = useState(new Set());

    const draggingPointIdx = useRef(null);
    const draggingCurveIdx = useRef(null);
    const draggingEdgeIdx = useRef(null);
    const isDraggingLayer = useRef(false);
    const isDraggingHeight = useRef(false);
    const heightDragStartRef = useRef({ startY: 0, startHeightM: 3.6 });
    const [isActivelyDragging, setIsActivelyDragging] = useState(false);
    const lastLocalPos = useRef({ x: 0, y: 0 });
    const dragStartScreenPos = useRef({ x: 0, y: 0 });
    const longPressTimer = useRef(null);

    const pointGestureRef = useRef({ idx: null, wasAlreadySelected: false, hasMoved: false, startX: 0, startY: 0, shiftKey: false });
    const edgeGestureRef = useRef({ idx: null, hasMoved: false, startX: 0, startY: 0 });
    const lastEdgeTapRef = useRef({ idx: -1, time: 0 });

    const [boxSelectRect, setBoxSelectRect] = useState(null);
    const boxSelectRef = useRef({ active: false, startX: 0, startY: 0, currX: 0, currY: 0, additive: false });

    // 計算當前編輯平面在 3D 場景中的 Z 軸像素高度
    const activePlaneZPx = useMemo(() => {
        if (isDrawingSite || !displayLayer) return 0;
        if (displayLayer.id === 'base' || displayLayer.id === 'excavation' || /^B\d+$/.test(displayLayer.id)) {
            return 0;
        }
        return (displayLayer.z || 0) + (displayLayer.height || 0);
    }, [isDrawingSite, displayLayer]);

    // 計算當前編輯樓層的平面平移量 (公尺)
    const activeLayerShiftM = useMemo(() => {
        if (!displayLayer || displayLayer.id === 'base' || displayLayer.id === 'excavation' || /^B\d+$/.test(displayLayer.id)) {
            return { x: 0, y: 0 };
        }
        const sX = (displayLayer.shiftX || 0) / (scale3d || 1);
        const sY = (displayLayer.shiftYPx || 0) / (scale3d || 1);
        return { x: sX, y: sY };
    }, [displayLayer, scale3d]);

    // 將螢幕座標轉換為當前編輯圖層的局部公尺座標 (考慮樓層平移與旋轉)
    const getLayerLocalPointFromScreen = useCallback((clientX, clientY) => {
        if (!screenToSiteLocal) return { x: 0, y: 0 };
        const sitePt = screenToSiteLocal(clientX, clientY, activePlaneZPx);
        if (!displayLayer || displayLayer.id === 'base' || displayLayer.id === 'excavation' || /^B\d+$/.test(displayLayer.id)) {
            return sitePt;
        }
        let dx = sitePt.x - activeLayerShiftM.x;
        let dy = sitePt.y - activeLayerShiftM.y;
        if (displayLayer.rotation) {
            const rotRad = -((displayLayer.rotation || 0) * Math.PI) / 180;
            const cos = Math.cos(rotRad);
            const sin = Math.sin(rotRad);
            return {
                x: dx * cos - dy * sin,
                y: dx * sin + dy * cos
            };
        }
        return { x: dx, y: dy };
    }, [screenToSiteLocal, activePlaneZPx, displayLayer, activeLayerShiftM]);

    // 切換樓層時重置選取點狀態
    useEffect(() => {
        setSelectedIndices(new Set());
        setSelectedPointForEdit(null);
        setSelectedCurveForEdit(null);
    }, [normalizedSelectedFloorId]);

    // ── 資料更新與儲存邏輯（與 3D 基地局部座標系完全共用同一原點，不額外偏移） ──
    const toWorldFloorPoints = useCallback((points) => {
        if (!points || points.length === 0) return points;
        return points.map(p => ({ x: p.x, y: p.y }));
    }, []);

    const toWorldFloorCurves = useCallback((curves) => {
        if (!curves) return curves;
        const worldCurves = {};
        Object.keys(curves).forEach(k => {
            const cp = curves[k];
            if (cp) worldCurves[k] = { x: cp.x, y: cp.y };
        });
        return worldCurves;
    }, []);

    const updateSetting = useCallback((rawFloorId, field, value) => {
        const floorId = (rawFloorId && rawFloorId !== 'base' && rawFloorId !== 'excavation' && !/^B\d+$/.test(rawFloorId) && rawFloorId.includes('-'))
            ? rawFloorId.split('-')[0]
            : rawFloorId;

        if (floorId === 'base') {
            if (field === 'points') {
                const worldPoints = (value || []).map(p => ({ x: p.x, y: p.y }));
                const worldCurves = displayLayer?.curves || baseCurves || null;
                onUpdateSetting(floorId, 'points', worldPoints);
                if (worldCurves) onUpdateSetting(floorId, 'curves', worldCurves);
                const bounds = getPolygonBounds(worldPoints);
                if (bounds) {
                    const bw = bounds.maxX - bounds.minX;
                    const bd = bounds.maxY - bounds.minY;
                    onUpdateInputs('baseWidth', parseFloat(bw.toFixed(2)));
                    onUpdateInputs('baseWidthM', parseFloat(bw.toFixed(2)));
                    onUpdateInputs('baseDepthM', parseFloat(bd.toFixed(2)));
                }
                const newBaseArea = calculatePolygonArea(worldPoints, worldCurves);
                if (newBaseArea > 0) {
                    onUpdateInputs('baseArea', parseFloat(newBaseArea.toFixed(2)));
                }
                onUpdateInputs('baseVersion', (inputs.baseVersion || 0) + 1);
                return;
            }
            if (field === 'curves') {
                const worldPoints = displayLayer?.points || currentBasePoints;
                if (!basePoints && worldPoints) {
                    onUpdateSetting(floorId, 'points', worldPoints);
                }
                onUpdateSetting(floorId, 'curves', value);
                if (worldPoints) {
                    const newBaseArea = calculatePolygonArea(worldPoints, value);
                    if (newBaseArea > 0) {
                        onUpdateInputs('baseArea', parseFloat(newBaseArea.toFixed(2)));
                    }
                }
                onUpdateInputs('baseVersion', (inputs.baseVersion || 0) + 1);
                return;
            }
        }

        if (field === 'points') {
            // 保持使用者編輯的頂點數量與原始座標，絕不呼叫會切割多邊形並自動新增頂點的 clipPolygon
            const worldPoints = toWorldFloorPoints(value);
            onUpdateSetting(floorId, 'points', worldPoints);
            if (displayLayer?.curves) {
                const worldCurves = toWorldFloorCurves(displayLayer.curves);
                if (worldCurves) onUpdateSetting(floorId, 'curves', worldCurves);
            }
            return;
        }

        if (field === 'floorHeight') {
            const numH = Math.max(2.4, Math.min(24.0, parseFloat(value) || 3.2));
            onUpdateSetting(floorId, 'floorHeight', numH);
            if (floorId === '1F' && onUpdateInputs) {
                onUpdateInputs('floorHeight1F', numH);
            }
            return;
        }

        if (field === 'curves') {
            if (floorId === 'excavation') {
                if (!excavationPoints && displayLayer?.points) {
                    onUpdateSetting('excavation', 'points', toWorldFloorPoints(displayLayer.points));
                }
            } else if (!floorSettings?.[floorId]?.points && displayLayer?.points) {
                onUpdateSetting(floorId, 'points', toWorldFloorPoints(displayLayer.points));
            }
            const worldCurves = toWorldFloorCurves(value);
            onUpdateSetting(floorId, 'curves', worldCurves);
            return;
        }

        if (field === 'units') {
            const worldUnits = Array.isArray(value)
                ? value.map(uPts => toWorldFloorPoints(uPts))
                : value;
            onUpdateSetting(floorId, 'units', worldUnits);
            return;
        }

        onUpdateSetting(floorId, field, value);
    }, [
        displayLayer,
        baseCurves,
        basePoints,
        currentBasePoints,
        excavationPoints,
        floorSettings,
        inputs.baseVersion,
        onUpdateInputs,
        onUpdateSetting,
        toWorldFloorPoints,
        toWorldFloorCurves
    ]);

    // ── 點拉線繪製基地輔助函式 (Point-to-Point Drawing Functions) ──
    const startDrawingSite = useCallback((mode = 'current') => {
        setDrawTarget(mode);
        setDrawnPoints([]);
        setCursorPoint(null);
        setSnappedInfo(null);
        setCustomLengthInput('');
        setIsDrawingSite(true);
        // 清除正在選取的控制點
        setSelectedIndices(new Set());
        setSelectedPointForEdit(null);
        setSelectedCurveForEdit(null);
    }, []);

    const cancelDrawingSite = useCallback(() => {
        setIsDrawingSite(false);
        setDrawnPoints([]);
        setCursorPoint(null);
        setSnappedInfo(null);
    }, []);

    const undoLastDrawnPoint = useCallback(() => {
        setDrawnPoints(prev => prev.slice(0, -1));
    }, []);

    // 計算點拉線時的吸附與正交約束座標
    const computeConstrainedDrawPoint = useCallback((rawPt, shiftKey = false) => {
        let pt = { x: rawPt.x, y: rawPt.y };
        let snapMeta = null;
        const snapRadiusM = Math.max(0.8, 14 / (scale3d || 10));

        // 1. 優先檢查是否吸附至起點 #1 (當已落點 >= 3 點時可封閉多邊形)
        if (drawnPoints.length >= 3) {
            const p0 = drawnPoints[0];
            if (Math.hypot(pt.x - p0.x, pt.y - p0.y) <= snapRadiusM * 1.35) {
                return {
                    pt: { x: p0.x, y: p0.y },
                    snapMeta: { pt: p0, label: '點擊起點 #1 封閉基地', type: 'close' }
                };
            }
        }

        // 2. 節點與邊線吸附 (既有基地角點、道路邊線或已繪製頂點)
        if (isSnapEnabled) {
            for (const cand of snapCandidates) {
                if (cand.type === 'point') {
                    if (Math.hypot(pt.x - cand.pt.x, pt.y - cand.pt.y) <= snapRadiusM) {
                        pt = { x: cand.pt.x, y: cand.pt.y };
                        snapMeta = { pt, label: cand.label || '吸附角點', type: 'vertex' };
                        break;
                    }
                }
            }
            if (!snapMeta) {
                for (const cand of snapCandidates) {
                    if (cand.type === 'segment' && cand.p1 && cand.p2) {
                        const d = distToSegment(pt, cand.p1, cand.p2);
                        if (d <= snapRadiusM * 0.85) {
                            const l2 = (cand.p2.x - cand.p1.x) ** 2 + (cand.p2.y - cand.p1.y) ** 2;
                            const t = l2 > 1e-6
                                ? Math.max(0, Math.min(1, ((pt.x - cand.p1.x) * (cand.p2.x - cand.p1.x) + (pt.y - cand.p1.y) * (cand.p2.y - cand.p1.y)) / l2))
                                : 0;
                            pt = {
                                x: cand.p1.x + t * (cand.p2.x - cand.p1.x),
                                y: cand.p1.y + t * (cand.p2.y - cand.p1.y)
                            };
                            snapMeta = { pt, label: cand.label || '吸附邊界', type: 'edge' };
                            break;
                        }
                    }
                }
            }
        }

        // 3. 正交 / 45度角鎖定 (開啟正交鎖定或按住 Shift)
        if (!snapMeta && (isOrthoLocked || shiftKey) && drawnPoints.length > 0) {
            const lastPt = drawnPoints[drawnPoints.length - 1];
            const dx = pt.x - lastPt.x;
            const dy = pt.y - lastPt.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0.05) {
                const rawAngle = Math.atan2(dy, dx);
                // 鎖定至每 45 度 (0, 45, 90, 135, 180...)
                const stepRad = Math.PI / 4;
                const snappedAngle = Math.round(rawAngle / stepRad) * stepRad;
                pt = {
                    x: lastPt.x + Math.cos(snappedAngle) * dist,
                    y: lastPt.y + Math.sin(snappedAngle) * dist
                };
                // 若同時吸附至起點 X 或 Y 對齊線 (方便畫出完美矩形收尾)
                if (drawnPoints.length >= 2) {
                    const p0 = drawnPoints[0];
                    if (Math.abs(pt.x - p0.x) < snapRadiusM * 0.8) {
                        pt.x = p0.x;
                        snapMeta = { pt, label: '對齊起點 X 軸', type: 'align' };
                    } else if (Math.abs(pt.y - p0.y) < snapRadiusM * 0.8) {
                        pt.y = p0.y;
                        snapMeta = { pt, label: '對齊起點 Y 軸', type: 'align' };
                    }
                }
            }
        } else if (!snapMeta && isSnapEnabled) {
            // 輕微 0.1m 數值對齊 + 對齊起點水平/垂直輔助線
            if (drawnPoints.length >= 2) {
                const p0 = drawnPoints[0];
                if (Math.abs(pt.x - p0.x) < snapRadiusM * 0.6) {
                    pt.x = p0.x;
                    snapMeta = { pt, label: '垂直對齊起點 #1', type: 'align' };
                } else if (Math.abs(pt.y - p0.y) < snapRadiusM * 0.6) {
                    pt.y = p0.y;
                    snapMeta = { pt, label: '水平對齊起點 #1', type: 'align' };
                }
            }
            pt = {
                x: Math.round(pt.x * 10) / 10,
                y: Math.round(pt.y * 10) / 10
            };
        }

        return { pt, snapMeta };
    }, [drawnPoints, isOrthoLocked, isSnapEnabled, scale3d, snapCandidates]);

    // 完成點拉線封閉多邊形，立即產生基地與 3D 量體並進入基地形狀編輯模式
    const finishDrawingSite = useCallback((overridePts = null) => {
        const rawPts = Array.isArray(overridePts) ? overridePts : drawnPoints;
        if (!rawPts || rawPts.length < 3) return;

        // 移除最後一點若與起點過近的重複點
        const cleanedPts = [...rawPts];
        if (cleanedPts.length > 3) {
            const first = cleanedPts[0];
            const last = cleanedPts[cleanedPts.length - 1];
            if (Math.hypot(last.x - first.x, last.y - first.y) < 0.25) {
                cleanedPts.pop();
            }
        }
        if (cleanedPts.length < 3) return;

        const area = calculatePolygonArea(cleanedPts, null);
        if (area < 1.0) {
            alert('繪製的基地面積過小（需大於 1 ㎡），請重新拉線定位。');
            return;
        }

        // 確保頂點順序為正向 (Clockwise in SVG Y-down, signedArea > 0)，使法向量與道路方位一致
        const signed = polygonSignedArea(cleanedPts);
        const orderedPts = signed < 0 ? [...cleanedPts].reverse() : cleanedPts;

        if (drawTarget === 'new' && typeof onCreateDrawnSite === 'function') {
            onCreateDrawnSite(orderedPts);
        } else {
            // 重繪目前基地：將多邊形直接設為目前基地的 basePoints 與清除舊弧線
            onUpdateSetting('base', 'curves', null);
            updateSetting('base', 'points', orderedPts);
            if (onEditEnd) {
                onEditEnd('base', orderedPts);
            }
        }

        setIsDrawingSite(false);
        setDrawnPoints([]);
        setCursorPoint(null);
        setSnappedInfo(null);
        // 繪製完成後自動選中 'base'，讓使用者可立即微調頂點、拉弧線或設定道路與退縮
        if (onSelectFloor) {
            onSelectFloor('base');
        }
    }, [drawnPoints, drawTarget, onCreateDrawnSite, onUpdateSetting, updateSetting, onEditEnd, onSelectFloor]);

    // 依輸入的精確邊長 (m) 沿當前游標方向落點
    const placeByExactLength = useCallback((lenVal) => {
        const len = parseFloat(lenVal ?? customLengthInput);
        if (isNaN(len) || len <= 0) return;
        if (drawnPoints.length === 0) {
            setDrawnPoints([{ x: -len / 2, y: 0 }, { x: len / 2, y: 0 }]);
            setCustomLengthInput('');
            return;
        }
        const lastPt = drawnPoints[drawnPoints.length - 1];
        let dirX = 1, dirY = 0;
        if (cursorPoint) {
            const dx = cursorPoint.x - lastPt.x;
            const dy = cursorPoint.y - lastPt.y;
            const d = Math.hypot(dx, dy);
            if (d > 1e-4) {
                dirX = dx / d;
                dirY = dy / d;
            }
        }
        const nextPt = {
            x: parseFloat((lastPt.x + dirX * len).toFixed(2)),
            y: parseFloat((lastPt.y + dirY * len).toFixed(2))
        };
        setDrawnPoints(prev => [...prev, nextPt]);
        setCustomLengthInput('');
    }, [customLengthInput, drawnPoints, cursorPoint]);

    // ── 頂點、邊線、弧線、整層平移操作 Handlers ──
    const insertVertexOnEdge = useCallback((idx1, idx2, clickLocalPt = null) => {
        if (!displayLayer?.points) return;
        const pts = [...displayLayer.points];
        const p1 = pts[idx1];
        const p2 = pts[idx2];
        if (!p1 || !p2) return;

        const oldCurves = displayLayer.curves ? { ...displayLayer.curves } : null;
        const curve = oldCurves?.[idx1] || null;
        let t = 0.5;

        if (clickLocalPt && !isNaN(clickLocalPt.x) && !isNaN(clickLocalPt.y)) {
            if (curve) {
                // 沿二次貝茲曲線尋找最接近點擊位置的參數 t (0.1 ~ 0.9)
                let bestD = Infinity;
                for (let s = 1; s <= 19; s++) {
                    const candT = s / 20;
                    const mt = 1 - candT;
                    const qx = mt * mt * p1.x + 2 * mt * candT * curve.x + candT * candT * p2.x;
                    const qy = mt * mt * p1.y + 2 * mt * candT * curve.y + candT * candT * p2.y;
                    const d = Math.hypot(clickLocalPt.x - qx, clickLocalPt.y - qy);
                    if (d < bestD) { bestD = d; t = candT; }
                }
            } else {
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const l2 = dx * dx + dy * dy;
                if (l2 > 1e-6) {
                    const rawT = ((clickLocalPt.x - p1.x) * dx + (clickLocalPt.y - p1.y) * dy) / l2;
                    t = Math.max(0.1, Math.min(0.9, rawT));
                }
            }
        }

        // 若該邊為弧線，使用 De Casteljau 精準細分二次貝茲曲線，確保插入頂點後外型 100% 不跳動
        let newP;
        let nextCurves = null;
        const isClosing = (idx2 === 0 && idx1 === pts.length - 1);
        const insertIdx = isClosing ? pts.length : idx1 + 1;

        if (oldCurves && Object.keys(oldCurves).length > 0) {
            nextCurves = {};
            Object.keys(oldCurves).forEach(keyStr => {
                const k = parseInt(keyStr, 10);
                if (isNaN(k) || !oldCurves[k]) return;
                if (k < idx1) {
                    nextCurves[k] = oldCurves[k];
                } else if (k > idx1) {
                    nextCurves[k + 1] = oldCurves[k];
                }
            });
        }

        if (curve) {
            const mt = 1 - t;
            const c1 = { x: mt * p1.x + t * curve.x, y: mt * p1.y + t * curve.y };
            const c2 = { x: mt * curve.x + t * p2.x, y: mt * curve.y + t * p2.y };
            newP = { x: mt * c1.x + t * c2.x, y: mt * c1.y + t * c2.y };
            if (!nextCurves) nextCurves = {};
            nextCurves[idx1] = c1;
            nextCurves[insertIdx] = c2;
        } else {
            newP = { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
        }

        pts.splice(insertIdx, 0, newP);
        // 同步寫入平移後之 curves 與新頂點，避免舊曲線索引錯位造成形狀亂跳
        if (normalizedSelectedFloorId === 'base') {
            onUpdateSetting('base', 'points', pts);
            onUpdateSetting('base', 'curves', nextCurves);
            const bounds = getPolygonBounds(pts);
            if (bounds) {
                const bw = bounds.maxX - bounds.minX;
                const bd = bounds.maxY - bounds.minY;
                onUpdateInputs('baseWidth', parseFloat(bw.toFixed(2)));
                onUpdateInputs('baseWidthM', parseFloat(bw.toFixed(2)));
                onUpdateInputs('baseDepthM', parseFloat(bd.toFixed(2)));
            }
            const newBaseArea = calculatePolygonArea(pts, nextCurves);
            if (newBaseArea > 0) {
                onUpdateInputs('baseArea', parseFloat(newBaseArea.toFixed(2)));
            }
            onUpdateInputs('baseVersion', (inputs.baseVersion || 0) + 1);
            if (onEditEnd) onEditEnd('base', pts);
        } else {
            onUpdateSetting(displayLayer.id, 'points', toWorldFloorPoints(pts));
            onUpdateSetting(displayLayer.id, 'curves', nextCurves ? toWorldFloorCurves(nextCurves) : null);
        }

        if (normalizedSelectedFloorId === 'base') {
            // 同步平移道路臨路邊陣列 (edgeIndices) 與舊版單一索引 (edgeIndex)
            const newRoads = (inputs.roads || []).map(r => {
                const updated = { ...r };
                if (Array.isArray(r.edgeIndices) && r.edgeIndices.length > 0) {
                    const shifted = new Set();
                    r.edgeIndices.forEach(eIdx => {
                        if (eIdx === idx1) {
                            shifted.add(idx1);
                            shifted.add(insertIdx);
                        } else if (eIdx >= insertIdx) {
                            shifted.add(eIdx + 1);
                        } else {
                            shifted.add(eIdx);
                        }
                    });
                    updated.edgeIndices = Array.from(shifted).sort((a, b) => a - b);
                }
                if (r.edgeIndex !== undefined && r.edgeIndex !== null && r.edgeIndex !== '') {
                    const ei = parseInt(r.edgeIndex, 10);
                    if (!isNaN(ei) && ei >= insertIdx) updated.edgeIndex = ei + 1;
                }
                return updated;
            });
            onUpdateRoads(newRoads);

            const newFrontage = new Set();
            (frontageIndices || new Set()).forEach(idx => {
                if (idx === idx1) {
                    newFrontage.add(idx1);
                    newFrontage.add(insertIdx);
                } else if (idx >= insertIdx) {
                    newFrontage.add(idx + 1);
                } else {
                    newFrontage.add(idx);
                }
            });
            onUpdateFrontageIndices(newFrontage);

            const newEdgeTypes = {};
            Object.keys(edgeTypes || {}).forEach(key => {
                const k = parseInt(key, 10);
                const type = edgeTypes[k];
                if (k >= insertIdx) newEdgeTypes[k + 1] = type;
                else newEdgeTypes[k] = type;
            });
            if (edgeTypes?.[idx1]) newEdgeTypes[insertIdx] = edgeTypes[idx1];
            onUpdateEdgeTypes(null, newEdgeTypes);
        }
        const nextSel = new Set([insertIdx]);
        selectedIndicesRef.current = nextSel;
        setSelectedIndices(nextSel);
        setSelectedPointForEdit({ idx: insertIdx, point: newP });
    }, [displayLayer, onUpdateSetting, onUpdateInputs, inputs.baseVersion, toWorldFloorPoints, toWorldFloorCurves, onEditEnd, normalizedSelectedFloorId, inputs.roads, onUpdateRoads, frontageIndices, onUpdateFrontageIndices, edgeTypes, onUpdateEdgeTypes]);

    const handleSegmentEdit = useCallback((idx) => {
        const pts = displayLayer?.points;
        if (!pts) return;
        const p1 = pts[idx];
        const p2 = pts[(idx + 1) % pts.length];
        const currentLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const newLenStr = prompt(`目前邊長: ${currentLen.toFixed(2)}m\n請輸入新長度 (m):`, currentLen.toFixed(2));
        if (newLenStr !== null) {
            const newLen = parseFloat(newLenStr);
            if (!isNaN(newLen) && newLen > 0) {
                const ratio = newLen / (currentLen || 1);
                const newP2 = { x: p1.x + (p2.x - p1.x) * ratio, y: p1.y + (p2.y - p1.y) * ratio };
                const newPoints = [...pts];
                newPoints[(idx + 1) % pts.length] = newP2;
                updateSetting(displayLayer.id, 'points', newPoints);
                if (onEditEnd && normalizedSelectedFloorId === 'base') {
                    onEditEnd('base', newPoints);
                }
            }
        }
    }, [displayLayer, updateSetting, onEditEnd, normalizedSelectedFloorId]);

    const handleDeletePoint = useCallback((e, idx) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (!displayLayer?.points) return;
        const pts = [...displayLayer.points];
        if (pts.length <= 3) return;
        pts.splice(idx, 1);
        updateSetting(displayLayer.id, 'points', pts);
        if (onEditEnd && normalizedSelectedFloorId === 'base') {
            onEditEnd('base', pts);
        }
        const nextSel = new Set();
        selectedIndicesRef.current.forEach(sIdx => {
            if (sIdx < idx) nextSel.add(sIdx);
            else if (sIdx > idx) nextSel.add(sIdx - 1);
        });
        selectedIndicesRef.current = nextSel;
        setSelectedIndices(nextSel);
        if (selectedPointForEdit?.idx === idx) setSelectedPointForEdit(null);
    }, [displayLayer, updateSetting, onEditEnd, normalizedSelectedFloorId, selectedPointForEdit]);

    const handlePointEdit = useCallback((axis, val) => {
        if (!selectedPointForEdit || !displayLayer?.points) return;
        const idx = selectedPointForEdit.idx;
        const pts = [...displayLayer.points];
        pts[idx] = { ...pts[idx], [axis]: parseFloat(val) };
        updateSetting(displayLayer.id, 'points', pts);
        if (onEditEnd && normalizedSelectedFloorId === 'base') {
            onEditEnd('base', pts);
        }
        setSelectedPointForEdit({ idx, point: pts[idx] });
    }, [selectedPointForEdit, displayLayer, updateSetting, onEditEnd, normalizedSelectedFloorId]);

    const getClientCoords = (e) => {
        if (e?.touches && e.touches.length > 0) {
            return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        }
        if (e?.changedTouches && e.changedTouches.length > 0) {
            return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
        }
        return { clientX: e?.clientX ?? 0, clientY: e?.clientY ?? 0 };
    };

    const handlePointPointerDown = useCallback((e, idx) => {
        if (e.button === 2) return;
        e.stopPropagation();
        if (draggingPointIdx.current === idx && pointGestureRef.current.idx === idx) return;

        const { clientX, clientY } = getClientCoords(e);
        const wasSelected = selectedIndicesRef.current.has(idx);
        pointGestureRef.current = {
            idx,
            wasAlreadySelected: wasSelected,
            hasMoved: false,
            startX: clientX,
            startY: clientY,
            shiftKey: Boolean(e.shiftKey)
        };

        if (e.shiftKey) {
            const nextSel = new Set(selectedIndicesRef.current);
            if (nextSel.has(idx)) {
                nextSel.delete(idx);
                draggingPointIdx.current = null;
            } else {
                nextSel.add(idx);
                draggingPointIdx.current = idx;
            }
            selectedIndicesRef.current = nextSel;
            setSelectedIndices(nextSel);
        } else {
            draggingPointIdx.current = idx;
        }

        lastLocalPos.current = getLayerLocalPointFromScreen(clientX, clientY);
        dragStartScreenPos.current = { x: clientX, y: clientY };
        if (isAreaLocked && displayLayer?.points) {
            lockedAreaRef.current = calculatePolygonArea(displayLayer.points);
        }
    }, [displayLayer, getLayerLocalPointFromScreen, isAreaLocked]);

    const handleCurvePointerDown = useCallback((e, idx) => {
        if (e.button === 2) return;
        e.stopPropagation();
        if (draggingCurveIdx.current === idx) return;
        const { clientX, clientY } = getClientCoords(e);
        draggingCurveIdx.current = idx;
        lastLocalPos.current = getLayerLocalPointFromScreen(clientX, clientY);
        dragStartScreenPos.current = { x: clientX, y: clientY };
        setSelectedCurveForEdit(idx);
        setSelectedPointForEdit(null);
    }, [getLayerLocalPointFromScreen]);

    const handleEdgeContextMenu = useCallback((e, idx) => {
        e.preventDefault();
        e.stopPropagation();
        setLockedEdgeIndices(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    }, []);

    const handleEdgePointerDown = useCallback((e, idx) => {
        if (e.button === 2) return;
        e.stopPropagation();
        if (draggingEdgeIdx.current === idx) return;

        if (e.shiftKey) {
            handleSegmentEdit(idx);
            return;
        }

        if (normalizedSelectedFloorId === 'base') {
            if (isRoadSelectMode) return;
            if (interactionMode === 'set_back') {
                onUpdateEdgeTypes(idx, 'back');
                return;
            }
            if (interactionMode === 'set_side') {
                onUpdateEdgeTypes(idx, 'side');
                return;
            }
        }

        const nextI = (idx + 1) % (displayLayer?.points?.length || 1);
        const { clientX, clientY } = getClientCoords(e);

        // 明確「新增控制點」模式：點擊邊線即在點擊位置精準插入一個控制點（絕不誤觸或亂跳）
        if (interactionMode === 'add_vertex') {
            const clickLocalPt = getLayerLocalPointFromScreen(clientX, clientY);
            insertVertexOnEdge(idx, nextI, clickLocalPt);
            return;
        }

        edgeGestureRef.current = { idx, hasMoved: false, startX: clientX, startY: clientY };
        draggingEdgeIdx.current = idx;
        lastLocalPos.current = getLayerLocalPointFromScreen(clientX, clientY);
        dragStartScreenPos.current = { x: clientX, y: clientY };

        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        longPressTimer.current = setTimeout(() => {
            if (!edgeGestureRef.current.hasMoved && draggingEdgeIdx.current === idx) {
                draggingEdgeIdx.current = null;
                handleSegmentEdit(idx);
            }
        }, 620);
    }, [
        handleSegmentEdit,
        normalizedSelectedFloorId,
        isRoadSelectMode,
        interactionMode,
        onUpdateEdgeTypes,
        displayLayer,
        insertVertexOnEdge,
        getLayerLocalPointFromScreen
    ]);

    const handleEdgePointerUp = useCallback((e, idx) => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        if (draggingEdgeIdx.current === idx && !edgeGestureRef.current.hasMoved && displayLayer?.points) {
            const nextI = (idx + 1) % displayLayer.points.length;
            const nextSel = new Set(selectedIndicesRef.current);
            const bothSelected = nextSel.has(idx) && nextSel.has(nextI);
            if (bothSelected) {
                nextSel.delete(idx);
                nextSel.delete(nextI);
            } else {
                nextSel.add(idx);
                nextSel.add(nextI);
            }
            selectedIndicesRef.current = nextSel;
            setSelectedIndices(nextSel);
            if (nextSel.size > 0) {
                const firstIdx = Array.from(nextSel)[0];
                setSelectedPointForEdit({ idx: firstIdx, point: displayLayer.points[firstIdx] });
            } else {
                setSelectedPointForEdit(null);
            }
        }
        draggingEdgeIdx.current = null;
        if (onEditEnd && normalizedSelectedFloorId === 'base' && displayLayer?.points) {
            onEditEnd('base', displayLayer.points);
        }
    }, [displayLayer, onEditEnd, normalizedSelectedFloorId]);

    const handleHeightPushPullDown = useCallback((e) => {
        if (e.button !== undefined && e.button !== 0) return;
        if (!displayLayer || normalizedSelectedFloorId === 'base' || normalizedSelectedFloorId === 'excavation' || /^B\d+$/.test(normalizedSelectedFloorId)) return;
        e.stopPropagation();
        if (e.preventDefault) e.preventDefault();
        const { clientY } = getClientCoords(e);
        const currentH = parseFloat(floorSettings?.[displayLayer.id]?.floorHeight)
            || parseFloat(displayLayer.realHeight)
            || (displayLayer.id === '1F' ? (parseFloat(inputs.floorHeight1F) || 4.2) : (parseFloat(inputs.floorHeightTypical) || 3.2));
        isDraggingHeight.current = true;
        heightDragStartRef.current = { startY: clientY, startHeightM: currentH };
        setIsActivelyDragging(true);
    }, [displayLayer, normalizedSelectedFloorId, floorSettings, inputs.floorHeight1F, inputs.floorHeightTypical]);

    const handleLayerBodyPointerDown = useCallback((e) => {
        if (e.button !== undefined && e.button !== 0) return;
        if (
            e.target.dataset?.type === 'control-point' ||
            e.target.dataset?.type === 'edge-line' ||
            e.target.dataset?.type === 'curve-handle' ||
            e.target.dataset?.type === 'height-push-pull'
        ) return;
        if (interactionMode === 'box_select' || e.shiftKey) return;
        if (!displayLayer || normalizedSelectedFloorId === 'base' || normalizedSelectedFloorId === 'excavation' || /^B\d+$/.test(normalizedSelectedFloorId)) return;
        if (interactionMode === 'push_pull') {
            handleHeightPushPullDown(e);
            return;
        }
        e.stopPropagation();
        if (isDraggingLayer.current) return;
        const { clientX, clientY } = getClientCoords(e);
        isDraggingLayer.current = true;
        lastLocalPos.current = screenToSiteLocal(clientX, clientY, activePlaneZPx);
    }, [interactionMode, displayLayer, normalizedSelectedFloorId, screenToSiteLocal, activePlaneZPx, handleHeightPushPullDown]);

    const handlePointerMoveOnPlane = useCallback((e) => {
        const { clientX, clientY } = getClientCoords(e);

        // 0. SketchUp 風格垂直推拉樓高 (Top-Face Height Push/Pull)
        if (isDraggingHeight.current && displayLayer) {
            if (e.stopPropagation) e.stopPropagation();
            const deltaScreenY = heightDragStartRef.current.startY - clientY; // 向上推 = 增加樓高，向下拉 = 降低樓高
            const pxPerMeter = Math.max(5, (scale3d || 15) * 0.85);
            const rawHeight = heightDragStartRef.current.startHeightM + deltaScreenY / pxPerMeter;
            const clampedHeight = Math.round(Math.max(2.4, Math.min(20.0, rawHeight)) * 10) / 10;
            updateSetting(displayLayer.id, 'floorHeight', clampedHeight);
            return true;
        }

        // 1. 點拉線繪製基地模式：即時更新游標拉線位置與吸附提示
        if (isDrawingSite && screenToSiteLocal) {
            const rawPt = screenToSiteLocal(clientX, clientY, 0);
            const { pt, snapMeta } = computeConstrainedDrawPoint(rawPt, e.shiftKey);
            setCursorPoint(pt);
            setSnappedInfo(snapMeta);
            return true;
        }

        // 2. 框選模式進行中
        if (boxSelectRef.current.active) {
            boxSelectRef.current.currX = clientX;
            boxSelectRef.current.currY = clientY;
            setBoxSelectRect({
                left: Math.min(boxSelectRef.current.startX, clientX),
                top: Math.min(boxSelectRef.current.startY, clientY),
                width: Math.abs(clientX - boxSelectRef.current.startX),
                height: Math.abs(clientY - boxSelectRef.current.startY)
            });
            return true;
        }

        // 3. 整層樓板拖曳偏移
        if (isDraggingLayer.current && displayLayer && screenToSiteLocal) {
            if (e.stopPropagation) e.stopPropagation();
            const curSitePt = screenToSiteLocal(clientX, clientY, activePlaneZPx);
            const dxM = curSitePt.x - lastLocalPos.current.x;
            const dyM = curSitePt.y - lastLocalPos.current.y;
            if (Math.abs(dxM) > 1e-4 || Math.abs(dyM) > 1e-4) {
                updateSetting(displayLayer.id, 'offset_delta', { x: dxM, y: dyM });
                lastLocalPos.current = curSitePt;
            }
            return true;
        }

        // 4. 頂點、邊線或貝茲曲線控制點拖曳
        if (draggingPointIdx.current === null && draggingEdgeIdx.current === null && draggingCurveIdx.current === null) {
            return false;
        }
        if (!displayLayer) return false;
        if (e.stopPropagation) e.stopPropagation();

        const totalScreenDist = Math.hypot(
            clientX - dragStartScreenPos.current.x,
            clientY - dragStartScreenPos.current.y
        );

        if (draggingPointIdx.current !== null) {
            if (!pointGestureRef.current.hasMoved) {
                if (totalScreenDist < 3) return true;
                pointGestureRef.current.hasMoved = true;
                setIsActivelyDragging(true);
                if (!pointGestureRef.current.wasAlreadySelected && !pointGestureRef.current.shiftKey) {
                    const singleSel = new Set([draggingPointIdx.current]);
                    selectedIndicesRef.current = singleSel;
                    setSelectedIndices(singleSel);
                }
            }
        }

        if (draggingEdgeIdx.current !== null) {
            if (!edgeGestureRef.current.hasMoved) {
                if (totalScreenDist < 3) return true;
                edgeGestureRef.current.hasMoved = true;
                setIsActivelyDragging(true);
                if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                }
                const eIdx = draggingEdgeIdx.current;
                const nextIdx = (eIdx + 1) % (displayLayer.points?.length || 1);
                const wasEdgeAlreadySelected = selectedIndicesRef.current.has(eIdx) && selectedIndicesRef.current.has(nextIdx);
                const edgeSel = (wasEdgeAlreadySelected && e.shiftKey) ? new Set(selectedIndicesRef.current) : new Set();
                edgeSel.add(eIdx);
                edgeSel.add(nextIdx);
                selectedIndicesRef.current = edgeSel;
                setSelectedIndices(edgeSel);
            }
        }

        if (draggingCurveIdx.current !== null && totalScreenDist >= 3) {
            setIsActivelyDragging(true);
        }

        const curLocalPt = getLayerLocalPointFromScreen(clientX, clientY);
        let localDx = curLocalPt.x - lastLocalPos.current.x;
        let localDy = curLocalPt.y - lastLocalPos.current.y;
        if (Math.abs(localDx) < 1e-6 && Math.abs(localDy) < 1e-6) {
            return true;
        }

        // 當開啟「推拉模式 (Push/Pull)」或推拉牆面邊線時，將位移向量投影至該牆面法向量（像 SketchUp 垂直推拉牆面）
        if (interactionMode === 'push_pull' && draggingEdgeIdx.current !== null && displayLayer.points) {
            const eIdx = draggingEdgeIdx.current;
            const p1 = displayLayer.points[eIdx];
            const p2 = displayLayer.points[(eIdx + 1) % displayLayer.points.length];
            if (p1 && p2) {
                const normal = getSegmentNormal(p1, p2, getPolygonCentroid(displayLayer.points));
                const proj = localDx * normal.x + localDy * normal.y;
                localDx = normal.x * proj;
                localDy = normal.y * proj;
            }
        } else if (e.shiftKey && (draggingPointIdx.current !== null || draggingCurveIdx.current !== null)) {
            if (Math.abs(localDx) > Math.abs(localDy)) localDy = 0;
            else localDx = 0;
        }

        if (draggingCurveIdx.current !== null) {
            const currentCurves = { ...(displayLayer.curves || {}) };
            const idx = draggingCurveIdx.current;
            const p = displayLayer.points[idx];
            const nextP = displayLayer.points[(idx + 1) % displayLayer.points.length];
            const defaultMid = { x: (p.x + nextP.x) / 2, y: (p.y + nextP.y) / 2 };
            const oldC = currentCurves[idx] || defaultMid;
            currentCurves[idx] = { x: oldC.x + localDx, y: oldC.y + localDy };
            updateSetting(displayLayer.id, 'curves', currentCurves);
        } else if (displayLayer.points) {
            let currentPoints = [...displayLayer.points];
            const indicesToMove = new Set();
            if (draggingEdgeIdx.current !== null) {
                indicesToMove.add(draggingEdgeIdx.current);
                indicesToMove.add((draggingEdgeIdx.current + 1) % currentPoints.length);
                if (e.shiftKey) {
                    selectedIndicesRef.current.forEach(idx => indicesToMove.add(idx));
                }
            } else if (draggingPointIdx.current !== null) {
                indicesToMove.add(draggingPointIdx.current);
                selectedIndicesRef.current.forEach(idx => indicesToMove.add(idx));
            }
            indicesToMove.forEach(idx => {
                const p = currentPoints[idx];
                if (!p) return;
                const newX = (p.x || 0) + localDx;
                const newY = (p.y || 0) + localDy;
                if (!isNaN(newX) && !isNaN(newY)) {
                    currentPoints[idx] = { x: newX, y: newY };
                }
            });

            if (isAreaLocked && lockedAreaRef.current) {
                const newArea = Math.abs(calculatePolygonArea(currentPoints));
                if (newArea > 0.001) {
                    const scaleFactor = Math.sqrt(Math.abs(lockedAreaRef.current) / newArea);
                    const centroid = getPolygonCentroid(currentPoints);
                    const scaled = scalePolygon(currentPoints, null, scaleFactor, centroid);
                    currentPoints = scaled.points;
                }
            }

            updateSetting(displayLayer.id, 'points', currentPoints);
            if (draggingPointIdx.current !== null) {
                setSelectedPointForEdit({ idx: draggingPointIdx.current, point: currentPoints[draggingPointIdx.current] });
            }
        }

        lastLocalPos.current = curLocalPt;
        return true;
    }, [
        isDrawingSite,
        screenToSiteLocal,
        computeConstrainedDrawPoint,
        displayLayer,
        activePlaneZPx,
        updateSetting,
        getLayerLocalPointFromScreen,
        isAreaLocked,
        interactionMode,
        scale3d
    ]);

    const handlePointerUpOnPlane = useCallback((e) => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        if (isDraggingHeight.current) {
            isDraggingHeight.current = false;
            setIsActivelyDragging(false);
            return true;
        }

        if (boxSelectRef.current.active) {
            const { startX, startY, currX, currY, additive } = boxSelectRef.current;
            boxSelectRef.current.active = false;
            setBoxSelectRect(null);
            const minX = Math.min(startX, currX);
            const maxX = Math.max(startX, currX);
            const minY = Math.min(startY, currY);
            const maxY = Math.max(startY, currY);

            if (maxX - minX > 6 || maxY - minY > 6) {
                const nextSel = additive ? new Set(selectedIndicesRef.current) : new Set();
                if (displayLayer?.points && projectLocalToScreen) {
                    displayLayer.points.forEach((pt, idx) => {
                        const screenPt = projectLocalToScreen(
                            pt.x + activeLayerShiftM.x,
                            pt.y + activeLayerShiftM.y,
                            activePlaneZPx
                        );
                        if (screenPt && screenPt.clientX >= minX && screenPt.clientX <= maxX && screenPt.clientY >= minY && screenPt.clientY <= maxY) {
                            nextSel.add(idx);
                        }
                    });
                }
                selectedIndicesRef.current = nextSel;
                setSelectedIndices(nextSel);
                if (nextSel.size > 0 && displayLayer?.points) {
                    const firstIdx = Array.from(nextSel)[0];
                    setSelectedPointForEdit({ idx: firstIdx, point: displayLayer.points[firstIdx] });
                } else {
                    setSelectedPointForEdit(null);
                }
                if (interactionMode === 'box_select') {
                    setInteractionMode('none');
                }
            }
            return true;
        }

        if (isDraggingLayer.current) {
            isDraggingLayer.current = false;
            return true;
        }

        if (draggingEdgeIdx.current !== null && !edgeGestureRef.current.hasMoved && displayLayer?.points) {
            const eIdx = draggingEdgeIdx.current;
            const nextI = (eIdx + 1) % displayLayer.points.length;
            const nextSel = new Set(selectedIndicesRef.current);
            const bothSelected = nextSel.has(eIdx) && nextSel.has(nextI);
            if (bothSelected) {
                nextSel.delete(eIdx);
                nextSel.delete(nextI);
            } else {
                nextSel.add(eIdx);
                nextSel.add(nextI);
            }
            selectedIndicesRef.current = nextSel;
            setSelectedIndices(nextSel);
            if (nextSel.size > 0) {
                const firstIdx = Array.from(nextSel)[0];
                setSelectedPointForEdit({ idx: firstIdx, point: displayLayer.points[firstIdx] });
            } else {
                setSelectedPointForEdit(null);
            }
        }

        if (draggingPointIdx.current !== null && pointGestureRef.current.idx !== null) {
            const activeIdx = pointGestureRef.current.idx;
            if (!pointGestureRef.current.hasMoved && !pointGestureRef.current.shiftKey) {
                const nextSel = new Set(selectedIndicesRef.current);
                if (pointGestureRef.current.wasAlreadySelected) {
                    nextSel.delete(activeIdx);
                    if (nextSel.size > 0) {
                        const lastRemaining = Array.from(nextSel)[nextSel.size - 1];
                        setSelectedPointForEdit({ idx: lastRemaining, point: displayLayer?.points?.[lastRemaining] });
                    } else {
                        setSelectedPointForEdit(null);
                    }
                } else {
                    nextSel.add(activeIdx);
                    setSelectedPointForEdit({ idx: activeIdx, point: displayLayer?.points?.[activeIdx] });
                }
                selectedIndicesRef.current = nextSel;
                setSelectedIndices(nextSel);
            } else if (pointGestureRef.current.hasMoved && displayLayer?.points?.[activeIdx]) {
                setSelectedPointForEdit({ idx: activeIdx, point: displayLayer.points[activeIdx] });
            }
        }

        const wasEditingGeometry = draggingPointIdx.current !== null || draggingEdgeIdx.current !== null || draggingCurveIdx.current !== null;
        pointGestureRef.current.idx = null;
        draggingPointIdx.current = null;
        draggingEdgeIdx.current = null;
        draggingCurveIdx.current = null;
        setIsActivelyDragging(false);

        if (wasEditingGeometry && onEditEnd && normalizedSelectedFloorId === 'base' && displayLayer?.points) {
            onEditEnd('base', displayLayer.points);
        }
        return wasEditingGeometry;
    }, [displayLayer, projectLocalToScreen, activeLayerShiftM, activePlaneZPx, interactionMode, onEditEnd, normalizedSelectedFloorId]);

    // 全域 Mouse / Pointer / Touch 拖曳監聽：確保在 3D 傾斜視角或俯視平面下拖曳頂點、邊線、弧線、整層樓板或框選時，游標移出 SVG 元素仍能穩定連續追蹤
    const moveOnPlaneRef = useRef(handlePointerMoveOnPlane);
    moveOnPlaneRef.current = handlePointerMoveOnPlane;
    const upOnPlaneRef = useRef(handlePointerUpOnPlane);
    upOnPlaneRef.current = handlePointerUpOnPlane;

    useEffect(() => {
        const isAnyDragActive = () => (
            draggingPointIdx.current !== null ||
            draggingEdgeIdx.current !== null ||
            draggingCurveIdx.current !== null ||
            isDraggingLayer.current ||
            isDraggingHeight.current ||
            boxSelectRef.current.active
        );
        const onGlobalMove = (e) => {
            if (isAnyDragActive()) {
                moveOnPlaneRef.current(e);
            }
        };
        const onGlobalUp = (e) => {
            if (isAnyDragActive()) {
                upOnPlaneRef.current(e);
            }
        };
        window.addEventListener('mousemove', onGlobalMove, { passive: false });
        window.addEventListener('mouseup', onGlobalUp);
        window.addEventListener('pointermove', onGlobalMove, { passive: false });
        window.addEventListener('pointerup', onGlobalUp);
        window.addEventListener('touchmove', onGlobalMove, { passive: false });
        window.addEventListener('touchend', onGlobalUp);
        window.addEventListener('touchcancel', onGlobalUp);
        return () => {
            window.removeEventListener('mousemove', onGlobalMove);
            window.removeEventListener('mouseup', onGlobalUp);
            window.removeEventListener('pointermove', onGlobalMove);
            window.removeEventListener('pointerup', onGlobalUp);
            window.removeEventListener('touchmove', onGlobalMove);
            window.removeEventListener('touchend', onGlobalUp);
            window.removeEventListener('touchcancel', onGlobalUp);
        };
    }, []);

    // 啟動框選
    const startBoxSelect = useCallback((e) => {
        if (interactionMode !== 'box_select') return false;
        boxSelectRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            currX: e.clientX,
            currY: e.clientY,
            additive: Boolean(e.shiftKey)
        };
        setBoxSelectRect({ left: e.clientX, top: e.clientY, width: 0, height: 0 });
        return true;
    }, [interactionMode]);

    // 預覽分戶切割多邊形
    const previewUnits = useMemo(() => {
        if (!unitSettings?.enabled || !displayLayer?.points) return null;
        const allowedPts = displayLayer.allowedPoints || displayLayer.unsplitPoints || displayLayer.points;
        const allowedCurvs = displayLayer.allowedCurves || displayLayer.unsplitCurves || displayLayer.curves || null;
        return getSplitUnits(displayLayer.points, unitSettings, displayLayer.curves, allowedPts, allowedCurvs);
    }, [unitSettings, displayLayer]);

    const unitsToRender = useMemo(() => {
        if (previewUnits) return null;
        if (!savedUnits || savedUnits.length === 0) return null;
        return savedUnits;
    }, [previewUnits, savedUnits]);

    // 道路與退縮邊界視覺化索引
    const { vizFrontIndices, vizCombinedEdgeTypes } = useMemo(() => {
        const vizPrimary = new Set();
        const vizSecondary = new Set();
        (inputs.roads || []).forEach(r => {
            const indices = new Set();
            if (r.edgeIndices) r.edgeIndices.forEach(i => indices.add(i));
            if (r.edgeIndex !== undefined && r.edgeIndex !== "") indices.add(parseInt(r.edgeIndex));
            if (r.type === 'primary') indices.forEach(i => vizPrimary.add(i));
            else indices.forEach(i => vizSecondary.add(i));
        });
        const front = new Set();
        if (frontageIndices && frontageIndices.size > 0) {
            frontageIndices.forEach(i => front.add(i));
        } else {
            vizPrimary.forEach(i => front.add(i));
            if (vizPrimary.size === 0 && vizSecondary.size > 0) vizSecondary.forEach(i => front.add(i));
        }
        const combined = { ...(edgeTypes || {}) };
        vizSecondary.forEach(idx => {
            if (!front.has(idx) && !combined[idx]) combined[idx] = 'side';
        });
        return { vizFrontIndices: front, vizCombinedEdgeTypes: combined };
    }, [inputs.roads, frontageIndices, edgeTypes]);

    // 鍵盤快捷鍵支援 (Enter 完成點拉線、Backspace 退回上一點、Esc 取消繪製或結束選取)
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (isDrawingSite) {
                if (e.key === 'Enter' && drawnPoints.length >= 3) {
                    e.preventDefault();
                    finishDrawingSite();
                } else if (e.key === 'Backspace' && drawnPoints.length > 0) {
                    e.preventDefault();
                    undoLastDrawnPoint();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelDrawingSite();
                }
            } else if (displayLayer && e.key === 'Escape' && onCloseFloorEdit) {
                e.preventDefault();
                onCloseFloorEdit();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isDrawingSite, drawnPoints.length, finishDrawingSite, undoLastDrawnPoint, cancelDrawingSite, displayLayer, onCloseFloorEdit]);

    return {
        displayLayer,
        groupedLayers,
        normalizedSelectedFloorId,
        currentBasePoints,
        savedUnits,
        previewUnits,
        unitsToRender,
        vizFrontIndices,
        vizCombinedEdgeTypes,
        activePlaneZPx,
        activeLayerShiftM,
        // 點拉線繪製基地狀態与方法
        isDrawingSite,
        setIsDrawingSite,
        drawTarget,
        setDrawTarget,
        drawnPoints,
        setDrawnPoints,
        cursorPoint,
        snappedInfo,
        isOrthoLocked,
        setIsOrthoLocked,
        isSnapEnabled,
        setIsSnapEnabled,
        customLengthInput,
        setCustomLengthInput,
        startDrawingSite,
        cancelDrawingSite,
        undoLastDrawnPoint,
        finishDrawingSite,
        placeByExactLength,
        computeConstrainedDrawPoint,
        // 頂點與幾何編輯狀態與方法
        isRoadSelectMode,
        setIsRoadSelectMode,
        interactionMode,
        setInteractionMode,
        selectedPointForEdit,
        setSelectedPointForEdit,
        selectedCurveForEdit,
        setSelectedCurveForEdit,
        isAreaLocked,
        setIsAreaLocked,
        selectedIndices,
        setSelectedIndices,
        selectedIndicesRef,
        lockedEdgeIndices,
        isActivelyDragging,
        boxSelectRect,
        startBoxSelect,
        updateSetting,
        insertVertexOnEdge,
        getLayerLocalPointFromScreen,
        handleSegmentEdit,
        handleDeletePoint,
        handlePointEdit,
        handlePointPointerDown,
        handleCurvePointerDown,
        handleEdgeContextMenu,
        handleEdgePointerDown,
        handleEdgePointerUp,
        handleLayerBodyPointerDown,
        handleHeightPushPullDown,
        handlePointerMoveOnPlane,
        handlePointerUpOnPlane,
        // 彈窗狀態
        showFloorDialog,
        setShowFloorDialog,
        showApplyAllDialog,
        setShowApplyAllDialog,
        floorConfig,
        setFloorConfig,
        toWorldFloorPoints,
        activeSiteName,
        nextSiteLabel,
        onSelectFloor,
        onCloseFloorEdit,
        onApplyAll,
        onUpdateFloorsAbove,
        onUpdateInputs,
        onUpdateRoads,
        unitSettings,
        onUpdateUnitSettings,
        inputs,
        basements,
        floorSettings,
        scale3d,
        floorsAboveValue,
        baseWidthM,
        baseDepthM
    };
}

/**
 * 3D 場景內嵌式平面/樓層幾何與點拉線繪製層 (InScenePolygonPlane)
 * 直接渲染於 3D 基地平面 (z=0) 或選中樓層之樓板頂面 (z=layerTop)，
 * 讓平面分析與 3D 模擬完全融合於同一個空間畫布。
 */
export const InScenePolygonPlane = ({
    controller,
    w,
    d,
    scale,
    isDarkMode,
    screenToSiteLocal
}) => {
    const {
        displayLayer,
        normalizedSelectedFloorId,
        isDrawingSite,
        drawnPoints,
        setDrawnPoints,
        cursorPoint,
        snappedInfo,
        finishDrawingSite,
        computeConstrainedDrawPoint,
        previewUnits,
        unitsToRender,
        vizFrontIndices,
        vizCombinedEdgeTypes,
        activePlaneZPx,
        interactionMode,
        selectedIndices,
        lockedEdgeIndices,
        updateSetting,
        handlePointPointerDown,
        handleCurvePointerDown,
        handleEdgeContextMenu,
        handleEdgePointerDown,
        handleEdgePointerUp,
        handleLayerBodyPointerDown,
        handleHeightPushPullDown,
        handlePointerMoveOnPlane,
        handlePointerUpOnPlane,
        setSelectedCurveForEdit,
        inputs
    } = controller;

    const lastDrawClickTimeRef = useRef(0);

    // ── 模式 A：點拉線繪製基地 (Point-to-Point Site Drawing Surface) ──
    if (isDrawingSite) {
        const padW = w * 3;
        const padD = d * 3;
        const originX = w / 2;
        const originY = d / 2;
        const gridStep1M = scale;
        const gridStep5M = scale * 5;

        const previewPolyPts = cursorPoint ? [...drawnPoints, cursorPoint] : drawnPoints;
        const liveAreaSqm = previewPolyPts.length >= 3 ? calculatePolygonArea(previewPolyPts, null) : 0;
        const liveCentroid = previewPolyPts.length >= 3 ? getPolygonCentroid(previewPolyPts) : null;

        const handleDrawSurfacePointerDown = (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            e.stopPropagation();
            const now = Date.now();
            const rawPt = screenToSiteLocal ? screenToSiteLocal(e.clientX, e.clientY, 0) : { x: 0, y: 0 };
            const { pt, snapMeta } = computeConstrainedDrawPoint(rawPt, e.shiftKey);

            // 若雙擊或點選起點 #1 (且已落點 >= 3)，立即完成封閉多邊形！
            if (drawnPoints.length >= 3 && (snapMeta?.type === 'close' || (now - lastDrawClickTimeRef.current < 320))) {
                lastDrawClickTimeRef.current = 0;
                finishDrawingSite(drawnPoints);
                return;
            }
            lastDrawClickTimeRef.current = now;
            setDrawnPoints(prev => [...prev, pt]);
        };

        return (
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${w}px`,
                    height: `${d}px`,
                    transform: 'translate3d(0px, 0px, 2px)',
                    transformStyle: 'preserve-3d',
                    zIndex: 9200,
                    pointerEvents: 'auto'
                }}
            >
                <svg
                    width={padW}
                    height={padD}
                    viewBox={`${originX - padW / 2} ${originY - padD / 2} ${padW} ${padD}`}
                    style={{
                        position: 'absolute',
                        left: `${-(padW - w) / 2}px`,
                        top: `${-(padD - d) / 2}px`,
                        overflow: 'visible',
                        cursor: 'crosshair',
                        touchAction: 'none'
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={handleDrawSurfacePointerDown}
                    onPointerMove={handlePointerMoveOnPlane}
                    onTouchStart={(e) => { if (e.touches.length === 1) e.stopPropagation(); }}
                    onTouchMove={(e) => { if (e.touches.length === 1) e.stopPropagation(); }}
                >
                    <defs>
                        <pattern id="draw-grid-1m" width={gridStep1M} height={gridStep1M} patternUnits="userSpaceOnUse">
                            <path
                                d={`M ${gridStep1M} 0 L 0 0 0 ${gridStep1M}`}
                                fill="none"
                                stroke={isDarkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.07)'}
                                strokeWidth="0.7"
                            />
                        </pattern>
                        <pattern id="draw-grid-5m" width={gridStep5M} height={gridStep5M} patternUnits="userSpaceOnUse">
                            <rect width={gridStep5M} height={gridStep5M} fill="url(#draw-grid-1m)" />
                            <path
                                d={`M ${gridStep5M} 0 L 0 0 0 ${gridStep5M}`}
                                fill="none"
                                stroke={isDarkMode ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.18)'}
                                strokeWidth="1.2"
                            />
                        </pattern>
                    </defs>

                    {/* 廣域互動感應區與度量網格 */}
                    <rect
                        x={originX - padW / 2}
                        y={originY - padD / 2}
                        width={padW}
                        height={padD}
                        fill="url(#draw-grid-5m)"
                    />

                    {/* 原點十字基準線 */}
                    <line
                        x1={originX - padW / 2}
                        y1={originY}
                        x2={originX + padW / 2}
                        y2={originY}
                        stroke={isDarkMode ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.3)'}
                        strokeWidth="1"
                        strokeDasharray="6,4"
                        pointerEvents="none"
                    />
                    <line
                        x1={originX}
                        y1={originY - padD / 2}
                        x2={originX}
                        y2={originY + padD / 2}
                        stroke={isDarkMode ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.3)'}
                        strokeWidth="1"
                        strokeDasharray="6,4"
                        pointerEvents="none"
                    />

                    {/* 即時多邊形面積填充預覽 */}
                    {previewPolyPts.length >= 3 && (
                        <path
                            d={generateSvgPath(previewPolyPts, null, scale, originX, originY)}
                            fill={isDarkMode ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.18)'}
                            stroke="none"
                            pointerEvents="none"
                        />
                    )}

                    {/* 已繪製之各邊線段與即時邊長標籤 */}
                    {drawnPoints.map((pt, i) => {
                        if (i === 0) return null;
                        const prev = drawnPoints[i - 1];
                        const x1 = originX + prev.x * scale;
                        const y1 = originY + prev.y * scale;
                        const x2 = originX + pt.x * scale;
                        const y2 = originY + pt.y * scale;
                        const segLen = Math.hypot(pt.x - prev.x, pt.y - prev.y);
                        const mx = (x1 + x2) / 2;
                        const my = (y1 + y2) / 2;
                        return (
                            <g key={`drawn-seg-${i}`} pointerEvents="none">
                                <line
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    stroke="#10b981"
                                    strokeWidth="3.2"
                                    strokeLinecap="round"
                                />
                                <rect
                                    x={mx - 26}
                                    y={my - 10}
                                    width="52"
                                    height="20"
                                    rx="4"
                                    fill={isDarkMode ? '#0f172a' : '#ffffff'}
                                    stroke="#10b981"
                                    strokeWidth="1.5"
                                />
                                <text
                                    x={mx}
                                    y={my + 1}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize="10"
                                    fontWeight="900"
                                    fill={isDarkMode ? '#34d399' : '#047857'}
                                >
                                    {segLen.toFixed(2)}m
                                </text>
                            </g>
                        );
                    })}

                    {/* 動態拉線 (Rubber-band Line) 從最後一點到游標位置 */}
                    {drawnPoints.length > 0 && cursorPoint && (() => {
                        const last = drawnPoints[drawnPoints.length - 1];
                        const p0 = drawnPoints[0];
                        const x1 = originX + last.x * scale;
                        const y1 = originY + last.y * scale;
                        const x2 = originX + cursorPoint.x * scale;
                        const y2 = originY + cursorPoint.y * scale;
                        const x0 = originX + p0.x * scale;
                        const y0 = originY + p0.y * scale;
                        const activeLen = Math.hypot(cursorPoint.x - last.x, cursorPoint.y - last.y);
                        const angleDeg = Math.round((Math.atan2(cursorPoint.y - last.y, cursorPoint.x - last.x) * 180) / Math.PI);
                        const mx = (x1 + x2) / 2;
                        const my = (y1 + y2) / 2;
                        return (
                            <g pointerEvents="none">
                                {/* 閉合預覽虛線 (游標回連至起點 #1) */}
                                {drawnPoints.length >= 2 && (
                                    <line
                                        x1={x2}
                                        y1={y2}
                                        x2={x0}
                                        y2={y0}
                                        stroke={isDarkMode ? 'rgba(148, 163, 184, 0.5)' : 'rgba(100, 116, 139, 0.5)'}
                                        strokeWidth="1.5"
                                        strokeDasharray="4,4"
                                    />
                                )}
                                {/* 主拉線 */}
                                <line
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    stroke="#f59e0b"
                                    strokeWidth="2.8"
                                    strokeDasharray="6,4"
                                />
                                {activeLen > 0.05 && (
                                    <g transform={`translate(${mx}, ${my - 14})`}>
                                        <rect
                                            x="-46"
                                            y="-11"
                                            width="92"
                                            height="22"
                                            rx="4"
                                            fill="#f59e0b"
                                            stroke="#000000"
                                            strokeWidth="1.5"
                                        />
                                        <text
                                            x="0"
                                            y="1"
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            fontSize="10"
                                            fontWeight="900"
                                            fill="#000000"
                                        >
                                            {`${activeLen.toFixed(2)}m (${angleDeg}°)`}
                                        </text>
                                    </g>
                                )}
                            </g>
                        );
                    })()}

                    {/* 即時預覽面積標籤 */}
                    {liveAreaSqm > 0.5 && liveCentroid && (
                        <g
                            transform={`translate(${originX + liveCentroid.x * scale}, ${originY + liveCentroid.y * scale})`}
                            pointerEvents="none"
                        >
                            <rect
                                x="-68"
                                y="-16"
                                width="136"
                                height="32"
                                rx="6"
                                fill={isDarkMode ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.94)'}
                                stroke="#10b981"
                                strokeWidth="2"
                            />
                            <text
                                x="0"
                                y="-3"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize="11"
                                fontWeight="900"
                                fill="#10b981"
                            >
                                {`${formatNum(toPing(liveAreaSqm))} 坪`}
                            </text>
                            <text
                                x="0"
                                y="9"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize="9"
                                fontWeight="700"
                                fill={isDarkMode ? '#94a3b8' : '#64748b'}
                            >
                                {`${formatNum(liveAreaSqm)} ㎡`}
                            </text>
                        </g>
                    )}

                    {/* 已落點之頂點控制點 (#1 起點具備封閉感應光圈) */}
                    {drawnPoints.map((pt, idx) => {
                        const cx = originX + pt.x * scale;
                        const cy = originY + pt.y * scale;
                        const isStart = idx === 0;
                        const canClose = isStart && drawnPoints.length >= 3;
                        const isCloseHovered = canClose && snappedInfo?.type === 'close';
                        return (
                            <g key={`drawn-pt-${idx}`} transform={`translate(${cx}, ${cy})`}>
                                {canClose && (
                                    <circle
                                        r={isCloseHovered ? 18 : 13}
                                        fill={isCloseHovered ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.15)'}
                                        stroke="#10b981"
                                        strokeWidth="2"
                                        strokeDasharray="3,2"
                                        style={{ cursor: 'pointer' }}
                                        onPointerDown={(e) => {
                                            e.stopPropagation();
                                            finishDrawingSite(drawnPoints);
                                        }}
                                    />
                                )}
                                <circle
                                    r={isStart ? 7.5 : 6}
                                    fill={isStart ? '#10b981' : '#ffffff'}
                                    stroke="#0f172a"
                                    strokeWidth="2.5"
                                    pointerEvents="none"
                                />
                                <text
                                    y="-12"
                                    textAnchor="middle"
                                    fontSize="10"
                                    fontWeight="900"
                                    fill={isStart ? '#10b981' : (isDarkMode ? '#f8fafc' : '#0f172a')}
                                    pointerEvents="none"
                                >
                                    {isStart ? '#1 起點' : `#${idx + 1}`}
                                </text>
                            </g>
                        );
                    })}

                    {/* 游標準星與吸附提示 */}
                    {cursorPoint && (
                        <g
                            transform={`translate(${originX + cursorPoint.x * scale}, ${originY + cursorPoint.y * scale})`}
                            pointerEvents="none"
                        >
                            <circle
                                r={snappedInfo ? 8 : 5}
                                fill={snappedInfo?.type === 'close' ? '#10b981' : (snappedInfo ? '#f59e0b' : '#38bdf8')}
                                fillOpacity="0.4"
                                stroke={snappedInfo?.type === 'close' ? '#10b981' : (snappedInfo ? '#f59e0b' : '#0284c7')}
                                strokeWidth="2"
                            />
                            {snappedInfo?.label && (
                                <g transform="translate(0, 20)">
                                    <rect
                                        x="-58"
                                        y="-10"
                                        width="116"
                                        height="20"
                                        rx="4"
                                        fill="#0f172a"
                                        stroke={snappedInfo.type === 'close' ? '#10b981' : '#f59e0b'}
                                        strokeWidth="1.5"
                                    />
                                    <text
                                        x="0"
                                        y="1"
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fontSize="9.5"
                                        fontWeight="900"
                                        fill="#ffffff"
                                    >
                                        {snappedInfo.label}
                                    </text>
                                </g>
                            )}
                        </g>
                    )}
                </svg>
            </div>
        );
    }

    // ── 模式 B：在 3D/俯視統一場景中直接編輯選中圖層 (基地 / 開挖 / B1.. / 1F..) ──
    if (!displayLayer || !displayLayer.points || displayLayer.points.length < 3) {
        return null;
    }

    const originX = w / 2;
    const originY = d / 2;
    const isFloorLayer = normalizedSelectedFloorId !== 'base' && normalizedSelectedFloorId !== 'excavation' && !/^B\d+$/.test(normalizedSelectedFloorId);
    const shiftX = isFloorLayer ? (displayLayer.shiftX || 0) : 0;
    const shiftY = isFloorLayer ? (displayLayer.shiftYPx || 0) : 0;
    const rotDeg = isFloorLayer ? (displayLayer.rotation || 0) : 0;
    const hitR = 14;

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${w}px`,
                height: `${d}px`,
                transform: isFloorLayer ? `translate3d(0px, 0px, ${activePlaneZPx + 0.6}px)` : 'none',
                transformStyle: 'preserve-3d',
                zIndex: 8800,
                pointerEvents: 'none'
            }}
        >
            <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${w} ${d}`}
                style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
            >
                <g
                    transform={`translate(${originX + shiftX}, ${originY + shiftY}) rotate(${rotDeg})`}
                    style={{ pointerEvents: 'auto' }}
                    className={isFloorLayer ? (interactionMode === 'push_pull' ? 'cursor-ns-resize' : 'cursor-move') : ''}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => { if (isFloorLayer) e.stopPropagation(); }}
                    onPointerDown={handleLayerBodyPointerDown}
                    onTouchStart={(e) => { if (e.touches.length === 1) e.stopPropagation(); }}
                    onTouchMove={(e) => { if (e.touches.length === 1) e.stopPropagation(); }}
                >
                    {/* 當編輯地上樓層時，顯示該層法定退縮可建包絡線 (虛線參考框) 與即時超界紅色亮顯遮罩 */}
                    {isFloorLayer && displayLayer.allowedPoints && displayLayer.allowedPoints.length >= 3 && (
                        <>
                            <defs>
                                <pattern id="floor-overflow-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                    <rect width="10" height="10" fill="rgba(239, 68, 68, 0.36)" />
                                    <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(220, 38, 38, 0.85)" strokeWidth="4" />
                                </pattern>
                                <mask id="floor-overflow-mask">
                                    <rect x="-4000" y="-4000" width="8000" height="8000" fill="white" />
                                    <path
                                        d={generateSvgPath(displayLayer.allowedPoints, displayLayer.allowedCurves, scale, 0, 0)}
                                        fill="black"
                                    />
                                </mask>
                            </defs>
                            <path
                                d={generateSvgPath(displayLayer.allowedPoints, displayLayer.allowedCurves, scale, 0, 0)}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="1.8"
                                strokeDasharray="5,4"
                                opacity="0.85"
                                pointerEvents="none"
                            />
                        </>
                    )}

                    {/* 主多邊形或分戶切割預覽 */}
                    {previewUnits ? (
                        previewUnits.map((pts, i) => (
                            <path
                                key={`preview-u-${i}`}
                                d={generateSvgPath(pts, null, scale, 0, 0)}
                                fill="rgba(99, 102, 241, 0.45)"
                                stroke="#4f46e5"
                                strokeWidth="2.5"
                            />
                        ))
                    ) : unitsToRender ? (
                        <>
                            <path
                                d={generateSvgPath(displayLayer.points, displayLayer.curves, scale, 0, 0)}
                                fill="none"
                                stroke={displayLayer.isViolation ? '#ef4444' : '#0284c7'}
                                strokeWidth="2"
                                opacity="0.7"
                            />
                            {unitsToRender.map((pts, i) => {
                                const c = getPolygonCentroid(pts);
                                const fillOpacity = Math.min(0.82, 0.48 + i * 0.1);
                                return (
                                    <g key={`unit-poly-${i}`}>
                                        <path
                                            d={generateSvgPath(pts, null, scale, 0, 0)}
                                            fill={`rgba(99, 102, 241, ${fillOpacity})`}
                                            stroke="#4f46e5"
                                            strokeWidth="1.8"
                                        />
                                        <text
                                            x={c.x * scale}
                                            y={c.y * scale}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            fontSize="10"
                                            fontWeight="900"
                                            fill="#ffffff"
                                            className="select-none pointer-events-none font-mono"
                                        >
                                            {String.fromCharCode(65 + i)} ({formatNum(toPing(calculatePolygonArea(pts)))}坪)
                                        </text>
                                    </g>
                                );
                            })}
                        </>
                    ) : (
                        <path
                            d={generateSvgPath(displayLayer.points, displayLayer.curves, scale, 0, 0)}
                            fill={
                                normalizedSelectedFloorId === 'excavation'
                                    ? 'rgba(245, 158, 11, 0.22)'
                                    : /^B\d+$/.test(normalizedSelectedFloorId)
                                        ? 'rgba(168, 85, 247, 0.22)'
                                        : normalizedSelectedFloorId === 'base'
                                            ? 'rgba(14, 165, 233, 0.08)'
                                            : 'rgba(14, 165, 233, 0.25)'
                            }
                            stroke={
                                normalizedSelectedFloorId === 'excavation'
                                    ? '#f59e0b'
                                    : /^B\d+$/.test(normalizedSelectedFloorId)
                                        ? '#a855f7'
                                        : displayLayer.isViolation
                                            ? '#ef4444'
                                            : '#0284c7'
                            }
                            strokeWidth="2.5"
                            strokeDasharray={normalizedSelectedFloorId === 'excavation' ? '5,3' : 'none'}
                        />
                    )}

                    {/* 超出退縮範圍／基地限制區域之即時紅色斜線警示亮顯（僅亮顯實際超出之區塊） */}
                    {isFloorLayer && displayLayer.allowedPoints && displayLayer.allowedPoints.length >= 3 && (
                        <path
                            d={generateSvgPath(displayLayer.points, displayLayer.curves, scale, 0, 0)}
                            fill="url(#floor-overflow-hatch)"
                            stroke="#dc2626"
                            strokeWidth="2.5"
                            mask="url(#floor-overflow-mask)"
                            pointerEvents="none"
                        />
                    )}

                    {/* 各邊線段、方位顏色、道路名稱、邊號與即時邊長標籤 */}
                    {displayLayer.points.map((p, i) => {
                        const nextI = (i + 1) % displayLayer.points.length;
                        const nextP = displayLayer.points[nextI];
                        const isLocked = lockedEdgeIndices.has(i);
                        const curve = displayLayer.curves?.[i];
                        const isFrontage = normalizedSelectedFloorId === 'base' && vizFrontIndices.has(i);
                        const isBack = normalizedSelectedFloorId === 'base' && vizCombinedEdgeTypes[i] === 'back';
                        const isSide = normalizedSelectedFloorId === 'base' && vizCombinedEdgeTypes[i] === 'side';
                        const isBothEndsSelected = selectedIndices.has(i) && selectedIndices.has(nextI);

                        let strokeColor = isLocked ? '#ef4444' : (isBothEndsSelected ? '#6366f1' : 'transparent');
                        if (isFrontage) strokeColor = '#ef4444';
                        else if (isBack) strokeColor = '#10b981';
                        else if (isSide) strokeColor = '#3b82f6';

                        const strokeWidth = (isFrontage || isBack || isSide) ? '4.5' : (isLocked || isBothEndsSelected ? '4' : '2');
                        let edgeD = `M ${p.x * scale} ${p.y * scale}`;
                        if (curve) {
                            edgeD += ` Q ${curve.x * scale} ${curve.y * scale}, ${nextP.x * scale} ${nextP.y * scale}`;
                        } else {
                            edgeD += ` L ${nextP.x * scale} ${nextP.y * scale}`;
                        }

                        const edgeLenM = Math.hypot(nextP.x - p.x, nextP.y - p.y);
                        const midX = curve ? (0.25 * p.x + 0.5 * curve.x + 0.25 * nextP.x) : (p.x + nextP.x) / 2;
                        const midY = curve ? (0.25 * p.y + 0.5 * curve.y + 0.25 * nextP.y) : (p.y + nextP.y) / 2;
                        const roadNames = (inputs.roads || [])
                            .filter(r => (r.edgeIndices || []).includes(i) || r.edgeIndex === i)
                            .map(r => r.name)
                            .join(', ');

                        return (
                            <g key={`unified-edge-${i}`}>
                                {(isFrontage || isBack || isSide) && (
                                    <path
                                        d={edgeD}
                                        stroke={isFrontage ? '#fee2e2' : (isBack ? '#d1fae5' : '#dbeafe')}
                                        strokeWidth="10"
                                        fill="none"
                                        strokeLinecap="round"
                                        pointerEvents="none"
                                    />
                                )}
                                {/* 寬感應帶：支援拖曳整條邊、新增點模式點擊插點、標準雙擊新增頂點、Shift+點擊輸入邊長 */}
                                <path
                                    d={edgeD}
                                    data-type="edge-line"
                                    stroke="transparent"
                                    strokeWidth="22"
                                    fill="none"
                                    strokeLinecap="round"
                                    className={interactionMode === 'add_vertex' ? 'cursor-copy' : 'cursor-pointer'}
                                    onContextMenu={(e) => handleEdgeContextMenu(e, i)}
                                    onPointerDown={(e) => handleEdgePointerDown(e, i)}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        const clickPt = controller.getLayerLocalPointFromScreen
                                            ? controller.getLayerLocalPointFromScreen(e.clientX, e.clientY)
                                            : null;
                                        controller.insertVertexOnEdge(i, nextI, clickPt);
                                    }}
                                />
                                <path
                                    d={edgeD}
                                    stroke={strokeColor}
                                    strokeWidth={strokeWidth}
                                    fill="none"
                                    strokeLinecap="round"
                                    pointerEvents="none"
                                />
                                {/* 邊線編號與即時公尺邊長標籤（可直接按住拖曳推拉整道牆面） */}
                                <g
                                    transform={`translate(${midX * scale}, ${midY * scale})`}
                                    data-type="edge-line"
                                    className={interactionMode === 'add_vertex' ? 'cursor-copy' : 'cursor-pointer'}
                                    onPointerDown={(e) => handleEdgePointerDown(e, i)}
                                    onContextMenu={(e) => handleEdgeContextMenu(e, i)}
                                >
                                    <rect
                                        x="-32"
                                        y="-9.5"
                                        width="64"
                                        height="19"
                                        rx="3"
                                        fill={interactionMode === 'add_vertex' ? '#059669' : (isFrontage ? '#b91c1c' : (isBack ? '#047857' : (isSide ? '#1d4ed8' : (interactionMode === 'push_pull' ? '#4f46e5' : (isDarkMode ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.95)')))))}
                                        stroke={isDarkMode ? '#475569' : '#0f172a'}
                                        strokeWidth="1.2"
                                    />
                                    <text
                                        x="0"
                                        y="1"
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fontSize="8.5"
                                        fontWeight="900"
                                        fill={(interactionMode === 'add_vertex' || isFrontage || isBack || isSide || interactionMode === 'push_pull') ? '#ffffff' : (isDarkMode ? '#f8fafc' : '#0f172a')}
                                        className="select-none font-mono pointer-events-none"
                                    >
                                        {interactionMode === 'add_vertex' ? `+ 新增點 #${i}` : (isFrontage ? `${roadNames || '道路'}#${i}` : `#${i}·${edgeLenM.toFixed(1)}m${isFloorLayer ? '↔' : ''}`)}
                                    </text>
                                </g>
                            </g>
                        );
                    })}

                    {/* SketchUp 風格：地上樓層頂面垂直「推拉樓高 (Push/Pull Height)」互動控制柄 */}
                    {isFloorLayer && displayLayer.points && displayLayer.points.length >= 3 && (() => {
                        const c = getPolygonCentroid(displayLayer.points);
                        const curHeightM = parseFloat(displayLayer.realHeight) || 3.2;
                        return (
                            <g
                                transform={`translate(${c.x * scale}, ${c.y * scale})`}
                                data-type="height-push-pull"
                                className="cursor-ns-resize"
                                onMouseDown={handleHeightPushPullDown}
                                onPointerDown={handleHeightPushPullDown}
                            >
                                <rect
                                    x="-58"
                                    y="-13"
                                    width="116"
                                    height="26"
                                    rx="4"
                                    fill={interactionMode === 'push_pull' ? '#4f46e5' : '#0f172a'}
                                    stroke="#ffffff"
                                    strokeWidth="1.8"
                                />
                                <text
                                    x="0"
                                    y="1"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize="9.5"
                                    fontWeight="900"
                                    fill="#ffffff"
                                    className="select-none font-mono pointer-events-none"
                                >
                                    ↕ 推拉樓高 {curHeightM.toFixed(1)}m
                                </text>
                            </g>
                        );
                    })()}

                    {/* 橘色貝茲曲線控制點 (Curve Handles) */}
                    {displayLayer.points.map((p, i) => {
                        const nextI = (i + 1) % displayLayer.points.length;
                        const nextP = displayLayer.points[nextI];
                        const curve = displayLayer.curves?.[i];
                        const isEdgeSelected = selectedIndices.has(i) && selectedIndices.has(nextI);
                        if (interactionMode !== 'curve' && !isEdgeSelected && !curve) return null;

                        const cpX = curve ? curve.x : (p.x + nextP.x) / 2;
                        const cpY = curve ? curve.y : (p.y + nextP.y) / 2;
                        return (
                            <g key={`unified-curve-${i}`} transform={`translate(${cpX * scale}, ${cpY * scale})`}>
                                <line
                                    x1={(p.x - cpX) * scale}
                                    y1={(p.y - cpY) * scale}
                                    x2={0}
                                    y2={0}
                                    stroke="#93c5fd"
                                    strokeDasharray="3"
                                    strokeWidth="1.2"
                                    pointerEvents="none"
                                />
                                <line
                                    x1={(nextP.x - cpX) * scale}
                                    y1={(nextP.y - cpY) * scale}
                                    x2={0}
                                    y2={0}
                                    stroke="#93c5fd"
                                    strokeDasharray="3"
                                    strokeWidth="1.2"
                                    pointerEvents="none"
                                />
                                <circle
                                    data-type="curve-handle"
                                    r={hitR}
                                    fill="transparent"
                                    className="cursor-crosshair"
                                    onMouseDown={(e) => {
                                        if (!curve) {
                                            const newCurves = { ...(displayLayer.curves || {}), [i]: { x: cpX, y: cpY } };
                                            updateSetting(displayLayer.id, 'curves', newCurves);
                                        }
                                        handleCurvePointerDown(e, i);
                                    }}
                                    onPointerDown={(e) => {
                                        if (!curve) {
                                            const newCurves = { ...(displayLayer.curves || {}), [i]: { x: cpX, y: cpY } };
                                            updateSetting(displayLayer.id, 'curves', newCurves);
                                        }
                                        handleCurvePointerDown(e, i);
                                    }}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        const newCurves = { ...(displayLayer.curves || {}) };
                                        delete newCurves[i];
                                        updateSetting(displayLayer.id, 'curves', newCurves);
                                        setSelectedCurveForEdit(null);
                                    }}
                                />
                                <circle
                                    r="6.5"
                                    fill="#f59e0b"
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                    pointerEvents="none"
                                />
                            </g>
                        );
                    })}

                    {/* 頂點控制點 (Control Points #1, #2...) */}
                    {displayLayer.points.map((p, i) => {
                        const isSelected = selectedIndices.has(i);
                        return (
                            <g key={`unified-pt-${i}`} transform={`translate(${p.x * scale}, ${p.y * scale})`}>
                                <circle
                                    data-type="control-point"
                                    data-control-idx={i}
                                    r={hitR}
                                    fill="transparent"
                                    className="cursor-grab active:cursor-grabbing"
                                    onMouseDown={(e) => handlePointPointerDown(e, i)}
                                    onPointerDown={(e) => handlePointPointerDown(e, i)}
                                    onContextMenu={(e) => controller.handleDeletePoint(e, i)}
                                />
                                {isSelected && (
                                    <circle
                                        r="11.5"
                                        fill="rgba(99, 102, 241, 0.25)"
                                        stroke="#6366f1"
                                        strokeWidth="1.8"
                                        strokeDasharray="2,2"
                                        pointerEvents="none"
                                    />
                                )}
                                <circle
                                    r={isSelected ? '7.5' : '6.2'}
                                    fill={isSelected ? '#6366f1' : '#ffffff'}
                                    stroke={isSelected ? '#ffffff' : (normalizedSelectedFloorId === 'excavation' ? '#f59e0b' : '#0284c7')}
                                    strokeWidth="2.5"
                                    pointerEvents="none"
                                />
                                <text
                                    y="-12"
                                    textAnchor="middle"
                                    fontSize="9"
                                    fontWeight="900"
                                    fill={isSelected ? '#4f46e5' : (isDarkMode ? '#e2e8f0' : '#0f172a')}
                                    pointerEvents="none"
                                    className="select-none font-mono"
                                >
                                    #{i + 1}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>
        </div>
    );
};

/**
 * 整合式 2D/3D 螢幕介面控制列與對話框 (UnifiedSceneHUD)
 * 提供：
 * - 左上整合工具列（點拉線繪基地、基地編輯、開挖範圍、樓層配置、分戶分割、3D/俯視視角一鍵切換、旋轉/平移切換）
 * - 左側可收合「基地與各層平面圖層列」（直接點選 Base / Excav / B1.. / 1F.. 即時在場景中編輯）
 * - 點拉線繪製專屬浮動引導列（支援切換重繪目前基地/新增基地、正交鎖定、輸入精確米數落點）
 * - 頂點 3D->2D 投影座標微調框 (CoordinatePopup) 與底部 EditMenu2D
 */
export const UnifiedSceneHUD = ({
    controller,
    isDarkMode,
    setIsDarkMode,
    isMobile = false,
    hideMobileNav = false,
    viewAngleX,
    rotationZ,
    onToggleTopDownView,
    primaryDragMode,
    onTogglePrimaryDragMode,
    projectLocalToScreen,
    aoMode = false,
    onToggleAoMode,
    sunPathOpen = false,
    onToggleSunPath,
    isNightAO = false,
    onOpenCadastralImport,
    appActions = {}
}) => {
    const {
        displayLayer,
        groupedLayers,
        normalizedSelectedFloorId,
        currentBasePoints,
        savedUnits,
        activePlaneZPx,
        activeLayerShiftM,
        isDrawingSite,
        drawTarget,
        setDrawTarget,
        drawnPoints,
        isOrthoLocked,
        setIsOrthoLocked,
        isSnapEnabled,
        setIsSnapEnabled,
        customLengthInput,
        setCustomLengthInput,
        startDrawingSite,
        cancelDrawingSite,
        undoLastDrawnPoint,
        finishDrawingSite,
        placeByExactLength,
        isRoadSelectMode,
        setIsRoadSelectMode,
        interactionMode,
        setInteractionMode,
        selectedPointForEdit,
        setSelectedPointForEdit,
        selectedCurveForEdit,
        isAreaLocked,
        setIsAreaLocked,
        selectedIndices,
        setSelectedIndices,
        selectedIndicesRef,
        isActivelyDragging,
        boxSelectRect,
        updateSetting,
        handleDeletePoint,
        handlePointEdit,
        showFloorDialog,
        setShowFloorDialog,
        showApplyAllDialog,
        setShowApplyAllDialog,
        floorConfig,
        setFloorConfig,
        toWorldFloorPoints,
        activeSiteName,
        nextSiteLabel,
        onSelectFloor,
        onCloseFloorEdit,
        onApplyAll,
        onUpdateFloorsAbove,
        onUpdateInputs,
        onUpdateRoads,
        unitSettings,
        onUpdateUnitSettings,
        inputs,
        basements,
        floorSettings,
        scale3d
    } = controller;

    // 預設收合圖層卡片抽屜並以 Blender / SketchUp 純圖示工具架呈現，保持 3D/平面工作區清爽不雜亂
    const [isToolbarStowed, setIsToolbarStowed] = useState(false);
    const [showToolbarLabels, setShowToolbarLabels] = useState(false);
    const [isLayerDockOpen, setIsLayerDockOpen] = useState(false);
    const [hoverTipsEnabled, setHoverTipsEnabled] = useHoverTipsPreference();

    // 同步桌機「各層平面」圖層抽屜開關狀態給外部，讓左側結果摘要自動下移避免面板打架
    const onLayerDockOpenChange = appActions?.onLayerDockOpenChange;
    useEffect(() => {
        if (typeof onLayerDockOpenChange === 'function') {
            onLayerDockOpenChange(!isToolbarStowed && isLayerDockOpen);
        }
    }, [isToolbarStowed, isLayerDockOpen, onLayerDockOpenChange]);
    const [unitMenuOffset, setUnitMenuOffset] = useState({ x: 0, y: 0 });
    const unitMenuOffsetRef = useRef(unitMenuOffset);
    unitMenuOffsetRef.current = unitMenuOffset;
    const unitMenuDragRef = useRef({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 });

    useEffect(() => {
        const getClient = (e) => {
            if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            return { x: e.clientX, y: e.clientY };
        };
        const handleMove = (e) => {
            if (!unitMenuDragRef.current.dragging) return;
            if (e.cancelable) e.preventDefault();
            const pt = getClient(e);
            if (pt.x === undefined) return;
            setUnitMenuOffset({
                x: unitMenuDragRef.current.originX + (pt.x - unitMenuDragRef.current.startX),
                y: unitMenuDragRef.current.originY + (pt.y - unitMenuDragRef.current.startY)
            });
        };
        const handleUp = () => { unitMenuDragRef.current.dragging = false; };
        window.addEventListener('pointermove', handleMove, { passive: false });
        window.addEventListener('pointerup', handleUp);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };
    }, []);

    const handleUnitMenuPointerDown = (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        const cx = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
        const cy = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
        unitMenuDragRef.current = {
            dragging: true,
            startX: cx,
            startY: cy,
            originX: unitMenuOffsetRef.current.x,
            originY: unitMenuOffsetRef.current.y
        };
    };

    const isTopDown = viewAngleX <= 5;

    // 計算選中頂點在螢幕上的投影錨點 (使 CoordinatePopup 精準浮動於該 3D 頂點旁)
    const popupScreenAnchor = useMemo(() => {
        if (!selectedPointForEdit?.point || !projectLocalToScreen) return null;
        const projected = projectLocalToScreen(
            selectedPointForEdit.point.x + activeLayerShiftM.x,
            selectedPointForEdit.point.y + activeLayerShiftM.y,
            activePlaneZPx
        );
        if (!projected) return null;
        return { x: projected.offsetX, y: projected.offsetY };
    }, [selectedPointForEdit, projectLocalToScreen, activeLayerShiftM, activePlaneZPx]);

    const baseAreaSqm = calculatePolygonArea(currentBasePoints, inputs.baseCurves) || inputs.baseArea || 0;
    const totalLayerCount = groupedLayers.length + (basements?.length || 0) + 2;
    const activeLayerBadge = isDrawingSite
        ? '繪製'
        : normalizedSelectedFloorId === 'base'
            ? '基地'
            : normalizedSelectedFloorId === 'excavation'
                ? '開挖'
                : (normalizedSelectedFloorId || totalLayerCount);

    return (
        <>
            {/* ── 手機版：由 UnifiedMobileSheet 接管時不再渲染重複導覽列 ── */}
            {isMobile ? (
                hideMobileNav ? null : (
                <MobileBottomNav
                    controller={controller}
                    isDarkMode={isDarkMode}
                    setIsDarkMode={setIsDarkMode}
                    viewAngleX={viewAngleX}
                    onToggleTopDownView={onToggleTopDownView}
                    primaryDragMode={primaryDragMode}
                    onTogglePrimaryDragMode={onTogglePrimaryDragMode}
                    aoMode={aoMode}
                    onToggleAoMode={onToggleAoMode}
                    sunPathOpen={sunPathOpen}
                    onToggleSunPath={onToggleSunPath}
                    onOpenCadastralImport={onOpenCadastralImport}
                    appActions={appActions}
                />
                )
            ) : (
            /* ── 桌機／平板版 (≥768px)：單行頂部工具列（防換行重疊，右側保留深色模式膠囊空間） ── */
            <div
                className="absolute top-3.5 left-4 z-40 flex flex-col gap-1.5 pointer-events-auto max-w-[calc(100vw-118px)] no-context-menu"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                {isToolbarStowed ? (
                    /* 完全收納狀態：僅保留單一 38x38 小巧工具箱方塊 */
                    <div className="bg-white/95 backdrop-blur-md border-2 border-black shadow-[4px_4px_0_#000] p-1 w-fit">
                        <ToolIconBtn
                            icon={<Maximize2 size={16} strokeWidth={2.5} />}
                            variant="dark"
                            tipTitle="展開工具列 (Expand Shelf)"
                            tipDesc="展開左上角繪製基地、圖層抽屜、樓層配置與 2D/3D 視角控制工具箱。"
                            tipPlacement="bottom"
                            hoverTipsEnabled={hoverTipsEnabled}
                            onDisableHoverTips={() => setHoverTipsEnabled(false)}
                            onClick={() => setIsToolbarStowed(false)}
                        />
                    </div>
                ) : (
                    /* 展開狀態：單行緊湊圖示列（768px 平板可平滑橫向捲動，永不換行遮擋下方摘要） */
                    <div className="flex flex-nowrap items-center gap-1 overflow-x-auto no-scrollbar max-w-full yra-card rounded-2xl p-1 text-black w-fit">
                        {/* 0. 收納整個工具列按鈕 */}
                        <ToolIconBtn
                            icon={<Minimize2 size={15} strokeWidth={2.5} />}
                            variant="default"
                            tipTitle="收納工具列 (Stow Shelf)"
                            tipDesc="將左上角主工具列完全收合為單一小方塊，最大化畫布視野。"
                            tipPlacement="bottom"
                            hoverTipsEnabled={hoverTipsEnabled}
                            onDisableHoverTips={() => setHoverTipsEnabled(false)}
                            onClick={() => {
                                setIsLayerDockOpen(false);
                                setIsToolbarStowed(true);
                            }}
                        />

                        <div className="h-5 w-[1.5px] bg-stone-300 mx-0.5" />

                        {/* 1. 點拉線繪製基地 */}
                        <ToolIconBtn
                            icon={<Pencil size={16} strokeWidth={2.5} />}
                            label={isDrawingSite ? '繪製中' : '點拉線繪基地'}
                            showLabel={showToolbarLabels}
                            active={isDrawingSite}
                            variant="emerald"
                            tipTitle="點拉線繪製基地 (Draw Site Polygon)"
                            tipShortcut="Shift 正交 / Enter 封閉"
                            tipDesc="在畫布直接點擊角點拉線繪製或重繪基地。拉線時即時顯示公尺邊長與角度，點擊起點 #1 或按 Enter 完成封閉。"
                            tipPlacement="bottom"
                            hoverTipsEnabled={hoverTipsEnabled}
                            onDisableHoverTips={() => setHoverTipsEnabled(false)}
                            onClick={() => isDrawingSite ? cancelDrawingSite() : startDrawingSite('current')}
                        />

                        {/* 1.5 台灣地籍圖串接 / 上傳 PDF、圖片、DXF 選地號 */}
                        {onOpenCadastralImport && (
                            <ToolIconBtn
                                icon={<Upload size={16} strokeWidth={2.5} />}
                                label="地籍匯入"
                                showLabel={showToolbarLabels}
                                variant="sky"
                                tipTitle="台灣地籍圖 / 上傳 PDF・圖片・DXF 選地號"
                                tipShortcut="100% 僅存本機瀏覽器"
                                tipDesc="串接國土測繪中心地籍圖、DXFast (.dxf)、TWD97 界址坐標表，或上傳地籍圖謄本 PDF / 都計圖，於畫布直接魔術棒點選地號建立基地。"
                                tipPlacement="bottom"
                                hoverTipsEnabled={hoverTipsEnabled}
                                onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                onClick={onOpenCadastralImport}
                            />
                        )}

                        {/* 2. 基地邊界與退縮編輯 */}
                        <ToolIconBtn
                            icon={<MapIcon size={16} strokeWidth={2.5} />}
                            label="基地形狀"
                            showLabel={showToolbarLabels}
                            active={normalizedSelectedFloorId === 'base' && !isDrawingSite}
                            variant="default"
                            tipTitle="基地形狀與臨路退縮編輯 (Edit Site)"
                            tipShortcut="雙擊基地亦可進入"
                            tipDesc="在場景中直接拖曳基地角點 (#1..#n) 或邊線、拉動圓弧、指定面前道路與前/後/側院退縮，3D 量體同步更新。"
                            tipPlacement="bottom"
                            hoverTipsEnabled={hoverTipsEnabled}
                            onDisableHoverTips={() => setHoverTipsEnabled(false)}
                            onClick={() => {
                                if (isDrawingSite) cancelDrawingSite();
                                if (normalizedSelectedFloorId === 'base') onCloseFloorEdit();
                                else onSelectFloor('base');
                            }}
                        />

                        {/* 3. 開挖範圍編輯 */}
                        <ToolIconBtn
                            icon={<Shovel size={16} strokeWidth={2.5} />}
                            label="開挖範圍"
                            showLabel={showToolbarLabels}
                            active={normalizedSelectedFloorId === 'excavation' && !isDrawingSite}
                            variant="amber"
                            tipTitle="地下室開挖範圍編輯 (Excavation)"
                            tipDesc="直接在地面調整地下室開挖邊界多邊形、曲線與開挖面積。"
                            tipPlacement="bottom"
                            hoverTipsEnabled={hoverTipsEnabled}
                            onDisableHoverTips={() => setHoverTipsEnabled(false)}
                            onClick={() => {
                                if (isDrawingSite) cancelDrawingSite();
                                if (normalizedSelectedFloorId === 'excavation') onCloseFloorEdit();
                                else onSelectFloor('excavation');
                            }}
                        />

                        {/* 4. 圖層與各層平面收納抽屜 (Base / Excav / B1.. / 1F..) */}
                        <ToolIconBtn
                            icon={<Layers size={16} strokeWidth={2.5} />}
                            label="各層平面"
                            showLabel={showToolbarLabels}
                            badge={activeLayerBadge}
                            active={isLayerDockOpen || (Boolean(normalizedSelectedFloorId) && normalizedSelectedFloorId !== 'base' && normalizedSelectedFloorId !== 'excavation')}
                            variant="indigo"
                            tipTitle="圖層與各樓層平面抽屜 (Layer Drawer)"
                            tipShortcut={`共 ${totalLayerCount} 層`}
                            tipDesc="展開或收納『基地、開挖、B1、1F~nF』各層平面清單；點選任一樓層即可直接在 3D 樓板頂面編輯形狀。"
                            tipPlacement="bottom"
                            hoverTipsEnabled={hoverTipsEnabled}
                            onDisableHoverTips={() => setHoverTipsEnabled(false)}
                            onClick={() => setIsLayerDockOpen(prev => !prev)}
                        />

                        {/* 5. 樓層數量配置 (FLOORS) */}
                        <ToolIconBtn
                            icon={<SlidersHorizontal size={16} strokeWidth={2.5} />}
                            label="樓層配置"
                            showLabel={showToolbarLabels}
                            variant="default"
                            tipTitle="地上 / 地下樓層數配置 (Floor Count)"
                            tipDesc="設定地上總層數與地下室開挖層數，立即重新計算並生成 3D 建築量體。"
                            tipPlacement="bottom"
                            hoverTipsEnabled={hoverTipsEnabled}
                            onDisableHoverTips={() => setHoverTipsEnabled(false)}
                            onClick={() => {
                                setFloorConfig({
                                    above: Math.max(1, parseInt(controller.floorsAboveValue || inputs.floorsAbove || '1')),
                                    below: Math.max(0, parseInt(inputs.floorsBelow || '0'))
                                });
                                setShowFloorDialog(true);
                            }}
                        />

                        {/* 6. 分戶/分棟切割 (SPLIT) */}
                        <ToolIconBtn
                            icon={<LayoutDashboard size={16} strokeWidth={2.5} />}
                            label="分戶分割"
                            showLabel={showToolbarLabels}
                            active={Boolean(unitSettings?.enabled)}
                            variant="indigo"
                            tipTitle="分戶 / 分棟切割設定 (Split Units)"
                            tipDesc="開啟分戶切割面板，可依比例、戶數或每戶坪數將樓板分割為多戶/多棟並設定棟距。"
                            tipPlacement="bottom"
                            hoverTipsEnabled={hoverTipsEnabled}
                            onDisableHoverTips={() => setHoverTipsEnabled(false)}
                            onClick={() => {
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
                        />

                        <div className="h-5 w-[1.5px] bg-stone-300 mx-0.5" />

                        {/* 7. 視角快速切換 (俯視平面 2D vs 3D 透視) */}
                        <ToolIconBtn
                            icon={<Compass size={16} strokeWidth={2.5} />}
                            label={isTopDown ? '俯視2D' : '3D立體'}
                            showLabel={showToolbarLabels}
                            badge={isTopDown ? '2D' : '3D'}
                            active={isTopDown}
                            variant="sky"
                            tipTitle={isTopDown ? '目前為正射俯視平面（點擊切回 3D）' : '目前為 3D 立體透視（點擊切換正射俯視）'}
                            tipDesc="在同一個空間場景中一鍵無縫切換『正射俯視平面 (Top-Down 2D)』與『3D 立體視角』，不中斷當前繪圖狀態。"
                            tipPlacement="bottom"
                            hoverTipsEnabled={hoverTipsEnabled}
                            onDisableHoverTips={() => setHoverTipsEnabled(false)}
                            onClick={onToggleTopDownView}
                        />

                        {/* 8. 滑鼠左鍵拖曳模式切換 (旋轉視角 vs 平移畫布) */}
                        <ToolIconBtn
                            icon={primaryDragMode === 'rotate' ? <RotateCw size={15} strokeWidth={2.5} /> : <Hand size={15} strokeWidth={2.5} />}
                            label={primaryDragMode === 'rotate' ? '旋轉' : '平移'}
                            showLabel={showToolbarLabels}
                            active={primaryDragMode === 'pan'}
                            variant="default"
                            tipTitle={primaryDragMode === 'rotate' ? '左鍵拖曳：旋轉 3D 視角（點此改為平移）' : '左鍵拖曳：平移畫布（點此改為旋轉）'}
                            tipShortcut="按住 Shift 可臨時切換"
                            tipDesc="切換在畫布空白處按住滑鼠左鍵（或單指）拖曳時的預設動作為『旋轉視角』或『平移畫布』。"
                            tipPlacement="bottom"
                            hoverTipsEnabled={hoverTipsEnabled}
                            onDisableHoverTips={() => setHoverTipsEnabled(false)}
                            onClick={onTogglePrimaryDragMode}
                        />

                        {/* 9. 白模 AO 視覺效果 & 10. 太陽軌跡日照分析 */}
                        {(onToggleAoMode || onToggleSunPath) && (
                            <>
                                <div className="h-5 w-[1.5px] bg-stone-300 mx-0.5" />
                                {onToggleAoMode && (
                                    <ToolIconBtn
                                        icon={<Box size={16} strokeWidth={2.5} />}
                                        label="AO白模"
                                        showLabel={showToolbarLabels}
                                        badge={aoMode ? (isNightAO ? '夜' : 'AO') : null}
                                        active={aoMode}
                                        variant="default"
                                        tipTitle="建築白模 AO 視覺效果 (Ambient Occlusion)"
                                        tipDesc="切換為高質感建築白模與環境光遮蔽 (AO) 渲染模式，純粹觀察量體層次、退縮關係與真實陰影投影。"
                                        tipPlacement="bottom"
                                        hoverTipsEnabled={hoverTipsEnabled}
                                        onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                        onClick={onToggleAoMode}
                                    />
                                )}
                                {onToggleSunPath && (
                                    <ToolIconBtn
                                        icon={isNightAO && sunPathOpen ? <Moon size={16} strokeWidth={2.5} /> : <Sun size={16} strokeWidth={2.5} />}
                                        label="太陽軌跡"
                                        showLabel={showToolbarLabels}
                                        active={sunPathOpen}
                                        variant="amber"
                                        tipTitle="太陽軌跡與日照陰影模擬 (Sun Path)"
                                        tipDesc="開啟太陽軌跡控制面板並自動切換為白模 AO 視覺效果；可拖曳 24 小時太陽時間與節氣，夜間自動切換為基地聚光夜景 AO！"
                                        tipPlacement="bottom"
                                        hoverTipsEnabled={hoverTipsEnabled}
                                        onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                        onClick={onToggleSunPath}
                                    />
                                )}
                            </>
                        )}

                        {/* 當正在編輯圖層時，於同一工具列提供精簡全選/清除選取圖示鈕 */}
                        {displayLayer && !isDrawingSite && displayLayer.points && (
                            <>
                                <div className="h-5 w-[1.5px] bg-stone-300 mx-0.5" />
                                <ToolIconBtn
                                    icon={<CheckSquare size={15} strokeWidth={2.5} />}
                                    label="全選"
                                    showLabel={showToolbarLabels}
                                    badge={selectedIndices.size > 0 ? selectedIndices.size : null}
                                    active={selectedIndices.size === displayLayer.points.length}
                                    variant="indigo"
                                    tipTitle="全選所有角點 (Select All)"
                                    tipDesc="一次選取目前多邊形上的所有控制點，方便整體平移。"
                                    tipPlacement="bottom"
                                    hoverTipsEnabled={hoverTipsEnabled}
                                    onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                    onClick={() => {
                                        const all = new Set(displayLayer.points.map((_, idx) => idx));
                                        selectedIndicesRef.current = all;
                                        setSelectedIndices(all);
                                    }}
                                />
                                {selectedIndices.size > 0 && (
                                    <ToolIconBtn
                                        icon={<X size={15} strokeWidth={2.5} />}
                                        label="清除選取"
                                        showLabel={showToolbarLabels}
                                        variant="danger"
                                        tipTitle={`清除已選角點 (目前選中 ${selectedIndices.size} 點)`}
                                        tipDesc="取消目前選取的所有角點並關閉座標微調框。"
                                        tipPlacement="bottom"
                                        hoverTipsEnabled={hoverTipsEnabled}
                                        onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                        onClick={() => {
                                            selectedIndicesRef.current = new Set();
                                            setSelectedIndices(new Set());
                                            setSelectedPointForEdit(null);
                                        }}
                                    />
                                )}
                            </>
                        )}

                        <div className="h-5 w-[1.5px] bg-stone-300 mx-0.5" />

                        {/* 10. 檢討模式切換（線框與法規限制面，預設關閉保持白模降噪） */}
                        {appActions?.setShowCheckLines && (
                            <ToolIconBtn
                                icon={<AlertTriangle size={15} strokeWidth={2.5} />}
                                label="檢討模式"
                                showLabel={showToolbarLabels}
                                active={Boolean(appActions.showCheckLines)}
                                variant="default"
                                tipTitle={appActions.showCheckLines ? '關閉檢討模式（回到純白模）' : '開啟檢討模式（顯示高度比與法規限制面）'}
                                tipDesc="切換是否於 3D 場景疊加高度比限制面與法規檢討線。"
                                tipPlacement="bottom"
                                hoverTipsEnabled={hoverTipsEnabled}
                                onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                onClick={() => appActions.setShowCheckLines(prev => !prev)}
                            />
                        )}

                        {/* 11. 輸出與分享報告 */}
                        {appActions?.onOpenExport && (
                            <ToolIconBtn
                                icon={<Upload size={15} strokeWidth={2.5} />}
                                label="輸出分享"
                                showLabel={showToolbarLabels}
                                variant="default"
                                tipTitle="輸出與分享報告（LINE 長圖 / 唯讀連結 / A4 PDF）"
                                tipDesc="產生適合 LINE 傳送的長圖、可開啟的唯讀連結或 A4 PDF 評估報告。"
                                tipPlacement="bottom"
                                hoverTipsEnabled={hoverTipsEnabled}
                                onDisableHoverTips={() => setHoverTipsEnabled(false)}
                                onClick={appActions.onOpenExport}
                            />
                        )}

                        {/* 12. 懸浮提示開關 (Hover Tooltips Toggle) */}
                        <ToolIconBtn
                            icon={<Sparkles size={15} strokeWidth={2.5} />}
                            label={hoverTipsEnabled ? '提示:開' : '提示:關'}
                            showLabel={showToolbarLabels}
                            active={hoverTipsEnabled}
                            variant="sky"
                            tipTitle={hoverTipsEnabled ? '懸浮功能提示：開啟中（點此關閉）' : '懸浮功能提示：已關閉（點此重新開啟）'}
                            tipDesc="控制滑鼠游標移到任何工具圖示上時，是否顯示點選前的功能說明與快捷鍵提示。"
                            tipPlacement="bottom"
                            hoverTipsEnabled={true}
                            onClick={() => setHoverTipsEnabled(!hoverTipsEnabled)}
                        />

                        {/* 10. 圖示/中文標籤模式切換 */}
                        <ToolIconBtn
                            icon={<Eye size={15} strokeWidth={2.5} />}
                            label={showToolbarLabels ? '隱藏標籤' : '中文標籤'}
                            showLabel={true}
                            active={showToolbarLabels}
                            variant="default"
                            tipTitle={showToolbarLabels ? '切換為純圖示模式' : '顯示工具中文標籤'}
                            tipDesc="在『純圖示精簡模式』與『圖示＋中文標籤模式』間切換。"
                            tipPlacement="bottom"
                            hoverTipsEnabled={hoverTipsEnabled}
                            onDisableHoverTips={() => setHoverTipsEnabled(false)}
                            onClick={() => setShowToolbarLabels(prev => !prev)}
                        />
                    </div>
                )}

                {/* ── 可收納之圖層與各樓層平面選擇抽屜 (點擊圖層按鈕時才展開，預設收納不佔空間) ── */}
                {!isToolbarStowed && isLayerDockOpen && (
                    <div className="flex flex-col gap-1.5 p-2 bg-white/95 backdrop-blur-md border-2 border-black shadow-[4px_4px_0_#000] max-w-[calc(100vw-32px)] sm:max-w-[72vw] animate-in fade-in duration-150">
                        <div className="flex items-center justify-between border-b border-stone-200 pb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-stone-600 flex items-center gap-1">
                                <Layers size={11} /> 點選圖層直接在 3D 場景內編輯平面
                            </span>
                            <button
                                onClick={() => setIsLayerDockOpen(false)}
                                className="px-1.5 py-0.5 text-[10px] font-black text-stone-500 hover:text-black hover:bg-stone-100 flex items-center gap-0.5"
                            >
                                <ChevronUp size={12} /> 收納抽屜
                            </button>
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 thin-scrollbar">
                            {/* 基地卡片 */}
                            <button
                                onClick={() => {
                                    if (isDrawingSite) cancelDrawingSite();
                                    if (normalizedSelectedFloorId === 'base') onCloseFloorEdit();
                                    else onSelectFloor('base');
                                }}
                                className={`flex flex-col items-start px-2.5 py-1 border-2 border-black shrink-0 transition-all ${
                                    normalizedSelectedFloorId === 'base' && !isDrawingSite
                                        ? 'bg-sky-600 text-white shadow-[2px_2px_0_#000]'
                                        : 'bg-white text-black hover:bg-sky-50'
                                }`}
                            >
                                <span className="text-[10px] font-black flex items-center gap-1">
                                    <MapIcon size={11} /> 基地
                                </span>
                                <span className="text-[10px] font-mono font-bold opacity-85">
                                    {formatNum(toPing(baseAreaSqm))}坪
                                </span>
                            </button>

                            {/* 開挖範圍卡片 */}
                            <button
                                onClick={() => {
                                    if (isDrawingSite) cancelDrawingSite();
                                    if (normalizedSelectedFloorId === 'excavation') onCloseFloorEdit();
                                    else onSelectFloor('excavation');
                                }}
                                className={`flex flex-col items-start px-2.5 py-1 border-2 border-black shrink-0 transition-all ${
                                    normalizedSelectedFloorId === 'excavation' && !isDrawingSite
                                        ? 'bg-amber-500 text-white shadow-[2px_2px_0_#000]'
                                        : 'bg-white text-amber-800 hover:bg-amber-50'
                                }`}
                            >
                                <span className="text-[10px] font-black uppercase flex items-center gap-1">
                                    <Shovel size={11} /> 開挖範圍
                                </span>
                                <span className="text-[10px] font-mono font-bold opacity-85">
                                    {inputs.excavationRatio || 60}%
                                </span>
                            </button>

                            {/* 地下室各層 B1..Bn */}
                            {(basements || []).filter(b => b.active).map(b => {
                                const isSel = normalizedSelectedFloorId === b.id && !isDrawingSite;
                                const customPts = floorSettings?.[b.id]?.points;
                                const customCurves = floorSettings?.[b.id]?.curves;
                                const area = customPts ? calculatePolygonArea(customPts, customCurves) : b.area;
                                return (
                                    <button
                                        key={b.id}
                                        onClick={() => {
                                            if (isDrawingSite) cancelDrawingSite();
                                            if (isSel) onCloseFloorEdit();
                                            else onSelectFloor(b.id);
                                        }}
                                        className={`flex flex-col items-start px-2.5 py-1 border-2 border-black shrink-0 transition-all ${
                                            isSel
                                                ? 'bg-purple-600 text-white shadow-[2px_2px_0_#000]'
                                                : 'bg-white text-purple-900 hover:bg-purple-50'
                                        }`}
                                    >
                                        <span className="text-[10px] font-black uppercase">{b.id}</span>
                                        <span className="text-[10px] font-mono font-bold opacity-85">
                                            {formatNum(toPing(area))}坪
                                        </span>
                                    </button>
                                );
                            })}

                            {/* 地上各樓層 1F..nF */}
                            {groupedLayers.map(group => {
                                const isSel = normalizedSelectedFloorId === group.id && !isDrawingSite;
                                const isViolation = group.units.some(u => u.isViolation);
                                const totalFloorArea = group.units.reduce((sum, u) => sum + (u.realArea || 0), 0);
                                return (
                                    <button
                                        key={group.id}
                                        onClick={() => {
                                            if (isDrawingSite) cancelDrawingSite();
                                            if (isSel) onCloseFloorEdit();
                                            else onSelectFloor(group.id);
                                        }}
                                        className={`flex flex-col items-start px-2.5 py-1 border-2 border-black shrink-0 transition-all relative ${
                                            isSel
                                                ? 'bg-indigo-600 text-white shadow-[2px_2px_0_#000]'
                                                : isViolation
                                                    ? 'bg-red-50 text-red-700 border-red-600 hover:bg-red-100'
                                                    : 'bg-white text-slate-900 hover:bg-indigo-50'
                                        }`}
                                    >
                                        <span className="text-[10px] font-black uppercase flex items-center gap-1">
                                            {group.id}
                                            {group.units.length > 1 ? ` (${group.units.length}戶)` : ''}
                                            {isViolation && <AlertTriangle size={10} className={isSel ? 'text-amber-300' : 'text-red-500'} />}
                                        </span>
                                        <span className="text-[10px] font-mono font-bold opacity-85">
                                            {formatNum(toPing(totalFloorArea))}坪
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
            )}

            {/* ── 頂部中央：點拉線繪製基地引導與精確控制列 ── */}
            {isDrawingSite && (
                <div
                    className="fixed top-20 left-1/2 -translate-x-1/2 z-[95] bg-white text-black border-4 border-black shadow-[8px_8px_0_#10b981] p-3 sm:p-4 flex flex-col gap-2.5 max-w-[95vw] w-fit pointer-events-auto no-context-menu"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-2">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-black uppercase">
                                ✏️ 點拉線繪製模式
                            </span>
                            <div className="flex border-2 border-black overflow-hidden text-xs font-black">
                                <button
                                    onClick={() => setDrawTarget('current')}
                                    className={`px-2.5 py-1 transition-colors ${drawTarget === 'current' ? 'bg-black text-white' : 'bg-white text-black hover:bg-stone-100'}`}
                                >
                                    重繪 {activeSiteName}
                                </button>
                                <button
                                    onClick={() => setDrawTarget('new')}
                                    className={`px-2.5 py-1 border-l-2 border-black transition-colors ${drawTarget === 'new' ? 'bg-black text-white' : 'bg-white text-black hover:bg-stone-100'}`}
                                >
                                    + 繪製為新基地 (基地 {nextSiteLabel})
                                </button>
                            </div>
                        </div>
                        <div className="text-xs font-black text-stone-600">
                            已落點: <span className="text-emerald-700 font-mono text-sm">{drawnPoints.length}</span> 點
                            {drawnPoints.length < 3 ? '（請在畫布點擊拉出至少 3 個角點）' : '（點擊起點 #1、雙擊或按 Enter 完成封閉）'}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        {/* 輔助鎖定開關 */}
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setIsOrthoLocked(prev => !prev)}
                                className={`px-2.5 py-1.5 border-2 border-black font-black flex items-center gap-1 transition-colors ${
                                    isOrthoLocked ? 'bg-amber-500 text-white' : 'bg-stone-100 text-black hover:bg-stone-200'
                                }`}
                                title="鎖定 0° / 45° / 90° 正交角度（亦可按住 Shift 鍵）"
                            >
                                <Compass size={13} />
                                <span>正交鎖定 {isOrthoLocked ? 'ON' : 'OFF'}</span>
                            </button>
                            <button
                                onClick={() => setIsSnapEnabled(prev => !prev)}
                                className={`px-2.5 py-1.5 border-2 border-black font-black flex items-center gap-1 transition-colors ${
                                    isSnapEnabled ? 'bg-sky-600 text-white' : 'bg-stone-100 text-black hover:bg-stone-200'
                                }`}
                                title="自動吸附既有基地角點、邊界與對齊線"
                            >
                                <Magnet size={13} />
                                <span>智慧吸附 {isSnapEnabled ? 'ON' : 'OFF'}</span>
                            </button>
                        </div>

                        {/* 精確輸入邊長落點 */}
                        <div className="flex items-center gap-1 bg-stone-100 border-2 border-black px-2 py-1">
                            <span className="text-[11px] font-black text-stone-600">精確邊長:</span>
                            <input
                                type="number"
                                step="0.5"
                                min="0.5"
                                value={customLengthInput}
                                onChange={(e) => setCustomLengthInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        placeByExactLength();
                                    }
                                }}
                                placeholder="米(m)"
                                className="w-16 px-1.5 py-0.5 text-xs font-black bg-white border border-black text-right outline-none"
                            />
                            <button
                                onClick={() => placeByExactLength()}
                                className="px-2 py-0.5 bg-black text-white text-[11px] font-black hover:bg-emerald-600 transition-colors flex items-center gap-0.5"
                                title="沿目前游標方向以此長度落點"
                            >
                                <CornerDownLeft size={11} /> 落點
                            </button>
                        </div>

                        {/* 退回、完成與取消 */}
                        <div className="flex items-center gap-1.5">
                            {drawnPoints.length > 0 && (
                                <button
                                    onClick={undoLastDrawnPoint}
                                    className="px-2.5 py-1.5 border-2 border-black bg-white text-black font-black hover:bg-stone-100 flex items-center gap-1"
                                >
                                    <Undo2 size={13} /> 退回一點
                                </button>
                            )}
                            <button
                                disabled={drawnPoints.length < 3}
                                onClick={() => finishDrawingSite()}
                                className={`px-3 py-1.5 border-2 border-black font-black flex items-center gap-1 transition-all ${
                                    drawnPoints.length >= 3
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-[2px_2px_0_#000]'
                                        : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                                }`}
                            >
                                <Check size={14} strokeWidth={3} /> 完成封閉基地
                            </button>
                            <button
                                onClick={cancelDrawingSite}
                                className="px-2.5 py-1.5 border-2 border-black bg-red-50 text-red-600 font-black hover:bg-red-600 hover:text-white flex items-center gap-1"
                            >
                                <X size={13} /> 取消
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 框選多點虛線矩形 ── */}
            {boxSelectRect && (
                <div
                    className="fixed z-[85] pointer-events-none border-2 border-dashed border-indigo-600 bg-indigo-500/15"
                    style={{
                        left: boxSelectRect.left,
                        top: boxSelectRect.top,
                        width: boxSelectRect.width,
                        height: boxSelectRect.height
                    }}
                />
            )}

            {/* ── 頂點座標精確微調與刪除浮動面板 (CoordinatePopup) ── */}
            {selectedPointForEdit && displayLayer && !isDrawingSite && !isActivelyDragging && (
                <CoordinatePopup
                    point={selectedPointForEdit.point}
                    idx={selectedPointForEdit.idx}
                    selectedIndices={selectedIndices}
                    totalPointsCount={displayLayer.points?.length || 0}
                    onChange={handlePointEdit}
                    onDeletePoint={handleDeletePoint}
                    onClearSelection={() => {
                        selectedIndicesRef.current = new Set();
                        setSelectedIndices(new Set());
                        setSelectedPointForEdit(null);
                    }}
                    scale={scale3d || 1}
                    screenAnchor={popupScreenAnchor}
                    isDarkMode={isDarkMode}
                />
            )}

            {/* ── 分戶/分棟切割設定面板 (SPLIT CONFIG) ── */}
            {unitSettings?.enabled && !isDrawingSite && (
                <div
                    className="fixed top-28 left-4 z-[75] bg-white text-black border-4 border-black p-5 shadow-[8px_8px_0_#000] w-76 pointer-events-auto no-context-menu"
                    style={{ transform: `translate(${unitMenuOffset.x}px, ${unitMenuOffset.y}px)` }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <h3
                        onMouseDown={handleUnitMenuPointerDown}
                        onTouchStart={handleUnitMenuPointerDown}
                        style={{ touchAction: 'none' }}
                        className="font-black text-sm uppercase tracking-tighter mb-3 border-b-2 border-black pb-1.5 cursor-grab active:cursor-grabbing select-none flex items-center justify-between"
                    >
                        <span>分戶/分棟切割 ({displayLayer && displayLayer.id !== 'base' && displayLayer.id !== 'excavation' ? displayLayer.id : (unitSettings.target || '1F')})</span>
                        <span className="text-[9px] font-mono text-stone-400">DRAG</span>
                    </h3>

                    {(!displayLayer || displayLayer.id === 'base' || displayLayer.id === 'excavation') && (
                        <div className="mb-2.5">
                            <label className="text-xs font-bold text-stone-500 block mb-1">目標樓層</label>
                            <select
                                value={(unitSettings.target || '1F').split('-')[0]}
                                onChange={(e) => onUpdateUnitSettings(p => ({ ...p, target: e.target.value }))}
                                className="w-full text-xs p-1.5 border-2 border-black bg-white font-black outline-none"
                            >
                                {(groupedLayers || []).filter(g => g.id !== 'base' && g.id !== 'excavation').map(g => (
                                    <option key={g.id} value={g.id}>{g.id}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="mb-2.5">
                        <label className="text-xs font-bold text-stone-500 block">分戶方式</label>
                        <div className="flex gap-1.5 mt-1">
                            <button onClick={() => onUpdateUnitSettings(p => ({ ...p, mode: 'ratio' }))} className={`flex-1 text-xs font-black py-1 border-2 border-black ${unitSettings.mode === 'ratio' ? 'bg-indigo-600 text-white' : 'bg-stone-50'}`}>比例</button>
                            <button onClick={() => onUpdateUnitSettings(p => ({ ...p, mode: 'count' }))} className={`flex-1 text-xs font-black py-1 border-2 border-black ${unitSettings.mode === 'count' ? 'bg-indigo-600 text-white' : 'bg-stone-50'}`}>戶數</button>
                            <button onClick={() => onUpdateUnitSettings(p => ({ ...p, mode: 'area' }))} className={`flex-1 text-xs font-black py-1 border-2 border-black ${unitSettings.mode === 'area' ? 'bg-indigo-600 text-white' : 'bg-stone-50'}`}>每戶坪</button>
                        </div>
                    </div>

                    <div className="mb-2.5">
                        <label className="text-xs font-bold text-stone-500 block">分割方向</label>
                        <div className="flex gap-1.5 mt-1">
                            <button onClick={() => onUpdateUnitSettings(p => ({ ...p, axis: 'x' }))} className={`flex-1 text-xs font-black py-1 border-2 border-black ${unitSettings.axis === 'x' ? 'bg-indigo-600 text-white' : 'bg-stone-50'}`}>垂直 (X)</button>
                            <button onClick={() => onUpdateUnitSettings(p => ({ ...p, axis: 'y' }))} className={`flex-1 text-xs font-black py-1 border-2 border-black ${unitSettings.axis === 'y' ? 'bg-indigo-600 text-white' : 'bg-stone-50'}`}>水平 (Y)</button>
                        </div>
                    </div>

                    {unitSettings.mode === 'ratio' && (
                        <div className="mb-2.5">
                            <label className="text-xs font-bold text-stone-500 block">分割比例 ({Math.round(unitSettings.ratio * 100)}:{Math.round((1 - unitSettings.ratio) * 100)})</label>
                            <input type="range" min="0.1" max="0.9" step="0.05" value={unitSettings.ratio} onChange={(e) => onUpdateUnitSettings(p => ({ ...p, ratio: parseFloat(e.target.value) }))} className="w-full accent-indigo-600" />
                        </div>
                    )}
                    {unitSettings.mode === 'count' && (
                        <div className="mb-2.5">
                            <label className="text-xs font-bold text-stone-500 block">戶數</label>
                            <input type="number" min="1" step="1" value={unitSettings.count} onChange={(e) => onUpdateUnitSettings(p => ({ ...p, count: Math.max(1, parseInt(e.target.value || '1')) }))} className="w-full text-xs p-1.5 border-2 border-black font-black" />
                        </div>
                    )}
                    {unitSettings.mode === 'area' && (
                        <div className="mb-2.5">
                            <label className="text-xs font-bold text-stone-500 block">每戶面積 (坪)</label>
                            <input type="number" min="0.5" step="0.5" value={unitSettings.areaPerUnit} onChange={(e) => onUpdateUnitSettings(p => ({ ...p, areaPerUnit: Math.max(0.5, parseFloat(e.target.value || '0.5')) }))} className="w-full text-xs p-1.5 border-2 border-black font-black" />
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="text-xs font-bold text-stone-500 block">棟距 (Gap): {unitSettings.gap}m</label>
                        <input type="range" min="0" max="5" step="0.1" value={unitSettings.gap} onChange={(e) => onUpdateUnitSettings(p => ({ ...p, gap: parseFloat(e.target.value) }))} className="w-full accent-indigo-600" />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                const tId = (displayLayer && displayLayer.id !== 'base' && displayLayer.id !== 'excavation')
                                    ? displayLayer.id
                                    : (unitSettings.target || '1F').split('-')[0];
                                const splitLayer = (controller.groupedLayers || []).find(g => g.id === tId)?.units?.[0];
                                const basePts = (displayLayer && displayLayer.id === tId) ? displayLayer.points : (splitLayer?.unsplitPoints || splitLayer?.points);
                                const baseCurvs = (displayLayer && displayLayer.id === tId) ? displayLayer.curves : (splitLayer?.unsplitCurves || splitLayer?.curves || null);
                                const allowedPts = (displayLayer && displayLayer.id === tId) ? (displayLayer.allowedPoints || basePts) : (splitLayer?.allowedPoints || basePts);
                                const allowedCurvs = (displayLayer && displayLayer.id === tId) ? (displayLayer.allowedCurves || baseCurvs) : (splitLayer?.allowedCurves || baseCurvs);
                                if (!basePts) return;
                                const units = getSplitUnits(basePts, unitSettings, baseCurvs, allowedPts, allowedCurvs);
                                const worldUnits = Array.isArray(units) ? units.map(uPts => toWorldFloorPoints(uPts)) : units;
                                updateSetting(tId, 'unitConfig', {
                                    mode: unitSettings.mode || 'ratio',
                                    axis: unitSettings.axis || 'x',
                                    ratio: unitSettings.ratio ?? 0.5,
                                    count: unitSettings.count ?? 2,
                                    areaPerUnit: unitSettings.areaPerUnit ?? 25,
                                    gap: unitSettings.gap ?? 0
                                });
                                updateSetting(tId, 'units', worldUnits);
                                onUpdateUnitSettings(prev => ({ ...prev, enabled: false }));
                            }}
                            className="flex-1 bg-black text-white text-xs font-black py-2 hover:bg-indigo-600 border-2 border-black transition-colors"
                        >
                            確認分割
                        </button>
                        {(savedUnits?.length > 0 || floorSettings?.[(unitSettings.target || '1F').split('-')[0]]?.unitConfig) && (
                            <button
                                onClick={() => {
                                    const tId = (displayLayer && displayLayer.id !== 'base' && displayLayer.id !== 'excavation')
                                        ? displayLayer.id
                                        : (unitSettings.target || '1F').split('-')[0];
                                    updateSetting(tId, 'units', null);
                                    updateSetting(tId, 'unitConfig', null);
                                    onUpdateUnitSettings(prev => ({ ...prev, enabled: false }));
                                }}
                                className="px-2.5 bg-red-50 text-red-600 text-xs font-black py-2 hover:bg-red-600 hover:text-white border-2 border-red-600 transition-colors"
                            >
                                取消分戶
                            </button>
                        )}
                        <button
                            onClick={() => onUpdateUnitSettings(prev => ({ ...prev, enabled: false }))}
                            className="flex-1 bg-white text-black text-xs font-black py-2 hover:bg-stone-100 border-2 border-black transition-colors"
                        >
                            關閉
                        </button>
                    </div>
                </div>
            )}

            {/* ── 樓層數配置彈窗 (FLOOR CONFIG) ── */}
            {showFloorDialog && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-auto">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowFloorDialog(false)} />
                    <div className="relative bg-white text-black border-4 border-black shadow-[12px_12px_0_#000] w-72 p-6 z-10">
                        <h3 className="font-black text-sm tracking-tight mb-4 border-b-2 border-black pb-1">樓層數配置</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-stone-600">地上樓層數</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={floorConfig.above}
                                    onChange={(e) => setFloorConfig(fc => ({ ...fc, above: Math.max(1, parseInt(e.target.value || '1')) }))}
                                    className="w-16 p-1 text-right border-2 border-black font-black outline-none focus:bg-black focus:text-white"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-stone-600">地下樓層數</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={floorConfig.below}
                                    onChange={(e) => setFloorConfig(fc => ({ ...fc, below: Math.max(0, parseInt(e.target.value || '0')) }))}
                                    className="w-16 p-1 text-right border-2 border-black font-black outline-none focus:bg-black focus:text-white"
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => {
                                    onUpdateFloorsAbove && onUpdateFloorsAbove(floorConfig.above);
                                    onUpdateInputs && onUpdateInputs('floorsBelow', floorConfig.below);
                                    setShowFloorDialog(false);
                                }}
                                className="flex-1 bg-black text-white text-xs font-black py-2 hover:bg-[var(--text-accent)] hover:text-white border-2 border-black transition-colors"
                            >
                                套用設定
                            </button>
                            <button
                                onClick={() => setShowFloorDialog(false)}
                                className="flex-1 bg-white text-black text-xs font-black py-2 hover:bg-stone-100 border-2 border-black transition-colors"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 套用至全部樓層確認彈窗 (APPLY TO ALL) ── */}
            {showApplyAllDialog && displayLayer && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-auto">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowApplyAllDialog(false)} />
                    <div className="relative bg-white text-black border-4 border-black shadow-[12px_12px_0_#000] w-80 p-6 z-10 space-y-4">
                        <h3 className="font-black text-base uppercase tracking-tighter border-b-2 border-black pb-2 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-amber-500" />
                            確認全部套用樓板 (APPLY TO ALL)
                        </h3>
                        <p className="text-xs font-bold text-stone-700 leading-relaxed">
                            確定要將目前 <span className="font-black text-black">{displayLayer.id}</span> 的樓板形狀{savedUnits && savedUnits.length > 0 ? '與戶型分割設定' : ''}套用至所有地上樓層嗎？
                            <br />
                            <span className="text-stone-500 font-normal mt-1 block">套用後各樓層仍可單獨點擊進入修改形狀或重新調整分戶。</span>
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => {
                                    const offset = floorSettings?.[displayLayer.id]?.offset || { x: 0, y: 0 };
                                    const currentUnits = savedUnits || floorSettings?.[displayLayer.id]?.units || null;
                                    const currentUnitConfig = floorSettings?.[displayLayer.id]?.unitConfig || null;
                                    let payload = {};
                                    if (displayLayer.points && displayLayer.points.length >= 3) {
                                        const area = calculatePolygonArea(displayLayer.points, displayLayer.curves);
                                        payload = { mode: 'polygon', points: displayLayer.points, curves: displayLayer.curves || null, area, offset, units: currentUnits, unitConfig: currentUnitConfig };
                                    } else {
                                        const bw = displayLayer.realWidth || controller.baseWidthM;
                                        const bd = displayLayer.realDepth || controller.baseDepthM;
                                        payload = { mode: 'box', width: bw, depth: bd, area: bw * bd, offset, units: currentUnits, unitConfig: currentUnitConfig };
                                    }
                                    setShowApplyAllDialog(false);
                                    onApplyAll && onApplyAll(payload);
                                }}
                                className="flex-1 bg-black text-white text-xs font-black py-2.5 hover:bg-amber-400 hover:text-black border-2 border-black transition-colors"
                            >
                                確認全部套用
                            </button>
                            <button
                                onClick={() => setShowApplyAllDialog(false)}
                                className="flex-1 bg-white text-black text-xs font-black py-2.5 hover:bg-stone-100 border-2 border-black transition-colors"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 底部整合編輯工具列 (EditMenu2D) ── */}
            {displayLayer && !isDrawingSite && (
                <EditMenu2D
                    data={displayLayer}
                    isDarkMode={isDarkMode}
                    onUpdateSetting={updateSetting}
                    onReset={(id) => updateSetting(id, 'reset')}
                    isOpen={true}
                    onClose={onCloseFloorEdit}
                    scale3d={scale3d}
                    inputs={inputs}
                    basePoints={currentBasePoints}
                    isRoadSelectMode={isRoadSelectMode}
                    onToggleRoadSelectMode={() => setIsRoadSelectMode(!isRoadSelectMode)}
                    interactionMode={interactionMode}
                    setInteractionMode={setInteractionMode}
                    selectedCurveIdx={selectedCurveForEdit}
                    onUpdateRoads={onUpdateRoads}
                    onUpdateInputs={onUpdateInputs}
                    isAreaLocked={isAreaLocked}
                    setIsAreaLocked={setIsAreaLocked}
                    unitSettings={unitSettings}
                    onUpdateUnitSettings={onUpdateUnitSettings}
                    onStartDrawSite={(mode) => startDrawingSite(mode || 'current')}
                    onRequestApplyAll={() => setShowApplyAllDialog(true)}
                />
            )}
        </>
    );
};

export default UnifiedSceneHUD;
