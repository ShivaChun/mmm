import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    X, Upload, Map as MapIcon, FileText, Wand2, Pencil, Ruler, Trash2,
    Search, ZoomIn, ZoomOut, CheckCircle2, ExternalLink, ShieldCheck,
    RotateCcw, FileCode2, FolderOpen, Magnet, Route, Undo2
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
    cadastralLocalDB,
    parseBoundaryCoordsText,
    parseDXFPolygons,
    detectParcelPolygonAtPixel,
    TAIWAN_PRESET_LOCATIONS,
    latLngToWorldPx,
    worldPxToLatLng,
    getMetersPerPixelAtLatZoom,
    getNLSCTileUrl,
    pixelPolygonToSiteMeters,
    snapPixelToDarkEdge,
    detectFrontageEdgesFromRoads,
    solvePolygonWithEdgeLengths,
    snapPointToPolygonEdges,
    snapSitePolygonToRoadEdges
} from '../utils/cadastralUtils';
import { toPing, formatNum } from '../utils/geometry';
import { getPolygonBounds, pointInPolygon, getPolygonCentroid } from '../utils/polygon';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// 範例：台灣地籍謄本界址坐標表（臺中市豐原區三陽段396地號）
const SAMPLE_TWD97_TEXT = `396 2032 223276.646 2682646.627
396 2026 223276.199 2682641.647
396 2096 223303.983 2682639.165
396 2097 223304.360 2682641.641
396 2098 223304.715 2682644.120`;

export const CadastralImportModal = ({
    isOpen,
    onClose,
    onImportSite, // ({ points, mode: 'current' | 'new', label, underlay, detectedRoad }) => void
    nextSiteLabel = 'B'
}) => {
    const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'map' | 'dxf'
    const [importTargetMode, setImportTargetMode] = useState('current'); // 'current' | 'new'
    const [keepAsUnderlay, setKeepAsUnderlay] = useState(true);
    const [localFiles, setLocalFiles] = useState([]);
    const [statusMsg, setStatusMsg] = useState('');
    const [edgeSnapEnabled, setEdgeSnapEnabled] = useState(true);
    // 匯入前基地邊長預先設定（可只設一邊由比例等比推演，亦可部分或全部設定）
    const [edgeLengthOverrides, setEdgeLengthOverrides] = useState({});

    // ── Tab 1: 台灣 NLSC 即時地籍圖狀態 ──
    const [mapCenter, setMapCenter] = useState({ lat: 24.2528, lng: 120.7289 });
    const [mapZoom, setMapZoom] = useState(18);
    const [showCadastralLayer, setShowCadastralLayer] = useState(true);
    const [showZoningLayer, setShowZoningLayer] = useState(false);
    const [showPhotoBase, setShowPhotoBase] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [mapPickMode, setMapPickMode] = useState('trace'); // 'trace' | 'road_trace' | 'pan'
    const [mapTracedLatLngs, setMapTracedLatLngs] = useState([]);
    const [mapRoadLatLngs, setMapRoadLatLngs] = useState([]);
    const [mapCursorScreen, setMapCursorScreen] = useState(null);
    const [mapSnapInfo, setMapSnapInfo] = useState(null);
    const mapContainerRef = useRef(null);
    const mapDragRef = useRef({ active: false, startX: 0, startY: 0, origWorldX: 0, origWorldY: 0, moved: false });
    const [mapViewportSize, setMapViewportSize] = useState({ w: 720, h: 460 });

    // ── Tab 2: 本機上傳 PDF / 圖片狀態 ──
    const [uploadedTitle, setUploadedTitle] = useState('');
    const [uploadedPages, setUploadedPages] = useState([]);
    const [currentPageIdx, setCurrentPageIdx] = useState(0);
    // 'wand' (選地號) | 'road_wand' (點選道路範圍) | 'trace' (點線框選基地) | 'calibrate' (校正比例尺)
    const [uploadTool, setUploadTool] = useState('wand');
    const [wandTolerance, setWandTolerance] = useState(34);
    const [scaleDenom, setScaleDenom] = useState(500);
    const [metersPerPxOverride, setMetersPerPxOverride] = useState(null);
    const [calibPts, setCalibPts] = useState([]);
    const [calibRealM, setCalibRealM] = useState('10');
    const [selectedUploadPolys, setSelectedUploadPolys] = useState([]); // [{ id, label, pointsPx }]
    const [selectedRoadPolys, setSelectedRoadPolys] = useState([]); // [{ id, label, pointsPx, widthM }]
    const [roadWidthInputM, setRoadWidthInputM] = useState('10');
    const [manualTracePx, setManualTracePx] = useState([]);
    const [isManualTraceClosed, setIsManualTraceClosed] = useState(false);
    const [manualRoadTracePx, setManualRoadTracePx] = useState([]);
    const [uploadCursorPx, setUploadCursorPx] = useState(null);
    const [uploadSnapInfo, setUploadSnapInfo] = useState(null);
    const [uploadZoom, setUploadZoom] = useState(1);
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const hiddenCanvasRef = useRef(null);
    const imgElementRef = useRef(null);

    // ── Tab 3: DXF / 界址坐標表狀態 ──
    const [dxfParcels, setDxfParcels] = useState([]);
    const [selectedDxfIds, setSelectedDxfIds] = useState(new Set());
    const [selectedDxfRoadIds, setSelectedDxfRoadIds] = useState(new Set());
    const [dxfPickKind, setDxfPickKind] = useState('site'); // 'site' | 'road'
    const [twd97Text, setTwd97Text] = useState('');
    const [twd97Parcels, setTwd97Parcels] = useState([]);
    const [selectedTwd97Id, setSelectedTwd97Id] = useState(null);

    const refreshLocalFiles = useCallback(async () => {
        const list = await cadastralLocalDB.listFiles();
        setLocalFiles(list);
    }, []);

    useEffect(() => {
        if (isOpen) refreshLocalFiles();
    }, [isOpen, refreshLocalFiles]);

    // 鍵盤支援：Backspace 退回上一點、Enter 封閉點線框
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'Backspace') {
                if (activeTab === 'upload' && uploadTool === 'trace' && manualTracePx.length > 0) {
                    e.preventDefault();
                    setIsManualTraceClosed(false);
                    setManualTracePx(prev => prev.slice(0, -1));
                } else if (activeTab === 'upload' && uploadTool === 'road_trace' && manualRoadTracePx.length > 0) {
                    e.preventDefault();
                    setManualRoadTracePx(prev => prev.slice(0, -1));
                } else if (activeTab === 'map' && mapPickMode === 'trace' && mapTracedLatLngs.length > 0) {
                    e.preventDefault();
                    setMapTracedLatLngs(prev => prev.slice(0, -1));
                } else if (activeTab === 'map' && mapPickMode === 'road_trace' && mapRoadLatLngs.length > 0) {
                    e.preventDefault();
                    setMapRoadLatLngs(prev => prev.slice(0, -1));
                }
            } else if (e.key === 'Enter') {
                if (activeTab === 'upload' && uploadTool === 'trace' && manualTracePx.length >= 3) {
                    e.preventDefault();
                    setIsManualTraceClosed(true);
                    setStatusMsg(`已完成點線框選（${manualTracePx.length} 個角點），可直接匯入至畫布！`);
                } else if (activeTab === 'upload' && uploadTool === 'road_trace' && manualRoadTracePx.length >= 3) {
                    e.preventDefault();
                    const wM = Math.max(2, parseFloat(roadWidthInputM) || 10);
                    setSelectedRoadPolys(prev => [
                        ...prev,
                        { id: `road-trace-${Date.now()}`, label: `道路 #${prev.length + 1}`, pointsPx: manualRoadTracePx, widthM: wM }
                    ]);
                    setManualRoadTracePx([]);
                    setStatusMsg(`已完成道路框選（路寬 ${wM}m），基地將自動吸附於此道路邊緣！`);
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, activeTab, uploadTool, manualTracePx.length, manualRoadTracePx, roadWidthInputM, mapPickMode, mapTracedLatLngs.length, mapRoadLatLngs.length]);

    useEffect(() => {
        if (!isOpen || activeTab !== 'map') return;
        const updateSize = () => {
            if (mapContainerRef.current) {
                setMapViewportSize({
                    w: mapContainerRef.current.clientWidth || 720,
                    h: mapContainerRef.current.clientHeight || 460
                });
            }
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [isOpen, activeTab]);

    const activePage = uploadedPages[currentPageIdx] || null;
    const effectiveMetersPerPx = useMemo(() => {
        if (metersPerPxOverride && metersPerPxOverride > 0) return metersPerPxOverride;
        if (!activePage || !activePage.width) return 0.05;
        const paperWidthM = 0.21 * (parseFloat(scaleDenom) || 500);
        return paperWidthM / activePage.width;
    }, [metersPerPxOverride, activePage, scaleDenom]);

    useEffect(() => {
        if (!activePage || !activePage.dataUrl || !hiddenCanvasRef.current) return;
        const img = new Image();
        img.onload = () => {
            const canvas = hiddenCanvasRef.current;
            if (!canvas) return;
            canvas.width = activePage.width;
            canvas.height = activePage.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = activePage.dataUrl;
    }, [activePage]);

    // ── 檔案本機上傳與 IndexedDB 儲存 ──
    const handleFileUpload = async (file) => {
        if (!file) return;
        setIsProcessingFile(true);
        setStatusMsg(`正在於本機瀏覽器解析「${file.name}」...`);

        try {
            const lower = file.name.toLowerCase();
            if (lower.endsWith('.dxf')) {
                const text = await file.text();
                const parsed = parseDXFPolygons(text);
                setDxfParcels(parsed);
                setSelectedDxfIds(parsed.length > 0 ? new Set([parsed[0].id]) : new Set());
                setSelectedDxfRoadIds(new Set());
                setActiveTab('dxf');
                await cadastralLocalDB.saveFile({
                    id: `dxf-${Date.now()}`,
                    name: file.name,
                    kind: 'dxf',
                    textContent: text,
                    parcelCount: parsed.length
                });
                await refreshLocalFiles();
                setStatusMsg(parsed.length > 0 ? `已於本機解析 DXF（共 ${parsed.length} 個地塊），點擊地塊選取、再點一次即可取消！` : '未在 DXF 中找到封閉多邊形。');
            } else if (lower.endsWith('.pdf')) {
                const buf = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
                const pages = [];
                let extractedTextAll = '';

                const maxPages = Math.min(pdf.numPages, 5);
                for (let p = 1; p <= maxPages; p++) {
                    const page = await pdf.getPage(p);
                    const viewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(viewport.width);
                    canvas.height = Math.round(viewport.height);
                    const ctx = canvas.getContext('2d');
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    pages.push({
                        pageNum: p,
                        width: canvas.width,
                        height: canvas.height,
                        dataUrl: canvas.toDataURL('image/png')
                    });
                    try {
                        const tc = await page.getTextContent();
                        extractedTextAll += '\n' + tc.items.map(it => it.str).join(' ');
                    } catch { /* ignore */ }
                }

                const scaleMatch = extractedTextAll.match(/1\s*\/\s*(\d{3,4})/);
                if (scaleMatch) {
                    const denom = parseInt(scaleMatch[1], 10);
                    if (denom >= 100 && denom <= 10000) setScaleDenom(denom);
                }

                const parsedCoords = parseBoundaryCoordsText(extractedTextAll);
                if (parsedCoords.length > 0) {
                    setTwd97Parcels(parsedCoords);
                    setSelectedTwd97Id(parsedCoords[0].id);
                }

                setUploadedTitle(file.name);
                setUploadedPages(pages);
                setCurrentPageIdx(0);
                setSelectedUploadPolys([]);
                setSelectedRoadPolys([]);
                setManualTracePx([]);
                setIsManualTraceClosed(false);
                setMetersPerPxOverride(null);
                setCalibPts([]);
                setUploadTool('wand');
                setActiveTab('upload');

                await cadastralLocalDB.saveFile({
                    id: `pdf-${Date.now()}`,
                    name: file.name,
                    kind: 'pdf',
                    pages,
                    scaleDenom: scaleMatch ? parseInt(scaleMatch[1], 10) : 500
                });
                await refreshLocalFiles();
                setStatusMsg(`已於本機載入 PDF（共 ${pages.length} 頁），點選地號或道路即可選取，再點一次可取消！`);
            } else if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(lower)) {
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                const dims = await new Promise((resolve) => {
                    const im = new Image();
                    im.onload = () => resolve({ width: im.naturalWidth, height: im.naturalHeight });
                    im.src = dataUrl;
                });
                const pages = [{ pageNum: 1, width: dims.width, height: dims.height, dataUrl }];
                setUploadedTitle(file.name);
                setUploadedPages(pages);
                setCurrentPageIdx(0);
                setSelectedUploadPolys([]);
                setSelectedRoadPolys([]);
                setManualTracePx([]);
                setIsManualTraceClosed(false);
                setMetersPerPxOverride(null);
                setCalibPts([]);
                setUploadTool('wand');
                setActiveTab('upload');

                await cadastralLocalDB.saveFile({
                    id: `img-${Date.now()}`,
                    name: file.name,
                    kind: 'image',
                    pages,
                    scaleDenom: 500
                });
                await refreshLocalFiles();
                setStatusMsg(`已於本機載入圖片「${file.name}」，可用魔術棒點選地號／道路，或用點線框搭配邊界吸附框選！`);
            } else {
                setStatusMsg('不支援的檔案格式，請上傳 PDF、JPG、PNG 或 DXF。');
            }
        } catch (err) {
            setStatusMsg(`本機解析失敗：${err?.message || '請確認檔案格式'}`);
        } finally {
            setIsProcessingFile(false);
        }
    };

    const handleLoadLocalRecord = (rec) => {
        if (rec.kind === 'dxf' && rec.textContent) {
            const parsed = parseDXFPolygons(rec.textContent);
            setDxfParcels(parsed);
            setSelectedDxfIds(parsed.length > 0 ? new Set([parsed[0].id]) : new Set());
            setSelectedDxfRoadIds(new Set());
            setActiveTab('dxf');
            setStatusMsg(`已從本機瀏覽器載入「${rec.name}」`);
        } else if (rec.pages && rec.pages.length > 0) {
            setUploadedTitle(rec.name);
            setUploadedPages(rec.pages);
            setCurrentPageIdx(0);
            setSelectedUploadPolys([]);
            setSelectedRoadPolys([]);
            setManualTracePx([]);
            setIsManualTraceClosed(false);
            setMetersPerPxOverride(null);
            if (rec.scaleDenom) setScaleDenom(rec.scaleDenom);
            setActiveTab('upload');
            setStatusMsg(`已從本機瀏覽器載入「${rec.name}」`);
        }
    };

    // ── Tab 2 邊界吸附計算（優先自動吸附道路邊緣 + 起點封閉 + 地號角點 + 深色地籍線 + 正交對齊） ──
    const computeUploadSnappedPoint = useCallback((rawX, rawY, shiftKey = false) => {
        if (!activePage) return { pt: { x: rawX, y: rawY }, snap: null };
        const snapR = Math.max(8, activePage.width * 0.015);
        const isRoadTracing = uploadTool === 'road_trace';
        const activeTraceList = isRoadTracing ? manualRoadTracePx : manualTracePx;

        // 1. 若已落點 >= 3 點且靠近起點 #1，優先吸附起點封閉
        if ((isRoadTracing || !isManualTraceClosed) && activeTraceList.length >= 3) {
            const p0 = activeTraceList[0];
            if (Math.hypot(rawX - p0.x, rawY - p0.y) <= snapR * 1.45) {
                return { pt: { x: p0.x, y: p0.y }, snap: { type: 'close', label: isRoadTracing ? '點擊起點 #1 封閉道路' : '點擊起點 #1 封閉基地' } };
            }
        }

        // 2. 當道路範圍已存在且正在框選基地時，優先將游標自動吸附至道路邊線與角點（即使吸附開關關閉也優先貼齊道路）
        if (!isRoadTracing && selectedRoadPolys.length > 0) {
            const roadSnap = snapPointToPolygonEdges({ x: rawX, y: rawY }, selectedRoadPolys, snapR * 1.5);
            if (roadSnap) {
                return { pt: roadSnap.pt, snap: { type: 'road', label: roadSnap.label } };
            }
        }

        if (edgeSnapEnabled) {
            // 3. 框選道路時優先吸附至已選基地邊線與角點；框選基地時吸附至既有地號
            const refPolys = isRoadTracing
                ? [...selectedUploadPolys, ...(manualTracePx.length >= 3 ? [{ label: '基地', pointsPx: manualTracePx }] : []), ...selectedRoadPolys]
                : [...selectedUploadPolys];
            const polySnap = snapPointToPolygonEdges({ x: rawX, y: rawY }, refPolys, snapR * 1.15);
            if (polySnap) {
                return { pt: polySnap.pt, snap: { type: 'vertex', label: polySnap.label } };
            }

            // 4. 吸附至圖面上的深色地籍線 / 紅藍界線像素
            if (hiddenCanvasRef.current) {
                const ctx = hiddenCanvasRef.current.getContext('2d', { willReadFrequently: true });
                const darkSnap = snapPixelToDarkEdge(ctx, rawX, rawY, activePage.width, activePage.height, Math.round(snapR));
                if (darkSnap) {
                    return { pt: darkSnap, snap: { type: 'edge', label: '吸附地籍邊界線' } };
                }
            }

            // 5. 與起點 #1 或上一點做水平/垂直正交輔助對齊
            if (activeTraceList.length > 0) {
                const refPts = [activeTraceList[0], activeTraceList[activeTraceList.length - 1]];
                let sx = rawX;
                let sy = rawY;
                let guide = null;
                if (shiftKey) {
                    const last = activeTraceList[activeTraceList.length - 1];
                    if (Math.abs(rawX - last.x) > Math.abs(rawY - last.y)) sy = last.y;
                    else sx = last.x;
                    guide = { type: 'ortho', label: '正交鎖定', refPt: last };
                } else {
                    for (const rp of refPts) {
                        if (Math.abs(rawX - rp.x) <= snapR * 0.65) {
                            sx = rp.x;
                            guide = { type: 'alignX', label: '垂直對齊', refPt: rp };
                            break;
                        }
                        if (Math.abs(rawY - rp.y) <= snapR * 0.65) {
                            sy = rp.y;
                            guide = { type: 'alignY', label: '水平對齊', refPt: rp };
                            break;
                        }
                    }
                }
                if (guide) return { pt: { x: sx, y: sy }, snap: guide };
            }
        }

        return { pt: { x: rawX, y: rawY }, snap: null };
    }, [activePage, uploadTool, isManualTraceClosed, manualTracePx, manualRoadTracePx, edgeSnapEnabled, selectedUploadPolys, selectedRoadPolys]);

    const handleUploadCanvasMove = (e) => {
        if (!activePage || !imgElementRef.current) return;
        if (uploadTool !== 'trace' && uploadTool !== 'road_trace' && uploadTool !== 'calibrate') {
            if (uploadCursorPx) setUploadCursorPx(null);
            return;
        }
        const rect = imgElementRef.current.getBoundingClientRect();
        const rawX = ((e.clientX - rect.left) / rect.width) * activePage.width;
        const rawY = ((e.clientY - rect.top) / rect.height) * activePage.height;
        const { pt, snap } = computeUploadSnappedPoint(rawX, rawY, e.shiftKey);
        setUploadCursorPx(pt);
        setUploadSnapInfo(snap);
    };

    // ── Tab 2 畫布點擊互動（魔術棒選地號可再點取消 / 道路點選與框選 / 點線框邊界吸附 / 校正比例尺） ──
    const handleUploadCanvasClick = (e) => {
        if (!activePage || !imgElementRef.current) return;
        const rect = imgElementRef.current.getBoundingClientRect();
        const rawX = ((e.clientX - rect.left) / rect.width) * activePage.width;
        const rawY = ((e.clientY - rect.top) / rect.height) * activePage.height;

        if (uploadTool === 'calibrate') {
            const { pt } = computeUploadSnappedPoint(rawX, rawY, e.shiftKey);
            if (calibPts.length >= 2) {
                setCalibPts([pt]);
            } else {
                const next = [...calibPts, pt];
                setCalibPts(next);
                if (next.length === 2) {
                    const distPx = Math.hypot(next[1].x - next[0].x, next[1].y - next[0].y);
                    const realM = parseFloat(calibRealM);
                    if (distPx > 2 && realM > 0) {
                        setMetersPerPxOverride(realM / distPx);
                        setStatusMsg(`比例尺校正完成：${distPx.toFixed(1)} px = ${realM} m`);
                    }
                }
            }
            return;
        }

        // 點線框選道路模式（點擊起點 #1 或按 Enter 封閉成道路多邊形，並自動讓基地吸附於道路邊緣）
        if (uploadTool === 'road_trace') {
            const { pt, snap } = computeUploadSnappedPoint(rawX, rawY, e.shiftKey);
            if (snap?.type === 'close' && manualRoadTracePx.length >= 3) {
                const wM = Math.max(2, parseFloat(roadWidthInputM) || 10);
                setSelectedRoadPolys(prev => [
                    ...prev,
                    { id: `road-trace-${Date.now()}`, label: `道路 #${prev.length + 1}`, pointsPx: manualRoadTracePx, widthM: wM }
                ]);
                setManualRoadTracePx([]);
                setStatusMsg(`已完成道路框選（路寬 ${wM}m），基地將自動吸附於此道路邊緣！`);
                return;
            }
            setManualRoadTracePx(prev => [...prev, pt]);
            return;
        }

        // 點線框選基地模式（含自動吸附道路邊緣與點擊起點封閉）
        if (uploadTool === 'trace') {
            const { pt, snap } = computeUploadSnappedPoint(rawX, rawY, e.shiftKey);
            if (isManualTraceClosed) {
                setIsManualTraceClosed(false);
                setManualTracePx([pt]);
                setStatusMsg('開始繪製新的點線框基地範圍（點擊起點 #1 或按 Enter 封閉）');
                return;
            }
            if (snap?.type === 'close' && manualTracePx.length >= 3) {
                setIsManualTraceClosed(true);
                setStatusMsg(`點線框選完成（共 ${manualTracePx.length} 個角點），可直接匯入至 3D 畫布！`);
                return;
            }
            setManualTracePx(prev => [...prev, pt]);
            return;
        }

        // 道路範圍點選模式（再點一次已選道路即可取消選取！）
        if (uploadTool === 'road_wand' && hiddenCanvasRef.current) {
            const hitRoadIdx = selectedRoadPolys.findIndex(rp => pointInPolygon({ x: rawX, y: rawY }, rp.pointsPx));
            if (hitRoadIdx !== -1) {
                const removed = selectedRoadPolys[hitRoadIdx];
                setSelectedRoadPolys(prev => prev.filter((_, idx) => idx !== hitRoadIdx));
                setStatusMsg(`已取消選取「${removed.label}」。`);
                return;
            }
            const ctx = hiddenCanvasRef.current.getContext('2d', { willReadFrequently: true });
            const imageData = ctx.getImageData(0, 0, activePage.width, activePage.height);
            const result = detectParcelPolygonAtPixel(imageData, rawX, rawY, wandTolerance);
            if (!result || result.error) {
                setStatusMsg(result?.error || '無法自動偵測道路區塊，請調整容差或點擊道路空白處。');
                return;
            }
            const wM = Math.max(2, parseFloat(roadWidthInputM) || 10);
            setSelectedRoadPolys(prev => [
                ...prev,
                {
                    id: `road-${Date.now()}`,
                    label: `道路 #${prev.length + 1}`,
                    pointsPx: result.points,
                    widthM: wM
                }
            ]);
            setStatusMsg(`已選取道路 #${selectedRoadPolys.length + 1}（再點一次可取消；匯入時將自動判定臨路邊）！`);
            return;
        }

        // 魔術棒選地號模式（再點一次已選地號即可取消選取！）
        if (uploadTool === 'wand' && hiddenCanvasRef.current) {
            const hitParcelIdx = selectedUploadPolys.findIndex(poly => pointInPolygon({ x: rawX, y: rawY }, poly.pointsPx));
            if (hitParcelIdx !== -1) {
                const removed = selectedUploadPolys[hitParcelIdx];
                setSelectedUploadPolys(prev => prev.filter((_, idx) => idx !== hitParcelIdx));
                setStatusMsg(`已取消選取「${removed.label}」。`);
                return;
            }
            const ctx = hiddenCanvasRef.current.getContext('2d', { willReadFrequently: true });
            const imageData = ctx.getImageData(0, 0, activePage.width, activePage.height);
            const result = detectParcelPolygonAtPixel(imageData, rawX, rawY, wandTolerance);
            if (!result || result.error) {
                setStatusMsg(result?.error || '無法偵測封閉區塊，請改點擊地號空白內部或切換「點線框選基地」。');
                return;
            }
            setSelectedUploadPolys(prev => [
                ...prev,
                {
                    id: `parcel-${Date.now()}`,
                    label: `地號 #${prev.length + 1}`,
                    pointsPx: result.points
                }
            ]);
            setStatusMsg(`已選取地號 #${selectedUploadPolys.length + 1}（再點一次可取消選取）！`);
        }
    };

    const activeUploadImportData = useMemo(() => {
        let rawSitePx = null;
        if (manualTracePx.length >= 3) {
            rawSitePx = manualTracePx;
        } else if (selectedUploadPolys.length > 0) {
            rawSitePx = selectedUploadPolys[selectedUploadPolys.length - 1].pointsPx;
        }
        if (!rawSitePx) return null;
        // 當道路範圍已存在時，自動將緊鄰道路的基地頂點吸附貼齊至道路邊緣，確保零縫隙重合
        const snappedSitePx = selectedRoadPolys.length > 0
            ? snapSitePolygonToRoadEdges(rawSitePx, selectedRoadPolys, Math.max(14, (activePage?.width || 1000) * 0.018))
            : rawSitePx;
        return pixelPolygonToSiteMeters(snappedSitePx, effectiveMetersPerPx);
    }, [manualTracePx, selectedUploadPolys, selectedRoadPolys, activePage, effectiveMetersPerPx]);

    // ── Tab 1: 台灣 NLSC 地籍圖磚計算與邊界吸附 ──
    const mapTiles = useMemo(() => {
        if (activeTab !== 'map') return [];
        const centerWorld = latLngToWorldPx(mapCenter.lat, mapCenter.lng, mapZoom);
        const halfW = mapViewportSize.w / 2;
        const halfH = mapViewportSize.h / 2;
        const minTileX = Math.floor((centerWorld.x - halfW) / 256);
        const maxTileX = Math.floor((centerWorld.x + halfW) / 256);
        const minTileY = Math.floor((centerWorld.y - halfH) / 256);
        const maxTileY = Math.floor((centerWorld.y + halfH) / 256);
        const tiles = [];
        for (let tx = minTileX; tx <= maxTileX; tx++) {
            for (let ty = minTileY; ty <= maxTileY; ty++) {
                tiles.push({
                    tx,
                    ty,
                    left: tx * 256 - (centerWorld.x - halfW),
                    top: ty * 256 - (centerWorld.y - halfH)
                });
            }
        }
        return tiles;
    }, [activeTab, mapCenter, mapZoom, mapViewportSize]);

    const handleSearchAddress = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setStatusMsg(`正在定位「${searchQuery}」...`);
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=tw&limit=1&q=${encodeURIComponent(searchQuery.trim())}`;
            const res = await fetch(url);
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                setMapCenter({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
                setMapZoom(18);
                setStatusMsg(`已定位至：${data[0].display_name.split(',')[0]}`);
            } else {
                setStatusMsg('找不到該地址或路名，請嘗試輸入完整「縣市＋路名」。');
            }
        } catch {
            setStatusMsg('定位服務暫時無法連線，您可直接拖曳地圖或使用快速定位按鈕。');
        } finally {
            setIsSearching(false);
        }
    };

    const mapTracedSiteData = useMemo(() => {
        if (mapTracedLatLngs.length < 3) return null;
        const mPerPx = getMetersPerPixelAtLatZoom(mapCenter.lat, mapZoom);
        let pxPts = mapTracedLatLngs.map(ll => latLngToWorldPx(ll.lat, ll.lng, mapZoom));
        // 若已標記道路範圍，基地自動吸附貼齊於道路邊線
        if (mapRoadLatLngs.length >= 2) {
            const roadPx = mapRoadLatLngs.map(ll => latLngToWorldPx(ll.lat, ll.lng, mapZoom));
            pxPts = snapSitePolygonToRoadEdges(pxPts, [{ pointsPx: roadPx }], 20);
        }
        return pixelPolygonToSiteMeters(pxPts, mPerPx);
    }, [mapTracedLatLngs, mapRoadLatLngs, mapCenter.lat, mapZoom]);

    // 計算即時地圖上的點線框吸附座標 (螢幕像素：當道路存在時，基地自動吸附至道路邊線與角點)
    const getMapSnappedScreenPt = (rawSx, rawSy, shiftKey = false) => {
        const cw = latLngToWorldPx(mapCenter.lat, mapCenter.lng, mapZoom);
        const toScreen = (ll) => {
            const wp = latLngToWorldPx(ll.lat, ll.lng, mapZoom);
            return { x: wp.x - cw.x + mapViewportSize.w / 2, y: wp.y - cw.y + mapViewportSize.h / 2 };
        };
        const activeList = mapPickMode === 'road_trace' ? mapRoadLatLngs : mapTracedLatLngs;
        const screenPts = activeList.map(toScreen);
        const otherPts = (mapPickMode === 'road_trace' ? mapTracedLatLngs : mapRoadLatLngs).map(toScreen);

        if (screenPts.length >= 3) {
            if (Math.hypot(rawSx - screenPts[0].x, rawSy - screenPts[0].y) <= 14) {
                return { pt: screenPts[0], snap: { type: 'close', label: '吸附起點 #1 封閉' } };
            }
        }
        // 當道路已存在且正在框選基地時，強制優先吸附道路邊緣與角點
        if (mapPickMode === 'trace' && otherPts.length >= 2) {
            const roadEdgeSnap = snapPointToPolygonEdges({ x: rawSx, y: rawSy }, [{ label: '道路', pointsPx: otherPts }], 18);
            if (roadEdgeSnap) {
                return { pt: roadEdgeSnap.pt, snap: { type: 'road', label: roadEdgeSnap.label } };
            }
        }
        if (edgeSnapEnabled) {
            if (otherPts.length >= 2) {
                const otherSnap = snapPointToPolygonEdges({ x: rawSx, y: rawSy }, [{ label: '基地', pointsPx: otherPts }], 14);
                if (otherSnap) {
                    return { pt: otherSnap.pt, snap: { type: 'vertex', label: otherSnap.label } };
                }
            }
            if (screenPts.length > 0) {
                const last = screenPts[screenPts.length - 1];
                if (shiftKey) {
                    const sx = Math.abs(rawSx - last.x) > Math.abs(rawSy - last.y) ? rawSx : last.x;
                    const sy = Math.abs(rawSx - last.x) > Math.abs(rawSy - last.y) ? last.y : rawSy;
                    return { pt: { x: sx, y: sy }, snap: { type: 'ortho', label: '正交鎖定' } };
                }
                if (Math.abs(rawSx - screenPts[0].x) <= 9) {
                    return { pt: { x: screenPts[0].x, y: rawSy }, snap: { type: 'alignX', label: '對齊起點 X 軸' } };
                }
                if (Math.abs(rawSy - screenPts[0].y) <= 9) {
                    return { pt: { x: rawSx, y: screenPts[0].y }, snap: { type: 'alignY', label: '對齊起點 Y 軸' } };
                }
            }
        }
        return { pt: { x: rawSx, y: rawSy }, snap: null };
    };

    // 計算當前分頁選取中的原始基地多邊形，並即時套用「匯入前邊長預先設定」推演結果
    const currentRawSiteData = useMemo(() => {
        if (activeTab === 'upload') return activeUploadImportData;
        if (activeTab === 'map') return mapTracedSiteData;
        if (activeTab === 'dxf') {
            const pickedDxf = dxfParcels.find(p => selectedDxfIds.has(p.id));
            if (pickedDxf) {
                const c = getPolygonCentroid(pickedDxf.points);
                const centeredPts = pickedDxf.points.map(p => ({
                    x: parseFloat((p.x - c.x).toFixed(3)),
                    y: parseFloat((p.y - c.y).toFixed(3))
                }));
                return { points: centeredPts, orderedPx: pickedDxf.points, centroidPx: c, areaSqm: pickedDxf.areaSqm, label: pickedDxf.label };
            }
            const pickedTwd = twd97Parcels.find(p => p.id === selectedTwd97Id);
            if (pickedTwd) {
                return { points: pickedTwd.points, orderedPx: pickedTwd.points, centroidPx: { x: 0, y: 0 }, areaSqm: pickedTwd.areaSqm, label: pickedTwd.label };
            }
        }
        return null;
    }, [activeTab, activeUploadImportData, mapTracedSiteData, dxfParcels, selectedDxfIds, twd97Parcels, selectedTwd97Id]);

    const solvedSiteData = useMemo(() => {
        if (!currentRawSiteData?.points || currentRawSiteData.points.length < 3) return null;
        return solvePolygonWithEdgeLengths(currentRawSiteData.points, edgeLengthOverrides);
    }, [currentRawSiteData, edgeLengthOverrides]);

    // 當多邊形頂點數改變或切換分頁時，清除過期的邊長覆寫值
    const rawVertexCount = currentRawSiteData?.points?.length || 0;
    useEffect(() => {
        setEdgeLengthOverrides({});
    }, [activeTab, rawVertexCount]);

    // ── 執行匯入基地（含邊長推演、100% 精準對齊底圖、以及原形狀道路多邊形與預設路寬！） ──
    const handleConfirmImport = () => {
        if (!currentRawSiteData || !solvedSiteData || solvedSiteData.points.length < 3) {
            setStatusMsg('請先選取或框選一個至少 3 個角點的基地範圍。');
            return;
        }
        const scaleFactor = solvedSiteData.scaleFactor || 1;
        const roadWidthM = Math.max(2, parseFloat(roadWidthInputM) || 10);

        if (activeTab === 'upload') {
            const finalMetersPerPx = effectiveMetersPerPx * scaleFactor;
            const centroidPx = currentRawSiteData.centroidPx;
            const detectedFrontageIndices = selectedRoadPolys.length > 0
                ? detectFrontageEdgesFromRoads(currentRawSiteData.orderedPx, selectedRoadPolys, Math.max(14, (activePage?.width || 1000) * 0.018))
                : [];
            const firstRoadWidth = selectedRoadPolys[0]?.widthM || roadWidthM;
            const detectedRoad = detectedFrontageIndices.length > 0
                ? { edgeIndices: detectedFrontageIndices, width: firstRoadWidth, name: '面前道路' }
                : null;

            // 將點選的每一條道路多邊形依完全相同的 centroidPx 與 finalMetersPerPx 轉為基地局部公尺座標，如實呈現原道路形狀
            const importedRoadPolygons = selectedRoadPolys.map(rp => ({
                id: rp.id,
                label: rp.label,
                widthM: rp.widthM || roadWidthM,
                points: rp.pointsPx.map(p => ({
                    x: parseFloat(((p.x - centroidPx.x) * finalMetersPerPx).toFixed(3)),
                    y: parseFloat(((p.y - centroidPx.y) * finalMetersPerPx).toFixed(3))
                }))
            }));

            // 以精確 anchorXM / anchorYM (原點對齊 centroidPx) 與 finalMetersPerPx 建立 100% 重合底圖
            const underlay = keepAsUnderlay && activePage
                ? {
                    dataUrl: activePage.dataUrl,
                    widthM: activePage.width * finalMetersPerPx,
                    heightM: activePage.height * finalMetersPerPx,
                    anchorXM: centroidPx.x * finalMetersPerPx,
                    anchorYM: centroidPx.y * finalMetersPerPx,
                    opacity: 0.65,
                    visible: true,
                    title: uploadedTitle || '地籍圖底圖'
                }
                : null;

            onImportSite({
                points: solvedSiteData.points,
                mode: importTargetMode,
                label: uploadedTitle || '匯入地籍基地',
                underlay,
                detectedRoad,
                importedRoadPolygons
            });
            onClose();
            return;
        }

        if (activeTab === 'map') {
            const mPerPx = getMetersPerPixelAtLatZoom(mapCenter.lat, mapZoom) * scaleFactor;
            const centroidPx = currentRawSiteData.centroidPx;
            let detectedRoad = null;
            let importedRoadPolygons = [];
            if (mapRoadLatLngs.length >= 2) {
                const roadPx = mapRoadLatLngs.map(ll => latLngToWorldPx(ll.lat, ll.lng, mapZoom));
                const fIndices = detectFrontageEdgesFromRoads(currentRawSiteData.orderedPx, [{ pointsPx: roadPx }], 22);
                if (fIndices.length > 0) {
                    detectedRoad = { edgeIndices: fIndices, width: roadWidthM, name: searchQuery.trim() || '面前道路' };
                }
                if (roadPx.length >= 3) {
                    importedRoadPolygons = [{
                        id: `map-road-${Date.now()}`,
                        label: searchQuery.trim() || '面前道路',
                        widthM: roadWidthM,
                        points: roadPx.map(p => ({
                            x: parseFloat(((p.x - centroidPx.x) * mPerPx).toFixed(3)),
                            y: parseFloat(((p.y - centroidPx.y) * mPerPx).toFixed(3))
                        }))
                    }];
                }
            }
            onImportSite({
                points: solvedSiteData.points,
                mode: importTargetMode,
                label: searchQuery.trim() || '台灣地籍選取基地',
                underlay: null,
                detectedRoad,
                importedRoadPolygons
            });
            onClose();
            return;
        }

        if (activeTab === 'dxf') {
            const pickedDxf = dxfParcels.find(p => selectedDxfIds.has(p.id));
            if (pickedDxf) {
                const c = currentRawSiteData.centroidPx;
                let detectedRoad = null;
                const roadDxfPolys = dxfParcels.filter(p => selectedDxfRoadIds.has(p.id));
                if (roadDxfPolys.length > 0) {
                    const fIndices = detectFrontageEdgesFromRoads(pickedDxf.points, roadDxfPolys.map(r => ({ pointsPx: r.points })), 1.8);
                    if (fIndices.length > 0) {
                        detectedRoad = { edgeIndices: fIndices, width: roadWidthM, name: '面前道路' };
                    }
                }
                const importedRoadPolygons = roadDxfPolys.map((rp, idx) => ({
                    id: rp.id,
                    label: rp.label || `道路 #${idx + 1}`,
                    widthM: roadWidthM,
                    points: rp.points.map(p => ({
                        x: parseFloat(((p.x - c.x) * scaleFactor).toFixed(3)),
                        y: parseFloat(((p.y - c.y) * scaleFactor).toFixed(3))
                    }))
                }));
                onImportSite({
                    points: solvedSiteData.points,
                    mode: importTargetMode,
                    label: pickedDxf.label,
                    underlay: null,
                    detectedRoad,
                    importedRoadPolygons
                });
                onClose();
                return;
            }
            const pickedTwd = twd97Parcels.find(p => p.id === selectedTwd97Id);
            if (pickedTwd) {
                onImportSite({
                    points: solvedSiteData.points,
                    mode: importTargetMode,
                    label: pickedTwd.label,
                    underlay: null,
                    importedRoadPolygons: []
                });
                onClose();
                return;
            }
        }
    };

    if (!isOpen) return null;

    const dxfBounds = (() => {
        if (dxfParcels.length === 0) return { minX: -20, minY: -20, w: 40, h: 40 };
        const allPts = dxfParcels.flatMap(p => p.points);
        const b = getPolygonBounds(allPts);
        if (!b) return { minX: -20, minY: -20, w: 40, h: 40 };
        const pad = Math.max(4, Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.12);
        return {
            minX: b.minX - pad,
            minY: b.minY - pad,
            w: (b.maxX - b.minX) + pad * 2,
            h: (b.maxY - b.minY) + pad * 2
        };
    })();

    return (
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-3 sm:p-5 no-context-menu font-['GenYoGothic',_sans-serif]"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* 與全站一致之建築製圖 Neo-Brutalist 白底黑框風格 */}
            <div
                className="bg-[#f5f4f0] text-black border-2 border-black shadow-[8px_8px_0_#000] w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden rounded-none"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 頂部標題列：清爽白底 + 黑框 + 本機隱私標籤 */}
                <div className="px-4 py-2.5 bg-white border-b-2 border-black flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-black text-white flex items-center justify-center border-2 border-black shadow-[2px_2px_0_#000]">
                            <MapIcon size={17} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="font-black text-sm sm:text-base tracking-tight flex flex-wrap items-center gap-2">
                                <span>台灣地籍圖與圖檔匯入（選地號／道路）</span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-50 text-emerald-800 border border-black px-2 py-0.5">
                                    <ShieldCheck size={12} /> 100% 僅存本機瀏覽器
                                </span>
                            </h2>
                            <p className="text-[11px] text-stone-500 font-bold">
                                點選地號／道路（再點可取消）或以點線框＋邊界吸附快速建立基地
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <a
                            href="https://dxfast.four-get.com/"
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 bg-white hover:bg-stone-100 text-black border-2 border-black shadow-[2px_2px_0_#000] text-[11px] font-black flex items-center gap-1 transition-all"
                            title="於新分頁開啟 DXFast 匯出台灣地籍 DXF 檔"
                        >
                            <ExternalLink size={12} />
                            <span>DXFast</span>
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 bg-white hover:bg-black hover:text-white text-black border-2 border-black flex items-center justify-center transition-colors"
                        >
                            <X size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* 分頁與匯入目標列 */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-[#eceae3] border-b-2 border-black">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setActiveTab('upload')}
                            className={`px-3 py-1.5 text-xs font-black border-2 border-black flex items-center gap-1.5 transition-all ${
                                activeTab === 'upload'
                                    ? 'bg-black text-white shadow-[2px_2px_0_#000]'
                                    : 'bg-white text-black hover:bg-stone-100'
                            }`}
                        >
                            <Upload size={14} />
                            <span>上傳地籍 PDF / 圖片</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('map')}
                            className={`px-3 py-1.5 text-xs font-black border-2 border-black flex items-center gap-1.5 transition-all ${
                                activeTab === 'map'
                                    ? 'bg-black text-white shadow-[2px_2px_0_#000]'
                                    : 'bg-white text-black hover:bg-stone-100'
                            }`}
                        >
                            <MapIcon size={14} />
                            <span>台灣即時地籍圖 (NLSC)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('dxf')}
                            className={`px-3 py-1.5 text-xs font-black border-2 border-black flex items-center gap-1.5 transition-all ${
                                activeTab === 'dxf'
                                    ? 'bg-black text-white shadow-[2px_2px_0_#000]'
                                    : 'bg-white text-black hover:bg-stone-100'
                            }`}
                        >
                            <FileCode2 size={14} />
                            <span>DXF / TWD97 界址坐標</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-black text-stone-600">匯入目標：</span>
                        <button
                            type="button"
                            onClick={() => setImportTargetMode('current')}
                            className={`px-2.5 py-1 border-2 border-black font-black ${importTargetMode === 'current' ? 'bg-black text-white' : 'bg-white text-black hover:bg-stone-100'}`}
                        >
                            目前基地
                        </button>
                        <button
                            type="button"
                            onClick={() => setImportTargetMode('new')}
                            className={`px-2.5 py-1 border-2 border-black font-black ${importTargetMode === 'new' ? 'bg-black text-white' : 'bg-white text-black hover:bg-stone-100'}`}
                        >
                            + 新增基地 {nextSiteLabel}
                        </button>
                    </div>
                </div>

                {/* 主內容區 */}
                <div className="flex-1 overflow-y-auto p-3.5 bg-[#f5f4f0] flex flex-col gap-3">
                    <canvas ref={hiddenCanvasRef} className="hidden" />

                    {/* ================= TAB 1: 上傳地籍圖 PDF / 圖片 ================= */}
                    {activeTab === 'upload' && (
                        <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-[440px]">
                            {/* 左側工具與本機快取欄 */}
                            <div className="w-full lg:w-64 flex flex-col gap-2.5 shrink-0">
                                <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-black bg-white hover:bg-stone-100 cursor-pointer transition-colors text-center shadow-[3px_3px_0_#000]">
                                    <Upload size={18} className="text-black mb-1" />
                                    <span className="text-xs font-black">上傳地籍 PDF / 圖片 / DXF</span>
                                    <span className="text-[10px] text-stone-500 mt-0.5 font-bold">謄本 PDF、都計圖 JPG / PNG</span>
                                    <input
                                        type="file"
                                        accept=".pdf,.png,.jpg,.jpeg,.webp,.dxf"
                                        className="hidden"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) handleFileUpload(f);
                                            e.target.value = '';
                                        }}
                                    />
                                </label>

                                {/* 畫布選取工具群組 */}
                                <div className="p-2.5 bg-white border-2 border-black shadow-[3px_3px_0_#000] space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">選取與繪製工具</span>
                                        <button
                                            type="button"
                                            onClick={() => setEdgeSnapEnabled(s => !s)}
                                            className={`px-1.5 py-0.5 text-[10px] font-black border border-black flex items-center gap-1 ${
                                                edgeSnapEnabled ? 'bg-amber-300 text-black' : 'bg-stone-100 text-stone-500'
                                            }`}
                                            title="點線框選時自動吸附地籍邊界線與角點"
                                        >
                                            <Magnet size={10} />
                                            <span>吸附 {edgeSnapEnabled ? 'ON' : 'OFF'}</span>
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setUploadTool('wand')}
                                            className={`px-2.5 py-1.5 text-xs font-black border-2 border-black flex items-center justify-between ${
                                                uploadTool === 'wand' ? 'bg-black text-white' : 'bg-white hover:bg-stone-100'
                                            }`}
                                        >
                                            <span className="flex items-center gap-1.5"><Wand2 size={14} /> 點選地號（再點取消）</span>
                                            {selectedUploadPolys.length > 0 && (
                                                <span className="px-1 text-[10px] bg-emerald-500 text-black font-mono">{selectedUploadPolys.length}</span>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setUploadTool('road_wand')}
                                            className={`px-2.5 py-1.5 text-xs font-black border-2 border-black flex items-center justify-between ${
                                                uploadTool === 'road_wand' ? 'bg-amber-500 text-white' : 'bg-white hover:bg-amber-50'
                                            }`}
                                        >
                                            <span className="flex items-center gap-1.5"><Route size={14} /> 點選道路（魔術棒）</span>
                                            {selectedRoadPolys.length > 0 && (
                                                <span className="px-1 text-[10px] bg-black text-white font-mono">{selectedRoadPolys.length}</span>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setUploadTool('road_trace')}
                                            className={`px-2.5 py-1.5 text-xs font-black border-2 border-black flex items-center justify-between ${
                                                uploadTool === 'road_trace' ? 'bg-amber-600 text-white' : 'bg-white hover:bg-amber-50'
                                            }`}
                                        >
                                            <span className="flex items-center gap-1.5"><Route size={14} /> 點線框選道路（吸附）</span>
                                            {manualRoadTracePx.length > 0 && (
                                                <span className="px-1 text-[10px] bg-white text-black font-mono">{manualRoadTracePx.length}</span>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setUploadTool('trace')}
                                            className={`px-2.5 py-1.5 text-xs font-black border-2 border-black flex items-center justify-between ${
                                                uploadTool === 'trace' ? 'bg-indigo-600 text-white' : 'bg-white hover:bg-indigo-50'
                                            }`}
                                        >
                                            <span className="flex items-center gap-1.5"><Pencil size={14} /> 點線框選基地（吸附）</span>
                                            {manualTracePx.length > 0 && (
                                                <span className="px-1 text-[10px] bg-white text-black font-mono">{manualTracePx.length}</span>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setUploadTool('calibrate'); setCalibPts([]); }}
                                            className={`px-2.5 py-1.5 text-xs font-black border-2 border-black flex items-center gap-1.5 ${
                                                uploadTool === 'calibrate' ? 'bg-sky-600 text-white' : 'bg-white hover:bg-sky-50'
                                            }`}
                                        >
                                            <Ruler size={14} />
                                            <span>兩點量測校正比例尺</span>
                                        </button>
                                    </div>

                                    {(uploadTool === 'wand' || uploadTool === 'road_wand') && (
                                        <div className="pt-1.5 border-t border-stone-200 space-y-1.5">
                                            <div>
                                                <div className="flex justify-between text-[10px] font-black text-stone-600">
                                                    <span>魔術棒邊線容差</span>
                                                    <span className="font-mono">{wandTolerance}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="12"
                                                    max="75"
                                                    value={wandTolerance}
                                                    onChange={(e) => setWandTolerance(parseInt(e.target.value, 10))}
                                                    className="w-full accent-black"
                                                />
                                            </div>
                                            {uploadTool === 'road_wand' && (
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[10px] font-black text-amber-800">預設道路寬度</span>
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            step="1"
                                                            value={roadWidthInputM}
                                                            onChange={(e) => setRoadWidthInputM(e.target.value)}
                                                            className="w-14 px-1.5 py-0.5 text-xs font-mono font-black border border-black text-right"
                                                        />
                                                        <span className="text-[10px] font-black">m</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {uploadTool === 'calibrate' && (
                                        <div className="pt-1.5 border-t border-stone-200 space-y-1">
                                            <label className="text-[10px] font-black text-sky-800 block">兩點實際距離 (m)</label>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={calibRealM}
                                                    onChange={(e) => setCalibRealM(e.target.value)}
                                                    className="w-full px-2 py-1 text-xs font-mono font-black border-2 border-black"
                                                />
                                                <span className="text-xs font-black">m</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 比例尺與底圖設定 */}
                                <div className="p-2.5 bg-white border-2 border-black shadow-[3px_3px_0_#000] space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-stone-500 uppercase">圖面比例尺 (A4)</span>
                                        {metersPerPxOverride && (
                                            <button type="button" onClick={() => setMetersPerPxOverride(null)} className="text-[10px] text-rose-600 font-black underline">
                                                重設
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-4 gap-1">
                                        {[500, 600, 1000, 1200].map(d => (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => { setMetersPerPxOverride(null); setScaleDenom(d); }}
                                                className={`py-1 text-[10px] font-mono font-black border border-black ${
                                                    !metersPerPxOverride && scaleDenom === d ? 'bg-black text-white' : 'bg-white hover:bg-stone-100'
                                                }`}
                                            >
                                                1/{d}
                                            </button>
                                        ))}
                                    </div>
                                    <label className="flex items-center gap-1.5 text-[11px] font-bold pt-1 border-t border-stone-200 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={keepAsUnderlay}
                                            onChange={(e) => setKeepAsUnderlay(e.target.checked)}
                                            className="w-3.5 h-3.5 accent-black"
                                        />
                                        <span>保留為 3D 畫布半透明底圖</span>
                                    </label>
                                </div>

                                {/* 本機暫存檔案列表 */}
                                <div className="p-2.5 bg-white border-2 border-black shadow-[3px_3px_0_#000] space-y-1.5 flex-1 overflow-y-auto max-h-36">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-stone-600 flex items-center gap-1">
                                            <FolderOpen size={12} /> 本機暫存 ({localFiles.length})
                                        </span>
                                        {localFiles.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    await cadastralLocalDB.clearAll();
                                                    await refreshLocalFiles();
                                                    setStatusMsg('已清除全部本機暫存檔案。');
                                                }}
                                                className="text-[10px] font-black text-red-600 hover:underline"
                                            >
                                                全部清除
                                            </button>
                                        )}
                                    </div>
                                    {localFiles.length === 0 ? (
                                        <p className="text-[10px] text-stone-400 font-bold">檔案僅存於本機瀏覽器</p>
                                    ) : (
                                        localFiles.map(rec => (
                                            <div key={rec.id} className="flex items-center justify-between gap-1 text-[10px] bg-stone-50 border border-black/30 px-1.5 py-1">
                                                <button type="button" onClick={() => handleLoadLocalRecord(rec)} className="truncate font-bold text-left hover:underline flex-1" title={rec.name}>
                                                    {rec.kind === 'pdf' ? '📄' : rec.kind === 'dxf' ? '📐' : '🖼️'} {rec.name}
                                                </button>
                                                <button type="button" onClick={async () => { await cadastralLocalDB.deleteFile(rec.id); await refreshLocalFiles(); }} className="text-stone-400 hover:text-red-600">
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* 右側製圖桌風格互動畫布 */}
                            <div className="flex-1 bg-[#e8e6df] border-2 border-black shadow-[4px_4px_0_#000] flex flex-col overflow-hidden min-h-[380px]">
                                <div className="px-3 py-1.5 bg-white text-black border-b-2 border-black flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black truncate max-w-[200px]">{uploadedTitle || '請先上傳地籍圖 PDF 或圖片'}</span>
                                        {uploadedPages.length > 1 && (
                                            <div className="flex items-center gap-1">
                                                {uploadedPages.map((pg, idx) => (
                                                    <button
                                                        key={pg.pageNum}
                                                        type="button"
                                                        onClick={() => { setCurrentPageIdx(idx); setSelectedUploadPolys([]); setSelectedRoadPolys([]); setManualTracePx([]); setIsManualTraceClosed(false); }}
                                                        className={`px-1.5 py-0.5 text-[10px] font-black border border-black ${
                                                            currentPageIdx === idx ? 'bg-black text-white' : 'bg-white text-black hover:bg-stone-100'
                                                        }`}
                                                    >
                                                        第 {pg.pageNum} 頁
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button type="button" onClick={() => setUploadZoom(z => Math.max(0.5, z - 0.25))} className="p-1 bg-white hover:bg-stone-100 border border-black"><ZoomOut size={12} /></button>
                                        <span className="font-mono text-[10px] font-black w-10 text-center">{Math.round(uploadZoom * 100)}%</span>
                                        <button type="button" onClick={() => setUploadZoom(z => Math.min(3.5, z + 0.25))} className="p-1 bg-white hover:bg-stone-100 border border-black"><ZoomIn size={12} /></button>
                                        {(uploadTool === 'trace' && manualTracePx.length > 0) || (uploadTool === 'road_trace' && manualRoadTracePx.length > 0) ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (uploadTool === 'road_trace') setManualRoadTracePx(prev => prev.slice(0, -1));
                                                    else { setIsManualTraceClosed(false); setManualTracePx(prev => prev.slice(0, -1)); }
                                                }}
                                                className="px-2 py-0.5 bg-white hover:bg-stone-100 border border-black text-[10px] font-black flex items-center gap-1"
                                            >
                                                <Undo2 size={11} /> 退回一點
                                            </button>
                                        ) : null}
                                        {(selectedUploadPolys.length > 0 || selectedRoadPolys.length > 0 || manualTracePx.length > 0 || manualRoadTracePx.length > 0) && (
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedUploadPolys([]); setSelectedRoadPolys([]); setManualTracePx([]); setManualRoadTracePx([]); setIsManualTraceClosed(false); }}
                                                className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white border border-black text-[10px] font-black flex items-center gap-1"
                                            >
                                                <RotateCcw size={11} /> 清除全部
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-auto flex items-center justify-center p-3">
                                    {isProcessingFile ? (
                                        <div className="text-black text-xs font-black animate-pulse bg-white px-4 py-2 border-2 border-black shadow-[3px_3px_0_#000]">
                                            正在於本機渲染高解析地籍圖...
                                        </div>
                                    ) : !activePage ? (
                                        <div className="bg-white border-2 border-black shadow-[4px_4px_0_#000] p-6 text-center space-y-2 max-w-sm">
                                            <FileText size={32} className="mx-auto text-black" />
                                            <div className="font-black text-sm">上傳台灣地籍圖謄本 PDF 或都計圖圖片</div>
                                            <p className="text-xs text-stone-600 font-medium leading-relaxed">
                                                上傳後可使用「🪄 點選地號」、「🛣️ 點選道路範圍」（再點一次即可取消），或切換「✏️ 點線框選基地」自動吸附地籍邊界線！
                                            </p>
                                        </div>
                                    ) : (
                                        <div
                                            className={`relative inline-block border-2 border-black shadow-[5px_5px_0_rgba(0,0,0,0.2)] bg-white ${
                                                uploadTool === 'trace' ? 'cursor-crosshair' : 'cursor-pointer'
                                            }`}
                                            style={{ width: `${Math.round(620 * uploadZoom)}px`, maxWidth: 'none' }}
                                            onMouseMove={handleUploadCanvasMove}
                                            onMouseLeave={() => { setUploadCursorPx(null); setUploadSnapInfo(null); }}
                                            onClick={handleUploadCanvasClick}
                                        >
                                            <img
                                                ref={imgElementRef}
                                                src={activePage.dataUrl}
                                                alt="Cadastral Upload"
                                                className="w-full h-auto block select-none pointer-events-none"
                                            />
                                            <svg
                                                viewBox={`0 0 ${activePage.width} ${activePage.height}`}
                                                className="absolute inset-0 w-full h-full pointer-events-none"
                                            >
                                                <defs>
                                                    <pattern id="cadastral-road-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                                        <rect width="14" height="14" fill="rgba(245, 158, 11, 0.28)" />
                                                        <line x1="0" y1="0" x2="0" y2="14" stroke="rgba(217, 119, 6, 0.72)" strokeWidth="4" />
                                                    </pattern>
                                                </defs>

                                                {/* 魔術棒偵測之道路範圍 (橘黃斜線標示，再點一次可取消) */}
                                                {selectedRoadPolys.map(rp => {
                                                    const d = rp.pointsPx.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
                                                    const c = getPolygonCentroid(rp.pointsPx);
                                                    return (
                                                        <g key={rp.id}>
                                                            <path d={d} fill="url(#cadastral-road-hatch)" stroke="#d97706" strokeWidth={Math.max(2, activePage.width * 0.003)} strokeDasharray="8,4" />
                                                            <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(12, activePage.width * 0.015)} fontWeight="900" fill="#92400e">
                                                                {rp.label} ({rp.widthM}m)
                                                            </text>
                                                        </g>
                                                    );
                                                })}

                                                {/* 魔術棒偵測之地號多邊形 (翠綠實線標示，含各邊編號 #0..#n 方便對應下方定尺) */}
                                                {selectedUploadPolys.map(poly => {
                                                    const d = poly.pointsPx.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
                                                    return (
                                                        <g key={poly.id}>
                                                            <path d={d} fill="rgba(16, 185, 129, 0.34)" stroke="#059669" strokeWidth={Math.max(2.2, activePage.width * 0.0032)} />
                                                            {poly.pointsPx.map((p, pi) => {
                                                                const np = poly.pointsPx[(pi + 1) % poly.pointsPx.length];
                                                                const mx = (p.x + np.x) / 2;
                                                                const my = (p.y + np.y) / 2;
                                                                return (
                                                                    <g key={pi}>
                                                                        <circle cx={p.x} cy={p.y} r={Math.max(3, activePage.width * 0.004)} fill="#ffffff" stroke="#059669" strokeWidth="2" />
                                                                        <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(10, activePage.width * 0.013)} fontWeight="900" fill="#064e3b" stroke="#ffffff" strokeWidth={Math.max(2, activePage.width * 0.003)} paintOrder="stroke">
                                                                            #{pi}
                                                                        </text>
                                                                    </g>
                                                                );
                                                            })}
                                                        </g>
                                                    );
                                                })}

                                                {/* 點線框選基地 (含即時虛線預覽、邊長標示與邊界吸附準星) */}
                                                {manualTracePx.length > 0 && (
                                                    <g>
                                                        <path
                                                            d={manualTracePx.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (isManualTraceClosed ? ' Z' : '')}
                                                            fill={isManualTraceClosed ? 'rgba(79, 70, 229, 0.28)' : 'none'}
                                                            stroke="#4f46e5"
                                                            strokeWidth={Math.max(2.2, activePage.width * 0.0032)}
                                                            strokeDasharray={isManualTraceClosed ? 'none' : '8,5'}
                                                        />
                                                        {!isManualTraceClosed && uploadCursorPx && uploadTool === 'trace' && (
                                                            <>
                                                                {/* 最後一點到游標之動態點線預覽 */}
                                                                <line
                                                                    x1={manualTracePx[manualTracePx.length - 1].x}
                                                                    y1={manualTracePx[manualTracePx.length - 1].y}
                                                                    x2={uploadCursorPx.x}
                                                                    y2={uploadCursorPx.y}
                                                                    stroke="#4f46e5"
                                                                    strokeWidth={Math.max(2, activePage.width * 0.0028)}
                                                                    strokeDasharray="6,4"
                                                                />
                                                                {/* 游標回起點之封閉預覽虛線 */}
                                                                {manualTracePx.length >= 2 && (
                                                                    <line
                                                                        x1={uploadCursorPx.x}
                                                                        y1={uploadCursorPx.y}
                                                                        x2={manualTracePx[0].x}
                                                                        y2={manualTracePx[0].y}
                                                                        stroke="#6366f1"
                                                                        strokeWidth={Math.max(1.4, activePage.width * 0.002)}
                                                                        strokeDasharray="4,5"
                                                                        opacity="0.65"
                                                                    />
                                                                )}
                                                            </>
                                                        )}
                                                        {manualTracePx.map((p, pi) => (
                                                            <circle
                                                                key={pi}
                                                                cx={p.x}
                                                                cy={p.y}
                                                                r={Math.max(4, activePage.width * 0.005)}
                                                                fill={pi === 0 ? '#10b981' : '#ffffff'}
                                                                stroke={pi === 0 ? '#065f46' : '#4f46e5'}
                                                                strokeWidth="2.2"
                                                            />
                                                        ))}
                                                    </g>
                                                )}

                                                {/* 點線框選道路進行中（橘色動態虛線預覽） */}
                                                {manualRoadTracePx.length > 0 && (
                                                    <g>
                                                        <path
                                                            d={manualRoadTracePx.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                                                            fill="rgba(245, 158, 11, 0.22)"
                                                            stroke="#d97706"
                                                            strokeWidth={Math.max(2.2, activePage.width * 0.0032)}
                                                            strokeDasharray="8,5"
                                                        />
                                                        {uploadCursorPx && uploadTool === 'road_trace' && (
                                                            <>
                                                                <line
                                                                    x1={manualRoadTracePx[manualRoadTracePx.length - 1].x}
                                                                    y1={manualRoadTracePx[manualRoadTracePx.length - 1].y}
                                                                    x2={uploadCursorPx.x}
                                                                    y2={uploadCursorPx.y}
                                                                    stroke="#d97706"
                                                                    strokeWidth={Math.max(2, activePage.width * 0.0028)}
                                                                    strokeDasharray="6,4"
                                                                />
                                                                {manualRoadTracePx.length >= 2 && (
                                                                    <line
                                                                        x1={uploadCursorPx.x}
                                                                        y1={uploadCursorPx.y}
                                                                        x2={manualRoadTracePx[0].x}
                                                                        y2={manualRoadTracePx[0].y}
                                                                        stroke="#f59e0b"
                                                                        strokeWidth={Math.max(1.4, activePage.width * 0.002)}
                                                                        strokeDasharray="4,5"
                                                                        opacity="0.7"
                                                                    />
                                                                )}
                                                            </>
                                                        )}
                                                        {manualRoadTracePx.map((p, pi) => (
                                                            <circle
                                                                key={`rt-${pi}`}
                                                                cx={p.x}
                                                                cy={p.y}
                                                                r={Math.max(4, activePage.width * 0.005)}
                                                                fill={pi === 0 ? '#f59e0b' : '#ffffff'}
                                                                stroke="#b45309"
                                                                strokeWidth="2.2"
                                                            />
                                                        ))}
                                                    </g>
                                                )}

                                                {/* 邊界吸附準星與提示標籤（基地框選與道路框選共用） */}
                                                {(uploadTool === 'trace' || uploadTool === 'road_trace') && uploadCursorPx && (uploadTool === 'road_trace' || !isManualTraceClosed) && (
                                                    <g transform={`translate(${uploadCursorPx.x}, ${uploadCursorPx.y})`}>
                                                        <circle
                                                            r={Math.max(6, activePage.width * 0.008)}
                                                            fill={uploadSnapInfo ? 'rgba(245, 158, 11, 0.35)' : 'rgba(79, 70, 229, 0.2)'}
                                                            stroke={uploadSnapInfo?.type === 'close' ? '#10b981' : (uploadSnapInfo ? '#d97706' : '#4f46e5')}
                                                            strokeWidth={Math.max(2, activePage.width * 0.0028)}
                                                        />
                                                        {uploadSnapInfo?.label && (
                                                            <text
                                                                y={-Math.max(12, activePage.width * 0.016)}
                                                                textAnchor="middle"
                                                                fontSize={Math.max(11, activePage.width * 0.013)}
                                                                fontWeight="900"
                                                                fill="#b45309"
                                                            >
                                                                {uploadSnapInfo.label}
                                                            </text>
                                                        )}
                                                    </g>
                                                )}

                                                {/* 比例尺兩點校正線 */}
                                                {calibPts.length > 0 && (
                                                    <g>
                                                        {calibPts.length === 2 && (
                                                            <line x1={calibPts[0].x} y1={calibPts[0].y} x2={calibPts[1].x} y2={calibPts[1].y} stroke="#0284c7" strokeWidth={Math.max(2.5, activePage.width * 0.0035)} strokeDasharray="6,4" />
                                                        )}
                                                        {calibPts.map((p, pi) => (
                                                            <circle key={pi} cx={p.x} cy={p.y} r={Math.max(4, activePage.width * 0.005)} fill="#0284c7" stroke="#000" strokeWidth="1.5" />
                                                        ))}
                                                    </g>
                                                )}
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ================= TAB 2: 台灣即時地籍圖 (NLSC WMTS) ================= */}
                    {activeTab === 'map' && (
                        <div className="flex flex-col gap-2.5 flex-1 min-h-[440px]">
                            <div className="flex flex-wrap items-center justify-between gap-2 bg-white border-2 border-black shadow-[3px_3px_0_#000] p-2">
                                <form onSubmit={handleSearchAddress} className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="輸入台灣地址或路名（如：台中市豐原大道四段）"
                                        className="flex-1 px-2.5 py-1 text-xs font-bold border-2 border-black outline-none"
                                    />
                                    <button type="submit" disabled={isSearching} className="px-3 py-1 bg-black text-white text-xs font-black flex items-center gap-1 hover:bg-stone-800">
                                        <Search size={13} />
                                        <span>{isSearching ? '定位中' : '定位'}</span>
                                    </button>
                                </form>

                                <div className="flex flex-wrap items-center gap-1 text-[11px] font-black">
                                    <button
                                        type="button"
                                        onClick={() => setMapPickMode('trace')}
                                        className={`px-2 py-1 border-2 border-black flex items-center gap-1 ${mapPickMode === 'trace' ? 'bg-black text-white' : 'bg-white text-black hover:bg-stone-100'}`}
                                    >
                                        <Pencil size={12} /> 點線框基地
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMapPickMode('road_trace')}
                                        className={`px-2 py-1 border-2 border-black flex items-center gap-1 ${mapPickMode === 'road_trace' ? 'bg-amber-500 text-white' : 'bg-white text-black hover:bg-amber-50'}`}
                                    >
                                        <Route size={12} /> 點線框選道路
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMapPickMode('pan')}
                                        className={`px-2 py-1 border-2 border-black ${mapPickMode === 'pan' ? 'bg-black text-white' : 'bg-white text-black hover:bg-stone-100'}`}
                                    >
                                        平移
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEdgeSnapEnabled(s => !s)}
                                        className={`px-2 py-1 border-2 border-black flex items-center gap-1 ${edgeSnapEnabled ? 'bg-amber-300 text-black' : 'bg-white text-stone-500'}`}
                                    >
                                        <Magnet size={11} /> 吸附
                                    </button>
                                    <label className="flex items-center gap-1 px-2 py-1 border border-black bg-stone-50 cursor-pointer">
                                        <input type="checkbox" checked={showCadastralLayer} onChange={e => setShowCadastralLayer(e.target.checked)} className="accent-red-600" />
                                        <span>地籍線</span>
                                    </label>
                                    <label className="flex items-center gap-1 px-2 py-1 border border-black bg-stone-50 cursor-pointer">
                                        <input type="checkbox" checked={showZoningLayer} onChange={e => setShowZoningLayer(e.target.checked)} className="accent-indigo-600" />
                                        <span>國土利用</span>
                                    </label>
                                    <label className="flex items-center gap-1 px-2 py-1 border border-black bg-stone-50 cursor-pointer">
                                        <input type="checkbox" checked={showPhotoBase} onChange={e => setShowPhotoBase(e.target.checked)} className="accent-emerald-600" />
                                        <span>空拍</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1">
                                <span className="text-[10px] font-black text-stone-500 mr-1">快速定位：</span>
                                {TAIWAN_PRESET_LOCATIONS.map(loc => (
                                    <button
                                        key={loc.name}
                                        type="button"
                                        onClick={() => { setMapCenter({ lat: loc.lat, lng: loc.lng }); setMapZoom(loc.zoom); setMapTracedLatLngs([]); setMapRoadLatLngs([]); }}
                                        className="px-2 py-0.5 text-[10px] font-black bg-white border border-black hover:bg-black hover:text-white transition-colors"
                                    >
                                        {loc.name}
                                    </button>
                                ))}
                            </div>

                            <div
                                ref={mapContainerRef}
                                className={`relative flex-1 min-h-[340px] bg-[#e8e6df] border-2 border-black shadow-[4px_4px_0_#000] overflow-hidden select-none ${
                                    mapPickMode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
                                }`}
                                onMouseDown={(e) => {
                                    const cw = latLngToWorldPx(mapCenter.lat, mapCenter.lng, mapZoom);
                                    mapDragRef.current = { active: true, startX: e.clientX, startY: e.clientY, origWorldX: cw.x, origWorldY: cw.y, moved: false };
                                }}
                                onMouseMove={(e) => {
                                    if (mapContainerRef.current && mapPickMode !== 'pan') {
                                        const rect = mapContainerRef.current.getBoundingClientRect();
                                        const { pt, snap } = getMapSnappedScreenPt(e.clientX - rect.left, e.clientY - rect.top, e.shiftKey);
                                        setMapCursorScreen(pt);
                                        setMapSnapInfo(snap);
                                    }
                                    if (!mapDragRef.current.active) return;
                                    const dx = e.clientX - mapDragRef.current.startX;
                                    const dy = e.clientY - mapDragRef.current.startY;
                                    if (Math.hypot(dx, dy) > 4) mapDragRef.current.moved = true;
                                    if (mapPickMode === 'pan' || mapDragRef.current.moved) {
                                        const nextLL = worldPxToLatLng(mapDragRef.current.origWorldX - dx, mapDragRef.current.origWorldY - dy, mapZoom);
                                        setMapCenter(nextLL);
                                    }
                                }}
                                onMouseUp={(e) => {
                                    const wasMoved = mapDragRef.current.moved;
                                    mapDragRef.current.active = false;
                                    if (!wasMoved && mapPickMode !== 'pan' && mapContainerRef.current) {
                                        const rect = mapContainerRef.current.getBoundingClientRect();
                                        const { pt, snap } = getMapSnappedScreenPt(e.clientX - rect.left, e.clientY - rect.top, e.shiftKey);
                                        if (snap?.type === 'close') {
                                            setStatusMsg('已完成基地點線框閉合，可直接匯入！');
                                            return;
                                        }
                                        const cw = latLngToWorldPx(mapCenter.lat, mapCenter.lng, mapZoom);
                                        const ll = worldPxToLatLng(cw.x - rect.width / 2 + pt.x, cw.y - rect.height / 2 + pt.y, mapZoom);
                                        if (mapPickMode === 'road_trace') {
                                            setMapRoadLatLngs(prev => [...prev, ll]);
                                        } else {
                                            setMapTracedLatLngs(prev => [...prev, ll]);
                                        }
                                    }
                                }}
                                onMouseLeave={() => { mapDragRef.current.active = false; setMapCursorScreen(null); }}
                            >
                                {mapTiles.map(tile => (
                                    <React.Fragment key={`${mapZoom}-${tile.tx}-${tile.ty}`}>
                                        <img src={getNLSCTileUrl(showPhotoBase ? 'PHOTO2' : 'EMAP', mapZoom, tile.tx, tile.ty)} alt="" draggable={false} style={{ position: 'absolute', left: tile.left, top: tile.top, width: 256, height: 256, pointerEvents: 'none' }} />
                                        {showZoningLayer && <img src={getNLSCTileUrl('LUIMAP', mapZoom, tile.tx, tile.ty)} alt="" draggable={false} style={{ position: 'absolute', left: tile.left, top: tile.top, width: 256, height: 256, opacity: 0.45, pointerEvents: 'none' }} />}
                                        {showCadastralLayer && <img src={getNLSCTileUrl('DMAPSCL', mapZoom, tile.tx, tile.ty)} alt="" draggable={false} style={{ position: 'absolute', left: tile.left, top: tile.top, width: 256, height: 256, pointerEvents: 'none' }} />}
                                    </React.Fragment>
                                ))}

                                {/* 點線框基地與道路覆蓋層 */}
                                {(() => {
                                    const cw = latLngToWorldPx(mapCenter.lat, mapCenter.lng, mapZoom);
                                    const toS = (ll) => {
                                        const wp = latLngToWorldPx(ll.lat, ll.lng, mapZoom);
                                        return { x: wp.x - cw.x + mapViewportSize.w / 2, y: wp.y - cw.y + mapViewportSize.h / 2 };
                                    };
                                    const sitePts = mapTracedLatLngs.map(toS);
                                    const roadPts = mapRoadLatLngs.map(toS);
                                    const activePts = mapPickMode === 'road_trace' ? roadPts : sitePts;
                                    return (
                                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                            {roadPts.length > 0 && (
                                                <g>
                                                    <path d={roadPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (roadPts.length >= 3 ? ' Z' : '')} fill="rgba(245, 158, 11, 0.30)" stroke="#d97706" strokeWidth="2.5" strokeDasharray="6,4" />
                                                    {roadPts.map((p, i) => <circle key={`r-${i}`} cx={p.x} cy={p.y} r="4.5" fill="#f59e0b" stroke="#000" strokeWidth="1.5" />)}
                                                </g>
                                            )}
                                            {sitePts.length > 0 && (
                                                <g>
                                                    <path d={sitePts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (sitePts.length >= 3 ? ' Z' : '')} fill="rgba(16, 185, 129, 0.28)" stroke="#059669" strokeWidth="2.5" strokeDasharray="6,4" />
                                                    {sitePts.map((p, i) => (
                                                        <g key={`s-${i}`}>
                                                            <circle cx={p.x} cy={p.y} r="5" fill={i === 0 ? '#10b981' : '#fff'} stroke="#065f46" strokeWidth="2.2" />
                                                            <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="10" fontWeight="900" fill="#065f46">#{i + 1}</text>
                                                        </g>
                                                    ))}
                                                </g>
                                            )}
                                            {mapCursorScreen && mapPickMode !== 'pan' && activePts.length > 0 && (
                                                <line
                                                    x1={activePts[activePts.length - 1].x}
                                                    y1={activePts[activePts.length - 1].y}
                                                    x2={mapCursorScreen.x}
                                                    y2={mapCursorScreen.y}
                                                    stroke={mapPickMode === 'road_trace' ? '#d97706' : '#059669'}
                                                    strokeWidth="2"
                                                    strokeDasharray="5,4"
                                                />
                                            )}
                                            {mapCursorScreen && mapPickMode !== 'pan' && (
                                                <g transform={`translate(${mapCursorScreen.x}, ${mapCursorScreen.y})`}>
                                                    <circle r="6" fill={mapSnapInfo ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.2)'} stroke={mapSnapInfo ? '#d97706' : '#059669'} strokeWidth="2" />
                                                    {mapSnapInfo?.label && <text y="-11" textAnchor="middle" fontSize="10" fontWeight="900" fill="#92400e">{mapSnapInfo.label}</text>}
                                                </g>
                                            )}
                                        </svg>
                                    );
                                })()}

                                <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setMapZoom(z => Math.min(20, z + 1)); }} className="w-8 h-8 bg-white border-2 border-black font-black flex items-center justify-center hover:bg-stone-100"><ZoomIn size={15} /></button>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setMapZoom(z => Math.max(14, z - 1)); }} className="w-8 h-8 bg-white border-2 border-black font-black flex items-center justify-center hover:bg-stone-100"><ZoomOut size={15} /></button>
                                    {(mapTracedLatLngs.length > 0 || mapRoadLatLngs.length > 0) && (
                                        <button type="button" onClick={(e) => { e.stopPropagation(); setMapTracedLatLngs([]); setMapRoadLatLngs([]); }} className="w-8 h-8 bg-red-600 text-white border-2 border-black flex items-center justify-center hover:bg-red-700" title="清除選取"><RotateCcw size={14} /></button>
                                    )}
                                </div>
                                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-white border-2 border-black text-[10px] font-mono font-black">
                                    國土測繪中心 NLSC (Zoom {mapZoom} · 拖曳平移 / 點線框選地號與道路)
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ================= TAB 3: DXF / TWD97 界址坐標表 ================= */}
                    {activeTab === 'dxf' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-[430px]">
                            <div className="bg-white border-2 border-black shadow-[4px_4px_0_#000] p-3 flex flex-col gap-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs font-black flex items-center gap-1.5">
                                        <FileCode2 size={15} />
                                        <span>DXF 地籍圖檔（點擊選取／再點取消）</span>
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setDxfPickKind('site')}
                                            className={`px-2 py-0.5 text-[10px] font-black border border-black ${dxfPickKind === 'site' ? 'bg-black text-white' : 'bg-white'}`}
                                        >
                                            選地號
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDxfPickKind('road')}
                                            className={`px-2 py-0.5 text-[10px] font-black border border-black ${dxfPickKind === 'road' ? 'bg-amber-500 text-white' : 'bg-white'}`}
                                        >
                                            選道路
                                        </button>
                                        <label className="px-2.5 py-0.5 bg-black text-white text-[10px] font-black cursor-pointer hover:bg-stone-800 border border-black">
                                            上傳 .dxf
                                            <input
                                                type="file"
                                                accept=".dxf"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    if (f) handleFileUpload(f);
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                                <div className="flex-1 bg-[#f0efe9] border-2 border-black min-h-[280px] flex items-center justify-center relative overflow-hidden">
                                    {dxfParcels.length === 0 ? (
                                        <div className="text-center text-stone-500 text-xs p-4 space-y-1.5 font-bold">
                                            <p className="font-black text-black">尚未載入 DXF 檔案</p>
                                            <p>可從右上「DXFast」匯出台灣地籍 .dxf 後拖入此處，直接於畫布點選地號或道路區塊（再點一次可取消）。</p>
                                        </div>
                                    ) : (
                                        <svg viewBox={`${dxfBounds.minX} ${dxfBounds.minY} ${dxfBounds.w} ${dxfBounds.h}`} className="w-full h-full max-h-[330px]">
                                            {dxfParcels.map(poly => {
                                                const isSiteSel = selectedDxfIds.has(poly.id);
                                                const isRoadSel = selectedDxfRoadIds.has(poly.id);
                                                const d = poly.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
                                                return (
                                                    <path
                                                        key={poly.id}
                                                        d={d}
                                                        fill={isSiteSel ? 'rgba(16, 185, 129, 0.45)' : (isRoadSel ? 'rgba(245, 158, 11, 0.42)' : 'rgba(255, 255, 255, 0.7)')}
                                                        stroke={isSiteSel ? '#059669' : (isRoadSel ? '#d97706' : '#334155')}
                                                        strokeWidth={dxfBounds.w * 0.0045}
                                                        className="cursor-pointer hover:fill-emerald-200/70 transition-colors"
                                                        onClick={() => {
                                                            if (dxfPickKind === 'road') {
                                                                setSelectedDxfRoadIds(prev => {
                                                                    const next = new Set(prev);
                                                                    if (next.has(poly.id)) next.delete(poly.id);
                                                                    else next.add(poly.id);
                                                                    return next;
                                                                });
                                                            } else {
                                                                setSelectedDxfIds(prev => {
                                                                    if (prev.has(poly.id)) return new Set();
                                                                    return new Set([poly.id]);
                                                                });
                                                            }
                                                        }}
                                                    />
                                                );
                                            })}
                                        </svg>
                                    )}
                                </div>
                                {dxfParcels.length > 0 && (
                                    <div className="text-[11px] font-black text-emerald-800">
                                        {(() => {
                                            const sel = dxfParcels.find(p => selectedDxfIds.has(p.id));
                                            return sel
                                                ? `已選基地：${sel.label}（${formatNum(sel.areaSqm)} ㎡ / ${formatNum(toPing(sel.areaSqm))} 坪）｜已選道路：${selectedDxfRoadIds.size} 塊`
                                                : `尚未選取基地地塊（點擊選取，再點一次取消）｜已選道路：${selectedDxfRoadIds.size} 塊`;
                                        })()}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white border-2 border-black shadow-[4px_4px_0_#000] p-3 flex flex-col gap-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-black">TWD97 界址坐標表貼上（1:1 精準）</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTwd97Text(SAMPLE_TWD97_TEXT);
                                            const parsed = parseBoundaryCoordsText(SAMPLE_TWD97_TEXT);
                                            setTwd97Parcels(parsed);
                                            if (parsed[0]) setSelectedTwd97Id(parsed[0].id);
                                        }}
                                        className="px-2 py-0.5 bg-amber-200 hover:bg-amber-300 text-black border border-black text-[10px] font-black"
                                    >
                                        載入範例 (豐原396地號)
                                    </button>
                                </div>
                                <textarea
                                    value={twd97Text}
                                    onChange={(e) => {
                                        const txt = e.target.value;
                                        setTwd97Text(txt);
                                        const parsed = parseBoundaryCoordsText(txt);
                                        setTwd97Parcels(parsed);
                                        if (parsed[0]) setSelectedTwd97Id(parsed[0].id);
                                    }}
                                    placeholder={'貼上地籍謄本第 2 頁「界址坐標表」，每行格式：\n地號 點號 橫坐標(X) 縱坐標(Y)'}
                                    className="w-full h-36 p-2 text-xs font-mono border-2 border-black bg-[#f8f7f3] focus:bg-white outline-none resize-none"
                                />
                                <div className="flex-1 bg-[#f5f4f0] border-2 border-black p-2 space-y-1.5 overflow-y-auto">
                                    <div className="text-[10px] font-black text-stone-500">解析結果（點擊選取／再點一次取消）：</div>
                                    {twd97Parcels.length === 0 ? (
                                        <p className="text-[11px] text-stone-400 font-bold">貼上至少 3 個界址點坐標後將自動計算真實面積</p>
                                    ) : (
                                        twd97Parcels.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => setSelectedTwd97Id(prev => prev === p.id ? null : p.id)}
                                                className={`w-full text-left px-2.5 py-2 border-2 border-black text-xs font-black flex items-center justify-between transition-colors ${
                                                    selectedTwd97Id === p.id ? 'bg-black text-white shadow-[2px_2px_0_#10b981]' : 'bg-white hover:bg-stone-100'
                                                }`}
                                            >
                                                <span>{p.label}（{p.points.length} 個界址點）</span>
                                                <span className="font-mono">{formatNum(p.areaSqm)} ㎡ / {formatNum(toPing(p.areaSqm))} 坪</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 匯入前精準定尺列：可只設定 1 邊由比例推演，或部分／全部設定基地各邊長 ＋ 設定道路寬度 */}
                {solvedSiteData && solvedSiteData.edgeLengths && (
                    <div className="px-4 py-2 bg-[#eceae3] border-t-2 border-black flex flex-wrap items-center gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 font-black text-black shrink-0">
                            <Ruler size={13} />
                            <span>基地邊長定尺</span>
                            <span className="text-[10px] font-bold text-stone-500 hidden sm:inline">（設 1 邊自動等比推演，可多邊設定）</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 flex-1">
                            {solvedSiteData.edgeLengths.slice(0, 12).map((lenM, idx) => {
                                const isCustom = edgeLengthOverrides[idx] !== undefined && edgeLengthOverrides[idx] !== '';
                                return (
                                    <div
                                        key={`edge-len-${idx}`}
                                        className={`flex items-center gap-0.5 px-1.5 py-0.5 border border-black ${
                                            isCustom ? 'bg-amber-200' : 'bg-white'
                                        }`}
                                    >
                                        <span className="font-mono font-black text-[10px] text-stone-600">#{idx}</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0.5"
                                            value={isCustom ? edgeLengthOverrides[idx] : lenM.toFixed(2)}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setEdgeLengthOverrides(prev => {
                                                    const next = { ...prev };
                                                    if (v === '') delete next[idx];
                                                    else next[idx] = v;
                                                    return next;
                                                });
                                            }}
                                            className="w-12 text-right font-mono font-black text-[11px] bg-transparent outline-none"
                                            title={`輸入第 #${idx} 邊實際長度 (m)`}
                                        />
                                        <span className="text-[9px] font-bold text-stone-500">m</span>
                                    </div>
                                );
                            })}
                            {Object.keys(edgeLengthOverrides).length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setEdgeLengthOverrides({})}
                                    className="px-1.5 py-0.5 text-[10px] font-black bg-white border border-black hover:bg-stone-100 text-rose-600"
                                >
                                    重設邊長
                                </button>
                            )}
                        </div>

                        {/* 匯入前道路寬度設定（隨時可調整，匯入時套用至面前道路與道路形狀） */}
                        <div className="flex items-center gap-1.5 pl-2 border-l-2 border-black/30 shrink-0">
                            <Route size={13} className="text-amber-700" />
                            <span className="font-black text-amber-900">路寬</span>
                            <input
                                type="number"
                                step="1"
                                min="2"
                                max="60"
                                value={roadWidthInputM}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setRoadWidthInputM(val);
                                    const num = Math.max(2, parseFloat(val) || 10);
                                    setSelectedRoadPolys(prev => prev.map(r => ({ ...r, widthM: num })));
                                }}
                                className="w-12 px-1 py-0.5 text-right font-mono font-black text-xs bg-white border border-black outline-none"
                            />
                            <span className="font-black text-[10px]">m</span>
                        </div>
                    </div>
                )}

                {/* 底部狀態列與確認匯入按鈕 */}
                <div className="px-4 py-2.5 bg-white border-t-2 border-black flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold text-stone-700 flex flex-wrap items-center gap-2">
                        {solvedSiteData ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-black border border-black font-mono font-black">
                                基地：{formatNum(solvedSiteData.areaSqm)} ㎡（{formatNum(toPing(solvedSiteData.areaSqm))} 坪 · {solvedSiteData.points.length} 點）
                            </span>
                        ) : null}
                        {((activeTab === 'upload' && selectedRoadPolys.length > 0) || (activeTab === 'map' && mapRoadLatLngs.length >= 2) || (activeTab === 'dxf' && selectedDxfRoadIds.size > 0)) && (
                            <span className="px-2 py-0.5 bg-amber-100 text-black border border-black font-mono font-black">
                                已選道路（路寬 {roadWidthInputM}m）
                            </span>
                        )}
                        <span className="truncate max-w-md">{statusMsg || '所有上傳資料僅存在本機電腦瀏覽器中。'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-1.5 text-xs font-black border-2 border-black bg-white hover:bg-stone-100"
                        >
                            取消
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmImport}
                            className="px-4 py-1.5 text-xs font-black border-2 border-black bg-black text-white hover:bg-emerald-600 shadow-[3px_3px_0_#000] flex items-center gap-1.5 transition-colors"
                        >
                            <CheckCircle2 size={15} />
                            <span>{importTargetMode === 'new' ? `匯入為新基地 (${nextSiteLabel})` : '匯入並套用至目前基地'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
