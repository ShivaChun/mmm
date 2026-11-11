Created At: 2026-07-01T07:08:59Z
Completed At: 2026-07-01T07:08:59Z
File Path: `file:///c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/App.jsx`
Total Lines: 809
Total Bytes: 42971
Showing lines 1 to 800
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
1: import React, { useState, useEffect, useCallback } from 'react';
2: import { Building2, MapPin, Plus, Trash2, FileText, Layers, ChevronUp, ChevronDown, AlertTriangle, Settings2, Pencil, Box, MapPinned, X } from 'lucide-react';
3: import { useSiteAnalysis } from './hooks/useSiteAnalysis';
4: import { useMultiSiteAnalysis } from './hooks/useMultiSiteAnalysis';
5: import { toPing, formatNum } from './utils/geometry';
6: import Visualizer3D from './components/PlanAnalysis3D';
7: import { CollapsibleSection, InputRow, SectionHeader } from './components/Si.jsx';
8: import { ContextMenu } from './components/ContextMenu.jsx';
9: import { DraggablePanel } from './components/DraggablePanel.jsx';
10: 
11: const DEFAULT_INPUTS = { projectName: '', district: '南投縣中興新村', roads: [{ id: 1, name: '向陽路', width: 10, orientation: 'bottom', type: 'primary', edgeIndex: 2 }], zoneType: '住宅區', urbanPlanName: '中興新村都市計畫區', coverageRatio: 50, floorRatio: 150, excavationRatio: 60, floorsBelow: 1, avgCarArea: 35, frontYardDepth: 4, sideYardDepth: 1.5, sideYardDirection: 'right', backYardDepth: 3, floorHeight1F: 4.2, floorHeightOther: 3.6, baseWidth: '', incentiveArea: 0, transferArea: 0, minBackyardDepthRatio: 0, arcadeDepth: 0, floorsAbove: 4, northAngle: 0 };
12: const SITE_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
13: 
14: // 精準的多邊形重疊檢查函式 (Precision Polygon Overlap Check)
15: const checkPolygonOverlap = (polyA, polyB) => {
16:     const segmentsIntersect = (p1, p2, p3, p4) => {
17:         const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
18:         return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
19:     };
20: 
21:     for (let i = 0; i < polyA.length; i++) {
22:         const a1 = polyA[i];
23:         const a2 = polyA[(i + 1) % polyA.length];
24:         for (let j = 0; j < polyB.length; j++) {
25:             const b1 = polyB[j];
26:             const b2 = polyB[(j + 1) % polyB.length];
27:             if (segmentsIntersect(a1, a2, b1, b2)) {
28:                 return true;
29:             }
30:         }
31:     }
32: 
33:     const isPointInPolygon = (pt, poly) => {
34:         let inside = false;
35:         for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
36:             const xi = poly[i].x, yi = poly[i].y;
37:             const xj = poly[j].x, yj = poly[j].y;
38:             const intersect = ((yi > pt.y) !== (yj > pt.y))
39:                 && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
40:             if (intersect) inside = !inside;
41:         }
42:         return inside;
43:     };
44: 
45:     if (polyA.length > 0 && isPointInPolygon(polyA[0], polyB)) return true;
46:     if (polyB.length > 0 && isPointInPolygon(polyB[0], polyA)) return true;
47: 
48:     return false;
49: };
50: 
51: const createDefaultSite = (name, id, isFirst = false) => ({
52:     id: id || Date.now(),
53:     name: name || '基地',
54:     lots: [{ id: 1, lot: '___段___地號', area: 239.12 }],
55:     inputs: { ...DEFAULT_INPUTS, roads: isFirst ? DEFAULT_INPUTS.roads : [] },
56:     overrides: {},
57:     position: { x: 0, y: 0, rotation: 0 },
58:     baseGeometry: { points: null, curves: null }
59: });
60: 
61: const Cal = () => {
62:     // ── Multi-Site State ──
63:     const [sites, setSites] = useState([createDefaultSite('基地 A', 1, true)]);
64:     const [activeSiteIndex, setActiveSiteIndex] = useState(0);
65:     const [showAddSiteDialog, setShowAddSiteDialog] = useState(false);
66:     const [showCombinedTable, setShowCombinedTable] = useState(true);
67: 
68:     // ── Placement Mode State ──
69:     const [placementMode, setPlacementMode] = useState(false); // false or 'independent'
70:     const [referenceEdge, setReferenceEdge] = useState(null);
71:     const [placementOffset, setPlacementOffset] = useState({ x: 0, y: 0 });
72: 
73:     // Derived active-site accessors (so all existing handlers keep working)
74:     const activeSite = sites[activeSiteIndex] || sites[0];
75:     const lots = activeSite.lots;
76:     const inputs = activeSite.inputs;
77:     const overrides = activeSite.overrides;
78:     const setLots = useCallback((u) => setSites(p => p.map((s, i) => i === activeSiteIndex ? { ...s, lots: typeof u === 'function' ? u(s.lots) : u } : s)), [activeSiteIndex]);
79:     const setInputs = useCallback((u) => setSites(p => p.map((s, i) => i === activeSiteIndex ? { ...s, inputs: typeof u === 'function' ? u(s.inputs) : u } : s)), [activeSiteIndex]);
80:     const setOverrides = useCallback((u) => setSites(p => p.map((s, i) => i === activeSiteIndex ? { ...s, overrides: typeof u === 'function' ? u(s.overrides) : u } : s)), [activeSiteIndex]);
81: 
82:     // ── Global Params (shared) ──
83:     const [params, setParams] = useState({ exemptRate: 15, stairRate: 5, balconyRate: 10, pricePerPing: 25 });
84:     const [isEditMode, setIsEditMode] = useState(false);
85:     const [unusedArea, setUnusedArea] = useState(0);
86:     const [showDetail, setShowDetail] = useState(true);
87:     const [showVisualizer, setShowVisualizer] = useState(true);
88:     const [showBasePanels, setShowBasePanels] = useState(true);
89:     const [showCheckLines, setShowCheckLines] = useState(true);
90:     const [showHeightRatio, setShowHeightRatio] = useState(true);
91:     const [showWeiLao, setShowWeiLao] = useState(false);
92:     const [showBackyard, setShowBackyard] = useState(true);
93:     const [isConstraintMode, setIsConstraintMode] = useState(false);
94:     const [isDarkMode, setIsDarkMode] = useState(false);
95:     const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0 });
96: 
97:     useEffect(() => {
98:         if (isDarkMode) {
99:             document.documentElement.classList.add('theme-cyberpunk');
100:             document.documentElement.classList.remove('theme-neumorphism');
101:         } else {
102:             document.documentElement.classList.add('theme-neumorphism');
103:             document.documentElement.classList.remove('theme-cyberpunk');
104:         }
105:     }, [isDarkMode]);
106: 
107:     // Removed unused toggleConstraints
108: 
109:     const updateLot = (id, field, value) => { setLots(prev => prev.map(l => l.id === id ? { ...l, [field]: field === 'area' ? (parseFloat(value) || 0) : value } : l)); };
110:     const addLot = () => { const newId = Math.max(...lots.map(l => l.id), 0) + 1; setLots([...lots, { id: newId, lot: '', area: 0 }]); };
111:     const removeLot = (id) => { if (lots.length > 1) setLots(lots.filter(l => l.id !== id)); };
112:     const updateRoad = (id, field, value) => { setInputs(prev => ({ ...prev, roads: prev.roads.map(r => r.id === id ? { ...r, [field]: value } : r) })); };
113:     const addRoad = () => { const newId = Math.max(...inputs.roads.map(r => r.id), 0) + 1; setInputs(prev => ({ ...prev, roads: [...prev.roads, { id: newId, name: '新道路', width: 6, orientation: 'custom', type: 'secondary' }] })); };
114:     const removeRoad = (id) => { if (inputs.roads.length > 1) setInputs(prev => ({ ...prev, roads: prev.roads.filter(r => r.id !== id) })); };
115:     const handleUpdateRoads = (newRoads) => { setInputs(prev => ({ ...prev, roads: newRoads })); };
116: 
117:     const { totalBaseArea, results, finalRes } = useSiteAnalysis(lots, inputs, params, overrides);
118:     const { siteResults, combined } = useMultiSiteAnalysis(sites, params);
119: 
120:     const handleConfirmPlacement = () => {
121:         const newIdx = sites.length;
122:         const label = SITE_LABELS[newIdx] || String(newIdx + 1);
123:         const newSite = createDefaultSite(`基地 ${label}`, Date.now(), false);
124:         
125:         const activeSite = sites[activeSiteIndex] || sites[0];
126:         
127:         // 擴充包含 rotation
128:         let position = {
129:             x: parseFloat(placementOffset.x || 0),
130:             y: parseFloat(placementOffset.y || 0),
131:             rotation: parseFloat(placementOffset.rotation || 0)
132:         };
133: 
134:         // 1. 計算新基地的 Local -> 世界坐標多邊形頂點
135:         const wNew = parseFloat(activeSite.inputs?.baseWidthM || activeSite.inputs?.baseWidth) || Math.sqrt(activeSite.inputs?.baseArea || 239);
136:         const dNew = parseFloat(activeSite.inputs?.baseDepthM) || ((activeSite.inputs?.baseArea || 239) / wNew);
137:         
138:         newSite.inputs = {
139:             ...activeSite.inputs,
140:             projectName: activeSite.inputs.projectName || '',
141:             baseWidth: activeSite.inputs.baseWidth,
142:             baseWidthM: activeSite.inputs.baseWidthM,
143:             baseDepthM: activeSite.inputs.baseDepthM,
144:             baseArea: activeSite.inputs.baseArea,
145:             roads: [] // 新基地不自帶實體道路，共享道路系統
146:         };
147: 
148:         const localPts = [
149:             { x: -wNew/2, y: -dNew/2 },
150:             { x: wNew/2, y: -dNew/2 },
151:             { x: wNew/2, y: dNew/2 },
152:             { x: -wNew/2, y: dNew/2 }
153:         ];
154:         const cos = Math.cos(position.rotation);
155:         const sin = Math.sin(position.rotation);
156:         const worldPtsNew = localPts.map(p => ({
157:             x: position.x + (p.x * cos - p.y * sin),
158:             y: position.y + (p.x * sin + p.y * cos)
159:         }));
160: 
161:         // 2. 計算主基地 A 主要道路的世界坐標多邊形，以做道路重疊檢測
162:         let roadWorldPolygon = null;
163:         const siteA = sites[0];
164:         const apA = siteA.position || { x: 0, y: 0, rotation: 0 };
165:         const cosA = Math.cos(apA.rotation || 0);
166:         const sinA = Math.sin(apA.rotation || 0);
167:         const wA = parseFloat(siteA.inputs.baseWidthM || siteA.inputs.baseWidth) || Math.sqrt(siteA.inputs.baseArea || 239);
168:         const dA = parseFloat(siteA.inputs.baseDepthM) || ((siteA.inputs.baseArea || 239) / wA);
169: 
170:         if (siteA && siteA.inputs?.roads) {
171:             const mainRoad = siteA.inputs.roads.find(r => r.type === 'primary') || siteA.inputs.roads[0];
172:             if (mainRoad) {
173:                 const roadWidth = parseFloat(mainRoad.width) || 6;
174:                 const ptsA = siteA.baseGeometry?.points || siteA.basePoints || null;
175:                 let p1, p2;
176:                 
177:                 if (ptsA && ptsA.length > 2) {
178:                     const roadEdgeIdx = parseInt(mainRoad.edgeIndex !== undefined ? mainRoad.edgeIndex : 2) % ptsA.length;
179:                     const pt1 = ptsA[roadEdgeIdx];
180:                     const pt2 = ptsA[(roadEdgeIdx + 1) % ptsA.length];
181:                     p1 = { 
182:                         x: apA.x + (pt1.x * cosA - pt1.y * sinA), 
183:                         y: apA.y + (pt1.x * sinA + pt1.y * cosA) 
184:                     };
185:                     p2 = { 
186:                         x: apA.x + (pt2.x * cosA - pt2.y * sinA), 
187:                         y: apA.y + (pt2.x * sinA + pt2.y * cosA) 
188:                     };
189:                 } else {
190:                     const localA = [
191:                         { x: -wA/2, y: -dA/2 }, { x: wA/2, y: -dA/2 },
192:                         { x: wA/2, y: dA/2 }, { x: -wA/2, y: dA/2 }
193:                     ];
194:                     const roadEdgeIdx = parseInt(mainRoad.edgeIndex !== undefined ? mainRoad.edgeIndex : 2) % 4;
195:                     const pt1 = localA[roadEdgeIdx];
196:                     const pt2 = localA[(roadEdgeIdx + 1) % 4];
197:                     p1 = { 
198:                         x: apA.x + (pt1.x * cosA - pt1.y * sinA), 
199:                         y: apA.y + (pt1.x * sinA + pt1.y * cosA) 
200:                     };
201:                     p2 = { 
202:                         x: apA.x + (pt2.x * cosA - pt2.y * sinA), 
203:                         y: apA.y + (pt2.x * sinA + pt2.y * cosA) 
204:                     };
205:                 }
206:                 
207:                 const dx = p2.x - p1.x;
208:                 const dy = p2.y - p1.y;
209:                 const L = Math.sqrt(dx*dx + dy*dy);
210:                 if (L > 0.001) {
211:                     const ptsA_pts = ptsA || [
212:                         { x: -wA/2, y: -dA/2 }, { x: wA/2, y: -dA/2 },
213:                         { x: wA/2, y: dA/2 }, { x: -wA/2, y: dA/2 }
214:                     ];
215:                     const sCentroidLocal = getPolygonCentroid(ptsA_pts);
216:                     const sCentroid = {
217:                         x: apA.x + (sCentroidLocal.x * cosA - sCentroidLocal.y * sinA),
218:                         y: apA.y + (sCentroidLocal.x * sinA + sCentroidLocal.y * cosA)
219:                     };
220:                     
221:                     const nx = -dy / L;
222:                     const ny = dx / L;
223:                     const vcx = (p1.x + p2.x)/2 - sCentroid.x;
224:                     const vcy = (p1.y + p2.y)/2 - sCentroid.y;
225:                     const dot = nx * vcx + ny * vcy;
226:                     const rx = dot >= 0 ? nx : -nx;
227:                     const ry = dot >= 0 ? ny : -ny;
228:                     
229:                     const roadOutP1 = { x: p1.x + rx * roadWidth, y: p1.y + ry * roadWidth };
230:                     const roadOutP2 = { x: p2.x + rx * roadWidth, y: p2.y + ry * roadWidth };
231:                     roadWorldPolygon = [p1, p2, roadOutP2, roadOutP1];
232:                 }
233:             }
234:         }
235: 
236:         // 3. 精準檢查與所有現有基地是否重疊
237:         let isColliding = false;
238:         for (const s of sites) {
239:             if (s.id === newSite.id) continue;
240: 
241:             const sGeom = s.baseGeometry?.points || s.basePoints;
242:             let sLocalPts = [];
243:             
244:             const ew = parseFloat(s.inputs?.baseWidthM || s.inputs?.baseWidth) || Math.sqrt(s.inputs?.baseArea || 239);
245:             const ed = parseFloat(s.inputs?.baseDepthM) || ((s.inputs?.baseArea || 239) / ew);
246:             
247:             if (sGeom && sGeom.length > 2) {
248:                 sLocalPts = sGeom;
249:             } else {
250:                 sLocalPts = [
251:                     { x: -ew/2, y: -ed/2 },
252:                     { x: ew/2, y: -ed/2 },
253:                     { x: ew/2, y: ed/2 },
254:                     { x: -ew/2, y: ed/2 }
255:                 ];
256:             }
257: 
258:             const sPos = s.position || { x: 0, y: 0, rotation: 0 };
259:             const cosS = Math.cos(sPos.rotation || 0);
260:             const sinS = Math.sin(sPos.rotation || 0);
261:             const worldPtsS = sLocalPts.map(p => ({
262:                 x: sPos.x + (p.x * cosS - p.y * sinS),
263:                 y: sPos.y + (p.x * sinS + p.y * cosS)
264:             }));
265: 
266:             if (checkPolygonOverlap(worldPtsNew, worldPtsS)) {
267:                 isColliding = true;
268:                 break;
269:             }
270:         }
271: 
272:         // 4. 檢查與主要道路範圍是否重疊
273:         if (!isColliding && roadWorldPolygon) {
274:             if (checkPolygonOverlap(worldPtsNew, roadWorldPolygon)) {
275:                 alert("放置位置侵佔了主要面前道路空間，請重新調整邊界或偏移量！");
276:                 return;
277:             }
278:         }
279: 
280:         if (isColliding) {
281:             alert("放置位置與現有基地重疊，請重新調整邊界或偏移量！");
282:             return;
283:         }
284: 
285:         // 5. 智慧面前道路對齊 (Smart Road Alignment)
286:         if (siteA && siteA.inputs?.roads) {
287:             const mainRoad = siteA.inputs.roads.find(r => r.type === 'primary') || siteA.inputs.roads[0];
288:             if (mainRoad) {
289:                 const ptsA = siteA.baseGeometry?.points || siteA.basePoints || null;
290:                 const apA = siteA.position || { x: 0, y: 0 };
291:                 let roadEdgeP1, roadEdgeP2;
292:                 
293:                 if (ptsA && ptsA.length > 2) {
294:                     const roadEdgeIdx = parseInt(mainRoad.edgeIndex !== undefined ? mainRoad.edgeIndex : 2) % ptsA.length;
295:                     roadEdgeP1 = { x: ptsA[roadEdgeIdx].x + apA.x, y: ptsA[roadEdgeIdx].y + apA.y };
296:                     roadEdgeP2 = { x: ptsA[(roadEdgeIdx + 1) % ptsA.length].x + apA.x, y: ptsA[(roadEdgeIdx + 1) % ptsA.length].y + apA.y };
297:                 } else {
298:                     const wA = parseFloat(siteA.inputs.baseWidthM || siteA.inputs.baseWidth) || Math.sqrt(siteA.inputs.baseArea || 239);
299:                     const dA = parseFloat(siteA.inputs.baseDepthM) || ((siteA.inputs.baseArea || 239) / wA);
300:                     const localA = [
301:                         { x: -wA/2, y: -dA/2 }, { x: wA/2, y: -dA/2 },
302:                         { x: wA/2, y: dA/2 }, { x: -wA/2, y: dA/2 }
303:                     ];
304:                     const roadEdgeIdx = parseInt(mainRoad.edgeIndex !== undefined ? mainRoad.edgeIndex : 2) % 4;
305:                     roadEdgeP1 = { x: localA[roadEdgeIdx].x + apA.x, y: localA[roadEdgeIdx].y + apA.y };
306:                     roadEdgeP2 = { x: localA[(roadEdgeIdx + 1) % 4].x + apA.x, y: localA[(roadEdgeIdx + 1) % 4].y + apA.y };
307:                 }
308:                 
309:                 const roadMid = { x: (roadEdgeP1.x + roadEdgeP2.x) / 2, y: (roadEdgeP1.y + roadEdgeP2.y) / 2 };
310:                 
311:                 let minDst = Infinity;
312:                 let bestEdgeIdx = 2; // 預設為頂部邊 (edgeIndex 2)
313:                 
314:                 for (let j = 0; j < 4; j++) {
315:                     const p1 = worldPtsNew[j];
316:                     const p2 = worldPtsNew[(j + 1) % 4];
317:                     const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
318:                     const dst = Math.pow(mid.x - roadMid.x, 2) + Math.pow(mid.y - roadMid.y, 2);
319:                     if (dst < minDst) {
320:                         minDst = dst;
321:                         bestEdgeIdx = j;
322:                     }
323:                 }
324:                 
325:                 newSite.inputs.roads = [{
326:                     ...mainRoad,
327:                     edgeIndex: bestEdgeIdx,
328:                     edgeIndices: [bestEdgeIdx],
329:                     orientation: bestEdgeIdx === 0 ? 'bottom' : bestEdgeIdx === 1 ? 'right' : bestEdgeIdx === 2 ? 'top' : 'left'
330:                 }];
331:             }
332:         }
333: 
334:         newSite.position = position;
335: 
336:         setSites(prev => [...prev, newSite]);
337:         setActiveSiteIndex(newIdx);
338:         setPlacementMode(false);
339:         setReferenceEdge(null);
340:         setPlacementOffset({ x: 0, y: 0, rotation: 0 });
341:         setShowAddSiteDialog(false);
342:     };
343: 
344:     // ── Site Management ──
345:     const handleAddSite = (snapDir) => {
346:         if (snapDir === 'free') {
347:             setPlacementMode('independent');
348:             setReferenceEdge(null);
349:             setShowAddSiteDialog(false);
350:             return;
351:         }
352: 
353:         const newIdx = sites.length;
354:         const label = SITE_LABELS[newIdx] || String(newIdx + 1);
355:         const newSite = createDefaultSite(`基地 ${label}`, Date.now(), false);
356: 
357:         // 基準基地為 基地 A (sites[0])
358:         const siteA = sites[0];
359:         const apA = siteA.position || { x: 0, y: 0, rotation: 0 };
360:         const radA = apA.rotation || 0;
361:         
362:         // 完全繼承主基地 A 的主要幾何尺寸與 inputs，確保共用同一個 WCS 軸線
363:         const wA = parseFloat(siteA.inputs.baseWidthM || siteA.inputs.baseWidth) || Math.sqrt(siteA.inputs.baseArea || 239);
364:         const dA = parseFloat(siteA.inputs.baseDepthM) || ((siteA.inputs.baseArea || 239) / wA);
365:         
366:         newSite.inputs = {
367:             ...siteA.inputs,
368:             projectName: siteA.inputs.projectName || '',
369:             baseWidth: siteA.inputs.baseWidth,
370:             baseWidthM: siteA.inputs.baseWidthM,
371:             baseDepthM: siteA.inputs.baseDepthM,
372:             baseArea: siteA.inputs.baseArea,
373:             roads: [] // 新基地不自帶實體道路，共享道路系統
374:         };
375: 
376:         const wNew = wA;
377:         const dNew = dA;
378: 
379:         // 計算基地 A 在 WCS 軸線下的朝右向量 (ux) 與朝上向量 (uy)
380:         const cosA = Math.cos(radA);
381:         const sinA = Math.sin(radA);
382:         const ux = { x: cosA, y: sinA };
383:         const uy = { x: -sinA, y: cosA };
384: 
385:         let newPos = { x: 0, y: 0, rotation: radA };
386:         if (snapDir === 'back') {
387:             // 緊貼後方：沿著基地 A 的 -uy 方向推出
388:             newPos.x = apA.x - uy.x * ((dA + dNew) / 2);
389:             newPos.y = apA.y - uy.y * ((dA + dNew) / 2);
390:         } else if (snapDir === 'left') {
391:             // 緊貼左側：沿著基地 A 的 -ux 方向推出
392:             newPos.x = apA.x - ux.x * ((wA + wNew) / 2);
393:             newPos.y = apA.y - ux.y * ((wA + wNew) / 2);
394:         } else if (snapDir === 'right') {
395:             // 緊貼右側：沿著基地 A 的 +ux 方向推出
396:             newPos.x = apA.x + ux.x * ((wA + wNew) / 2);
397:             newPos.y = apA.y + ux.y * ((wA + wNew) / 2);
398:         }
399: 
400:         // 計算新基地的世界坐標多邊形端點，用以做防碰撞重疊檢查
401:         const localNew = [
402:             { x: -wNew/2, y: -dNew/2 }, { x: wNew/2, y: -dNew/2 },
403:             { x: wNew/2, y: dNew/2 }, { x: -wNew/2, y: dNew/2 }
404:         ];
405:         const cosN = Math.cos(newPos.rotation);
406:         const sinN = Math.sin(newPos.rotation);
407:         const worldPtsNew = localNew.map(p => ({
408:             x: newPos.x + (p.x * cosN - p.y * sinN),
409:             y: newPos.y + (p.x * sinN + p.y * cosN)
410:         }));
411: 
412:         // 計算面前道路在世界坐標下的實際 Road Polygon
413:         let roadWorldPolygon = null;
414:         if (siteA && siteA.inputs?.roads) {
415:             const mainRoad = siteA.inputs.roads.find(r => r.type === 'primary') || siteA.inputs.roads[0];
416:             if (mainRoad) {
417:                 const roadWidth = parseFloat(mainRoad.width) || 6;
418:                 const ptsA = siteA.baseGeometry?.points || siteA.basePoints || null;
419:                 let p1, p2;
420:                 
421:                 if (ptsA && ptsA.length > 2) {
422:                     const roadEdgeIdx = parseInt(mainRoad.edgeIndex !== undefined ? mainRoad.edgeIndex : 2) % ptsA.length;
423:                     const pt1 = ptsA[roadEdgeIdx];
424:                     const pt2 = ptsA[(roadEdgeIdx + 1) % ptsA.length];
425:                     p1 = { 
426:                         x: apA.x + (pt1.x * cosA - pt1.y * sinA), 
427:                         y: apA.y + (pt1.x * sinA + pt1.y * cosA) 
428:                     };
429:                     p2 = { 
430:                         x: apA.x + (pt2.x * cosA - pt2.y * sinA), 
431:                         y: apA.y + (pt2.x * sinA + pt2.y * cosA) 
432:                     };
433:                 } else {
434:                     const localA = [
435:                         { x: -wA/2, y: -dA/2 }, { x: wA/2, y: -dA/2 },
436:                         { x: wA/2, y: dA/2 }, { x: -wA/2, y: dA/2 }
437:                     ];
438:                     const roadEdgeIdx = parseInt(mainRoad.edgeIndex !== undefined ? mainRoad.edgeIndex : 2) % 4;
439:                     const pt1 = localA[roadEdgeIdx];
440:                     const pt2 = localA[(roadEdgeIdx + 1) % 4];
441:                     p1 = { 
442:                         x: apA.x + (pt1.x * cosA - pt1.y * sinA), 
443:                         y: apA.y + (pt1.x * sinA + pt1.y * cosA) 
444:                     };
445:                     p2 = { 
446:                         x: apA.x + (pt2.x * cosA - pt2.y * sinA), 
447:                         y: apA.y + (pt2.x * sinA + pt2.y * cosA) 
448:                     };
449:                 }
450:                 
451:                 const dx = p2.x - p1.x;
452:                 const dy = p2.y - p1.y;
453:                 const L = Math.sqrt(dx*dx + dy*dy);
454:                 if (L > 0.001) {
455:                     const ptsA_pts = ptsA || [
456:                         { x: -wA/2, y: -dA/2 }, { x: wA/2, y: -dA/2 },
457:                         { x: wA/2, y: dA/2 }, { x: -wA/2, y: dA/2 }
458:                     ];
459:                     const sCentroidLocal = getPolygonCentroid(ptsA_pts);
460:                     const sCentroid = {
461:                         x: apA.x + (sCentroidLocal.x * cosA - sCentroidLocal.y * sinA),
462:                         y: apA.y + (sCentroidLocal.x * sinA + sCentroidLocal.y * cosA)
463:                     };
464:                     
465:                     const nx = -dy / L;
466:                     const ny = dx / L;
467:                     const vcx = (p1.x + p2.x)/2 - sCentroid.x;
468:                     const vcy = (p1.y + p2.y)/2 - sCentroid.y;
469:                     const dot = nx * vcx + ny * vcy;
470:                     const rx = dot >= 0 ? nx : -nx;
471:                     const ry = dot >= 0 ? ny : -ny;
472:                     
473:                     const roadOutP1 = { x: p1.x + rx * roadWidth, y: p1.y + ry * roadWidth };
474:                     const roadOutP2 = { x: p2.x + rx * roadWidth, y: p2.y + ry * roadWidth };
475:                     roadWorldPolygon = [p1, p2, roadOutP2, roadOutP1];
476:                 }
477:             }
478:         }
479: 
480:         // 精準檢查與所有現有基地是否重疊
481:         let isColliding = false;
482:         for (const s of sites) {
483:             const sPos = s.position || { x: 0, y: 0, rotation: 0 };
484:             const sGeom = s.baseGeometry?.points || s.basePoints;
485:             let sLocalPts = [];
486:             
487:             const ew = parseFloat(s.inputs?.baseWidthM || s.inputs?.baseWidth) || Math.sqrt(s.inputs?.baseArea || 239);
488:             const ed = parseFloat(s.inputs?.baseDepthM) || ((s.inputs?.baseArea || 239) / ew);
489:             
490:             if (sGeom && sGeom.length > 2) {
491:                 sLocalPts = sGeom;
492:             } else {
493:                 sLocalPts = [
494:                     { x: -ew/2, y: -ed/2 },
495:                     { x: ew/2, y: -ed/2 },
496:                     { x: ew/2, y: ed/2 },
497:                     { x: -ew/2, y: ed/2 }
498:                 ];
499:             }
500:             
501:             const cosS = Math.cos(sPos.rotation || 0);
502:             const sinS = Math.sin(sPos.rotation || 0);
503:             const worldPtsS = sLocalPts.map(p => ({
504:                 x: sPos.x + (p.x * cosS - p.y * sinS),
505:                 y: sPos.y + (p.x * sinS + p.y * cosS)
506:             }));
507:             
508:             if (checkPolygonOverlap(worldPtsNew, worldPtsS)) {
509:                 isColliding = true;
510:                 break;
511:             }
512:         }
513: 
514:         // 檢查與主要道路範圍是否重疊
515:         if (!isColliding && roadWorldPolygon) {
516:             if (checkPolygonOverlap(worldPtsNew, roadWorldPolygon)) {
517:                 alert("快速新增位置侵佔了主要面前道路空間，請調整原基地朝向或手動精確放置！");
518:                 return;
519:             }
520:         }
521: 
522:         if (isColliding) {
523:             alert("快速新增位置與現有基地重疊，請調整原基地朝向或手動精確放置！");
524:             return;
525:         }
526: 
527:         // 智慧面前道路對齊 (Smart Road Alignment) for 快速新增
528:         if (siteA && siteA.inputs?.roads) {
529:             const mainRoad = siteA.inputs.roads.find(r => r.type === 'primary') || siteA.inputs.roads[0];
530:             if (mainRoad) {
531:                 const roadEdgeP1 = roadWorldPolygon ? roadWorldPolygon[0] : { x: 0, y: 0 };
532:                 const roadEdgeP2 = roadWorldPolygon ? roadWorldPolygon[1] : { x: 0, y: 0 };
533:                 const roadMid = { x: (roadEdgeP1.x + roadEdgeP2.x) / 2, y: (roadEdgeP1.y + roadEdgeP2.y) / 2 };
534:                 
535:                 let minDst = Infinity;
536:                 let bestEdgeIdx = 2;
537:                 
538:                 for (let j = 0; j < 4; j++) {
539:                     const p1 = worldPtsNew[j];
540:                     const p2 = worldPtsNew[(j + 1) % 4];
541:                     const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
542:                     const dst = Math.pow(mid.x - roadMid.x, 2) + Math.pow(mid.y - roadMid.y, 2);
543:                     if (dst < minDst) {
544:                         minDst = dst;
545:                         bestEdgeIdx = j;
546:                     }
547:                 }
548:                 
549:                 newSite.inputs.roads = [{
550:                     ...mainRoad,
551:                     edgeIndex: bestEdgeIdx,
552:                     edgeIndices: [bestEdgeIdx],
553:                     orientation: bestEdgeIdx === 0 ? 'bottom' : bestEdgeIdx === 1 ? 'right' : bestEdgeIdx === 2 ? 'top' : 'left'
554:                 }];
555:             }
556:         }
557: 
558:         newSite.position = newPos;
559: 
560:         setSites(prev => [...prev, newSite]);
561:         setActiveSiteIndex(newIdx);
562:         setShowAddSiteDialog(false);
563:     };
564:     const handleRemoveSite = (idx) => {
565:         if (sites.length <= 1) return;
566:         if (confirm(`確定要刪除 ${sites[idx].name} 嗎？`)) {
567:             setSites(prev => prev.filter((_, i) => i !== idx));
568:             setActiveSiteIndex(prev => prev > idx ? prev - 1 : (prev === idx ? Math.max(0, idx - 1) : prev));
569:         }
570:     };
571:     const handleUpdateSiteGeometry = (idx, geometry) => {
572:         setSites(prev => {
573:             const next = [...prev];
574:             const oldGeom = prev[idx].baseGeometry;
575:             const newGeom = geometry;
576: 
577:             // Sync adjacent sites if points count remained the same (simple dragging)
578:             if (oldGeom && oldGeom.points && newGeom && newGeom.points && oldGeom.points.length === newGeom.points.length) {
579:                 const tolerance = 0.5; // 0.5m tolerance for "coincident" points
580:                 const deltas = [];
581:                 for (let i = 0; i < oldGeom.points.length; i++) {
582:                     const op = oldGeom.points[i];
583:                     const np = newGeom.points[i];
584:                     const dx = np.x - op.x;
585:                     const dy = np.y - op.y;
586:                     if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
587:                         deltas.push({ op, dx, dy });
588:                     }
589:                 }
590: 
591:                 if (deltas.length > 0) {
592:                     for (let k = 0; k < next.length; k++) {
593:                         if (k === idx) continue;
594:                         let modified = false;
595:                         const otherGeom = next[k].baseGeometry;
596:                         if (otherGeom && otherGeom.points) {
597:                             const newOtherPoints = otherGeom.points.map(p => {
598:                                 let newP = { ...p };
599:                                 for (const d of deltas) {
600:                                     if (Math.abs(p.x - d.op.x) < tolerance && Math.abs(p.y - d.op.y) < tolerance) {
601:                                         newP.x += d.dx;
602:                                         newP.y += d.dy;
603:                                         modified = true;
604:                                     }
605:                                 }
606:                                 return newP;
607:                             });
608:                             if (modified) {
609:                                 next[k] = { ...next[k], baseGeometry: { ...otherGeom, points: newOtherPoints } };
610:                             }
611:                         }
612:                     }
613:                 }
614:             }
615:             
616:             next[idx] = { ...next[idx], baseGeometry: geometry };
617:             return next;
618:         });
619:     };
620: 
621:     useEffect(() => {
622:         // Clear totalCFA override when base area or ratio changes
623:         // eslint-disable-next-line
624:         setOverrides(prev => { 
625:             if ('totalCFA' in prev) {
626:                 const copy = { ...prev }; 
627:                 delete copy.totalCFA; 
628:                 return copy; 
629:             }
630:             return prev;
631:         });
632:     }, [inputs.baseArea, inputs.floorRatio, setOverrides, activeSiteIndex]);
633: 
634:     const handleInputChange = (e) => { const { name, value } = e.target; setInputs(prev => ({ ...prev, [name]: value })); };
635:     const handleOverride = (id, value) => { const val = parseFloat(value); if (!isNaN(val)) setOverrides(prev => ({ ...prev, [id]: val })); };
636:     const handleParamChange = (key, value) => { setParams(prev => ({ ...prev, [key]: parseFloat(value) || 0 })); };
637:     const updateBaseDim = (key, val) => { setInputs(prev => ({ ...prev, [key]: val })); };
638:     const handleUpdateInputs = (key, val) => { setInputs(prev => ({ ...prev, [key]: val })); };
639:     const handleUpdateSiteSetting = (id, key, val) => {
640:         setSites(prev => prev.map(s => s.id === id ? { ...s, [key]: val } : s));
641:     };
642: 
643:     const inputClass = "w-full p-3 border-2 border-[var(--border-strong)] rounded-none outline-none theme-input text-sm font-bold num-font transition-all duration-200";
644:     const labelClass = "block text-xs font-black theme-text-muted uppercase mb-1 tracking-wider";
645: 
646:     return (
647:         <div 
648:             className="fixed inset-0 w-full h-full bg-sky-50 dark:bg-slate-900 overflow-hidden text-stone-800"
649:             onContextMenu={(e) => {
650:                 e.preventDefault();
651:                 setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY });
652:             }}
653:         >
654:             <ContextMenu x={contextMenu.x} y={contextMenu.y} isOpen={contextMenu.isOpen} onClose={() => setContextMenu({ ...contextMenu, isOpen: false })} activePanels={activePanels} onTogglePanel={(panel) => setActivePanels(prev => prev.includes(panel) ? prev.filter(p => p !== panel) : [...prev, panel])} />
655:             
656:             {/* 3D VISUALIZER SECTION (Full Screen) */}
657:             <div className="absolute inset-0 z-0">
658:                 <Visualizer3D
659:                     isDarkMode={isDarkMode}
660:                     setIsDarkMode={setIsDarkMode}
661:                     sites={sites}
662:                     activeSiteId={activeSite.id}
663:                     inputs={{ ...inputs, baseArea: finalRes.base, floorsAbove: finalRes.floorsAbove }}
664:                     res={finalRes}
665:                     siteResults={siteResults}
666:                     onUpdateBaseDim={updateBaseDim}
667:                     onUpdateRoads={handleUpdateRoads}
668:                     onUpdateInputs={handleUpdateInputs}
669:                     onUpdateSiteSetting={handleUpdateSiteSetting}
670:                     showCheckLines={showCheckLines}
671:                     setShowCheckLines={setShowCheckLines}
672:                     showHeightRatio={showHeightRatio}
673:                     setShowHeightRatio={setShowHeightRatio}
674:                     showWeiLao={showWeiLao}
675:                     setShowWeiLao={setShowWeiLao}
676:                     showBackyard={showBackyard}
677:                     setShowBackyard={setShowBackyard}
678:                     isConstraintMode={isConstraintMode}
679:                     setIsConstraintMode={setIsConstraintMode}
680:                     onUnusedAreaChange={setUnusedArea}
681:                     placementMode={placementMode}
682:                     referenceEdge={referenceEdge}
683:                     setReferenceEdge={setReferenceEdge}
684:                     placementOffset={placementOffset}
685:                     setPlacementOffset={setPlacementOffset}
686:                     onConfirmPlacement={handleConfirmPlacement}
687:                     onUpdateSiteGeometry={(geom) => handleUpdateSiteGeometry(activeSiteIndex, geom)}
688:                     setActiveSiteIndex={setActiveSiteIndex}
689:                 />
690:             </div>
691:             
692:             {/* FLOATING PANELS */}
693:             {activePanels.includes('inputs') && (
694:                 <DraggablePanel title="專案設定" onClose={() => setActivePanels(prev => prev.filter(p => p !== 'inputs'))} defaultSize={{w: 400, h: 600}}>
695:                     <div className="space-y-4">
696:                         <div className="flex flex-col">
697:                             <label className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">專案名稱</label>
698:                             <input 
699:                                 type="text" 
700:                                 name="projectName" 
701:                                 value={inputs.projectName} 
702:                                 onChange={handleInputChange} 
703:                                 placeholder="輸入專案名稱" 
704:                                 className="border-b-4 border-[var(--border-strong)] focus:border-[var(--text-accent)] outline-none bg-transparent py-2 text-xl font-black theme-text placeholder:text-stone-400" 
705:                             />
706:                         </div>
707:                         <div className="grid grid-cols-1 gap-4">
708:                             <div>
709:                                 <label className={labelClass}>縣市區域</label>
710:                                 <input type="text" name="district" value={inputs.district} onChange={handleInputChange} className={inputClass} />
711:                             </div>
712:                             <div>
713:                                 <label className={labelClass}>土地使用分區</label>
714:                                 <input type="text" name="zoneType" value={inputs.zoneType} onChange={handleInputChange} className={inputClass} />
715:                             </div>
716:                             <div>
717:                                 <label className={labelClass}>適用都市計畫</label>
718:                                 <input type="text" name="urbanPlanName" value={inputs.urbanPlanName} onChange={handleInputChange} className={inputClass} />
719:                             </div>
720:                         </div>
721:                         
722:                         <div className="grid grid-cols-2 gap-4">
723:                             <div>
724:                                 <label className={labelClass}>法定建蔽率 (%)</label>
725:                                 <input type="number" name="coverageRatio" value={inputs.coverageRatio} onChange={handleInputChange} className={inputClass} />
726:                             </div>
727:                             <div>
728:                                 <label className={labelClass}>法定容積率 (%)</label>
729:                                 <input type="number" name="floorRatio" value={inputs.floorRatio} onChange={handleInputChange} className={inputClass} />
730:                             </div>
731:                         </div>
732:                     </div>
733:                 </DraggablePanel>
734:             )}
735: 
736:             {activePanels.includes('sites') && (
737:                 <DraggablePanel title="基地管理" onClose={() => setActivePanels(prev => prev.filter(p => p !== 'sites'))} defaultSize={{w: 360, h: 400}}>
738:                     <div className="space-y-4">
739:                         <div className="flex items-center gap-2 flex-wrap mb-4">
740:                             {sites.map((site, idx) => (
741:                                 <button 
742:                                     key={site.id} 
743:                                     onClick={() => setActiveSiteIndex(idx)} 
744:                                     className={`px-4 py-2 font-black transition-all border-4 ${activeSiteIndex === idx ? 'theme-btn-active scale-105 shadow-[4px_4px_0_#111]' : 'theme-btn border-transparent opacity-70 hover:opacity-100 hover:border-black'}`}
745:                                 >
746:                                     {site.name}
747:                                 </button>
748:                             ))}
749:                             <button onClick={() => setShowAddSiteDialog(true)} className="px-3 py-2 border-4 border-dashed border-[var(--border-strong)] text-[var(--text-muted)] hover:border-black hover:text-black font-black transition-colors rounded-none flex items-center gap-1">
750:                                 <Plus size={20} strokeWidth={3} /> 新增
751:                             </button>
752:                         </div>
753:                         {sites.length > 1 && (
754:                             <button onClick={() => handleRemoveSite(activeSite.id)} className="w-full flex items-center justify-center gap-2 p-3 border-4 border-red-200 bg-red-50 text-red-600 font-black hover:bg-red-600 hover:text-white hover:border-red-700 transition-colors">
755:                                 <Trash2 size={20} strokeWidth={3} /> 刪除當前基地
756:                             </button>
757:                         )}
758:                     </div>
759:                 </DraggablePanel>
760:             )}
761: 
762:             {activePanels.includes('summary') && (
763:                 <DraggablePanel title="評估結果" onClose={() => setActivePanels(prev => prev.filter(p => p !== 'summary'))} defaultSize={{w: 500, h: 700}}>
764:                     <div className="space-y-6">
765:                         <div className="grid grid-cols-2 gap-4">
766:                             <div className="p-4 border-4 border-black bg-stone-50">
767:                                 <div className="text-xs font-black text-stone-500 mb-1">總銷售坪數</div>
768:                                 <div className="text-3xl font-black text-[var(--text-accent)] num-font">{formatNum(toPing(finalRes.totalSaleable))} <span className="text-sm text-stone-600">坪</span></div>
769:                             </div>
770:                             <div className="p-4 border-4 border-black bg-stone-50">
771:                                 <div className="text-xs font-black text-stone-500 mb-1">容積單價</div>
772:                                 <div className="text-3xl font-black text-emerald-600 num-font">{formatNum((finalRes.totalSaleable / (finalRes.base * (inputs.floorRatio/100))).toFixed(2))} <span className="text-sm text-stone-600">坪/容積</span></div>
773:                             </div>
774:                         </div>
775:                         <table className="w-full text-sm border-collapse border-4 border-black bg-white shadow-[4px_4px_0_#111]">
776:                             <tbody>
777:                                 <InputRow id="totalCFA" label="總樓地板面積" value={finalRes.totalCFA} />
778:                                 <InputRow id="totalSaleable" label="總銷售面積" value={finalRes.totalSaleable} highlight={true} />
779:                                 <InputRow id="balconyArea" label="陽台面積" value={finalRes.balconyArea} />
780:                                 <InputRow id="totalCarArea" label="停車空間面積" value={finalRes.totalCarArea} />
781:                             </tbody>
782:                         </table>
783:                     </div>
784:                 </DraggablePanel>
785:             )}
786:             
787:             {showAddSiteDialog && (
788:                 <div className="fixed inset-0 z-[100] flex items-center justify-center">
789:                     <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddSiteDialog(false)} />
790:                     <div className="relative bg-white shadow-2xl border-4 border-black p-8 max-w-md w-full mx-4">
791:                         <button onClick={() => setShowAddSiteDialog(false)} className="absolute top-4 right-4 text-stone-400 hover:text-black"><X size={20} /></button>
792:                         <h3 className="text-2xl font-black mb-2 flex items-center gap-3"><MapPinned size={24} className="text-[var(--text-accent)]" /> 新增基地</h3>
793:                         <p className="text-sm text-stone-500 mb-6">是否緊貼 <span className="font-black text-black">{activeSite.name}</span>？</p>
794:                         <div className="space-y-3">
795:                             <button onClick={() => handleAddSite('back')} className="w-full p-4 border-4 border-black font-bold hover:bg-stone-100 text-left flex items-center gap-3 transition-colors">🔗 緊貼後方（背面）</button>
796:                             <button onClick={() => handleAddSite('left')} className="w-full p-4 border-4 border-black font-bold hover:bg-stone-100 text-left flex items-center gap-3 transition-colors">🔗 緊貼左側</button>
797:                             <button onClick={() => handleAddSite('right')} className="w-full p-4 border-4 border-black font-bold hover:bg-stone-100 text-left flex items-center gap-3 transition-colors">🔗 緊貼右側</button>
798:                             <div className="border-t-4 border-stone-200 my-2" />
799:                             <button onClick={() => handleAddSite('free')} className="w-full p-4 border-4 border-dashed border-stone-400 font-bold hover:bg-stone-50 text-left flex items-center gap-3 text-stone-600 transition-colors">📍 獨立放置（不緊貼）</button>
800:                         </div>
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
