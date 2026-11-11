import React, { useState, useEffect, useCallback } from 'react';
import { Building2, MapPin, Plus, Trash2, FileText, Layers, ChevronUp, ChevronDown, AlertTriangle, Settings2, Pencil, Box, MapPinned, X } from 'lucide-react';
import { useSiteAnalysis } from './hooks/useSiteAnalysis';
import { useMultiSiteAnalysis } from './hooks/useMultiSiteAnalysis';
import { toPing, formatNum } from './utils/geometry';
import { getPolygonCentroid, discretizePolygon, getSegmentNormal, normalizeWithCurves, calculatePolygonArea } from './utils/polygon';
import Visualizer3D from './components/PlanAnalysis3D';
import { ContextMenu } from './components/ContextMenu';
import { DraggablePanel } from './components/DraggablePanel';
import { CollapsibleSection, InputRow, SectionHeader } from './components/Si.jsx';

const DEFAULT_INPUTS = { projectName: '', district: '南投縣中興新村', roads: [{ id: 1, name: '向陽路', width: 10, orientation: 'bottom', type: 'primary', edgeIndex: 2 }], zoneType: '住宅區', urbanPlanName: '中興新村都市計畫區', coverageRatio: 50, floorRatio: 150, excavationRatio: 60, floorsBelow: 1, avgCarArea: 35, frontYardDepth: 4, sideYardDepth: 1.5, sideYardDirection: 'right', backYardDepth: 3, floorHeight1F: 4.2, floorHeightOther: 3.6, baseWidth: '', incentiveArea: 0, transferArea: 0, minBackyardDepthRatio: 0, arcadeDepth: 0, floorsAbove: 4, northAngle: 0 };
const SITE_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const getSiteDimensionsAndLocalPts = (site) => {
    const pts = site?.baseGeometry?.points || site?.basePoints || null;
    const curves = site?.baseGeometry?.curves || site?.baseCurves || null;
    if (pts && pts.length > 2) {
        const norm = normalizeWithCurves(pts, curves);
        const normPts = norm.points || pts;
        const normCurves = norm.curves || null;
        const disc = discretizePolygon(normPts, normCurves, 16);
        const samplePts = disc?.points?.length > 2 ? disc.points : normPts;
        const xs = samplePts.map(p => p.x);
        const ys = samplePts.map(p => p.y);
        const w = Math.max(...xs) - Math.min(...xs);
        const d = Math.max(...ys) - Math.min(...ys);
        const area = calculatePolygonArea(normPts, normCurves) || (w * d);
        return { w, d, area, localPts: normPts, localCurves: normCurves, discretizedPts: samplePts };
    }
    const lotArea = Array.isArray(site?.lots) ? site.lots.reduce((acc, l) => acc + (parseFloat(l.area) || 0), 0) : 0;
    const area = parseFloat(site?.inputs?.baseArea) || lotArea || 239.12;
    const w = parseFloat(site?.inputs?.baseWidthM || site?.inputs?.baseWidth) || Math.sqrt(area);
    const d = parseFloat(site?.inputs?.baseDepthM || site?.inputs?.baseDepth) || (area / w);
    const localPts = [
        { x: -w / 2, y: -d / 2 },
        { x: w / 2, y: -d / 2 },
        { x: w / 2, y: d / 2 },
        { x: -w / 2, y: d / 2 }
    ];
    return { w, d, area, localPts, localCurves: null, discretizedPts: localPts };
};

// 將多邊形微幅向內縮放以避免共用曲線/直線貼齊邊界被誤判為重疊
const shrinkPolygonSlightly = (poly, eps = 0.04) => {
    if (!Array.isArray(poly) || poly.length < 3) return poly;
    const c = getPolygonCentroid(poly);
    return poly.map(p => {
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= eps) return p;
        const factor = (dist - eps) / dist;
        return { x: c.x + dx * factor, y: c.y + dy * factor };
    });
};

// 計算基地道路在世界座標下的真實多邊形（支援曲線道路與兩端 50m 延伸段）
const buildSiteRoadWorldPolygons = (site, includeExtensions = true) => {
    if (!site || !Array.isArray(site.inputs?.roads) || site.inputs.roads.length === 0) return [];
    const { localPts, localCurves } = getSiteDimensionsAndLocalPts(site);
    if (!localPts || localPts.length < 3) return [];
    const N = localPts.length;
    const siteCentroid = getPolygonCentroid(localPts);
    const pos = site.position || { x: 0, y: 0, rotation: 0 };
    const cosA = Math.cos(pos.rotation || 0);
    const sinA = Math.sin(pos.rotation || 0);
    const toWorld = (p) => ({
        x: pos.x + (p.x * cosA - p.y * sinA),
        y: pos.y + (p.x * sinA + p.y * cosA)
    });

    const roadPolys = [];
    site.inputs.roads.forEach(road => {
        const rw = parseFloat(road.width) || 6;
        const indices = Array.isArray(road.edgeIndices) && road.edgeIndices.length > 0
            ? road.edgeIndices
            : (road.edgeIndex !== undefined && road.edgeIndex !== "" ? [parseInt(road.edgeIndex)] : []);
        indices.forEach(rawIdx => {
            const edgeIdx = ((rawIdx % N) + N) % N;
            const p1 = localPts[edgeIdx];
            const p2 = localPts[(edgeIdx + 1) % N];
            const ctrl = localCurves?.[edgeIdx];
            const steps = ctrl ? 18 : 1;
            const samplePts = [];
            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
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

            const EXT_LEN = 50;
            const innerChain = [...samplePts];
            if (includeExtensions && samplePts.length >= 2) {
                const p0 = samplePts[0];
                const pt1 = samplePts[1];
                const startDir = { x: pt1.x - p0.x, y: pt1.y - p0.y };
                const lenStart = Math.hypot(startDir.x, startDir.y);
                if (lenStart > 1e-6) {
                    innerChain.unshift({
                        x: p0.x - (startDir.x / lenStart) * EXT_LEN,
                        y: p0.y - (startDir.y / lenStart) * EXT_LEN
                    });
                }
                const pn = samplePts[samplePts.length - 1];
                const pn1 = samplePts[samplePts.length - 2];
                const endDir = { x: pn.x - pn1.x, y: pn.y - pn1.y };
                const lenEnd = Math.hypot(endDir.x, endDir.y);
                if (lenEnd > 1e-6) {
                    innerChain.push({
                        x: pn.x + (endDir.x / lenEnd) * EXT_LEN,
                        y: pn.y + (endDir.y / lenEnd) * EXT_LEN
                    });
                }
            }

            const segOutNormals = [];
            for (let s = 0; s < innerChain.length - 1; s++) {
                const inN = getSegmentNormal(innerChain[s], innerChain[s + 1], siteCentroid);
                segOutNormals.push({ x: -inN.x, y: -inN.y });
            }
            const outerChain = innerChain.map((pt, s) => {
                let nx, ny;
                if (s === 0) { nx = segOutNormals[0].x; ny = segOutNormals[0].y; }
                else if (s === innerChain.length - 1) { nx = segOutNormals[segOutNormals.length - 1].x; ny = segOutNormals[segOutNormals.length - 1].y; }
                else {
                    const bx = segOutNormals[s - 1].x + segOutNormals[s].x;
                    const by = segOutNormals[s - 1].y + segOutNormals[s].y;
                    const len = Math.hypot(bx, by);
                    nx = len > 1e-6 ? bx / len : segOutNormals[s].x;
                    ny = len > 1e-6 ? by / len : segOutNormals[s].y;
                }
                return { x: pt.x + nx * rw, y: pt.y + ny * rw };
            });
            const localPoly = [...innerChain, ...[...outerChain].reverse()];
            roadPolys.push({
                road,
                edgeIdx,
                worldPoly: localPoly.map(toWorld),
                innerWorldChain: innerChain.map(toWorld),
                innerWorldMid: toWorld(samplePts[Math.floor(samplePts.length / 2)])
            });
        });
    });
    return roadPolys;
};

// 僅允許邊界貼齊；一旦產生面積穿透或交叉才視為非法重疊
const checkPolygonOverlap = (polyA, polyB) => {
    const EPSILON = 1e-5;

    if (!Array.isArray(polyA) || !Array.isArray(polyB) || polyA.length < 3 || polyB.length < 3) {
        return false;
    }

    const shrunkA = shrinkPolygonSlightly(polyA, 0.05);
    const shrunkB = shrinkPolygonSlightly(polyB, 0.05);

    const pointOnSegment = (point, segStart, segEnd) => {
        const cross = (segEnd.x - segStart.x) * (point.y - segStart.y) - (segEnd.y - segStart.y) * (point.x - segStart.x);
        if (Math.abs(cross) > EPSILON) return false;

        const dot = (point.x - segStart.x) * (point.x - segEnd.x) + (point.y - segStart.y) * (point.y - segEnd.y);
        return dot <= EPSILON;
    };

    const orientation = (a, b, c) => (
        (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    );

    const segmentsProperlyIntersect = (a1, a2, b1, b2) => {
        if (
            pointOnSegment(a1, b1, b2) ||
            pointOnSegment(a2, b1, b2) ||
            pointOnSegment(b1, a1, a2) ||
            pointOnSegment(b2, a1, a2)
        ) {
            return false;
        }

        const o1 = orientation(a1, a2, b1);
        const o2 = orientation(a1, a2, b2);
        const o3 = orientation(b1, b2, a1);
        const o4 = orientation(b1, b2, a2);

        return ((o1 > EPSILON && o2 < -EPSILON) || (o1 < -EPSILON && o2 > EPSILON))
            && ((o3 > EPSILON && o4 < -EPSILON) || (o3 < -EPSILON && o4 > EPSILON));
    };

    const isPointInPolygonStrict = (pt, poly) => {
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            if (pointOnSegment(pt, a, b)) return false;
        }

        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x;
            const yi = poly[i].y;
            const xj = poly[j].x;
            const yj = poly[j].y;
            const intersect = ((yi > pt.y) !== (yj > pt.y))
                && (pt.x < ((xj - xi) * (pt.y - yi)) / ((yj - yi) || EPSILON) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    for (let i = 0; i < shrunkA.length; i++) {
        const a1 = shrunkA[i];
        const a2 = shrunkA[(i + 1) % shrunkA.length];
        for (let j = 0; j < shrunkB.length; j++) {
            const b1 = shrunkB[j];
            const b2 = shrunkB[(j + 1) % shrunkB.length];
            if (segmentsProperlyIntersect(a1, a2, b1, b2)) {
                return true;
            }
        }
    }

    if (shrunkA.some(pt => isPointInPolygonStrict(pt, shrunkB))) return true;
    if (shrunkB.some(pt => isPointInPolygonStrict(pt, shrunkA))) return true;

    return false;
};

const createDefaultSite = (name, id, isFirst = false) => ({
    id: id || Date.now(),
    name: name || '基地',
    lots: [{ id: 1, lot: '___段___地號', area: 239.12 }],
    inputs: { ...DEFAULT_INPUTS, roads: isFirst ? DEFAULT_INPUTS.roads : [] },
    overrides: {},
    position: { x: 0, y: 0, rotation: 0 },
    baseGeometry: { points: null, curves: null },
    floorSettings: {},
    adjacentLandGroups: [{ id: 1, edges: [] }]
});

const Cal = () => {
    // ── Multi-Site State ──
    const [sites, setSites] = useState([createDefaultSite('基地 A', 1, true)]);
    const [activeSiteIndex, setActiveSiteIndex] = useState(0);
    const [showAddSiteDialog, setShowAddSiteDialog] = useState(false);
    const [showCombinedTable, setShowCombinedTable] = useState(true);

    // ── Placement Mode State ──
    const [placementMode, setPlacementMode] = useState(false); // false or 'independent'
    const [referenceEdge, setReferenceEdge] = useState(null);
    const [placementOffset, setPlacementOffset] = useState({ x: 0, y: 0 });

    // Derived active-site accessors (so all existing handlers keep working)
    const activeSite = sites[activeSiteIndex] || sites[0];
    const lots = activeSite.lots;
    const inputs = activeSite.inputs;
    const overrides = activeSite.overrides;
    const setLots = useCallback((u) => setSites(p => p.map((s, i) => i === activeSiteIndex ? { ...s, lots: typeof u === 'function' ? u(s.lots) : u } : s)), [activeSiteIndex]);
    const setInputs = useCallback((u) => setSites(p => p.map((s, i) => i === activeSiteIndex ? { ...s, inputs: typeof u === 'function' ? u(s.inputs) : u } : s)), [activeSiteIndex]);
    const setOverrides = useCallback((u) => setSites(p => p.map((s, i) => i === activeSiteIndex ? { ...s, overrides: typeof u === 'function' ? u(s.overrides) : u } : s)), [activeSiteIndex]);

    // ── Global Params (shared) ──
    const [params, setParams] = useState({ exemptRate: 15, stairRate: 5, balconyRate: 10, pricePerPing: 25 });
    const [isEditMode, setIsEditMode] = useState(false);
    const [unusedArea, setUnusedArea] = useState(0);
    const [showDetail, setShowDetail] = useState(true);
    const [showVisualizer, setShowVisualizer] = useState(true);
    const [showBasePanels, setShowBasePanels] = useState(true);
    const [showCheckLines, setShowCheckLines] = useState(true);
    const [showHeightRatio, setShowHeightRatio] = useState(true);
    const [showWeiLao, setShowWeiLao] = useState(false);
    const [showBackyard, setShowBackyard] = useState(true);
    const [isConstraintMode, setIsConstraintMode] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        // 藍曬圖主題: 亮色為 'theme-blueprint', 暗色為 'theme-cyberpunk'
        if (isDarkMode) {
            document.documentElement.classList.add('theme-cyberpunk');
            document.documentElement.classList.remove('theme-blueprint');
            document.body.classList.add('theme-cyberpunk');
            document.body.classList.remove('theme-blueprint');
        } else {
            document.documentElement.classList.add('theme-blueprint');
            document.documentElement.classList.remove('theme-cyberpunk');
            document.body.classList.add('theme-blueprint');
            document.body.classList.remove('theme-cyberpunk');
        }
    }, [isDarkMode]);

    // Removed unused toggleConstraints

    const updateLot = (id, field, value) => { setLots(prev => prev.map(l => l.id === id ? { ...l, [field]: field === 'area' ? (parseFloat(value) || 0) : value } : l)); };
    const addLot = () => { const newId = Math.max(...lots.map(l => l.id), 0) + 1; setLots([...lots, { id: newId, lot: '', area: 0 }]); };
    const removeLot = (id) => { if (lots.length > 1) setLots(lots.filter(l => l.id !== id)); };
    const updateRoad = (id, field, value) => { setInputs(prev => ({ ...prev, roads: prev.roads.map(r => r.id === id ? { ...r, [field]: value } : r) })); };
    const addRoad = () => { const newId = Math.max(...inputs.roads.map(r => r.id), 0) + 1; setInputs(prev => ({ ...prev, roads: [...prev.roads, { id: newId, name: '新道路', width: 6, orientation: 'custom', type: 'secondary' }] })); };
    const removeRoad = (id) => { if (inputs.roads.length > 1) setInputs(prev => ({ ...prev, roads: prev.roads.filter(r => r.id !== id) })); };
    const handleUpdateRoads = (newRoads) => { setInputs(prev => ({ ...prev, roads: newRoads })); };

    const { totalBaseArea, results, finalRes } = useSiteAnalysis(lots, inputs, params, overrides);
    const { siteResults, combined } = useMultiSiteAnalysis(sites, params);

    const handleConfirmPlacement = () => {
        try {
            const newIdx = sites.length;
            const label = SITE_LABELS[newIdx] || String(newIdx + 1);
            const newSite = createDefaultSite(`基地 ${label}`, Date.now(), false);
            
            const activeSite = sites[activeSiteIndex] || sites[0];
            
            let position = {
                x: parseFloat(placementOffset.x || 0),
                y: parseFloat(placementOffset.y || 0),
                rotation: parseFloat(placementOffset.rotation || 0)
            };

            // 以最初的基地形狀面積與尺寸作為預設基準
            const lotArea = Array.isArray(activeSite.lots)
                ? activeSite.lots.reduce((acc, l) => acc + (parseFloat(l.area) || 0), 0)
                : 0;
            const initArea = lotArea || 239.12;
            const initW = Math.sqrt(initArea);
            const initD = initArea / initW;
            const defaultLocalPts = [
                { x: -initW / 2, y: -initD / 2 },
                { x: initW / 2, y: -initD / 2 },
                { x: initW / 2, y: initD / 2 },
                { x: -initW / 2, y: initD / 2 }
            ];

            const adaptedPts = placementOffset.adaptedPoints || null;
            const adaptedCurves = placementOffset.adaptedCurves || null;
            const finalLocalPts = adaptedPts || defaultLocalPts;
            const finalArea = adaptedPts ? calculatePolygonArea(adaptedPts, adaptedCurves) : initArea;
            const boundsXs = finalLocalPts.map(p => p.x);
            const boundsYs = finalLocalPts.map(p => p.y);
            const finalW = boundsXs.length > 0 ? (Math.max(...boundsXs) - Math.min(...boundsXs)) : initW;
            const finalD = boundsYs.length > 0 ? (Math.max(...boundsYs) - Math.min(...boundsYs)) : initD;

            newSite.lots = [{ id: 1, lot: '___段___地號', area: parseFloat(finalArea.toFixed(2)) }];
            newSite.inputs = {
                ...activeSite.inputs,
                projectName: activeSite.inputs.projectName || '',
                baseWidth: parseFloat(finalW.toFixed(2)),
                baseWidthM: parseFloat(finalW.toFixed(2)),
                baseDepthM: parseFloat(finalD.toFixed(2)),
                baseArea: parseFloat(finalArea.toFixed(2)),
                roads: []
            };
            newSite.basePoints = finalLocalPts;
            newSite.baseCurves = adaptedCurves;
            newSite.baseGeometry = { points: finalLocalPts, curves: adaptedCurves };

            const discNew = discretizePolygon(finalLocalPts, adaptedCurves, 16);
            const sampleNew = discNew?.points?.length > 2 ? discNew.points : finalLocalPts;
            const cos = Math.cos(position.rotation);
            const sin = Math.sin(position.rotation);
            const worldPtsNew = sampleNew.map(p => ({
                x: position.x + (p.x * cos - p.y * sin),
                y: position.y + (p.x * sin + p.y * cos)
            }));

            let isColliding = false;
            for (const s of sites) {
                if (s.id === newSite.id) continue;
                const { discretizedPts: sSamplePts } = getSiteDimensionsAndLocalPts(s);
                const sPos = s.position || { x: 0, y: 0, rotation: 0 };
                const cosS = Math.cos(sPos.rotation || 0);
                const sinS = Math.sin(sPos.rotation || 0);
                const worldPtsS = sSamplePts.map(p => ({
                    x: sPos.x + (p.x * cosS - p.y * sinS),
                    y: sPos.y + (p.x * sinS + p.y * cosS)
                }));
                if (checkPolygonOverlap(worldPtsNew, worldPtsS)) {
                    isColliding = true;
                    break;
                }
            }

            const siteA = sites[0];
            const roadPolysA = buildSiteRoadWorldPolygons(siteA, true);
            for (const rp of roadPolysA) {
                if (checkPolygonOverlap(worldPtsNew, rp.worldPoly)) {
                    alert('新增基地不可侵入道路範圍，僅允許與道路邊界貼齊。');
                    return;
                }
            }

            if (isColliding) {
                alert('新增基地與既有基地發生重疊，請調整位置後再放置。');
                return;
            }

            // 僅當新基地某條邊實際緊鄰既有道路邊界時，才將該邊設定為臨路邊，不額外產生新道路
            if (roadPolysA.length > 0) {
                const mainRoadPoly = roadPolysA.find(rp => rp.road.type === 'primary') || roadPolysA[0];
                const chain = mainRoadPoly.innerWorldChain || mainRoadPoly.worldPoly || [];
                let minEdgeDist = Infinity;
                let bestEdgeIdx = 2;
                for (let j = 0; j < finalLocalPts.length; j++) {
                    const lp1 = finalLocalPts[j];
                    const lp2 = finalLocalPts[(j + 1) % finalLocalPts.length];
                    const p1 = { x: position.x + (lp1.x * cos - lp1.y * sin), y: position.y + (lp1.x * sin + lp1.y * cos) };
                    const p2 = { x: position.x + (lp2.x * cos - lp2.y * sin), y: position.y + (lp2.y * sin + lp2.y * cos) };
                    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                    for (let k = 0; k < chain.length - 1; k++) {
                        const a = chain[k];
                        const b = chain[k + 1];
                        const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
                        const t = l2 > 1e-6 ? Math.max(0, Math.min(1, ((mid.x - a.x) * (b.x - a.x) + (mid.y - a.y) * (b.y - a.y)) / l2)) : 0;
                        const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
                        const d = Math.hypot(mid.x - proj.x, mid.y - proj.y);
                        if (d < minEdgeDist) {
                            minEdgeDist = d;
                            bestEdgeIdx = j;
                        }
                    }
                }
                const rw = parseFloat(mainRoadPoly.road?.width) || 6;
                if (minEdgeDist <= rw + 2.5) {
                    newSite.inputs.roads = [{ ...mainRoadPoly.road, edgeIndex: bestEdgeIdx }];
                }
            }

            newSite.position = position;

            setSites(prev => [...prev, newSite]);
            setActiveSiteIndex(newIdx);
            setPlacementMode(false);
            setReferenceEdge(null);
            setPlacementOffset({ x: 0, y: 0, rotation: 0 });
            setShowAddSiteDialog(false);
        } catch (err) {
            console.error('Failed to confirm placement:', err);
            alert('放置基地發生幾何錯誤: ' + err.message);
        }
    };

    // ── Site Management ──
    const handleAddSite = (snapDir) => {
        try {
            if (snapDir === 'free') {
                setPlacementMode('independent');
                setReferenceEdge(null);
                setShowAddSiteDialog(false);
                return;
            }

            const newIdx = sites.length;
            const label = SITE_LABELS[newIdx] || String(newIdx + 1);
            const newSite = createDefaultSite(`基地 ${label}`, Date.now(), false);

            // 以目前選取的基地作為緊貼參考基準（若無則退回 sites[0]）
            const refSite = sites[activeSiteIndex] || sites[0];
            const siteA = sites[0];
            const apRef = refSite.position || { x: 0, y: 0, rotation: 0 };
            const radRef = apRef.rotation || 0;
            const cosR = Math.cos(radRef);
            const sinR = Math.sin(radRef);

            const { localPts: refLocalPts, localCurves: refLocalCurves } = getSiteDimensionsAndLocalPts(refSite);
            const N = refLocalPts.length;
            const refCentroid = getPolygonCentroid(refLocalPts);

            // 1. 以最初的基地形狀尺寸 (initW, initD) 作為新增基地的基準尺寸
            const initialLotArea = (Array.isArray(refSite.lots)
                ? refSite.lots.reduce((acc, l) => acc + (parseFloat(l.area) || 0), 0)
                : 0) || (Array.isArray(siteA?.lots)
                ? siteA.lots.reduce((acc, l) => acc + (parseFloat(l.area) || 0), 0)
                : 0) || 239.12;
            const initW = Math.sqrt(initialLotArea);
            const initD = initialLotArea / initW;

            // 2. 先偵測上一個基地的道路邊界、曲線端點切線方向與四個基準角點
            const refRoads = (refSite.inputs?.roads && refSite.inputs.roads.length > 0)
                ? refSite.inputs.roads
                : (siteA?.inputs?.roads || []);
            const primaryRoad = refRoads.find(r => r.type === 'primary') || refRoads[0] || null;
            let frontEdgeIdx = 2;
            if (primaryRoad) {
                if (Array.isArray(primaryRoad.edgeIndices) && primaryRoad.edgeIndices.length > 0) {
                    frontEdgeIdx = ((primaryRoad.edgeIndices[0] % N) + N) % N;
                } else if (primaryRoad.edgeIndex !== undefined && primaryRoad.edgeIndex !== "") {
                    frontEdgeIdx = ((parseInt(primaryRoad.edgeIndex) % N) + N) % N;
                }
            } else {
                frontEdgeIdx = Math.min(2, N - 1);
            }

            const idxFR = frontEdgeIdx % N;
            const idxFL = (frontEdgeIdx + 1) % N;
            const idxBL = (frontEdgeIdx + 2) % N;
            const idxBR = (frontEdgeIdx - 1 + N) % N;

            const P_FR = refLocalPts[idxFR];
            const P_FL = refLocalPts[idxFL];
            const P_BL = refLocalPts[idxBL];
            const P_BR = refLocalPts[idxBR];

            const C_front = refLocalCurves?.[idxFR] || null;
            const C_left = refLocalCurves?.[idxFL] || null;
            const C_back = refLocalCurves?.[idxBL] || null;
            const C_right = refLocalCurves?.[idxBR] || null;

            // 計算面前道路在左右兩端的真實延伸切線向量（與 renderRoads 的 18 段採樣完全一致）
            const roadSteps = C_front ? 18 : 1;
            const sampleBezierPt = (t) => {
                if (!C_front) {
                    return { x: P_FR.x + (P_FL.x - P_FR.x) * t, y: P_FR.y + (P_FL.y - P_FR.y) * t };
                }
                const mt = 1 - t;
                return {
                    x: mt * mt * P_FR.x + 2 * mt * t * C_front.x + t * t * P_FL.x,
                    y: mt * mt * P_FR.y + 2 * mt * t * C_front.y + t * t * P_FL.y
                };
            };
            const ptAfterStart = sampleBezierPt(1 / roadSteps);
            const ptBeforeEnd = sampleBezierPt((roadSteps - 1) / roadSteps);

            const rawTRight = { x: P_FR.x - ptAfterStart.x, y: P_FR.y - ptAfterStart.y };
            const lenTRight = Math.hypot(rawTRight.x, rawTRight.y) || 1;
            const T_right = { x: rawTRight.x / lenTRight, y: rawTRight.y / lenTRight };

            const rawTLeft = { x: P_FL.x - ptBeforeEnd.x, y: P_FL.y - ptBeforeEnd.y };
            const lenTLeft = Math.hypot(rawTLeft.x, rawTLeft.y) || 1;
            const T_left = { x: rawTLeft.x / lenTLeft, y: rawTLeft.y / lenTLeft };

            const targetEdgeIdx = snapDir === 'left' ? idxFL : (snapDir === 'right' ? idxBR : idxBL);
            const edgeP1 = refLocalPts[targetEdgeIdx];
            const edgeP2 = refLocalPts[(targetEdgeIdx + 1) % N];
            const edgeInN = getSegmentNormal(edgeP1, edgeP2, refCentroid);
            const outN = { x: -edgeInN.x, y: -edgeInN.y };

            // 檢查該目標邊上是否有次要/背面道路；若有則自動跨越該道路寬度
            const ownRefRoads = refSite.inputs?.roads || [];
            const roadOnTargetEdge = ownRefRoads.find(r => r.edgeIndex == targetEdgeIdx || (r.edgeIndices || []).includes(targetEdgeIdx));
            const roadOffsetOnEdge = roadOnTargetEdge ? (parseFloat(roadOnTargetEdge.width) || 0) : 0;

            let newPos = { x: apRef.x, y: apRef.y, rotation: radRef };
            let adaptedNormPts = null;
            let adaptedNormCurves = null;
            let worldPtsNew = [];
            let isColliding = false;
            const roadPolysA = buildSiteRoadWorldPolygons(siteA, true);

            for (let attempt = 1; attempt <= sites.length + 3; attempt++) {
                let rawPts = [];
                const rawCurves = {};

                if (snapDir === 'left') {
                    // 緊貼左側：右邊界 (Edge 1: V1->V2) 貼合上一基地左邊界 (P_BL->P_FL)，前邊界 (Edge 2: V2->V3) 對齊延伸道路
                    const projDot = Math.max(0.5, T_left.x * outN.x + T_left.y * outN.y);
                    const startDist = (roadOffsetOnEdge / projDot) + (attempt - 1) * initW;
                    const endDist = startDist + initW;

                    const v1_BR = { x: P_BL.x + T_left.x * startDist, y: P_BL.y + T_left.y * startDist };
                    const v2_FR = { x: P_FL.x + T_left.x * startDist, y: P_FL.y + T_left.y * startDist };
                    const v3_FL = { x: P_FL.x + T_left.x * endDist, y: P_FL.y + T_left.y * endDist };
                    const v0_BL = { x: P_BL.x + T_left.x * endDist, y: P_BL.y + T_left.y * endDist };

                    rawPts = [v0_BL, v1_BR, v2_FR, v3_FL];
                    if (C_left && attempt === 1) {
                        rawCurves[1] = { x: C_left.x + T_left.x * startDist, y: C_left.y + T_left.y * startDist };
                    }
                } else if (snapDir === 'right') {
                    // 緊貼右側：左邊界 (Edge 3: V3->V0) 貼合上一基地右邊界 (P_FR->P_BR)，前邊界 (Edge 2: V2->V3) 對齊延伸道路
                    const projDot = Math.max(0.5, T_right.x * outN.x + T_right.y * outN.y);
                    const startDist = (roadOffsetOnEdge / projDot) + (attempt - 1) * initW;
                    const endDist = startDist + initW;

                    const v0_BL = { x: P_BR.x + T_right.x * startDist, y: P_BR.y + T_right.y * startDist };
                    const v3_FL = { x: P_FR.x + T_right.x * startDist, y: P_FR.y + T_right.y * startDist };
                    const v2_FR = { x: P_FR.x + T_right.x * endDist, y: P_FR.y + T_right.y * endDist };
                    const v1_BR = { x: P_BR.x + T_right.x * endDist, y: P_BR.y + T_right.y * endDist };

                    rawPts = [v0_BL, v1_BR, v2_FR, v3_FL];
                    if (C_right && attempt === 1) {
                        rawCurves[3] = { x: C_right.x + T_right.x * startDist, y: C_right.y + T_right.y * startDist };
                    }
                } else {
                    // 緊貼後方：前邊界 (Edge 2: V2->V3) 貼合上一基地後邊界 (P_BR->P_BL)，其餘三邊維持初始直線矩形比例
                    let bowOut = 0;
                    if (C_back) {
                        const midX = (P_BL.x + P_BR.x) / 2;
                        const midY = (P_BL.y + P_BR.y) / 2;
                        bowOut = Math.max(0, (C_back.x - midX) * outN.x + (C_back.y - midY) * outN.y);
                    }
                    const stepD = Math.max(initD, bowOut + 10);
                    const startDist = roadOffsetOnEdge + (attempt - 1) * stepD;
                    const endDist = startDist + stepD;

                    const v3_FL = { x: P_BL.x + outN.x * startDist, y: P_BL.y + outN.y * startDist };
                    const v2_FR = { x: P_BR.x + outN.x * startDist, y: P_BR.y + outN.y * startDist };
                    const v1_BR = { x: P_BR.x + outN.x * endDist, y: P_BR.y + outN.y * endDist };
                    const v0_BL = { x: P_BL.x + outN.x * endDist, y: P_BL.y + outN.y * endDist };

                    rawPts = [v0_BL, v1_BR, v2_FR, v3_FL];
                    if (C_back && attempt === 1) {
                        rawCurves[2] = { x: C_back.x + outN.x * startDist, y: C_back.y + outN.y * startDist };
                    }
                }

                const norm = normalizeWithCurves(rawPts, Object.keys(rawCurves).length > 0 ? rawCurves : null);
                adaptedNormPts = norm.points;
                adaptedNormCurves = norm.curves;
                const cLocal = norm.centroid || { x: 0, y: 0 };

                newPos = {
                    x: apRef.x + (cLocal.x * cosR - cLocal.y * sinR),
                    y: apRef.y + (cLocal.x * sinR + cLocal.y * cosR),
                    rotation: radRef
                };

                const discNew = discretizePolygon(adaptedNormPts, adaptedNormCurves, 16);
                const sampleNew = discNew?.points?.length > 2 ? discNew.points : adaptedNormPts;
                worldPtsNew = sampleNew.map(p => ({
                    x: newPos.x + (p.x * cosR - p.y * sinR),
                    y: newPos.y + (p.x * sinR + p.y * cosR)
                }));

                isColliding = false;
                for (const s of sites) {
                    const sPos = s.position || { x: 0, y: 0, rotation: 0 };
                    const { discretizedPts: sSamplePts } = getSiteDimensionsAndLocalPts(s);
                    const cosS = Math.cos(sPos.rotation || 0);
                    const sinS = Math.sin(sPos.rotation || 0);
                    const worldPtsS = sSamplePts.map(p => ({
                        x: sPos.x + (p.x * cosS - p.y * sinS),
                        y: sPos.y + (p.x * sinS + p.y * cosS)
                    }));
                    if (checkPolygonOverlap(worldPtsNew, worldPtsS)) {
                        isColliding = true;
                        break;
                    }
                }
                if (!isColliding) {
                    for (const rp of roadPolysA) {
                        if (checkPolygonOverlap(worldPtsNew, rp.worldPoly)) {
                            isColliding = true;
                            break;
                        }
                    }
                }
                if (!isColliding) break;
            }

            if (isColliding) {
                alert('新基地與既有基地或道路發生重疊，請重新選擇貼齊方向或使用獨立放置。');
                return;
            }

            const newArea = adaptedNormPts ? calculatePolygonArea(adaptedNormPts, adaptedNormCurves) : initialLotArea;
            const boundsXs = (adaptedNormPts || []).map(p => p.x);
            const boundsYs = (adaptedNormPts || []).map(p => p.y);
            const newW = boundsXs.length > 0 ? (Math.max(...boundsXs) - Math.min(...boundsXs)) : initW;
            const newD = boundsYs.length > 0 ? (Math.max(...boundsYs) - Math.min(...boundsYs)) : initD;

            // 3. 道路設定：左右相鄰基地共用延伸道路於 Edge 2，後方基地僅在後方有道路時配置道路，絕不另外新增垂直道路
            let assignedRoads = [];
            if ((snapDir === 'left' || snapDir === 'right') && primaryRoad) {
                assignedRoads = [{ ...primaryRoad, edgeIndex: 2, edgeIndices: [2] }];
            } else if (snapDir === 'back' && roadOnTargetEdge) {
                assignedRoads = [{ ...roadOnTargetEdge, edgeIndex: 2, edgeIndices: [2] }];
            }

            // 4. 臨地 (adjacentLandGroups) 偵測與移轉對齊：移除共用邊上的臨地，並將外推邊的臨地同步至新基地
            const refAdjGroups = Array.isArray(refSite.adjacentLandGroups) ? refSite.adjacentLandGroups : [];
            const hadAdjOnRef = refAdjGroups.some(g => {
                const arr = Array.isArray(g?.edges) ? g.edges : Array.from(g?.edges || []);
                return arr.length > 0;
            });
            if (hadAdjOnRef) {
                const sharedEdgeOnNew = snapDir === 'left' ? 1 : (snapDir === 'right' ? 3 : 2);
                const roadEdgeSet = new Set(assignedRoads.map(r => r.edgeIndex));
                const newAdjEdges = [0, 1, 2, 3].filter(e => e !== sharedEdgeOnNew && !roadEdgeSet.has(e));
                newSite.adjacentLandGroups = [{ id: 1, edges: newAdjEdges }];
            }

            newSite.lots = [{ id: 1, lot: '___段___地號', area: parseFloat(newArea.toFixed(2)) }];
            newSite.inputs = {
                ...refSite.inputs,
                projectName: refSite.inputs.projectName || '',
                baseWidth: parseFloat(newW.toFixed(2)),
                baseWidthM: parseFloat(newW.toFixed(2)),
                baseDepthM: parseFloat(newD.toFixed(2)),
                baseArea: parseFloat(newArea.toFixed(2)),
                roads: assignedRoads
            };
            newSite.basePoints = adaptedNormPts;
            newSite.baseCurves = adaptedNormCurves;
            newSite.baseGeometry = { points: adaptedNormPts, curves: adaptedNormCurves };
            newSite.position = newPos;

            setSites(prev => {
                const updatedPrev = prev.map(s => {
                    if (s.id !== refSite.id || !Array.isArray(s.adjacentLandGroups)) return s;
                    return {
                        ...s,
                        adjacentLandGroups: s.adjacentLandGroups.map(g => {
                            const arr = Array.isArray(g?.edges) ? g.edges : Array.from(g?.edges || []);
                            return { ...g, edges: arr.filter(e => e !== targetEdgeIdx) };
                        })
                    };
                });
                return [...updatedPrev, newSite];
            });
            setActiveSiteIndex(newIdx);
            setShowAddSiteDialog(false);
        } catch (err) {
            console.error('Failed to add site:', err);
            alert('新增基地發生錯誤: ' + err.message);
        }
    };
    const handleRemoveSite = (idx) => {
        if (sites.length <= 1) return;
        if (confirm(`確定要刪除 ${sites[idx].name} 嗎？`)) {
            setSites(prev => prev.filter((_, i) => i !== idx));
            setActiveSiteIndex(prev => prev > idx ? prev - 1 : (prev === idx ? Math.max(0, idx - 1) : prev));
        }
    };
    const handleUpdateSiteGeometry = (idx, geometry) => {
        setSites(prev => {
            const next = [...prev];
            const oldGeom = prev[idx].baseGeometry;
            const newGeom = geometry;

            // Sync adjacent sites if points count remained the same (simple dragging)
            if (oldGeom && oldGeom.points && newGeom && newGeom.points && oldGeom.points.length === newGeom.points.length) {
                const tolerance = 0.5; // 0.5m tolerance for "coincident" points
                const deltas = [];
                for (let i = 0; i < oldGeom.points.length; i++) {
                    const op = oldGeom.points[i];
                    const np = newGeom.points[i];
                    const dx = np.x - op.x;
                    const dy = np.y - op.y;
                    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
                        deltas.push({ op, dx, dy });
                    }
                }

                if (deltas.length > 0) {
                    for (let k = 0; k < next.length; k++) {
                        if (k === idx) continue;
                        let modified = false;
                        const otherGeom = next[k].baseGeometry;
                        if (otherGeom && otherGeom.points) {
                            const newOtherPoints = otherGeom.points.map(p => {
                                let newP = { ...p };
                                for (const d of deltas) {
                                    if (Math.abs(p.x - d.op.x) < tolerance && Math.abs(p.y - d.op.y) < tolerance) {
                                        newP.x += d.dx;
                                        newP.y += d.dy;
                                        modified = true;
                                    }
                                }
                                return newP;
                            });
                            if (modified) {
                                next[k] = { ...next[k], baseGeometry: { ...otherGeom, points: newOtherPoints } };
                            }
                        }
                    }
                }
            }
            
            next[idx] = { ...next[idx], baseGeometry: geometry };
            return next;
        });
    };

    useEffect(() => {
        // Clear totalCFA override when base area or ratio changes
        // eslint-disable-next-line
        setOverrides(prev => { 
            if ('totalCFA' in prev) {
                const copy = { ...prev }; 
                delete copy.totalCFA; 
                return copy; 
            }
            return prev;
        });
    }, [inputs.baseArea, inputs.floorRatio, setOverrides, activeSiteIndex]);

    const handleInputChange = (e) => { const { name, value } = e.target; setInputs(prev => ({ ...prev, [name]: value })); };
    const handleOverride = (id, value) => { const val = parseFloat(value); if (!isNaN(val)) setOverrides(prev => ({ ...prev, [id]: val })); };
    const handleParamChange = (key, value) => { setParams(prev => ({ ...prev, [key]: parseFloat(value) || 0 })); };
    const updateBaseDim = (key, val) => { setInputs(prev => ({ ...prev, [key]: val })); };
    const handleUpdateInputs = (key, val) => { setInputs(prev => ({ ...prev, [key]: val })); };
    const handleUpdateSiteSetting = (id, key, val) => {
        setSites(prev => prev.map(site => {
            if (site.id !== id) return site;

            const defaultForKey = key === 'floorSettings'
                ? {}
                : (key === 'adjacentLandGroups' ? [{ id: 1, edges: [] }] : undefined);
            const resolvedVal = typeof val === 'function' ? val(site[key] ?? defaultForKey) : val;
            const nextSite = { ...site, [key]: resolvedVal };

            if (key === 'basePoints' || key === 'baseCurves') {
                const currentGeometry = site.baseGeometry || {};
                nextSite.baseGeometry = {
                    points: key === 'basePoints'
                        ? resolvedVal
                        : (nextSite.basePoints ?? currentGeometry.points ?? null),
                    curves: key === 'baseCurves'
                        ? resolvedVal
                        : (nextSite.baseCurves ?? currentGeometry.curves ?? null)
                };
            }

            return nextSite;
        }));
    };

    const inputClass = "w-full p-2 @[480px]:p-2.5 border-2 border-[var(--border-strong)] rounded-none outline-none theme-input text-xs @[480px]:text-sm font-bold num-font transition-all duration-200 min-w-0";
    const labelClass = "block text-[11px] @[480px]:text-xs font-black theme-text-muted uppercase mb-1 tracking-wider truncate";

    const touchTimer = React.useRef(null);
    const [contextMenuState, setContextMenuState] = useState(null);
    const [isLandscapeMode, setIsLandscapeMode] = useState(false);
    const [activePanels, setActivePanels] = useState([]);
    const [showSummaryPanel, setShowSummaryPanel] = useState(false);
    const [showEnvPanel, setShowEnvPanel] = useState(false);

    const togglePanel = useCallback((panelId) => {
        setActivePanels(prev => prev.includes(panelId) ? prev.filter(p => p !== panelId) : [...prev, panelId]);
    }, []);
    const closePanel = useCallback((panelId) => {
        setActivePanels(prev => prev.filter(p => p !== panelId));
    }, []);

    const handleContextMenu = useCallback((e) => {
        if(e.target.closest('input') || e.target.closest('button')) return;
        e.preventDefault();
        setContextMenuState({ x: e.clientX, y: e.clientY });
    }, []);

    const handleTouchStart = useCallback((e) => {
        if (e.touches.length === 1 && !e.target.closest('input') && !e.target.closest('button')) {
            touchTimer.current = setTimeout(() => {
                setContextMenuState({ x: e.touches[0].clientX, y: e.touches[0].clientY });
            }, 700);
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (touchTimer.current) clearTimeout(touchTimer.current);
    }, []);

    const handleContextMenuAction = useCallback((action) => {
        if (action === 'toggle_project_panel') togglePanel('project');
        if (action === 'toggle_sites_panel') togglePanel('sites');
        if (action === 'toggle_info_panel') togglePanel('info');
        if (action === 'toggle_results_panel') togglePanel('results');
        if (action === 'toggle_combined_table') togglePanel('combined');
        if (action === 'toggle_summary_panel') setShowSummaryPanel(prev => !prev);
        if (action === 'toggle_env_panel') setShowEnvPanel(prev => !prev);
        if (action === 'toggle_landscape') setIsLandscapeMode(prev => !prev);
        if (action === 'toggle_dark_mode') setIsDarkMode(prev => !prev);
        if (action === 'open_add_site') setShowAddSiteDialog(true);
        if (action === 'toggle_check_lines') setShowCheckLines(prev => !prev);
        if (action === 'toggle_height_ratio') setShowHeightRatio(prev => !prev);
        if (action === 'toggle_wei_lao') setShowWeiLao(prev => !prev);
        if (action === 'toggle_backyard') setShowBackyard(prev => !prev);
    }, [togglePanel]);

    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (e.key === 'Escape') {
                setContextMenuState(null);
                setPlacementMode(false);
                setReferenceEdge(null);
                setShowAddSiteDialog(false);
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    // 浮動面板元件 - 用 fixed + 居中形式顯示
    
    return (
        <div 
            className={`fixed inset-0 w-screen h-screen overflow-hidden theme-bg theme-text selection:bg-[var(--text-accent)] selection:text-white ${isLandscapeMode ? "landscape-mode" : ""}`}
            onContextMenu={handleContextMenu}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd}
        >
            {contextMenuState && (
                <ContextMenu
                    x={contextMenuState.x}
                    y={contextMenuState.y}
                    onClose={() => setContextMenuState(null)}
                    onAction={handleContextMenuAction}
                    sitesCount={sites.length}
                    isDarkMode={isDarkMode}
                    isMobile={window.innerWidth < 768}
                    sites={sites}
                    activeSiteIndex={activeSiteIndex}
                    onSwitchSite={(idx) => setActiveSiteIndex(idx)}
                    onAddSite={() => setShowAddSiteDialog(true)}
                    onRemoveSite={(idx) => handleRemoveSite(idx)}
                    inputs={inputs}
                    onInputChange={handleInputChange}
                    showCheckLines={showCheckLines}
                    showHeightRatio={showHeightRatio}
                    showWeiLao={showWeiLao}
                    showBackyard={showBackyard}
                    showSummaryPanel={showSummaryPanel}
                />
            )}
            {/* 3D VISUALIZER FULLSCREEN */}
            <div className="absolute inset-0 z-0 pointer-events-auto">
                <Visualizer3D
                                    isDarkMode={isDarkMode}
                                    setIsDarkMode={setIsDarkMode}
                                    sites={sites}
                                    activeSiteId={activeSite.id}
                                    inputs={{ ...inputs, baseArea: finalRes.base, floorsAbove: finalRes.floorsAbove }}
                                    res={finalRes}
                                    siteResults={siteResults}
                                    onUpdateBaseDim={updateBaseDim}
                                    onUpdateRoads={handleUpdateRoads}
                                    onUpdateInputs={handleUpdateInputs}
                                    onUpdateSiteSetting={handleUpdateSiteSetting}
                                    showCheckLines={showCheckLines}
                                    setShowCheckLines={setShowCheckLines}
                                    showHeightRatio={showHeightRatio}
                                    setShowHeightRatio={setShowHeightRatio}
                                    showWeiLao={showWeiLao}
                                    setShowWeiLao={setShowWeiLao}
                                    showBackyard={showBackyard}
                                    setShowBackyard={setShowBackyard}
                                    isConstraintMode={isConstraintMode}
                                    setIsConstraintMode={setIsConstraintMode}
                                    isLandscapeMode={isLandscapeMode}
                                    onUnusedAreaChange={setUnusedArea}
                                    placementMode={placementMode}
                                    referenceEdge={referenceEdge}
                                    setReferenceEdge={setReferenceEdge}
                                    placementOffset={placementOffset}
                                    setPlacementOffset={setPlacementOffset}
                                    onConfirmPlacement={handleConfirmPlacement}
                                    onUpdateSiteGeometry={(geom) => handleUpdateSiteGeometry(activeSiteIndex, geom)}
                                    setActiveSiteIndex={setActiveSiteIndex}
                                    showSummaryPanel={showSummaryPanel}
                                    setShowSummaryPanel={setShowSummaryPanel}
                                    showEnvPanel={showEnvPanel}
                                    setShowEnvPanel={setShowEnvPanel}
                                />
            </div>
            
                {activePanels.includes('project') && (
                    <DraggablePanel title="專案設定" onClose={() => closePanel('project')} defaultSize={{ w: 520, h: 420 }}>
                        {/* HEADER */}
                <header className="flex flex-col @[520px]:flex-row justify-between items-start @[520px]:items-center theme-panel p-4 @[480px]:p-6 gap-4">
                    <div className="space-y-2 min-w-0">
                        <h1 className="text-xl @[480px]:text-3xl font-black flex items-center gap-3 theme-text-title leading-tight">
                            <Building2 className="text-[var(--text-accent)] shrink-0" size={32} strokeWidth={3} />
                            <span className="truncate">自地自建評估計算書</span>
                        </h1>
                        <p className="theme-text font-bold text-xs @[480px]:text-sm opacity-80 border-l-4 border-[var(--text-accent)] pl-3">
                            基地開發效益評估 / 容積獎勵檢討 / 停車空間規劃
                        </p>
                    </div>
                    <div className="flex items-center gap-3 w-full @[520px]:w-auto">
                        <div className="flex flex-col flex-1 min-w-0">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">專案名稱</label>
                            <input 
                                type="text" 
                                name="projectName" 
                                value={inputs.projectName} 
                                onChange={handleInputChange} 
                                placeholder="輸入專案名稱" 
                                className="border-b-4 border-[var(--border-strong)] focus:border-[var(--text-accent)] outline-none bg-transparent py-1 text-base @[480px]:text-xl font-black theme-text placeholder:text-stone-400 w-full min-w-0" 
                            />
                        </div>
                        <button 
                            onClick={() => setIsEditMode(!isEditMode)} 
                            className={`w-11 h-11 shrink-0 flex items-center justify-center transition-all duration-200 border-2 border-[var(--border-strong)] ${isEditMode ? 'theme-btn-active' : 'theme-btn'}`}
                        >
                            {isEditMode ? <Settings2 size={20} strokeWidth={3} /> : <Pencil size={20} strokeWidth={3} />}
                        </button>
                    </div>
                </header>
                    </DraggablePanel>
                )}

                {/* ADD SITE DIALOG */}
                {showAddSiteDialog && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddSiteDialog(false)} />
                        <div className="relative bg-white shadow-2xl border-4 border-black p-8 max-w-md w-full mx-4">
                            <button onClick={() => setShowAddSiteDialog(false)} className="absolute top-4 right-4 text-stone-400 hover:text-black"><X size={20} /></button>
                            <h3 className="text-2xl font-black mb-2 flex items-center gap-3"><MapPinned size={24} className="text-[var(--text-accent)]" /> 新增基地</h3>
                            <p className="text-sm text-stone-500 mb-6">是否緊貼 <span className="font-black text-black">{activeSite.name}</span>？</p>
                            <div className="space-y-3">
                                <button onClick={() => handleAddSite('back')} className="w-full p-4 border-4 border-black font-bold hover:bg-stone-100 text-left flex items-center gap-3 transition-colors">🔗 緊貼後方（背面）</button>
                                <button onClick={() => handleAddSite('left')} className="w-full p-4 border-4 border-black font-bold hover:bg-stone-100 text-left flex items-center gap-3 transition-colors">🔗 緊貼左側</button>
                                <button onClick={() => handleAddSite('right')} className="w-full p-4 border-4 border-black font-bold hover:bg-stone-100 text-left flex items-center gap-3 transition-colors">🔗 緊貼右側</button>
                                <div className="border-t-4 border-stone-200 my-2" />
                                <button onClick={() => handleAddSite('free')} className="w-full p-4 border-4 border-dashed border-stone-400 font-bold hover:bg-stone-50 text-left flex items-center gap-3 text-stone-600 transition-colors">📍 獨立放置（不緊貼）</button>
                            </div>
                        </div>
                    </div>
                )}

                {activePanels.includes('sites') && (
                    <DraggablePanel title="基地切換與管理" onClose={() => closePanel('sites')} defaultSize={{ w: 460, h: 320 }}>
                        {/* SITE TABS */}
                {sites.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {sites.map((site, idx) => (
                            <div key={site.id} className="relative group">
                                <button
                                    onClick={() => setActiveSiteIndex(idx)}
                                    className={`px-4 py-2 font-black text-sm @[480px]:text-base border-2 border-black transition-all duration-200 flex items-center gap-2 ${
                                        idx === activeSiteIndex
                                            ? 'bg-[var(--text-accent)] text-white shadow-[3px_3px_0_#000] -translate-y-0.5'
                                            : 'bg-white text-black hover:bg-stone-100'
                                    }`}
                                >
                                    <MapPinned size={16} strokeWidth={3} />
                                    {site.name}
                                </button>
                                {sites.length > 1 && idx === activeSiteIndex && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRemoveSite(idx); }}
                                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-black shadow-md hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={10} />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            onClick={() => setShowAddSiteDialog(true)}
                            className="px-4 py-2 font-black text-sm @[480px]:text-base border-2 border-dashed border-black text-black hover:bg-stone-100 transition-all duration-200 flex items-center gap-2"
                        >
                            <Plus size={16} strokeWidth={3} /> 新增基地
                        </button>
                    </div>
                )}

                
                    </DraggablePanel>
                )}
                {/* PLACEMENT MODE UI */}
                {placementMode === 'independent' && (
                    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-white border-4 border-black p-6 shadow-[8px_8px_0_var(--text-accent)] flex flex-col gap-4 animate-in fade-in slide-in-from-top-4" style={{ pointerEvents: 'auto' }}>
                        <div className="flex items-center justify-between gap-8">
                            <h3 className="text-xl font-black flex items-center gap-2">
                                <MapPinned size={20} className="text-[var(--text-accent)]" /> 精準放置模式
                            </h3>
                            <button onClick={() => { setPlacementMode(false); setReferenceEdge(null); }} className="text-stone-400 hover:text-black transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-1">參考線 (基準)</span>
                                <span className={`text-sm font-black p-2 border-2 text-center ${referenceEdge ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 'border-dashed border-stone-300 text-stone-400'}`}>
                                    {referenceEdge ? '已選擇' : '請在 3D 區點擊線段'}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-1">X 距離</span>
                                <div className="flex items-center gap-2 border-b-4 border-black pb-1">
                                    <input type="number" 
                                        value={placementOffset.x} onChange={e => setPlacementOffset(p => ({...p, x: e.target.value}))}
                                        className="w-16 text-xl font-black text-center outline-none bg-transparent" placeholder="0" />
                                    <span className="font-bold">m</span>
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-1">Y 距離</span>
                                <div className="flex items-center gap-2 border-b-4 border-black pb-1">
                                    <input type="number" 
                                        value={placementOffset.y} onChange={e => setPlacementOffset(p => ({...p, y: e.target.value}))}
                                        className="w-16 text-xl font-black text-center outline-none bg-transparent" placeholder="0" />
                                    <span className="font-bold">m</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={handleConfirmPlacement} className="w-full bg-[var(--text-accent)] text-white font-black py-3 hover:bg-opacity-90 active:translate-y-1 transition-all mt-2">
                            確認放置
                        </button>
                    </div>
                )}

                {activePanels.includes('info') && (
                    <DraggablePanel
                        title="基地與法規設定"
                        onClose={() => closePanel('info')}
                        defaultPos={{ x: 24, y: 24 }}
                        defaultSize={{ w: 560, h: 640 }}
                    >
                        {/* INFO & PLANNING SECTION */}
                        <section className="space-y-3 @[480px]:space-y-4 w-full min-w-0">
                            <div className="theme-panel bg-[var(--text-primary)] p-0">
                                <div 
                                    className="px-3 py-2.5 @[480px]:px-4 @[480px]:py-3 flex justify-between items-center cursor-pointer hover:bg-[var(--text-accent)] transition-colors group" 
                                    onClick={() => setShowBasePanels(!showBasePanels)}
                                >
                                    <h3 className="text-sm @[480px]:text-base @[680px]:text-lg font-black text-white flex items-center gap-2 min-w-0">
                                        <Layers size={18} strokeWidth={3} className="shrink-0" />
                                        <span className="truncate">基本資訊與規劃 ({activeSite.name})</span>
                                    </h3>
                                    <div className="text-white group-hover:scale-110 transition-transform shrink-0">
                                        {showBasePanels ? <ChevronUp size={20} strokeWidth={3} /> : <ChevronDown size={20} strokeWidth={3} />}
                                    </div>
                                </div>
                            </div>

                            <div className={`transition-all duration-300 ease-in-out ${showBasePanels ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                                <div className="grid grid-cols-1 @[560px]:grid-cols-2 @[860px]:grid-cols-3 gap-3 @[480px]:gap-4 items-start">
                                    <CollapsibleSection title="基本資料" icon={<MapPin size={18} className="text-[var(--text-accent)] shrink-0" />} className="col-span-1 theme-panel p-3 @[480px]:p-4 bg-white min-w-0">
                                        <div className="space-y-3 @[480px]:space-y-4">
                                            <div>
                                                <label className={labelClass}>行政區</label>
                                                <input type="text" name="district" value={inputs.district} onChange={handleInputChange} className={inputClass} />
                                            </div>
                                            <div className="space-y-2.5">
                                                <div className="flex justify-between items-center border-b-2 border-[var(--border-strong)] pb-1.5 gap-2">
                                                    <label className={`${labelClass} mb-0`}>地號與面積 (㎡)</label>
                                                    <button onClick={addLot} className="text-xs font-black text-[var(--text-accent)] hover:scale-105 transition-transform flex items-center gap-1 shrink-0">
                                                        <Plus size={14} strokeWidth={3} /> 新增
                                                    </button>
                                                </div>
                                                <div className="max-h-48 overflow-y-auto pr-1 space-y-2 thin-scrollbar">
                                                    {lots.map(l => (
                                                        <div key={l.id} className="grid grid-cols-[1fr_minmax(72px,96px)_auto] gap-1.5 items-center">
                                                            <input type="text" placeholder="地號" value={l.lot} onChange={(e) => updateLot(l.id, 'lot', e.target.value)} className={`${inputClass} py-1.5 text-xs`} />
                                                            <input type="number" placeholder="面積" value={l.area} onChange={(e) => updateLot(l.id, 'area', e.target.value)} className={`${inputClass} py-1.5 text-xs text-right`} />
                                                            {lots.length > 1 && (
                                                                <button onClick={() => removeLot(l.id)} className="p-1.5 border-2 border-[var(--border-strong)] hover:bg-red-500 hover:text-white transition-colors shrink-0">
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="text-right text-xs @[480px]:text-sm font-black bg-[var(--text-primary)] text-white p-2 break-words">
                                                    合計: {formatNum(totalBaseArea)} ㎡ ({formatNum(toPing(totalBaseArea))} 坪)
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-3 pt-3 mt-3 border-t-4 border-[var(--border-strong)]">
                                                <div className="flex justify-between items-center gap-2">
                                                    <label className={`${labelClass} mb-0`}>臨路狀況</label>
                                                    <button onClick={addRoad} className="text-xs font-black text-[var(--text-accent)] hover:scale-105 transition-transform flex items-center gap-1 shrink-0">
                                                        <Plus size={14} strokeWidth={3} /> 新增道路
                                                    </button>
                                                </div>
                                                <div className="space-y-2.5">
                                                    {inputs.roads.map(r => (
                                                        <div key={r.id} className="theme-panel p-2.5 @[480px]:p-3 bg-stone-100 border-2 space-y-2">
                                                            <div className="grid grid-cols-[1fr_72px] gap-2">
                                                                <div className="min-w-0">
                                                                    <label className="text-[10px] font-black uppercase block mb-0.5">路名</label>
                                                                    <input type="text" value={r.name} onChange={(e) => updateRoad(r.id, 'name', e.target.value)} className={`${inputClass} py-1 text-xs`} />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <label className="text-[10px] font-black uppercase text-center block mb-0.5">寬(M)</label>
                                                                    <input type="number" value={r.width} onChange={(e) => updateRoad(r.id, 'width', e.target.value)} className={`${inputClass} py-1 text-xs text-center`} />
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap justify-between items-center gap-2">
                                                                <div className="text-[10px] font-black uppercase px-1.5 py-0.5 bg-white border border-black">
                                                                    方位: {r.edgeIndex !== undefined ? `邊線 ${r.edgeIndex}` : r.orientation}
                                                                </div>
                                                                <div className="flex items-center gap-2.5">
                                                                    <label className="flex items-center gap-1.5 text-xs font-black cursor-pointer">
                                                                        <input type="checkbox" checked={r.type === 'primary'} onChange={(e) => updateRoad(r.id, 'type', e.target.checked ? 'primary' : 'secondary')} className="w-4 h-4 border-2 border-black checked:bg-black rounded-none appearance-none checked:after:content-['✓'] after:text-white after:text-[10px] after:flex after:justify-center after:items-center" />
                                                                        主要道路
                                                                    </label>
                                                                    {inputs.roads.length > 1 && (
                                                                        <button onClick={() => removeRoad(r.id)} className="text-red-500 hover:scale-110 transition-transform"><Trash2 size={15} /></button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </CollapsibleSection>

                                    <CollapsibleSection title="法規參數" icon={<FileText size={18} className="text-sky-500 shrink-0" />} className="col-span-1 theme-panel p-3 @[480px]:p-4 bg-white min-w-0">
                                        <div className="space-y-3 @[480px]:space-y-4">
                                            <div><label className={labelClass}>使用分區</label><input type="text" name="zoneType" value={inputs.zoneType} onChange={handleInputChange} className={inputClass} /></div>
                                            <div><label className={labelClass}>都市計畫名稱</label><input type="text" name="urbanPlanName" value={inputs.urbanPlanName} onChange={handleInputChange} className={inputClass} /></div>
                                            <div className="grid grid-cols-2 gap-2.5">
                                                <div className="bg-sky-50 p-2.5 border-2 border-sky-500 min-w-0">
                                                    <label className={`${labelClass} text-sky-700`}>建蔽率 (%)</label>
                                                    <input type="number" name="coverageRatio" value={inputs.coverageRatio} onChange={handleInputChange} className={`${inputClass} font-black text-sky-800 border-sky-400 bg-sky-50`} />
                                                </div>
                                                <div className="bg-sky-50 p-2.5 border-2 border-sky-500 min-w-0">
                                                    <label className={`${labelClass} text-sky-700`}>容積率 (%)</label>
                                                    <input type="number" name="floorRatio" value={inputs.floorRatio} onChange={handleInputChange} className={`${inputClass} font-black text-sky-800 border-sky-400 bg-sky-50`} />
                                                </div>
                                            </div>
                                            <div className="bg-amber-50 p-2.5 @[480px]:p-3 border-2 border-amber-500">
                                                <label className={`${labelClass} text-amber-700`}>地下室開挖率 (%)</label>
                                                <input type="number" name="excavationRatio" value={inputs.excavationRatio} onChange={handleInputChange} className={`${inputClass} font-black text-amber-800 border-amber-400 bg-amber-50`} />
                                            </div>
                                        </div>
                                    </CollapsibleSection>

                                    <CollapsibleSection title="樓層規劃" icon={<Layers size={18} className="text-indigo-500 shrink-0" />} className="col-span-1 @[560px]:col-span-2 @[860px]:col-span-1 theme-panel p-3 @[480px]:p-4 bg-white min-w-0">
                                        <div className="space-y-3 @[480px]:space-y-4">
                                            <div className="grid grid-cols-2 gap-2.5">
                                                <div className="theme-panel p-2.5 @[480px]:p-3 bg-indigo-50 border-indigo-200 min-w-0">
                                                    <label className={`${labelClass} text-indigo-700`}>地上樓層數</label>
                                                    <div className="text-2xl @[480px]:text-3xl font-black text-indigo-900 flex flex-col leading-tight">
                                                        <span>{finalRes.floorsAbove}F</span>
                                                        <span className="text-[10px] font-bold text-indigo-400 mt-1 uppercase">自動估算結果</span>
                                                    </div>
                                                </div>
                                                <div className="theme-panel p-2.5 @[480px]:p-3 min-w-0">
                                                    <label className={labelClass}>地下樓層數</label>
                                                    <input type="number" name="floorsBelow" value={inputs.floorsBelow} onChange={handleInputChange} className={inputClass} />
                                                </div>
                                            </div>
                                            <div className="theme-panel p-3.5 @[480px]:p-4 bg-[var(--text-primary)] text-white shadow-[4px_4px_0_var(--text-accent)]">
                                                <label className="text-[10px] @[480px]:text-xs font-black uppercase text-[var(--text-accent)] mb-1.5 block">允建總樓地板面積 (Total CFA)</label>
                                                <div className="text-xl @[480px]:text-2xl @[680px]:text-3xl font-black text-right border-b-2 border-[var(--text-accent)] pb-1.5 flex justify-between items-baseline gap-2">
                                                    <span className="text-[10px] font-bold text-white/50">SQM</span>
                                                    <span className="truncate">{formatNum(finalRes.totalCFA)}</span>
                                                </div>
                                                <div className="text-sm @[480px]:text-base @[680px]:text-lg font-black text-right mt-1.5 text-[var(--text-accent)] flex justify-between items-baseline gap-2">
                                                    <span className="text-[10px] font-bold text-white/50 uppercase">Pings</span>
                                                    <span className="truncate">{formatNum(toPing(finalRes.totalCFA))} 坪</span>
                                                </div>
                                            </div>
                                        </div>
                                    </CollapsibleSection>
                                </div>
                            </div>
                        </section>
                    </DraggablePanel>
                )}

                {activePanels.includes('results') && (
                    <DraggablePanel
                        title="詳細計算表"
                        onClose={() => closePanel('results')}
                        defaultPos={{ x: 60, y: 40 }}
                        defaultSize={{ w: 640, h: 680 }}
                    >
                        {/* DATA TABLE SECTION */}
                        <section className="space-y-3 w-full min-w-0">
                            <div className="theme-panel bg-[var(--text-primary)] p-0">
                                <div className="px-3 py-2.5 @[480px]:px-4 @[480px]:py-3 flex justify-between items-center gap-2">
                                    <div
                                        className="flex items-center gap-2 cursor-pointer hover:text-[var(--text-accent)] transition-colors min-w-0 flex-1"
                                        onClick={() => setShowDetail(!showDetail)}
                                    >
                                        <FileText size={18} strokeWidth={3} className="text-white shrink-0" />
                                        <h3 className="text-sm @[480px]:text-base @[680px]:text-lg font-black text-white truncate">
                                            詳細計算表 ({activeSite.name})
                                        </h3>
                                        <div className="text-white shrink-0">
                                            {showDetail ? <ChevronUp size={18} strokeWidth={3} /> : <ChevronDown size={18} strokeWidth={3} />}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsEditMode(!isEditMode)}
                                        className={`px-2.5 py-1 text-[11px] font-black border-2 border-white flex items-center gap-1.5 shrink-0 transition-colors ${
                                            isEditMode ? 'bg-[var(--text-accent)] text-white' : 'bg-white/10 text-white hover:bg-white/20'
                                        }`}
                                        title="切換參數微調模式"
                                    >
                                        {isEditMode ? <Settings2 size={13} strokeWidth={3} /> : <Pencil size={13} strokeWidth={3} />}
                                        <span>{isEditMode ? '完成微調' : '微調參數'}</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div className={`transition-all duration-300 ease-in-out ${showDetail ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                                <div className="theme-panel overflow-hidden border-2 @[480px]:border-4">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse num-font bg-white table-auto">
                                            <thead>
                                                <tr className="bg-[var(--text-primary)] text-white border-b-4 border-black">
                                                    <th className="p-2 @[480px]:p-3 @[680px]:p-3.5 text-[11px] @[480px]:text-xs @[680px]:text-sm font-black uppercase">評估項目</th>
                                                    <th className="p-2 @[480px]:p-3 @[680px]:p-3.5 text-[11px] @[480px]:text-xs @[680px]:text-sm font-black uppercase text-right whitespace-nowrap">數值/面積 (㎡)</th>
                                                    <th className="p-2 @[480px]:p-3 @[680px]:p-3.5 text-[11px] @[480px]:text-xs @[680px]:text-sm font-black uppercase text-right whitespace-nowrap">坪數 (坪)</th>
                                                    {isEditMode && (
                                                        <>
                                                            <th className="p-2 @[480px]:p-3 text-[11px] @[480px]:text-xs font-black uppercase text-[var(--text-accent)] bg-stone-900 border-l-2 border-black">參數設定</th>
                                                            <th className="p-2 @[480px]:p-3 text-[11px] @[480px]:text-xs font-black uppercase text-[var(--text-accent)] bg-stone-900 border-l-2 border-black hidden @[640px]:table-cell">註解</th>
                                                        </>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y-2 divide-black">
                                                <SectionHeader title="A. 基地基礎法規檢討" />
                                                <InputRow id="base" label="1. 基地面積" value={finalRes.base} calculatedValue={results.base} formula="SUM(地號面積)" note="多筆地號加總" isEditMode={isEditMode} onOverride={handleOverride} />
                                                <InputRow id="maxBuildingArea" label="2. 允建建築面積" value={finalRes.maxBuildingArea} calculatedValue={results.maxBuildingArea} formula="基地面積 × 法定建蔽率" note={`建蔽率 ${inputs.coverageRatio}%`} isEditMode={isEditMode} onOverride={handleOverride} highlight />
                                                <InputRow id="statutoryFA" label="3. 法定容積 (FA)" value={finalRes.statutoryFA} calculatedValue={results.statutoryFA} formula="基地面積 × 法定容積率" note={`容積率 ${inputs.floorRatio}%`} isEditMode={isEditMode} onOverride={handleOverride} highlight />
                                                
                                                <SectionHeader title="B. 免計容積與獎勵試算" />
                                                <InputRow id="incentiveArea" label="4. 獎勵容積" value={inputs.incentiveArea} calculatedValue={inputs.incentiveArea} formula="自行輸入" note="如都更獎勵" isEditMode={isEditMode} onOverride={handleInputChange} />
                                                <InputRow id="transferArea" label="5. 移轉容積" value={inputs.transferArea} calculatedValue={inputs.transferArea} formula="自行輸入" note="容積移轉" isEditMode={isEditMode} onOverride={handleInputChange} />
                                                <InputRow id="exempt15" label={`6. 免計容積 (${params.exemptRate}%)`} value={finalRes.exempt15} calculatedValue={results.exempt15} formula="FA × 免計率" note="機電設備上限" isEditMode={isEditMode} onOverride={handleOverride} paramKey="exemptRate" paramValue={params.exemptRate} onParamChange={handleParamChange} />
                                                <InputRow id="exemptStair" label="7. 免計梯廳" value={finalRes.exemptStair} calculatedValue={results.exemptStair} formula={`FA × ${params.stairRate}%`} note="梯廳獎勵" isEditMode={isEditMode} onOverride={handleOverride} paramKey="stairRate" paramValue={params.stairRate} onParamChange={handleParamChange} />
                                                <InputRow id="exemptIndoor" label="8. 免計容積室內合計" value={finalRes.exemptIndoor} calculatedValue={results.exemptIndoor} formula="Item 6 + Item 7" note="免計容積總和" isEditMode={isEditMode} onOverride={handleOverride} subTotal />
                                                <InputRow id="balcony" label="9. 免計容積陽台" value={finalRes.balcony} calculatedValue={results.balcony} formula={`FA × ${params.balconyRate}%`} note="陽台獎勵" isEditMode={isEditMode} onOverride={handleOverride} paramKey="balconyRate" paramValue={params.balconyRate} onParamChange={handleParamChange} />
                                                
                                                <SectionHeader title="C. 允建面積總表" />
                                                <InputRow id="permittedIndoor" label="10. 允建室內面積" value={finalRes.permittedIndoor} calculatedValue={results.permittedIndoor} formula="法定+獎勵+移轉+免計" note="不含陽台" isEditMode={isEditMode} onOverride={handleOverride} bold />
                                                <InputRow id="roofProtrusion" label="11. 允建屋突面積" value={finalRes.roofProtrusion} calculatedValue={results.roofProtrusion} formula="(建築面積×1/8)×2" note="屋頂突出物" isEditMode={isEditMode} onOverride={handleOverride} />
                                                <InputRow id="totalBasementArea" label="12. 地下室總面積" value={finalRes.totalBasementArea} calculatedValue={results.totalBasementArea} formula="基地×開挖×層數" note={`開挖率 ${inputs.excavationRatio}%`} isEditMode={isEditMode} onOverride={handleOverride} />

                                                <tr className="bg-[var(--text-accent)] text-white border-y-4 border-black">
                                                    <td className="p-2.5 @[480px]:p-3.5 @[680px]:p-4 font-black text-xs @[480px]:text-sm @[680px]:text-base italic uppercase leading-tight">
                                                        13. 允建總樓地板面積 (CFA)
                                                        {unusedArea > 0.1 && <div className="text-[10px] font-bold text-black bg-white inline-block px-1.5 py-0.5 mt-1 ml-1">餘 {formatNum(toPing(unusedArea))} 坪未用</div>}
                                                    </td>
                                                    <td className="p-2.5 @[480px]:p-3.5 @[680px]:p-4 text-right font-black text-sm @[480px]:text-lg @[680px]:text-xl leading-none whitespace-nowrap">
                                                        {formatNum(finalRes.totalCFA)}
                                                    </td>
                                                    <td className="p-2.5 @[480px]:p-3.5 @[680px]:p-4 text-right font-black text-sm @[480px]:text-lg @[680px]:text-xl leading-none whitespace-nowrap">
                                                        {formatNum(toPing(finalRes.totalCFA))}
                                                    </td>
                                                    {isEditMode && (
                                                        <>
                                                            <td className="p-2.5 @[480px]:p-3 font-black text-[10px] bg-black/20 border-l-2 border-black">TOTAL CFA</td>
                                                            <td className="p-2.5 @[480px]:p-3 font-black text-[10px] bg-black/20 border-l-2 border-black hidden @[640px]:table-cell">鎖定上限值</td>
                                                        </>
                                                    )}
                                                </tr>

                                                <tr className="theme-panel border-y-2 border-black">
                                                    <td className="p-2.5 @[480px]:p-3.5 font-black text-xs @[480px]:text-sm @[680px]:text-base theme-text-title uppercase">工程預算評估</td>
                                                    <td className="p-2.5 @[480px]:p-3.5 text-right font-black text-xs @[480px]:text-sm" colSpan={2}>
                                                        <div className="flex flex-wrap items-center justify-end gap-1.5 @[480px]:gap-2">
                                                            <span className="text-[10px] @[480px]:text-xs font-bold theme-text-muted">單價(萬/坪):</span>
                                                            <input 
                                                                type="number" 
                                                                value={params.pricePerPing} 
                                                                onChange={(e) => handleParamChange('pricePerPing', e.target.value)} 
                                                                className="w-16 @[480px]:w-20 p-1 @[480px]:p-1.5 text-right border-2 border-black rounded-none theme-bg theme-text font-black outline-none focus:border-[var(--text-accent)] text-xs @[480px]:text-sm" 
                                                            />
                                                            <span className="text-xs font-bold theme-text-muted">=</span>
                                                            <span className="theme-text-accent text-sm @[480px]:text-lg @[680px]:text-xl italic whitespace-nowrap">{formatNum(finalRes.estimatedBudget)} 萬</span>
                                                        </div>
                                                    </td>
                                                    {isEditMode && (
                                                        <>
                                                            <td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 border-l-2 border-black">Total CFA × 單價</td>
                                                            <td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 hidden @[640px]:table-cell">概估造價</td>
                                                        </>
                                                    )}
                                                </tr>

                                                <SectionHeader title="D. 空間與停車檢討" />
                                                <tr className="hover:bg-stone-50 transition-colors">
                                                    <td className="p-2.5 @[480px]:p-3 pl-3 @[480px]:pl-5 border-l-4 border-black font-bold text-xs @[480px]:text-sm">12. 地上樓層估算</td>
                                                    <td className="p-2.5 @[480px]:p-3 text-right font-black text-xs @[480px]:text-sm @[680px]:text-base" colSpan={2}>約 <span className="theme-text-accent italic">{formatNum(finalRes.floorsAbove)}</span> 層</td>
                                                    {isEditMode && <><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 border-l-2 border-black">允建室內 / 允建建築面積</td><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 hidden @[640px]:table-cell">自動推算層數</td></>}
                                                </tr>
                                                <tr className="hover:bg-stone-50 transition-colors">
                                                    <td className="p-2.5 @[480px]:p-3 pl-3 @[480px]:pl-5 border-l-4 border-black font-bold text-xs @[480px]:text-sm">13. 地下層開挖檢討</td>
                                                    <td className="p-2.5 @[480px]:p-3 text-right font-black text-xs @[480px]:text-sm @[680px]:text-base" colSpan={2}>B1 ~ B{inputs.floorsBelow} (單層 {formatNum(toPing(finalRes.basementAreaPerFloor))} 坪)</td>
                                                    {isEditMode && <><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 border-l-2 border-black">基地 × {inputs.excavationRatio}%</td><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 hidden @[640px]:table-cell">單層最大開挖面積</td></>}
                                                </tr>
                                                <tr className="hover:bg-stone-50 transition-colors">
                                                    <td className="p-2.5 @[480px]:p-3 pl-3 @[480px]:pl-5 border-l-4 border-black font-bold text-xs @[480px]:text-sm">14. 停車空間檢討</td>
                                                    <td className="p-2.5 @[480px]:p-3 text-right font-black text-xs @[480px]:text-sm @[680px]:text-base" colSpan={2}>法定 {formatNum(finalRes.statutoryParking)} 部 / 估計可停 {formatNum(finalRes.possibleParking)} 部</td>
                                                    {isEditMode && <><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 border-l-2 border-black">CFA / 150 (法定)</td><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 hidden @[640px]:table-cell">每車 {inputs.avgCarArea}m² 預估</td></>}
                                                </tr>
                                                <InputRow id="exemptBasement" label="*. 地下室免計容積" value={finalRes.exemptBasement} calculatedValue={results.exemptBasement} formula="40 × 法定停車" note="地下室停車不計容積上限" isEditMode={isEditMode} onOverride={handleOverride} />
                                                <tr className="hover:bg-stone-100 transition-colors border-t-2 border-black">
                                                    <td className="p-2.5 @[480px]:p-3 font-black uppercase text-xs @[480px]:text-sm border-l-4 border-[var(--text-accent)]">15. 坪效分析 (倍數)</td>
                                                    <td className="p-2.5 @[480px]:p-3 text-right font-black text-sm @[480px]:text-lg @[680px]:text-xl text-[var(--text-accent)] italic" colSpan={2}>{formatNum(finalRes.efficiency)} 倍</td>
                                                    {isEditMode && <><td className="p-2.5 @[480px]:p-3 font-black text-[10px] text-stone-500 bg-stone-50 border-l-2 border-black">總銷坪 / 基地坪</td><td className="p-2.5 @[480px]:p-3 font-black text-[10px] text-stone-500 bg-stone-50 hidden @[640px]:table-cell">土地開發倍數</td></>}
                                                </tr>

                                                <SectionHeader title="E. 高度比與退縮檢討" />
                                                <tr className="hover:bg-stone-50">
                                                    <td className="p-2.5 @[480px]:p-3 pl-3 @[480px]:pl-5 border-l-4 border-black font-bold text-xs @[480px]:text-sm">16. 前院深度</td>
                                                    <td className="p-2.5 @[480px]:p-3 text-right" colSpan={2}>
                                                        <div className="flex items-center justify-end gap-1.5 font-black text-xs @[480px]:text-sm @[680px]:text-base">
                                                            <input type="number" name="frontYardDepth" value={inputs.frontYardDepth} onChange={handleInputChange} className="w-16 @[480px]:w-20 p-1 @[480px]:p-1.5 text-right border-2 border-black rounded-none theme-bg theme-text outline-none focus:border-[var(--text-accent)]" /> 
                                                            <span className="text-xs theme-text-muted">m</span>
                                                        </div>
                                                    </td>
                                                    {isEditMode && <><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 border-l-2 border-black">自行輸入</td><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 hidden @[640px]:table-cell">臨路側退縮</td></>}
                                                </tr>
                                                <tr className="hover:bg-stone-50">
                                                    <td className="p-2.5 @[480px]:p-3 pl-3 @[480px]:pl-5 border-l-4 border-black font-bold text-xs @[480px]:text-sm">17. 側院深度</td>
                                                    <td className="p-2.5 @[480px]:p-3 text-right" colSpan={2}>
                                                        <div className="flex flex-wrap items-center justify-end gap-1.5 font-black text-xs @[480px]:text-sm @[680px]:text-base">
                                                            <select name="sideYardDirection" value={inputs.sideYardDirection || 'right'} onChange={handleInputChange} className="p-1 @[480px]:p-1.5 border-2 border-black rounded-none theme-bg theme-text text-xs outline-none focus:border-[var(--text-accent)]">
                                                                <option value="right">右側</option>
                                                                <option value="left">左側</option>
                                                            </select>
                                                            <input type="number" name="sideYardDepth" value={inputs.sideYardDepth || 0} onChange={handleInputChange} className="w-16 @[480px]:w-20 p-1 @[480px]:p-1.5 text-right border-2 border-black rounded-none theme-bg theme-text outline-none focus:border-[var(--text-accent)]" /> 
                                                            <span className="text-xs theme-text-muted">m</span>
                                                        </div>
                                                    </td>
                                                    {isEditMode && <><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 border-l-2 border-black">自行輸入</td><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 hidden @[640px]:table-cell">側向退縮深度</td></>}
                                                </tr>
                                                <tr className="hover:bg-stone-50">
                                                    <td className="p-2.5 @[480px]:p-3 pl-3 @[480px]:pl-5 border-l-4 border-black font-bold text-xs @[480px]:text-sm">18. 後院深度</td>
                                                    <td className="p-2.5 @[480px]:p-3 text-right" colSpan={2}>
                                                        <div className="flex items-center justify-end gap-1.5 font-black text-xs @[480px]:text-sm @[680px]:text-base">
                                                            <input type="number" name="backYardDepth" value={inputs.backYardDepth} onChange={handleInputChange} className="w-16 @[480px]:w-20 p-1 @[480px]:p-1.5 text-right border-2 border-black rounded-none theme-bg theme-text outline-none focus:border-[var(--text-accent)]" /> 
                                                            <span className="text-xs theme-text-muted">m</span>
                                                        </div>
                                                    </td>
                                                    {isEditMode && <><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 border-l-2 border-black">自行輸入</td><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 hidden @[640px]:table-cell">背側退縮深度</td></>}
                                                </tr>
                                                <tr className="hover:bg-stone-50">
                                                    <td className="p-2.5 @[480px]:p-3 pl-3 @[480px]:pl-5 border-l-4 border-black font-bold text-xs @[480px]:text-sm">19. 樓層高度設定</td>
                                                    <td className="p-2.5 @[480px]:p-3 text-right font-black text-xs" colSpan={2}>
                                                        <div className="flex flex-wrap gap-2 justify-end items-center">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[10px] font-black text-[var(--text-accent)] uppercase">1F:</span>
                                                                <input type="number" name="floorHeight1F" value={inputs.floorHeight1F} onChange={handleInputChange} className="w-14 @[480px]:w-16 p-1 text-right border-2 border-black rounded-none theme-bg theme-text focus:border-[var(--text-accent)] outline-none" />
                                                                <span className="text-[10px] theme-text-muted">m</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[10px] font-black text-[var(--text-accent)] uppercase">Other:</span>
                                                                <input type="number" name="floorHeightOther" value={inputs.floorHeightOther} onChange={handleInputChange} className="w-14 @[480px]:w-16 p-1 text-right border-2 border-black rounded-none theme-bg theme-text focus:border-[var(--text-accent)] outline-none" />
                                                                <span className="text-[10px] theme-text-muted">m</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {isEditMode && <><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 border-l-2 border-black">1F≤4.2, 其他≤3.6</td><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 hidden @[640px]:table-cell">依規範自動校準</td></>}
                                                </tr>
                                                <InputRow id="buildingHeight" label="20. 建築物高度" value={finalRes.buildingHeight} calculatedValue={finalRes.buildingHeight} formula="1F+(其他×(F-1))+9" note={finalRes.isHighRise ? "高層建築" : "一般建築"} isEditMode={isEditMode} onOverride={handleOverride} highlight isArea={false} unit="m" />
                                                <InputRow id="heightRatio" label="21. 高度比" value={finalRes.heightRatio} calculatedValue={finalRes.heightRatio} formula="高度 / (路寬 + 前院)" note="主路寬 + 前院深度" isEditMode={isEditMode} onOverride={handleOverride} highlight isArea={false} />
                                                <tr className="hover:bg-stone-50">
                                                    <td className="p-2.5 @[480px]:p-3 pl-3 @[480px]:pl-5 border-l-4 border-black font-bold text-xs @[480px]:text-sm">22. 最小後院深度比 (檢討)</td>
                                                    <td className="p-2.5 @[480px]:p-3 text-right" colSpan={2}>
                                                        <div className="flex items-center justify-end gap-1.5 font-black text-xs @[480px]:text-sm @[680px]:text-base">
                                                            <input type="number" name="minBackyardDepthRatio" value={inputs.minBackyardDepthRatio || 0} onChange={handleInputChange} className="w-16 @[480px]:w-20 p-1 @[480px]:p-1.5 text-right border-2 border-black rounded-none theme-bg theme-text outline-none focus:border-[var(--text-accent)] text-amber-600" />
                                                        </div>
                                                    </td>
                                                    {isEditMode && <><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 border-l-2 border-black">如：2 (深度 &gt; 高度/2)</td><td className="p-2.5 @[480px]:p-3 font-black text-[10px] theme-text-muted bg-stone-50 hidden @[640px]:table-cell">自行設定檢討比率</td></>}
                                                </tr>
                                                <InputRow id="weiLaoRatio" label="23. 危老評估 (路心比)" value={finalRes.weiLaoRatio} calculatedValue={finalRes.weiLaoRatio} formula="5 / (0.5×路寬 + 前院)" note="危老條例高度係數" isEditMode={isEditMode} onOverride={handleOverride} highlight isArea={false} />
                                                
                                                {inputs.frontYardDepth == 0 && (
                                                    <tr className="bg-indigo-50/50 border-y-2 border-indigo-200">
                                                        <td className="p-2.5 @[480px]:p-3 pl-3 @[480px]:pl-5 border-l-4 border-indigo-600 font-black text-xs @[480px]:text-sm text-[var(--text-accent)]">24. 騎樓深度</td>
                                                        <td className="p-2.5 @[480px]:p-3 text-right" colSpan={2}>
                                                            <div className="flex items-center justify-end gap-1.5 font-black text-xs @[480px]:text-sm @[680px]:text-base">
                                                                <input type="number" name="arcadeDepth" value={inputs.arcadeDepth} onChange={handleInputChange} className="w-16 @[480px]:w-20 p-1 @[480px]:p-1.5 text-right border-2 border-indigo-600 rounded-none theme-bg theme-text outline-none focus:border-indigo-400" /> 
                                                                <span className="text-xs theme-text-muted">m</span>
                                                            </div>
                                                        </td>
                                                        {isEditMode && <><td className="p-2.5 @[480px]:p-3 font-black text-[10px] text-indigo-700 bg-indigo-50 border-l-2 border-indigo-200 uppercase">當前院=0時可用</td><td className="p-2.5 @[480px]:p-3 font-black text-[10px] text-indigo-700 bg-indigo-50 hidden @[640px]:table-cell">設定1F入口退縮</td></>}
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </DraggablePanel>
                )}

                {/* COMBINED REVIEW TABLE (shown when activePanels.includes('combined')) */}
                {activePanels.includes('combined') && sites.length > 1 && (
                    <DraggablePanel
                        title="整體合併檢討表"
                        onClose={() => closePanel('combined')}
                        defaultPos={{ x: 90, y: 60 }}
                        defaultSize={{ w: 600, h: 560 }}
                    >
                        <section className="space-y-3 w-full min-w-0">
                            <div className="theme-panel bg-emerald-900 p-0">
                                <div
                                    className="px-3 py-2.5 @[480px]:px-4 @[480px]:py-3 flex justify-between items-center cursor-pointer hover:bg-emerald-800 transition-colors group"
                                    onClick={() => setShowCombinedTable(!showCombinedTable)}
                                >
                                    <h3 className="text-sm @[480px]:text-base @[680px]:text-lg font-black text-white flex items-center gap-2">
                                        <MapPinned size={18} strokeWidth={3} className="shrink-0" /> 整體合併容積檢討表
                                    </h3>
                                    <div className="text-white group-hover:scale-110 transition-transform shrink-0">
                                        {showCombinedTable ? <ChevronUp size={20} strokeWidth={3} /> : <ChevronDown size={20} strokeWidth={3} />}
                                    </div>
                                </div>
                            </div>

                            <div className={`transition-all duration-300 ease-in-out ${showCombinedTable ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                                <div className="theme-panel overflow-hidden border-2 @[480px]:border-4">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse num-font bg-white">
                                            <thead>
                                                <tr className="bg-emerald-800 text-white border-b-4 border-emerald-900">
                                                    <th className="p-2.5 @[480px]:p-3.5 text-xs @[480px]:text-sm font-black uppercase">整體合併項目</th>
                                                    <th className="p-2.5 @[480px]:p-3.5 text-xs @[480px]:text-sm font-black uppercase text-right whitespace-nowrap">數值 (㎡)</th>
                                                    <th className="p-2.5 @[480px]:p-3.5 text-xs @[480px]:text-sm font-black uppercase text-right whitespace-nowrap">坪數 (坪)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y-2 divide-emerald-200">
                                                <tr className="bg-emerald-900 text-white">
                                                    <td colSpan={3} className="p-2 @[480px]:p-2.5 pl-3 @[480px]:pl-5 font-black text-[11px] @[480px]:text-xs uppercase tracking-widest">各基地允建 CFA 摘要</td>
                                                </tr>
                                                {siteResults.map((sr, i) => (
                                                    <tr key={sr.siteId} className="hover:bg-stone-50 transition-colors">
                                                        <td className="p-2.5 @[480px]:p-3.5 pl-3 @[480px]:pl-5 border-l-4 border-emerald-500 font-bold text-xs @[480px]:text-sm">
                                                            {sites[i].name}
                                                            <span className="ml-1.5 text-[10px] @[480px]:text-xs text-stone-400">
                                                                (建蔽 {sites[i].inputs.coverageRatio}% / 容積 {sites[i].inputs.floorRatio}%)
                                                            </span>
                                                        </td>
                                                        <td className="p-2.5 @[480px]:p-3.5 text-right font-black text-xs @[480px]:text-sm @[680px]:text-base">{formatNum(sr.finalRes.totalCFA)}</td>
                                                        <td className="p-2.5 @[480px]:p-3.5 text-right font-black text-xs @[480px]:text-sm @[680px]:text-base text-stone-500">{formatNum(toPing(sr.finalRes.totalCFA))}</td>
                                                    </tr>
                                                ))}

                                                <tr className="bg-emerald-900 text-white">
                                                    <td colSpan={3} className="p-2 @[480px]:p-2.5 pl-3 @[480px]:pl-5 font-black text-[11px] @[480px]:text-xs uppercase tracking-widest">合計彙總</td>
                                                </tr>
                                                <tr className="hover:bg-stone-50">
                                                    <td className="p-2.5 @[480px]:p-3.5 pl-3 @[480px]:pl-5 border-l-4 border-emerald-500 font-bold text-xs @[480px]:text-sm">合計基地面積</td>
                                                    <td className="p-2.5 @[480px]:p-3.5 text-right font-black text-xs @[480px]:text-sm @[680px]:text-base">{formatNum(combined.totalBase)}</td>
                                                    <td className="p-2.5 @[480px]:p-3.5 text-right font-black text-xs @[480px]:text-sm @[680px]:text-base text-stone-500">{formatNum(toPing(combined.totalBase))}</td>
                                                </tr>
                                                <tr className="hover:bg-stone-50">
                                                    <td className="p-2.5 @[480px]:p-3.5 pl-3 @[480px]:pl-5 border-l-4 border-emerald-500 font-bold text-xs @[480px]:text-sm">合計允建建築面積</td>
                                                    <td className="p-2.5 @[480px]:p-3.5 text-right font-black text-xs @[480px]:text-sm @[680px]:text-base">{formatNum(combined.totalMaxBuildingArea)}</td>
                                                    <td className="p-2.5 @[480px]:p-3.5 text-right font-black text-xs @[480px]:text-sm @[680px]:text-base text-stone-500">{formatNum(toPing(combined.totalMaxBuildingArea))}</td>
                                                </tr>
                                                <tr className="hover:bg-stone-50">
                                                    <td className="p-2.5 @[480px]:p-3.5 pl-3 @[480px]:pl-5 border-l-4 border-emerald-500 font-bold text-xs @[480px]:text-sm">合計法定容積</td>
                                                    <td className="p-2.5 @[480px]:p-3.5 text-right font-black text-xs @[480px]:text-sm @[680px]:text-base">{formatNum(combined.totalStatutoryFA)}</td>
                                                    <td className="p-2.5 @[480px]:p-3.5 text-right font-black text-xs @[480px]:text-sm @[680px]:text-base text-stone-500">{formatNum(toPing(combined.totalStatutoryFA))}</td>
                                                </tr>

                                                <tr className="bg-emerald-600 text-white border-y-4 border-emerald-900">
                                                    <td className="p-3 @[480px]:p-4 font-black text-sm @[480px]:text-base @[680px]:text-lg italic uppercase leading-tight">合計允建總樓地板面積</td>
                                                    <td className="p-3 @[480px]:p-4 text-right font-black text-base @[480px]:text-xl @[680px]:text-2xl leading-none">{formatNum(combined.totalCFA)}</td>
                                                    <td className="p-3 @[480px]:p-4 text-right font-black text-sm @[480px]:text-lg @[680px]:text-xl text-emerald-100">{formatNum(toPing(combined.totalCFA))}</td>
                                                </tr>
                                                <tr className="bg-emerald-700 text-white">
                                                    <td className="p-2.5 @[480px]:p-3.5 font-black uppercase text-xs @[480px]:text-sm @[680px]:text-base border-l-4 border-emerald-400">綜合坪效</td>
                                                    <td className="p-2.5 @[480px]:p-3.5 text-right font-black text-base @[480px]:text-xl @[680px]:text-2xl text-emerald-200 italic" colSpan={2}>
                                                        {formatNum(combined.avgEfficiency)} 倍
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </DraggablePanel>
                )}
        </div>
    );
};

export default Cal;
