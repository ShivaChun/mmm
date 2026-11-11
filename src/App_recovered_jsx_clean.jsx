Created At: 2026-07-01T07:08:59Z
Completed At: 2026-07-01T07:08:59Z
File Path: `file:///c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/App.jsx`
Total Lines: 809
Total Bytes: 42971
Showing lines 1 to 800
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
import React, { useState, useEffect, useCallback } from 'react';
import { Building2, MapPin, Plus, Trash2, FileText, Layers, ChevronUp, ChevronDown, AlertTriangle, Settings2, Pencil, Box, MapPinned, X } from 'lucide-react';
import { useSiteAnalysis } from './hooks/useSiteAnalysis';
import { useMultiSiteAnalysis } from './hooks/useMultiSiteAnalysis';
import { toPing, formatNum } from './utils/geometry';
import Visualizer3D from './components/PlanAnalysis3D';
import { CollapsibleSection, InputRow, SectionHeader } from './components/Si.jsx';
import { ContextMenu } from './components/ContextMenu.jsx';
import { DraggablePanel } from './components/DraggablePanel.jsx';

const DEFAULT_INPUTS = { projectName: '', district: '南投縣中興新村', roads: [{ id: 1, name: '向陽路', width: 10, orientation: 'bottom', type: 'primary', edgeIndex: 2 }], zoneType: '住宅區', urbanPlanName: '中興新村都市計畫區', coverageRatio: 50, floorRatio: 150, excavationRatio: 60, floorsBelow: 1, avgCarArea: 35, frontYardDepth: 4, sideYardDepth: 1.5, sideYardDirection: 'right', backYardDepth: 3, floorHeight1F: 4.2, floorHeightOther: 3.6, baseWidth: '', incentiveArea: 0, transferArea: 0, minBackyardDepthRatio: 0, arcadeDepth: 0, floorsAbove: 4, northAngle: 0 };
const SITE_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// 精準的多邊形重疊檢查函式 (Precision Polygon Overlap Check)
const checkPolygonOverlap = (polyA, polyB) => {
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
            if (segmentsIntersect(a1, a2, b1, b2)) {
                return true;
            }
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

    return false;
};

const createDefaultSite = (name, id, isFirst = false) => ({
    id: id || Date.now(),
    name: name || '基地',
    lots: [{ id: 1, lot: '___段___地號', area: 239.12 }],
    inputs: { ...DEFAULT_INPUTS, roads: isFirst ? DEFAULT_INPUTS.roads : [] },
    overrides: {},
    position: { x: 0, y: 0, rotation: 0 },
    baseGeometry: { points: null, curves: null }
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
    const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0 });

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('theme-cyberpunk');
            document.documentElement.classList.remove('theme-neumorphism');
        } else {
            document.documentElement.classList.add('theme-neumorphism');
            document.documentElement.classList.remove('theme-cyberpunk');
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
        const newIdx = sites.length;
        const label = SITE_LABELS[newIdx] || String(newIdx + 1);
        const newSite = createDefaultSite(`基地 ${label}`, Date.now(), false);
        
        const activeSite = sites[activeSiteIndex] || sites[0];
        
        // 擴充包含 rotation
        let position = {
            x: parseFloat(placementOffset.x || 0),
            y: parseFloat(placementOffset.y || 0),
            rotation: parseFloat(placementOffset.rotation || 0)
        };

        // 1. 計算新基地的 Local -> 世界坐標多邊形頂點
        const wNew = parseFloat(activeSite.inputs?.baseWidthM || activeSite.inputs?.baseWidth) || Math.sqrt(activeSite.inputs?.baseArea || 239);
        const dNew = parseFloat(activeSite.inputs?.baseDepthM) || ((activeSite.inputs?.baseArea || 239) / wNew);
        
        newSite.inputs = {
            ...activeSite.inputs,
            projectName: activeSite.inputs.projectName || '',
            baseWidth: activeSite.inputs.baseWidth,
            baseWidthM: activeSite.inputs.baseWidthM,
            baseDepthM: activeSite.inputs.baseDepthM,
            baseArea: activeSite.inputs.baseArea,
            roads: [] // 新基地不自帶實體道路，共享道路系統
        };

        const localPts = [
            { x: -wNew/2, y: -dNew/2 },
            { x: wNew/2, y: -dNew/2 },
            { x: wNew/2, y: dNew/2 },
            { x: -wNew/2, y: dNew/2 }
        ];
        const cos = Math.cos(position.rotation);
        const sin = Math.sin(position.rotation);
        const worldPtsNew = localPts.map(p => ({
            x: position.x + (p.x * cos - p.y * sin),
            y: position.y + (p.x * sin + p.y * cos)
        }));

        // 2. 計算主基地 A 主要道路的世界坐標多邊形，以做道路重疊檢測
        let roadWorldPolygon = null;
        const siteA = sites[0];
        const apA = siteA.position || { x: 0, y: 0, rotation: 0 };
        const cosA = Math.cos(apA.rotation || 0);
        const sinA = Math.sin(apA.rotation || 0);
        const wA = parseFloat(siteA.inputs.baseWidthM || siteA.inputs.baseWidth) || Math.sqrt(siteA.inputs.baseArea || 239);
        const dA = parseFloat(siteA.inputs.baseDepthM) || ((siteA.inputs.baseArea || 239) / wA);

        if (siteA && siteA.inputs?.roads) {
            const mainRoad = siteA.inputs.roads.find(r => r.type === 'primary') || siteA.inputs.roads[0];
            if (mainRoad) {
                const roadWidth = parseFloat(mainRoad.width) || 6;
                const ptsA = siteA.baseGeometry?.points || siteA.basePoints || null;
                let p1, p2;
                
                if (ptsA && ptsA.length > 2) {
                    const roadEdgeIdx = parseInt(mainRoad.edgeIndex !== undefined ? mainRoad.edgeIndex : 2) % ptsA.length;
                    const pt1 = ptsA[roadEdgeIdx];
                    const pt2 = ptsA[(roadEdgeIdx + 1) % ptsA.length];
                    p1 = { 
                        x: apA.x + (pt1.x * cosA - pt1.y * sinA), 
                        y: apA.y + (pt1.x * sinA + pt1.y * cosA) 
                    };
                    p2 = { 
                        x: apA.x + (pt2.x * cosA - pt2.y * sinA), 
                        y: apA.y + (pt2.x * sinA + pt2.y * cosA) 
                    };
                } else {
                    const localA = [
                        { x: -wA/2, y: -dA/2 }, { x: wA/2, y: -dA/2 },
                        { x: wA/2, y: dA/2 }, { x: -wA/2, y: dA/2 }
                    ];
                    const roadEdgeIdx = parseInt(mainRoad.edgeIndex !== undefined ? mainRoad.edgeIndex : 2) % 4;
                    const pt1 = localA[roadEdgeIdx];
                    const pt2 = localA[(roadEdgeIdx + 1) % 4];
                    p1 = { 
                        x: apA.x + (pt1.x * cosA - pt1.y * sinA), 
                        y: apA.y + (pt1.x * sinA + pt1.y * cosA) 
                    };
                    p2 = { 
                        x: apA.x + (pt2.x * cosA - pt2.y * sinA), 
                        y: apA.y + (pt2.x * sinA + pt2.y * cosA) 
                    };
                }
                
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const L = Math.sqrt(dx*dx + dy*dy);
                if (L > 0.001) {
                    const ptsA_pts = ptsA || [
                        { x: -wA/2, y: -dA/2 }, { x: wA/2, y: -dA/2 },
                        { x: wA/2, y: dA/2 }, { x: -wA/2, y: dA/2 }
                    ];
                    const sCentroidLocal = getPolygonCentroid(ptsA_pts);
                    const sCentroid = {
                        x: apA.x + (sCentroidLocal.x * cosA - sCentroidLocal.y * sinA),
                        y: apA.y + (sCentroidLocal.x * sinA + sCentroidLocal.y * cosA)
                    };
                    
                    const nx = -dy / L;
                    const ny = dx / L;
                    const vcx = (p1.x + p2.x)/2 - sCentroid.x;
                    const vcy = (p1.y + p2.y)/2 - sCentroid.y;
                    const dot = nx * vcx + ny * vcy;
                    const rx = dot >= 0 ? nx : -nx;
                    const ry = dot >= 0 ? ny : -ny;
                    
                    const roadOutP1 = { x: p1.x + rx * roadWidth, y: p1.y + ry * roadWidth };
                    const roadOutP2 = { x: p2.x + rx * roadWidth, y: p2.y + ry * roadWidth };
                    roadWorldPolygon = [p1, p2, roadOutP2, roadOutP1];
                }
            }
        }

        // 3. 精準檢查與所有現有基地是否重疊
        let isColliding = false;
        for (const s of sites) {
            if (s.id === newSite.id) continue;

            const sGeom = s.baseGeometry?.points || s.basePoints;
            let sLocalPts = [];
            
            const ew = parseFloat(s.inputs?.baseWidthM || s.inputs?.baseWidth) || Math.sqrt(s.inputs?.baseArea || 239);
            const ed = parseFloat(s.inputs?.baseDepthM) || ((s.inputs?.baseArea || 239) / ew);
            
            if (sGeom && sGeom.length > 2) {
                sLocalPts = sGeom;
            } else {
                sLocalPts = [
                    { x: -ew/2, y: -ed/2 },
                    { x: ew/2, y: -ed/2 },
                    { x: ew/2, y: ed/2 },
                    { x: -ew/2, y: ed/2 }
                ];
            }

            const sPos = s.position || { x: 0, y: 0, rotation: 0 };
            const cosS = Math.cos(sPos.rotation || 0);
            const sinS = Math.sin(sPos.rotation || 0);
            const worldPtsS = sLocalPts.map(p => ({
                x: sPos.x + (p.x * cosS - p.y * sinS),
                y: sPos.y + (p.x * sinS + p.y * cosS)
            }));

            if (checkPolygonOverlap(worldPtsNew, worldPtsS)) {
                isColliding = true;
                break;
            }
        }

        // 4. 檢查與主要道路範圍是否重疊
        if (!isColliding && roadWorldPolygon) {
            if (checkPolygonOverlap(worldPtsNew, roadWorldPolygon)) {
                alert("放置位置侵佔了主要面前道路空間，請重新調整邊界或偏移量！");
                return;
            }
        }

        if (isColliding) {
            alert("放置位置與現有基地重疊，請重新調整邊界或偏移量！");
            return;
        }

        // 5. 智慧面前道路對齊 (Smart Road Alignment)
        if (siteA && siteA.inputs?.roads) {
            const mainRoad = siteA.inputs.roads.find(r => r.type === 'primary') || siteA.inputs.roads[0];
            if (mainRoad) {
                const ptsA = siteA.baseGeometry?.points || siteA.basePoints || null;
                const apA = siteA.position || { x: 0, y: 0 };
                let roadEdgeP1, roadEdgeP2;
                
                if (ptsA && ptsA.length > 2) {
                    const roadEdgeIdx = parseInt(mainRoad.edgeIndex !== undefined ? mainRoad.edgeIndex : 2) % ptsA.length;
                    roadEdgeP1 = { x: ptsA[roadEdgeIdx].x + apA.x, y: ptsA[roadEdgeIdx].y + apA.y };
                    roadEdgeP2 = { x: ptsA[(roadEdgeIdx + 1) % ptsA.length].x + apA.x, y: ptsA[(roadEdgeIdx + 1) % ptsA.length].y + apA.y };
                } else {
                    const wA = parseFloat(siteA.inputs.baseWidthM || siteA.inputs.baseWidth) || Math.sqrt(siteA.inputs.baseArea || 239);
                    const dA = parseFloat(siteA.inputs.baseDepthM) || ((siteA.inputs.baseArea || 239) / wA);
                    const localA = [
                        { x: -wA/2, y: -dA/2 }, { x: wA/2, y: -dA/2 },
                        { x: wA/2, y: dA/2 }, { x: -wA/2, y: dA/2 }
                    ];
                    const roadEdgeIdx = parseInt(mainRoad.edgeIndex !== undefined ? mainRoad.edgeIndex : 2) % 4;
                    roadEdgeP1 = { x: localA[roadEdgeIdx].x + apA.x, y: localA[roadEdgeIdx].y + apA.y };
                    roadEdgeP2 = { x: localA[(roadEdgeIdx + 1) % 4].x + apA.x, y: localA[(roadEdgeIdx + 1) % 4].y + apA.y };
                }
                
                const roadMid = { x: (roadEdgeP1.x + roadEdgeP2.x) / 2, y: (roadEdgeP1.y + roadEdgeP2.y) / 2 };
                
                let minDst = Infinity;
                let bestEdgeIdx = 2; // 預設為頂部邊 (edgeIndex 2)
                
                for (let j = 0; j < 4; j++) {
                    const p1 = worldPtsNew[j];
                    const p2 = worldPtsNew[(j + 1) % 4];
                    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                    const dst = Math.pow(mid.x - roadMid.x, 2) + Math.pow(mid.y - roadMid.y, 2);
                    if (dst < minDst) {
                        minDst = dst;
                        bestEdgeIdx = j;
                    }
                }
                
                newSite.inputs.roads = [{
                    ...mainRoad,
                    edgeIndex: bestEdgeIdx,
                    edgeIndices: [bestEdgeIdx],
                    orientation: bestEdgeIdx === 0 ? 'bottom' : bestEdgeIdx === 1 ? 'right' : bestEdgeIdx === 2 ? 'top' : 'left'
                }];
            }
        }

        newSite.position = position;

        setSites(prev => [...prev, newSite]);
        setActiveSiteIndex(newIdx);
        setPlacementMode(false);
        setReferenceEdge(null);
        setPlacementOffset({ x: 0, y: 0, rotation: 0 });
        setShowAddSiteDialog(false);
    };

    // ── Site Management ──
    const handleAddSite = (snapDir) => {
        if (snapDir === 'free') {
            setPlacementMode('independent');
            setReferenceEdge(null);
            setShowAddSiteDialog(false);
            return;
        }

        const newIdx = sites.length;
        const label = SITE_LABELS[newIdx] || String(newIdx + 1);
        const newSite = createDefaultSite(`基地 ${label}`, Date.now(), false);

        // 基準基地為 基地 A (sites[0])
        const siteA = sites[0];
        const apA = siteA.position || { x: 0, y: 0, rotation: 0 };
        const radA = apA.rotation || 0;
        
        // 完全繼承主基地 A 的主要幾何尺寸與 inputs，確保共用同一個 WCS 軸線
        const wA = parseFloat(siteA.inputs.baseWidthM || siteA.inputs.baseWidth) || Math.sqrt(siteA.inputs.baseArea || 239);
        const dA = parseFloat(siteA.inputs.baseDepthM) || ((siteA.inputs.baseArea || 239) / wA);
        
        newSite.inputs = {
            ...siteA.inputs,
            projectName: siteA.inputs.projectName || '',
            baseWidth: siteA.inputs.baseWidth,
            baseWidthM: siteA.inputs.baseWidthM,
            baseDepthM: siteA.inputs.baseDepthM,
            baseArea: siteA.inputs.baseArea,
            roads: [] // 新基地不自帶實體道路，共享道路系統
        };

        const wNew = wA;
        const dNew = dA;

        // 計算基地 A 在 WCS 軸線下的朝右向量 (ux) 與朝上向量 (uy)
        const cosA = Math.cos(radA);
        const sinA = Math.sin(radA);
        const ux = { x: cosA, y: sinA };
        const uy = { x: -sinA, y: cosA };

        let newPos = { x: 0, y: 0, rotation: radA };
        if (snapDir === 'back') {
            // 緊貼後方：沿著基地 A 的 -uy 方向推出
            newPos.x = apA.x - uy.x * ((dA + dNew) / 2);
            newPos.y = apA.y - uy.y * ((dA + dNew) / 2);
        } else if (snapDir === 'left') {
            // 緊貼左側：沿著基地 A 的 -ux 方向推出
            newPos.x = apA.x - ux.x * ((wA + wNew) / 2);
            newPos.y = apA.y - ux.y * ((wA + wNew) / 2);
        } else if (snapDir === 'right') {
            // 緊貼右側：沿著基地 A 的 +ux 方向推出
            newPos.x = apA.x + ux.x * ((wA + wNew) / 2);
            newPos.y = apA.y + ux.y * ((wA + wNew) / 2);
        }

        // 計算新基地的世界坐標多邊形端點，用以做防碰撞重疊檢查
        const localNew = [
            { x: -wNew/2, y: -dNew/2 }, { x: wNew/2, y: -dNew/2 },
            { x: wNew/2, y: dNew/2 }, { x: -wNew/2, y: dNew/2 }
        ];
        const cosN = Math.cos(newPos.rotation);
        const sinN = Math.sin(newPos.rotation);
        const worldPtsNew = localNew.map(p => ({
            x: newPos.x + (p.x * cosN - p.y * sinN),
            y: newPos.y + (p.x * sinN + p.y * cosN)
        }));

        // 計算面前道路在世界坐標下的實際 Road Polygon
        let roadWorldPolygon = null;
        if (siteA && siteA.inputs?.roads) {
            const mainRoad = siteA.inputs.roads.find(r => r.type === 'primary') || siteA.inputs.roads[0];
            if (mainRoad) {
                const roadWidth = parseFloat(mainRoad.width) || 6;
                const ptsA = siteA.baseGeometry?.points || siteA.basePoints || null;
                let p1, p2;
                
                if (ptsA && ptsA.length > 2) {
                    const roadEdgeIdx = parseInt(mainRoad.edgeIndex !== undefined ? mainRoad.edgeIndex : 2) % ptsA.length;
                    const pt1 = ptsA[roadEdgeIdx];
                    const pt2 = ptsA[(roadEdgeIdx + 1) % ptsA.length];
                    p1 = { 
                        x: apA.x + (pt1.x * cosA - pt1.y * sinA), 
                        y: apA.y + (pt1.x * sinA + pt1.y * cosA) 
                    };
                    p2 = { 
                        x: apA.x + (pt2.x * cosA - pt2.y * sinA), 
                        y: apA.y + (pt2.x * sinA + pt2.y * cosA) 
                    };
                } else {
                    const localA = [
                        { x: -wA/2, y: -dA/2 }, { x: wA/2, y: -dA/2 },
                        { x: wA/2, y: dA/2 }, { x: -wA/2, y: dA/2 }
                    ];
                    const roadEdgeIdx = parseInt(mainRoad.edgeIndex !== undefined ? mainRoad.edgeIndex : 2) % 4;
                    const pt1 = localA[roadEdgeIdx];
                    const pt2 = localA[(roadEdgeIdx + 1) % 4];
                    p1 = { 
                        x: apA.x + (pt1.x * cosA - pt1.y * sinA), 
                        y: apA.y + (pt1.x * sinA + pt1.y * cosA) 
                    };
                    p2 = { 
                        x: apA.x + (pt2.x * cosA - pt2.y * sinA), 
                        y: apA.y + (pt2.x * sinA + pt2.y * cosA) 
                    };
                }
                
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const L = Math.sqrt(dx*dx + dy*dy);
                if (L > 0.001) {
                    const ptsA_pts = ptsA || [
                        { x: -wA/2, y: -dA/2 }, { x: wA/2, y: -dA/2 },
                        { x: wA/2, y: dA/2 }, { x: -wA/2, y: dA/2 }
                    ];
                    const sCentroidLocal = getPolygonCentroid(ptsA_pts);
                    const sCentroid = {
                        x: apA.x + (sCentroidLocal.x * cosA - sCentroidLocal.y * sinA),
                        y: apA.y + (sCentroidLocal.x * sinA + sCentroidLocal.y * cosA)
                    };
                    
                    const nx = -dy / L;
                    const ny = dx / L;
                    const vcx = (p1.x + p2.x)/2 - sCentroid.x;
                    const vcy = (p1.y + p2.y)/2 - sCentroid.y;
                    const dot = nx * vcx + ny * vcy;
                    const rx = dot >= 0 ? nx : -nx;
                    const ry = dot >= 0 ? ny : -ny;
                    
                    const roadOutP1 = { x: p1.x + rx * roadWidth, y: p1.y + ry * roadWidth };
                    const roadOutP2 = { x: p2.x + rx * roadWidth, y: p2.y + ry * roadWidth };
                    roadWorldPolygon = [p1, p2, roadOutP2, roadOutP1];
                }
            }
        }

        // 精準檢查與所有現有基地是否重疊
        let isColliding = false;
        for (const s of sites) {
            const sPos = s.position || { x: 0, y: 0, rotation: 0 };
            const sGeom = s.baseGeometry?.points || s.basePoints;
            let sLocalPts = [];
            
            const ew = parseFloat(s.inputs?.baseWidthM || s.inputs?.baseWidth) || Math.sqrt(s.inputs?.baseArea || 239);
            const ed = parseFloat(s.inputs?.baseDepthM) || ((s.inputs?.baseArea || 239) / ew);
            
            if (sGeom && sGeom.length > 2) {
                sLocalPts = sGeom;
            } else {
                sLocalPts = [
                    { x: -ew/2, y: -ed/2 },
                    { x: ew/2, y: -ed/2 },
                    { x: ew/2, y: ed/2 },
                    { x: -ew/2, y: ed/2 }
                ];
            }
            
            const cosS = Math.cos(sPos.rotation || 0);
            const sinS = Math.sin(sPos.rotation || 0);
            const worldPtsS = sLocalPts.map(p => ({
                x: sPos.x + (p.x * cosS - p.y * sinS),
                y: sPos.y + (p.x * sinS + p.y * cosS)
            }));
            
            if (checkPolygonOverlap(worldPtsNew, worldPtsS)) {
                isColliding = true;
                break;
            }
        }

        // 檢查與主要道路範圍是否重疊
        if (!isColliding && roadWorldPolygon) {
            if (checkPolygonOverlap(worldPtsNew, roadWorldPolygon)) {
                alert("快速新增位置侵佔了主要面前道路空間，請調整原基地朝向或手動精確放置！");
                return;
            }
        }

        if (isColliding) {
            alert("快速新增位置與現有基地重疊，請調整原基地朝向或手動精確放置！");
            return;
        }

        // 智慧面前道路對齊 (Smart Road Alignment) for 快速新增
        if (siteA && siteA.inputs?.roads) {
            const mainRoad = siteA.inputs.roads.find(r => r.type === 'primary') || siteA.inputs.roads[0];
            if (mainRoad) {
                const roadEdgeP1 = roadWorldPolygon ? roadWorldPolygon[0] : { x: 0, y: 0 };
                const roadEdgeP2 = roadWorldPolygon ? roadWorldPolygon[1] : { x: 0, y: 0 };
                const roadMid = { x: (roadEdgeP1.x + roadEdgeP2.x) / 2, y: (roadEdgeP1.y + roadEdgeP2.y) / 2 };
                
                let minDst = Infinity;
                let bestEdgeIdx = 2;
                
                for (let j = 0; j < 4; j++) {
                    const p1 = worldPtsNew[j];
                    const p2 = worldPtsNew[(j + 1) % 4];
                    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                    const dst = Math.pow(mid.x - roadMid.x, 2) + Math.pow(mid.y - roadMid.y, 2);
                    if (dst < minDst) {
                        minDst = dst;
                        bestEdgeIdx = j;
                    }
                }
                
                newSite.inputs.roads = [{
                    ...mainRoad,
                    edgeIndex: bestEdgeIdx,
                    edgeIndices: [bestEdgeIdx],
                    orientation: bestEdgeIdx === 0 ? 'bottom' : bestEdgeIdx === 1 ? 'right' : bestEdgeIdx === 2 ? 'top' : 'left'
                }];
            }
        }

        newSite.position = newPos;

        setSites(prev => [...prev, newSite]);
        setActiveSiteIndex(newIdx);
        setShowAddSiteDialog(false);
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
        setSites(prev => prev.map(s => s.id === id ? { ...s, [key]: val } : s));
    };

    const inputClass = "w-full p-3 border-2 border-[var(--border-strong)] rounded-none outline-none theme-input text-sm font-bold num-font transition-all duration-200";
    const labelClass = "block text-xs font-black theme-text-muted uppercase mb-1 tracking-wider";

    return (
        <div 
            className="fixed inset-0 w-full h-full bg-sky-50 dark:bg-slate-900 overflow-hidden text-stone-800"
            onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY });
            }}
        >
            <ContextMenu x={contextMenu.x} y={contextMenu.y} isOpen={contextMenu.isOpen} onClose={() => setContextMenu({ ...contextMenu, isOpen: false })} activePanels={activePanels} onTogglePanel={(panel) => setActivePanels(prev => prev.includes(panel) ? prev.filter(p => p !== panel) : [...prev, panel])} />
            
            {/* 3D VISUALIZER SECTION (Full Screen) */}
            <div className="absolute inset-0 z-0">
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
                    onUnusedAreaChange={setUnusedArea}
                    placementMode={placementMode}
                    referenceEdge={referenceEdge}
                    setReferenceEdge={setReferenceEdge}
                    placementOffset={placementOffset}
                    setPlacementOffset={setPlacementOffset}
                    onConfirmPlacement={handleConfirmPlacement}
                    onUpdateSiteGeometry={(geom) => handleUpdateSiteGeometry(activeSiteIndex, geom)}
                    setActiveSiteIndex={setActiveSiteIndex}
                />
            </div>
            
            {/* FLOATING PANELS */}
            {activePanels.includes('inputs') && (
                <DraggablePanel title="專案設定" onClose={() => setActivePanels(prev => prev.filter(p => p !== 'inputs'))} defaultSize={{w: 400, h: 600}}>
                    <div className="space-y-4">
                        <div className="flex flex-col">
                            <label className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">專案名稱</label>
                            <input 
                                type="text" 
                                name="projectName" 
                                value={inputs.projectName} 
                                onChange={handleInputChange} 
                                placeholder="輸入專案名稱" 
                                className="border-b-4 border-[var(--border-strong)] focus:border-[var(--text-accent)] outline-none bg-transparent py-2 text-xl font-black theme-text placeholder:text-stone-400" 
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className={labelClass}>縣市區域</label>
                                <input type="text" name="district" value={inputs.district} onChange={handleInputChange} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>土地使用分區</label>
                                <input type="text" name="zoneType" value={inputs.zoneType} onChange={handleInputChange} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>適用都市計畫</label>
                                <input type="text" name="urbanPlanName" value={inputs.urbanPlanName} onChange={handleInputChange} className={inputClass} />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>法定建蔽率 (%)</label>
                                <input type="number" name="coverageRatio" value={inputs.coverageRatio} onChange={handleInputChange} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>法定容積率 (%)</label>
                                <input type="number" name="floorRatio" value={inputs.floorRatio} onChange={handleInputChange} className={inputClass} />
                            </div>
                        </div>
                    </div>
                </DraggablePanel>
            )}

            {activePanels.includes('sites') && (
                <DraggablePanel title="基地管理" onClose={() => setActivePanels(prev => prev.filter(p => p !== 'sites'))} defaultSize={{w: 360, h: 400}}>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 flex-wrap mb-4">
                            {sites.map((site, idx) => (
                                <button 
                                    key={site.id} 
                                    onClick={() => setActiveSiteIndex(idx)} 
                                    className={`px-4 py-2 font-black transition-all border-4 ${activeSiteIndex === idx ? 'theme-btn-active scale-105 shadow-[4px_4px_0_#111]' : 'theme-btn border-transparent opacity-70 hover:opacity-100 hover:border-black'}`}
                                >
                                    {site.name}
                                </button>
                            ))}
                            <button onClick={() => setShowAddSiteDialog(true)} className="px-3 py-2 border-4 border-dashed border-[var(--border-strong)] text-[var(--text-muted)] hover:border-black hover:text-black font-black transition-colors rounded-none flex items-center gap-1">
                                <Plus size={20} strokeWidth={3} /> 新增
                            </button>
                        </div>
                        {sites.length > 1 && (
                            <button onClick={() => handleRemoveSite(activeSite.id)} className="w-full flex items-center justify-center gap-2 p-3 border-4 border-red-200 bg-red-50 text-red-600 font-black hover:bg-red-600 hover:text-white hover:border-red-700 transition-colors">
                                <Trash2 size={20} strokeWidth={3} /> 刪除當前基地
                            </button>
                        )}
                    </div>
                </DraggablePanel>
            )}

            {activePanels.includes('summary') && (
                <DraggablePanel title="評估結果" onClose={() => setActivePanels(prev => prev.filter(p => p !== 'summary'))} defaultSize={{w: 500, h: 700}}>
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 border-4 border-black bg-stone-50">
                                <div className="text-xs font-black text-stone-500 mb-1">總銷售坪數</div>
                                <div className="text-3xl font-black text-[var(--text-accent)] num-font">{formatNum(toPing(finalRes.totalSaleable))} <span className="text-sm text-stone-600">坪</span></div>
                            </div>
                            <div className="p-4 border-4 border-black bg-stone-50">
                                <div className="text-xs font-black text-stone-500 mb-1">容積單價</div>
                                <div className="text-3xl font-black text-emerald-600 num-font">{formatNum((finalRes.totalSaleable / (finalRes.base * (inputs.floorRatio/100))).toFixed(2))} <span className="text-sm text-stone-600">坪/容積</span></div>
                            </div>
                        </div>
                        <table className="w-full text-sm border-collapse border-4 border-black bg-white shadow-[4px_4px_0_#111]">
                            <tbody>
                                <InputRow id="totalCFA" label="總樓地板面積" value={finalRes.totalCFA} />
                                <InputRow id="totalSaleable" label="總銷售面積" value={finalRes.totalSaleable} highlight={true} />
                                <InputRow id="balconyArea" label="陽台面積" value={finalRes.balconyArea} />
                                <InputRow id="totalCarArea" label="停車空間面積" value={finalRes.totalCarArea} />
                            </tbody>
                        </table>
                    </div>
                </DraggablePanel>
            )}
            
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
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
