import { calculatePolygonArea, polygonSignedArea, getPolygonCentroid } from './polygon';

// ============================================================================
// 1. 本機瀏覽器專屬 IndexedDB 儲存引擎（絕不上傳至任何雲端伺服器）
// ============================================================================
const DB_NAME = 'YRA_LocalCadastralDB';
const DB_VERSION = 1;
const STORE_NAME = 'cadastral_files';

function openLocalDB() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('此瀏覽器不支援 IndexedDB 本機儲存'));
            return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export const cadastralLocalDB = {
    async saveFile(record) {
        const db = await openLocalDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put({
                ...record,
                savedAt: record.savedAt || Date.now()
            });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    },
    async listFiles() {
        try {
            const db = await openLocalDB();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const req = tx.objectStore(STORE_NAME).getAll();
                req.onsuccess = () => {
                    const rows = (req.result || []).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
                    resolve(rows);
                };
                req.onerror = () => reject(req.error);
            });
        } catch {
            return [];
        }
    },
    async deleteFile(id) {
        const db = await openLocalDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(id);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    },
    async clearAll() {
        const db = await openLocalDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }
};

// ============================================================================
// 2. 台灣地籍謄本界址坐標表 (TWD97 / TWD67) 解析器
// ============================================================================
/**
 * 解析台灣地籍圖謄本第 2 頁「界址坐標表」純文字或貼上表格
 * 支援格式如：
 *   396  2032  223276.646  2682646.627
 *   223276.646, 2682646.627
 * 自動依地號分組，並將 TWD97 (X 向東, Y 向北) 轉換為基地局部公尺座標 (X 向右, Y 向下)
 */
export function parseBoundaryCoordsText(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const groups = new Map();

    lines.forEach((line, lineIdx) => {
        // 略過明顯標頭
        if (/^(地號|點號|橫坐標|縱坐標|界址|謄本)/.test(line)) return;
        const tokens = line.split(/[\s,\t;]+/).filter(Boolean);
        // 找出數值型欄位（通常是最後兩個大數值作為 X, Y）
        const nums = [];
        tokens.forEach((tk, i) => {
            const v = parseFloat(tk);
            if (!isNaN(v) && /^-?\d+(\.\d+)?$/.test(tk)) {
                nums.push({ val: v, idx: i, raw: tk });
            }
        });
        if (nums.length < 2) return;

        // 取最後兩個數值當作 X (橫坐標/東距), Y (縱坐標/北距)
        const xObj = nums[nums.length - 2];
        const yObj = nums[nums.length - 1];
        const xVal = xObj.val;
        const yVal = yObj.val;
        if (Math.abs(xVal) < 1e-6 && Math.abs(yVal) < 1e-6) return;

        // 若前方有地號欄位 (例如 4 欄: 地號 點號 X Y)，以第 1 欄作為地號名稱
        let parcelId = '自訂地號';
        if (tokens.length >= 4 && xObj.idx >= 2) {
            parcelId = tokens[0];
        } else if (tokens.length === 3 && xObj.idx === 1 && /[-A-Za-z\u4e00-\u9fa5]/.test(tokens[0])) {
            parcelId = tokens[0];
        }

        if (!groups.has(parcelId)) groups.set(parcelId, []);
        groups.get(parcelId).push({ x: xVal, y: yVal, lineIdx });
    });

    const parcels = [];
    groups.forEach((rawPts, parcelId) => {
        if (rawPts.length < 3) return;
        // 過濾相鄰重複點
        const dedup = [];
        rawPts.forEach(p => {
            const prev = dedup[dedup.length - 1];
            if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 0.01) {
                dedup.push(p);
            }
        });
        if (dedup.length > 3) {
            const first = dedup[0];
            const last = dedup[dedup.length - 1];
            if (Math.hypot(first.x - last.x, first.y - last.y) < 0.02) dedup.pop();
        }
        if (dedup.length < 3) return;

        // TWD97 縱坐標 Y 朝北為正，轉換為 SVG/3D 畫布座標（Y 朝南為正）並平移至中心原點
        const avgX = dedup.reduce((s, p) => s + p.x, 0) / dedup.length;
        const avgY = dedup.reduce((s, p) => s + p.y, 0) / dedup.length;
        let localPts = dedup.map(p => ({
            x: parseFloat((p.x - avgX).toFixed(3)),
            y: parseFloat((-(p.y - avgY)).toFixed(3))
        }));
        if (polygonSignedArea(localPts) < 0) {
            localPts = [...localPts].reverse();
        }
        const areaSqm = calculatePolygonArea(localPts, null);
        if (areaSqm > 0.5) {
            parcels.push({
                id: `twd97-${parcelId}`,
                label: `地號 ${parcelId}`,
                points: localPts,
                rawWorldPoints: dedup,
                areaSqm
            });
        }
    });
    return parcels;
}

// ============================================================================
// 3. 本機 DXF 解析器（相容 DXFast / AutoCAD 匯出之 LWPOLYLINE / POLYLINE）
// ============================================================================
export function parseDXFPolygons(dxfText) {
    if (!dxfText || typeof dxfText !== 'string') return [];
    const rawLines = dxfText.split(/\r?\n/);
    const pairs = [];
    for (let i = 0; i < rawLines.length - 1; i += 2) {
        pairs.push({ code: rawLines[i].trim(), val: rawLines[i + 1].trim() });
    }

    const rawPolys = [];
    let i = 0;
    while (i < pairs.length) {
        const { code, val } = pairs[i];
        if (code === '0' && val === 'LWPOLYLINE') {
            let layer = '0';
            const pts = [];
            let curX = null;
            i++;
            while (i < pairs.length && pairs[i].code !== '0') {
                const c = pairs[i].code;
                const v = pairs[i].val;
                if (c === '8') layer = v;
                else if (c === '10') curX = parseFloat(v);
                else if (c === '20' && curX !== null) {
                    const curY = parseFloat(v);
                    if (!isNaN(curX) && !isNaN(curY)) pts.push({ x: curX, y: curY });
                    curX = null;
                }
                i++;
            }
            if (pts.length >= 3) rawPolys.push({ layer, pts });
            continue;
        }
        if (code === '0' && val === 'POLYLINE') {
            let layer = '0';
            const pts = [];
            i++;
            while (i < pairs.length && !(pairs[i].code === '0' && pairs[i].val === 'SEQEND')) {
                if (pairs[i].code === '8') layer = pairs[i].val;
                if (pairs[i].code === '0' && pairs[i].val === 'VERTEX') {
                    let vx = null;
                    let vy = null;
                    i++;
                    while (i < pairs.length && pairs[i].code !== '0') {
                        if (pairs[i].code === '10') vx = parseFloat(pairs[i].val);
                        if (pairs[i].code === '20') vy = parseFloat(pairs[i].val);
                        i++;
                    }
                    if (vx !== null && vy !== null && !isNaN(vx) && !isNaN(vy)) {
                        pts.push({ x: vx, y: vy });
                    }
                    continue;
                }
                i++;
            }
            if (pts.length >= 3) rawPolys.push({ layer, pts });
            continue;
        }
        i++;
    }

    if (rawPolys.length === 0) return [];

    // 偵測 DXF 單位是否為公分/毫米（若典型邊長 > 500 推測為 cm，> 5000 推測為 mm）
    let sampleSpan = 0;
    rawPolys.slice(0, 20).forEach(poly => {
        for (let k = 0; k < poly.pts.length - 1; k++) {
            sampleSpan = Math.max(sampleSpan, Math.hypot(poly.pts[k + 1].x - poly.pts[k].x, poly.pts[k + 1].y - poly.pts[k].y));
        }
    });
    const unitScale = sampleSpan > 4000 ? 0.001 : (sampleSpan > 400 ? 0.01 : 1);

    // 計算整體包絡中心以便保留所有地號的相對位置
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    rawPolys.forEach(poly => {
        poly.pts.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
    });
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const results = [];
    rawPolys.forEach((poly, idx) => {
        // 移除頭尾重複點
        const clean = [];
        poly.pts.forEach(p => {
            const pt = {
                x: (p.x - cx) * unitScale,
                y: -((p.y - cy) * unitScale) // DXF Y 軸朝上，轉為畫布 Y 軸朝下
            };
            const prev = clean[clean.length - 1];
            if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) > 0.02) {
                clean.push(pt);
            }
        });
        if (clean.length > 3 && Math.hypot(clean[0].x - clean[clean.length - 1].x, clean[0].y - clean[clean.length - 1].y) < 0.05) {
            clean.pop();
        }
        if (clean.length < 3) return;
        const ordered = polygonSignedArea(clean) < 0 ? [...clean].reverse() : clean;
        const areaSqm = calculatePolygonArea(ordered, null);
        if (areaSqm < 2 || areaSqm > 500000) return;
        results.push({
            id: `dxf-${idx}`,
            label: `${poly.layer !== '0' ? poly.layer + ' · ' : ''}地塊 #${idx + 1}`,
            layer: poly.layer,
            points: ordered,
            areaSqm
        });
    });
    return results;
}

// ============================================================================
// 4. 魔術棒自動偵測地號輪廓 (Flood-Fill + Moore Contour + Douglas-Peucker)
// ============================================================================
function pointToSegDistSq(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    if (l2 < 1e-9) return (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    return (p.x - px) ** 2 + (p.y - py) ** 2;
}

function simplifyDouglasPeucker(pts, epsilon) {
    if (pts.length <= 3) return pts;
    const epsSq = epsilon * epsilon;
    let maxDist = 0;
    let maxIdx = 0;
    const end = pts.length - 1;
    for (let i = 1; i < end; i++) {
        const d = pointToSegDistSq(pts[i], pts[0], pts[end]);
        if (d > maxDist) {
            maxDist = d;
            maxIdx = i;
        }
    }
    if (maxDist > epsSq) {
        const left = simplifyDouglasPeucker(pts.slice(0, maxIdx + 1), epsilon);
        const right = simplifyDouglasPeucker(pts.slice(maxIdx), epsilon);
        return [...left.slice(0, -1), ...right];
    }
    return [pts[0], pts[end]];
}

/**
 * 在上傳之地籍圖／都計圖畫布上，於點擊位置 (clickX, clickY) 執行 Flood-Fill 偵測封閉地號區塊，
 * 並回傳簡化後的平滑多邊形像素頂點 [{ x, y }, ...]
 */
export function detectParcelPolygonAtPixel(imageData, clickX, clickY, tolerance = 34) {
    const { width, height, data } = imageData;
    const sx = Math.round(clickX);
    const sy = Math.round(clickY);
    if (sx < 1 || sy < 1 || sx >= width - 1 || sy >= height - 1) return null;

    const startIdx = (sy * width + sx) * 4;
    const sr = data[startIdx];
    const sg = data[startIdx + 1];
    const sb = data[startIdx + 2];
    const startLum = 0.299 * sr + 0.587 * sg + 0.114 * sb;

    // 若使用者點在深色線條上，微幅搜尋鄰近亮色像素作為起點
    let seedX = sx;
    let seedY = sy;
    if (startLum < 95) {
        let found = false;
        for (let rad = 1; rad <= 5 && !found; rad++) {
            for (let dy = -rad; dy <= rad && !found; dy++) {
                for (let dx = -rad; dx <= rad && !found; dx++) {
                    const nx = sx + dx;
                    const ny = sy + dy;
                    if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= height - 1) continue;
                    const idx = (ny * width + nx) * 4;
                    const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                    if (lum > 140) {
                        seedX = nx;
                        seedY = ny;
                        found = true;
                    }
                }
            }
        }
    }

    const sIdx = (seedY * width + seedX) * 4;
    const tr = data[sIdx];
    const tg = data[sIdx + 1];
    const tb = data[sIdx + 2];

    const mask = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let qHead = 0;
    let qTail = 0;

    const isFillable = (x, y) => {
        const i4 = (y * width + x) * 4;
        const r = data[i4];
        const g = data[i4 + 1];
        const b = data[i4 + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        // 遇到深色地籍線條或明顯紅/藍/黃邊界線時停止擴散
        if (lum < 110) return false;
        const diff = Math.abs(r - tr) + Math.abs(g - tg) + Math.abs(b - tb);
        return diff <= tolerance * 3.1;
    };

    const seedPos = seedY * width + seedX;
    mask[seedPos] = 1;
    queue[qTail++] = seedPos;

    let minX = seedX, maxX = seedX, minY = seedY, maxY = seedY;
    let pixelCount = 0;
    const maxAllowedPixels = Math.floor(width * height * 0.42);

    while (qHead < qTail) {
        const pos = queue[qHead++];
        const cx = pos % width;
        const cy = (pos - cx) / width;
        pixelCount++;
        if (pixelCount > maxAllowedPixels) {
            return { error: '選取範圍過大（可能地籍線有缺口），請調低容差或改用手動點拉界址點。' };
        }
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const neighbors = [
            cx + 1 < width ? pos + 1 : -1,
            cx - 1 >= 0 ? pos - 1 : -1,
            cy + 1 < height ? pos + width : -1,
            cy - 1 >= 0 ? pos - width : -1
        ];
        for (let n = 0; n < 4; n++) {
            const np = neighbors[n];
            if (np < 0 || mask[np]) continue;
            const nx = np % width;
            const ny = (np - nx) / width;
            if (isFillable(nx, ny)) {
                mask[np] = 1;
                queue[qTail++] = np;
            }
        }
    }

    if (pixelCount < 45) {
        return { error: '偵測到的區域過小，請點擊地號空白處內部（避開文字或線條）。' };
    }

    // 形態學閉運算（微幅填補地號數字/浮水印造成的內部孔洞），並尋找最外圈輪廓
    const pad = 2;
    const bw = (maxX - minX) + 1 + pad * 2;
    const bh = (maxY - minY) + 1 + pad * 2;
    const sub = new Uint8Array(bw * bh);
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (mask[y * width + x]) {
                sub[(y - minY + pad) * bw + (x - minX + pad)] = 1;
            }
        }
    }

    // Moore-Neighbor 外輪廓追蹤
    let startBx = -1;
    let startBy = -1;
    outer: for (let y = 1; y < bh - 1; y++) {
        for (let x = 1; x < bw - 1; x++) {
            if (sub[y * bw + x] === 1) {
                startBx = x;
                startBy = y;
                break outer;
            }
        }
    }
    if (startBx < 0) return null;

    // 8 鄰域順時針方向表
    const dirs = [
        { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
        { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 }
    ];

    const contour = [];
    let cx = startBx;
    let cy = startBy;
    let backDir = 6; // 從左側進入
    const maxSteps = bw * bh * 2;

    for (let step = 0; step < maxSteps; step++) {
        contour.push({ x: cx - pad + minX, y: cy - pad + minY });
        let foundNext = false;
        const startDir = (backDir + 1) % 8;
        for (let k = 0; k < 8; k++) {
            const dIdx = (startDir + k) % 8;
            const nx = cx + dirs[dIdx].dx;
            const ny = cy + dirs[dIdx].dy;
            if (nx >= 0 && ny >= 0 && nx < bw && ny < bh && sub[ny * bw + nx] === 1) {
                cx = nx;
                cy = ny;
                backDir = (dIdx + 4) % 8;
                foundNext = true;
                break;
            }
        }
        if (!foundNext) break;
        if (cx === startBx && cy === startBy && step > 4) break;
    }

    if (contour.length < 6) return null;

    // 閉合環狀 Douglas-Peucker 簡化，將數百個像素點精簡為乾淨的建築角點 (通常 4~10 點)
    const spanPx = Math.hypot(maxX - minX, maxY - minY);
    const eps = Math.max(2.6, spanPx * 0.022);
    // 先找離起點最遠的點把閉合環拆成兩段簡化，避免起點成為假角點
    let farIdx = 0;
    let farDist = -1;
    for (let i = 1; i < contour.length; i++) {
        const d = (contour[i].x - contour[0].x) ** 2 + (contour[i].y - contour[0].y) ** 2;
        if (d > farDist) { farDist = d; farIdx = i; }
    }
    const segA = simplifyDouglasPeucker(contour.slice(0, farIdx + 1), eps);
    const segB = simplifyDouglasPeucker([...contour.slice(farIdx), contour[0]], eps);
    let simplified = [...segA.slice(0, -1), ...segB.slice(0, -1)];

    // 再做一次相鄰近點與幾乎共線頂點過濾
    const cleaned = [];
    for (let i = 0; i < simplified.length; i++) {
        const prev = simplified[(i - 1 + simplified.length) % simplified.length];
        const curr = simplified[i];
        const next = simplified[(i + 1) % simplified.length];
        if (Math.hypot(curr.x - prev.x, curr.y - prev.y) < 3) continue;
        const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
        const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
        const cross = Math.abs((curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x));
        if (d1 > 1e-3 && d2 > 1e-3 && cross / (d1 * d2) < 0.06) continue;
        cleaned.push(curr);
    }

    const finalPts = cleaned.length >= 3 ? cleaned : simplified;
    return {
        points: finalPts,
        bbox: { minX, minY, maxX, maxY },
        pixelCount
    };
}

// ============================================================================
// 5. 台灣國土測繪中心 (NLSC) 免費公開 WMTS 地籍圖磚座標工具
// ============================================================================
export const TAIWAN_PRESET_LOCATIONS = [
    { name: '台中・豐原大道四段', lat: 24.2528, lng: 120.7289, zoom: 18 },
    { name: '台中・七期重劃區', lat: 24.1618, lng: 120.6468, zoom: 18 },
    { name: '台北・信義計畫區', lat: 25.0338, lng: 121.5645, zoom: 18 },
    { name: '新北・板橋新板特區', lat: 25.0138, lng: 121.4642, zoom: 18 },
    { name: '桃園・青埔高鐵特區', lat: 25.0132, lng: 121.2145, zoom: 18 },
    { name: '台南・安平五期', lat: 22.9912, lng: 120.1846, zoom: 18 },
    { name: '高雄・美術館特區', lat: 22.6562, lng: 120.2866, zoom: 18 }
];

export function latLngToWorldPx(lat, lng, zoom) {
    const scale = 256 * Math.pow(2, zoom);
    const x = ((lng + 180) / 360) * scale;
    const sinLat = Math.sin((lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
    return { x, y };
}

export function worldPxToLatLng(wx, wy, zoom) {
    const scale = 256 * Math.pow(2, zoom);
    const lng = (wx / scale) * 360 - 180;
    const n = Math.PI - (2 * Math.PI * wy) / scale;
    const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    return { lat, lng };
}

export function getMetersPerPixelAtLatZoom(lat, zoom) {
    return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

export function getNLSCTileUrl(layerId, z, x, y) {
    // layerId: 'EMAP' (通用電子地圖) | 'DMAPSCL' (段籍圖/地籍圖) | 'LUIMAP' (國土利用/使用分區) | 'PHOTO2' (正射影像)
    return `https://wmts.nlsc.gov.tw/wmts/${layerId}/default/GoogleMapsCompatible/${z}/${y}/${x}`;
}

/**
 * 將多邊形像素頂點依 metersPerPx 轉為居中於 (0,0) 之基地局部公尺座標（正向順時針）
 */
export function pixelPolygonToSiteMeters(pixelPts, metersPerPx) {
    if (!pixelPts || pixelPts.length < 3 || !metersPerPx) return null;
    const c = getPolygonCentroid(pixelPts);
    let orderedPx = [...pixelPts];
    let ptsM = orderedPx.map(p => ({
        x: parseFloat(((p.x - c.x) * metersPerPx).toFixed(3)),
        y: parseFloat(((p.y - c.y) * metersPerPx).toFixed(3))
    }));
    if (polygonSignedArea(ptsM) < 0) {
        ptsM = [...ptsM].reverse();
        orderedPx = [...orderedPx].reverse();
    }
    const areaSqm = calculatePolygonArea(ptsM, null);
    return { points: ptsM, orderedPx, areaSqm, centroidPx: c };
}

/**
 * 在上傳之地籍圖／都計圖畫布上，自動搜尋游標附近最接近的深色地籍界線像素作為邊界吸附點
 */
export function snapPixelToDarkEdge(ctx, rawX, rawY, width, height, radiusPx = 10) {
    if (!ctx || !width || !height) return null;
    const cx = Math.round(rawX);
    const cy = Math.round(rawY);
    const x0 = Math.max(0, cx - radiusPx);
    const y0 = Math.max(0, cy - radiusPx);
    const w = Math.min(width - x0, radiusPx * 2 + 1);
    const h = Math.min(height - y0, radiusPx * 2 + 1);
    if (w <= 0 || h <= 0) return null;

    const img = ctx.getImageData(x0, y0, w, h).data;
    let bestPt = null;
    let bestScore = Infinity;

    for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
            const idx = (dy * w + dx) * 4;
            const r = img[idx];
            const g = img[idx + 1];
            const b = img[idx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            // 深色地籍線條或明顯紅/藍邊界線
            const isColoredBorder = (r > 170 && g < 110 && b < 110) || (b > 160 && r < 110 && g < 130);
            if (lum < 125 || isColoredBorder) {
                const px = x0 + dx;
                const py = y0 + dy;
                const dist = Math.hypot(px - rawX, py - rawY);
                if (dist <= radiusPx) {
                    const score = dist + (lum / 255) * 2.5;
                    if (score < bestScore) {
                        bestScore = score;
                        bestPt = { x: px, y: py };
                    }
                }
            }
        }
    }
    return bestPt;
}

/**
 * 依據已選取的基地多邊形 (orderedPx) 與點選的道路多邊形陣列 (roadPolysPx)，
 * 自動判定基地哪幾條邊 (#0..#n) 緊鄰道路，並回傳對應之臨路邊索引陣列
 */
export function detectFrontageEdgesFromRoads(siteOrderedPx, roadPolysPx, thresholdPx = 18) {
    if (!siteOrderedPx || siteOrderedPx.length < 3 || !roadPolysPx || roadPolysPx.length === 0) {
        return [];
    }
    const frontageSet = new Set();
    for (let i = 0; i < siteOrderedPx.length; i++) {
        const p1 = siteOrderedPx[i];
        const p2 = siteOrderedPx[(i + 1) % siteOrderedPx.length];
        // 在基地邊上取 3 個檢查點（1/4, 1/2, 3/4）檢查是否貼近任一道路多邊形邊界
        const checkPts = [
            { x: p1.x * 0.75 + p2.x * 0.25, y: p1.y * 0.75 + p2.y * 0.25 },
            { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 },
            { x: p1.x * 0.25 + p2.x * 0.75, y: p1.y * 0.25 + p2.y * 0.75 }
        ];
        let hits = 0;
        for (const cp of checkPts) {
            let nearRoad = false;
            for (const road of roadPolysPx) {
                const rPts = road.pointsPx || road;
                if (!rPts || rPts.length < 2) continue;
                for (let j = 0; j < rPts.length; j++) {
                    const rp1 = rPts[j];
                    const rp2 = rPts[(j + 1) % rPts.length];
                    const d = Math.sqrt(pointToSegDistSq(cp, rp1, rp2));
                    if (d <= thresholdPx) {
                        nearRoad = true;
                        break;
                    }
                }
                if (nearRoad) break;
            }
            if (nearRoad) hits++;
        }
        if (hits >= 2) {
            frontageSet.add(i);
        }
    }
    return Array.from(frontageSet).sort((a, b) => a - b);
}

/**
 * 依據使用者預先設定的基地邊長（可只設定 1 邊由比例等比推演，亦可部分或全部設定），
 * 計算調整後之基地多邊形座標、等比縮放係數 (scaleFactor) 與最終各邊長度
 */
export function solvePolygonWithEdgeLengths(basePoints, edgeOverrides = {}) {
    if (!basePoints || basePoints.length < 3) return null;
    const n = basePoints.length;
    const origLens = [];
    for (let i = 0; i < n; i++) {
        const p1 = basePoints[i];
        const p2 = basePoints[(i + 1) % n];
        origLens.push(Math.hypot(p2.x - p1.x, p2.y - p1.y));
    }

    // 篩選有效的大於 0 的自訂邊長
    const validOverrides = {};
    Object.keys(edgeOverrides || {}).forEach(k => {
        const idx = parseInt(k, 10);
        const val = parseFloat(edgeOverrides[k]);
        if (!isNaN(idx) && idx >= 0 && idx < n && !isNaN(val) && val > 0.1) {
            validOverrides[idx] = val;
        }
    });
    const overrideKeys = Object.keys(validOverrides).map(Number);

    if (overrideKeys.length === 0) {
        return {
            points: basePoints,
            areaSqm: calculatePolygonArea(basePoints, null),
            scaleFactor: 1,
            edgeLengths: origLens
        };
    }

    // 計算基準縮放比（單邊設定時 100% 等比推演其餘各邊；多邊設定時先以平均比例縮放再進行迭代約束求解）
    let ratioSum = 0;
    let ratioCnt = 0;
    overrideKeys.forEach(idx => {
        if (origLens[idx] > 1e-4) {
            ratioSum += validOverrides[idx] / origLens[idx];
            ratioCnt++;
        }
    });
    const scaleFactor = ratioCnt > 0 ? (ratioSum / ratioCnt) : 1;

    let pts = basePoints.map(p => ({
        x: p.x * scaleFactor,
        y: p.y * scaleFactor
    }));

    // 若設定超過 1 條邊，執行 Position-Based Geometry 迭代約束鬆弛，精準收斂每一條自訂邊長
    if (overrideKeys.length > 1) {
        const targetLens = origLens.map((l, idx) =>
            validOverrides[idx] !== undefined ? validOverrides[idx] : l * scaleFactor
        );
        const iterations = 90;
        for (let iter = 0; iter < iterations; iter++) {
            for (let i = 0; i < n; i++) {
                const nextI = (i + 1) % n;
                const p1 = pts[i];
                const p2 = pts[nextI];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const curLen = Math.hypot(dx, dy);
                if (curLen < 1e-6) continue;
                const isLocked = validOverrides[i] !== undefined;
                const stiffness = isLocked ? 0.65 : 0.08;
                const diff = (targetLens[i] - curLen) * 0.5 * stiffness;
                const ux = dx / curLen;
                const uy = dy / curLen;
                pts[i] = { x: p1.x - ux * diff, y: p1.y - uy * diff };
                pts[nextI] = { x: p2.x + ux * diff, y: p2.y + uy * diff };
            }
        }
        // 重新置中於幾何質心 (0, 0)
        const c = getPolygonCentroid(pts);
        pts = pts.map(p => ({
            x: parseFloat((p.x - c.x).toFixed(3)),
            y: parseFloat((p.y - c.y).toFixed(3))
        }));
    } else {
        pts = pts.map(p => ({
            x: parseFloat(p.x.toFixed(3)),
            y: parseFloat(p.y.toFixed(3))
        }));
    }

    const finalLens = [];
    for (let i = 0; i < n; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        finalLens.push(Math.hypot(p2.x - p1.x, p2.y - p1.y));
    }

    return {
        points: pts,
        areaSqm: calculatePolygonArea(pts, null),
        scaleFactor,
        edgeLengths: finalLens
    };
}

/**
 * 將單一點 (pt) 吸附至多邊形集合的最近邊線（含頂點優先），回傳 { pt, dist, label, isVertex }
 */
export function snapPointToPolygonEdges(pt, polygons, snapRadius = 14) {
    if (!pt || !Array.isArray(polygons) || polygons.length === 0) return null;
    let bestVertex = null;
    let bestVertexDist = snapRadius;
    let bestEdge = null;
    let bestEdgeDist = snapRadius;

    for (const poly of polygons) {
        const pts = poly.pointsPx || poly.points || poly;
        if (!Array.isArray(pts) || pts.length < 2) continue;
        const label = poly.label || '道路';
        const segCount = pts.length >= 3 ? pts.length : pts.length - 1;

        for (let i = 0; i < pts.length; i++) {
            const dV = Math.hypot(pt.x - pts[i].x, pt.y - pts[i].y);
            if (dV <= bestVertexDist) {
                bestVertexDist = dV;
                bestVertex = { pt: { x: pts[i].x, y: pts[i].y }, dist: dV, label: `吸附 ${label} 角點`, isVertex: true };
            }
        }
        for (let i = 0; i < segCount; i++) {
            const a = pts[i];
            const b = pts[(i + 1) % pts.length];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const l2 = dx * dx + dy * dy;
            if (l2 < 1e-6) continue;
            const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / l2));
            const px = a.x + t * dx;
            const py = a.y + t * dy;
            const dE = Math.hypot(pt.x - px, pt.y - py);
            if (dE <= bestEdgeDist) {
                bestEdgeDist = dE;
                bestEdge = { pt: { x: px, y: py }, dist: dE, label: `吸附 ${label} 邊緣`, isVertex: false };
            }
        }
    }
    return bestVertex || bestEdge || null;
}

/**
 * 當道路多邊形出現時，將基地多邊形中緊鄰道路邊界之頂點自動吸附貼齊至道路邊線上，消除微小縫隙
 */
export function snapSitePolygonToRoadEdges(sitePts, roadPolys, snapThreshold = 14) {
    if (!Array.isArray(sitePts) || sitePts.length < 3 || !Array.isArray(roadPolys) || roadPolys.length === 0) {
        return sitePts;
    }
    return sitePts.map(pt => {
        const snapped = snapPointToPolygonEdges(pt, roadPolys, snapThreshold);
        return snapped ? snapped.pt : pt;
    });
}
