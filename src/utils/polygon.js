import { toPing } from './geometry';

export const generateSvgPath = (points, curves, scale = 1, offsetX = 0, offsetY = 0) => {
    if (!points || points.length === 0) return "";
    let d = `M ${(points[0].x * scale) + offsetX} ${(points[0].y * scale) + offsetY}`;
    for (let i = 0; i < points.length; i++) {
        const nextP = points[(i + 1) % points.length];
        const curve = curves ? curves[i] : null;
        if (curve) {
            d += ` Q ${(curve.x * scale) + offsetX} ${(curve.y * scale) + offsetY}, ${(nextP.x * scale) + offsetX} ${(nextP.y * scale) + offsetY}`;
        } else {
            d += ` L ${(nextP.x * scale) + offsetX} ${(nextP.y * scale) + offsetY}`;
        }
    }
    d += " Z";
    return d;
};

export const calculatePolygonArea = (points, curves = null) => {
    if (!points || points.length < 3) return 0;
    const pts = (curves && Object.keys(curves).length > 0)
        ? discretizePolygon(points, curves, 20).points
        : points;
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y;
        area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area) / 2;
};

export const getPolygonCentroid = (points) => {
    if (!points || points.length === 0) return { x: 0, y: 0 };
    let cx = 0, cy = 0, area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        const cross = points[i].x * points[j].y - points[j].x * points[i].y;
        cx += (points[i].x + points[j].x) * cross;
        cy += (points[i].y + points[j].y) * cross;
        area += cross;
    }
    area /= 2;
    if (area === 0) {
        const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        return { x: sum.x / points.length, y: sum.y / points.length };
    }
    return { x: cx / (6 * area), y: cy / (6 * area) };
};

export const getPolygonBounds = (points) => {
    if (!points || points.length === 0) return null;
    let minX = points[0].x, maxX = points[0].x, minY = points[0].y, maxY = points[0].y;
    for (let i = 1; i < points.length; i++) {
        const p = points[i];
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY };
};

export const scalePolygon = (points, curves, scale, centroid) => {
    if (!points) return { points: null, curves: null };
    const center = centroid || getPolygonCentroid(points);
    const newPoints = points.map(p => ({
        x: (p.x - center.x) * scale + center.x,
        y: (p.y - center.y) * scale + center.y
    }));
    let newCurves = null;
    if (curves) {
        newCurves = {};
        Object.keys(curves).forEach(k => {
            const cp = curves[k];
            newCurves[k] = {
                x: (cp.x - center.x) * scale + center.x,
                y: (cp.y - center.y) * scale + center.y
            };
        });
    }
    return { points: newPoints, curves: newCurves };
};

export const pointInPolygon = (pt, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / ((yj - yi) || 1e-12) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

export const allInsidePolygon = (points, container) => {
    if (!points || !container || points.length === 0 || container.length < 3) return false;
    for (let i = 0; i < points.length; i++) {
        if (!pointInPolygon(points[i], container)) return false;
    }
    return true;
};

export const polygonSignedArea = (points) => {
    if (!points || points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y - points[j].x * points[i].y;
    }
    return area / 2;
};

export const clipPolygonByPolygon = (subject, clip) => {
    if (!subject || subject.length < 3 || !clip || clip.length < 3) return subject;
    let output = subject;
    const clipArea = polygonSignedArea(clip);
    const isCCW = clipArea >= 0;
    const inside = (p, a, b) => {
        const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        return isCCW ? cross >= -1e-9 : cross <= 1e-9;
    };
    const intersection = (s, e, a, b) => {
        const dx1 = e.x - s.x;
        const dy1 = e.y - s.y;
        const dx2 = b.x - a.x;
        const dy2 = b.y - a.y;
        const denom = dx1 * dy2 - dy1 * dx2;
        if (Math.abs(denom) < 1e-12) return e;
        const t = ((a.x - s.x) * dy2 - (a.y - s.y) * dx2) / denom;
        return { x: s.x + t * dx1, y: s.y + t * dy1 };
    };
    for (let i = 0; i < clip.length; i++) {
        const a = clip[i];
        const b = clip[(i + 1) % clip.length];
        const input = output;
        output = [];
        for (let j = 0; j < input.length; j++) {
            const s = input[j];
            const e = input[(j + 1) % input.length];
            const eInside = inside(e, a, b);
            const sInside = inside(s, a, b);
            if (eInside) {
                if (!sInside) output.push(intersection(s, e, a, b));
                output.push(e);
            } else if (sInside) {
                output.push(intersection(s, e, a, b));
            }
        }
        if (output.length === 0) return null;
    }
    return output;
};

export const fitPolygonWithin = (points, curves, container) => {
    if (!points || !container) return { points, curves };
    if (allInsidePolygon(points, container)) return { points, curves };
    let lo = 0.1, hi = 1.0;
    let best = { points, curves };
    const centroid = getPolygonCentroid(points);
    for (let iter = 0; iter < 14; iter++) {
        const mid = (lo + hi) / 2;
        const scaled = scalePolygon(points, curves, mid, centroid);
        if (allInsidePolygon(scaled.points, container)) {
            best = scaled; lo = mid;
        } else {
            hi = mid;
        }
    }
    return best;
};

export const isPolygonConvex = (poly) => {
    if (!poly || poly.length < 3) return false;
    let sign = 0;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % n];
        const c = poly[(i + 2) % n];
        const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
        if (Math.abs(cross) > 1e-6) {
            const s = cross > 0 ? 1 : -1;
            if (sign === 0) sign = s;
            else if (sign !== s) return false;
        }
    }
    return true;
};

export const constrainPolygonToLegalBoundary = (points, curves, boundaryPoints, boundaryCurves = null) => {
    if (!points || points.length < 3 || !boundaryPoints || boundaryPoints.length < 3) {
        return { points, curves };
    }
    const boundaryDense = (boundaryCurves && Object.keys(boundaryCurves).length > 0)
        ? discretizePolygon(boundaryPoints, boundaryCurves, 20).points
        : boundaryPoints;
    const subjectDense = (curves && Object.keys(curves).length > 0)
        ? discretizePolygon(points, curves, 20).points
        : points;

    if (allInsidePolygon(subjectDense, boundaryDense)) {
        return { points, curves };
    }

    if (isPolygonConvex(boundaryDense)) {
        const clipped = clipPolygonByPolygon(subjectDense, boundaryDense);
        if (clipped && clipped.length >= 3) {
            return { points: clipped, curves: null };
        }
    }

    // 若法規退縮邊界含有內凹曲線，採用向退縮幾何中心二分收斂投影，確保頂點 100% 落於合法退縮範圍內且不誤切凹面
    const center = getPolygonCentroid(boundaryDense);
    const clampedPts = subjectDense.map(pt => {
        if (pointInPolygon(pt, boundaryDense)) return pt;
        let lo = 0, hi = 1;
        let best = { ...center };
        for (let iter = 0; iter < 16; iter++) {
            const mid = (lo + hi) / 2;
            const testPt = {
                x: center.x + (pt.x - center.x) * mid,
                y: center.y + (pt.y - center.y) * mid
            };
            if (pointInPolygon(testPt, boundaryDense)) {
                best = testPt;
                lo = mid;
            } else {
                hi = mid;
            }
        }
        return best;
    });
    return { points: clampedPts, curves: null };
};

export const getSegmentNormal = (p1, p2, centroid) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x: 0, y: 0 };

    let nx = -dy / len;
    let ny = dx / len;

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const toCentroidX = centroid.x - midX;
    const toCentroidY = centroid.y - midY;

    if (nx * toCentroidX + ny * toCentroidY < 0) {
        nx = -nx;
        ny = -ny;
    }
    return { x: nx, y: ny };
};

export const getLineIntersection = (p1, p2, p3, p4) => {
    const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (denom == 0) return null;
    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    return { x: p1.x + ua * (p2.x - p1.x), y: p1.y + ua * (p2.y - p1.y) };
};

export const discretizePolygon = (points, curves, steps = 10) => {
    if (!curves) return { points: points, edgeMap: points.map((_, i) => i) };
    const newPoints = [];
    const edgeMap = [];
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        const curve = curves[i];
        if (curve) {
            for (let j = 0; j < steps; j++) {
                const t = j / steps;
                const invT = 1 - t;
                const x = invT * invT * p1.x + 2 * invT * t * curve.x + t * t * p2.x;
                const y = invT * invT * p1.y + 2 * invT * t * curve.y + t * t * p2.y;
                newPoints.push({ x, y });
                edgeMap.push(i);
            }
        } else {
            newPoints.push(p1);
            edgeMap.push(i);
        }
    }
    return { points: newPoints, edgeMap };
};

export const offsetPolygon = (points, edgeTypes, depths, frontageIndices, curves) => {
    if (!points || points.length < 3) return null;

    const N = points.length;
    const centroid = getPolygonCentroid(points);

    const shiftedLines = [];
    for (let i = 0; i < N; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % N];
        const normal = getSegmentNormal(p1, p2, centroid);

        let depth = 0;
        if (frontageIndices && frontageIndices.has(i)) {
            depth = depths.front || 0;
        } else if (edgeTypes && edgeTypes[i] === 'back') {
            depth = depths.back || 0;
        } else if (edgeTypes && edgeTypes[i] === 'side') {
            depth = depths.side || 0;
        }

        const shiftX = normal.x * depth;
        const shiftY = normal.y * depth;

        shiftedLines.push({
            p1: { x: p1.x + shiftX, y: p1.y + shiftY },
            p2: { x: p2.x + shiftX, y: p2.y + shiftY },
            origIdx: i,
            shiftX,
            shiftY
        });
    }

    const newPoints = [];
    const newEdgeIndices = [];

    // newPoints[i] is the offset vertex corresponding to points[i]
    // (intersection of previous edge i-1 and current edge i)
    for (let i = 0; i < N; i++) {
        const lPrev = shiftedLines[(i - 1 + N) % N];
        const lCurr = shiftedLines[i];
        const intersect = getLineIntersection(lPrev.p1, lPrev.p2, lCurr.p1, lCurr.p2);

        if (intersect) {
            newPoints.push(intersect);
        } else {
            newPoints.push(lCurr.p1);
        }
        newEdgeIndices.push(i);
    }

    let newCurves = null;
    if (curves && Object.keys(curves).length > 0) {
        newCurves = {};
        Object.keys(curves).forEach(k => {
            const idx = parseInt(k, 10);
            const cp = curves[k];
            if (!cp || isNaN(idx) || idx < 0 || idx >= N) return;
            const p1 = points[idx];
            const p2 = points[(idx + 1) % N];
            const np1 = newPoints[idx];
            const np2 = newPoints[(idx + 1) % N];
            const oldMid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const newMid = { x: (np1.x + np2.x) / 2, y: (np1.y + np2.y) / 2 };
            const oldLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const newLen = Math.hypot(np2.x - np1.x, np2.y - np1.y);
            const scale = oldLen > 1e-6 ? (newLen / oldLen) : 1;
            newCurves[idx] = {
                x: newMid.x + (cp.x - oldMid.x) * scale,
                y: newMid.y + (cp.y - oldMid.y) * scale
            };
        });
    }

    return { points: newPoints, curves: newCurves, edgeIndices: newEdgeIndices };
};

export const offsetPolygonByArray = (points, curves, depthsArray) => {
    if (!points || points.length < 3) return null;
    const { points: densePoints, edgeMap } = discretizePolygon(points, curves, 15);
    const centroid = getPolygonCentroid(densePoints);
    const shiftedLines = [];
    for (let i = 0; i < densePoints.length; i++) {
        const p1 = densePoints[i];
        const p2 = densePoints[(i + 1) % densePoints.length];
        const normal = getSegmentNormal(p1, p2, centroid);
        const originalIdx = edgeMap[i];
        
        let depth = depthsArray[originalIdx] || 0;
        
        const shiftX = normal.x * depth;
        const shiftY = normal.y * depth;
        
        shiftedLines.push({
            p1: { x: p1.x + shiftX, y: p1.y + shiftY },
            p2: { x: p2.x + shiftX, y: p2.y + shiftY },
            origIdx: originalIdx
        });
    }
    const newPoints = [];
    const newEdgeIndices = [];
    for (let i = 0; i < shiftedLines.length; i++) {
        const l1 = shiftedLines[i];
        const l2 = shiftedLines[(i + 1) % shiftedLines.length];
        const intersect = getLineIntersection(l1.p1, l1.p2, l2.p1, l2.p2);
        if (intersect) {
            newPoints.push(intersect);
        } else {
            newPoints.push(l1.p2);
        }
        newEdgeIndices.push(l1.origIdx);
    }
    return { points: newPoints, edgeIndices: newEdgeIndices };
};

export const distToSegment = (p, v, w) => {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 == 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
};

export const normalizeWithCurves = (points, curves) => {
    if (!points) return { points: null, curves: null, centroid: { x: 0, y: 0 } };
    const centroid = getPolygonCentroid(points);
    const newPoints = points.map(p => ({ x: p.x - centroid.x, y: p.y - centroid.y }));
    let newCurves = null;
    if (curves) {
        newCurves = {};
        Object.keys(curves).forEach(k => {
            const cp = curves[k];
            newCurves[k] = { x: cp.x - centroid.x, y: cp.y - centroid.y };
        });
    }
    return { points: newPoints, curves: newCurves, centroid };
};

export const splitPolygon = (points, axis, ratio, gap, curves = null) => {
    if (!points || points.length < 3) return [points];
    const sourcePts = (curves && Object.keys(curves).length > 0)
        ? discretizePolygon(points, curves, 24).points
        : points;
    const xs = sourcePts.map(p => p.x); const ys = sourcePts.map(p => p.y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const w = maxX - minX; const h = maxY - minY;
    const span = axis === 'x' ? w : h;
    if (span <= 1e-6) return [sourcePts];

    const safeRatio = Math.max(0.05, Math.min(0.95, parseFloat(ratio) || 0.5));
    const safeGap = Math.max(0, Math.min(span * 0.6, parseFloat(gap) || 0));
    const minVal = axis === 'x' ? minX : minY;
    const cutCenter = minVal + span * safeRatio;
    const cut1 = Math.max(minVal + span * 0.02, cutCenter - safeGap / 2);
    const cut2 = Math.min(minVal + span * 0.98, cutCenter + safeGap / 2);

    const clip = (pts, isKeep, limit) => {
        const newPts = [];
        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i]; const p2 = pts[(i + 1) % pts.length];
            const v1 = axis === 'x' ? p1.x : p1.y; const v2 = axis === 'x' ? p2.x : p2.y;
            const in1 = isKeep(v1); const in2 = isKeep(v2);
            if (in1) {
                newPts.push(p1);
                if (!in2 && v2 !== v1) {
                    const alpha = (limit - v1) / (v2 - v1);
                    newPts.push({ x: p1.x + (p2.x - p1.x) * alpha, y: p1.y + (p2.y - p1.y) * alpha });
                }
            } else if (in2 && v2 !== v1) {
                const alpha = (limit - v1) / (v2 - v1);
                newPts.push({ x: p1.x + (p2.x - p1.x) * alpha, y: p1.y + (p2.y - p1.y) * alpha });
            }
        }
        return newPts.length >= 3 ? newPts : null;
    };

    // 依當前基地與法規退縮範圍內部切割棟距，確保分戶絕對不超出退縮線與道路邊界
    const p1 = clip(sourcePts, (v) => v <= cut1 + 1e-6, cut1);
    const p2 = clip(sourcePts, (v) => v >= cut2 - 1e-6, cut2);
    return [p1, p2].filter(p => p !== null);
};

export const splitPolygonByCount = (points, axis, count, gap, curves = null) => {
    if (!points || points.length < 3) return [points];
    const sourcePts = (curves && Object.keys(curves).length > 0)
        ? discretizePolygon(points, curves, 24).points
        : points;
    const safeCount = Math.max(1, Math.round(count || 1));
    if (safeCount === 1) return [sourcePts];
    const xs = sourcePts.map(p => p.x); const ys = sourcePts.map(p => p.y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const len = axis === 'x' ? (maxX - minX) : (maxY - minY);
    if (len <= 0) return [sourcePts];

    const safeGap = Math.max(0, parseFloat(gap) || 0);
    const effectiveGap = safeCount > 1 ? Math.min(safeGap, (len * 0.65) / (safeCount - 1)) : 0;
    const unitLen = (len - effectiveGap * (safeCount - 1)) / safeCount;
    const minVal = axis === 'x' ? minX : minY;

    const clip = (pts, isKeep, limit) => {
        const newPts = [];
        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i]; const p2 = pts[(i + 1) % pts.length];
            const v1 = axis === 'x' ? p1.x : p1.y; const v2 = axis === 'x' ? p2.x : p2.y;
            const in1 = isKeep(v1); const in2 = isKeep(v2);
            if (in1) {
                newPts.push(p1);
                if (!in2 && v2 !== v1) {
                    const alpha = (limit - v1) / (v2 - v1);
                    newPts.push({ x: p1.x + (p2.x - p1.x) * alpha, y: p1.y + (p2.y - p1.y) * alpha });
                }
            } else if (in2 && v2 !== v1) {
                const alpha = (limit - v1) / (v2 - v1);
                newPts.push({ x: p1.x + (p2.x - p1.x) * alpha, y: p1.y + (p2.y - p1.y) * alpha });
            }
        }
        return newPts.length >= 3 ? newPts : null;
    };

    // 在合法退縮包絡線內切割各戶與棟距，使各戶面積與形狀完全符合當前基地與退縮限制
    const units = [];
    for (let i = 0; i < safeCount; i++) {
        const segStart = minVal + i * (unitLen + effectiveGap);
        const segEnd = segStart + unitLen;
        let seg = clip(sourcePts, (v) => v >= segStart - 1e-6, segStart);
        if (seg) seg = clip(seg, (v) => v <= segEnd + 1e-6, segEnd);
        if (seg) units.push(seg);
    }
    return units.length > 0 ? units : [sourcePts];
};

export const getSplitUnits = (points, settings, curves = null, allowedPolygon = null, allowedCurves = null) => {
    if (!points || !settings) return null;
    let workingPts = points;
    let workingCurves = curves;
    if (allowedPolygon && allowedPolygon.length >= 3) {
        const constrained = constrainPolygonToLegalBoundary(points, curves, allowedPolygon, allowedCurves);
        workingPts = constrained.points;
        workingCurves = constrained.curves;
    }
    const mode = settings.mode || 'ratio';
    const axis = settings.axis || 'x';
    const gap = settings.gap || 0;
    let units = null;
    if (mode === 'ratio') {
        units = splitPolygon(workingPts, axis, settings.ratio || 0.5, gap, workingCurves);
    } else {
        let count = settings.count || 1;
        if (mode === 'area') {
            const perUnit = parseFloat(settings.areaPerUnit || 0);
            if (perUnit > 0) {
                const totalPing = toPing(calculatePolygonArea(workingPts, workingCurves));
                count = Math.max(1, Math.round(totalPing / perUnit));
            } else {
                count = 1;
            }
        }
        units = splitPolygonByCount(workingPts, axis, count, gap, workingCurves);
    }
    if (allowedPolygon && allowedPolygon.length >= 3 && Array.isArray(units)) {
        units = units
            .map(uPts => constrainPolygonToLegalBoundary(uPts, null, allowedPolygon, allowedCurves).points)
            .filter(uPts => uPts && uPts.length >= 3);
    }
    return units;
};

export const edgesIntersect = (p1, p2, p3, p4) => { const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y); if (denom === 0) return false; const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom; const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom; return (ua > 0 && ua < 1 && ub > 0 && ub < 1); };
export const polygonsOverlap = (poly1, poly2) => { if (!poly1 || !poly2 || poly1.length < 3 || poly2.length < 3) return false; for (let p of poly1) { if (pointInPolygon(p, poly2)) return true; } for (let p of poly2) { if (pointInPolygon(p, poly1)) return true; } for (let i = 0; i < poly1.length; i++) { const a = poly1[i]; const b = poly1[(i+1)%poly1.length]; for (let j = 0; j < poly2.length; j++) { const c = poly2[j]; const d = poly2[(j+1)%poly2.length]; if (edgesIntersect(a, b, c, d)) return true; } } return false; };