const renderPolygonSetbacks = (ps) => {
const site = ps.site;
const normalizedData = ps.normalized;
const inputs = site.inputs;
const rawNormalized = normalizedData.points;
if (!rawNormalized) return null;

let { points: normalizedPoints, edgeMap } = discretizePolygon(rawNormalized, normalizedData.curves, 15);
normalizedPoints = toWorldPts(normalizedPoints, ps.layout);
const primaryIndices = new Set();
const secondaryIndices = new Set();
if (inputs.roads) {
inputs.roads.forEach(r => {
const indices = new Set();
if (r.edgeIndices) r.edgeIndices.forEach(i => indices.add(i));
if (r.edgeIndex !== undefined && r.edgeIndex !== "") indices.add(parseInt(r.edgeIndex));
if (r.type === 'primary') indices.forEach(i => primaryIndices.add(i));
else indices.forEach(i => secondaryIndices.add(i));
});
}
const initialFront = new Set();
if (frontageIndices && frontageIndices.size > 0) frontageIndices.forEach(i => initialFront.add(i));
else if (primaryIndices.size > 0) primaryIndices.forEach(i => initialFront.add(i));
else if (secondaryIndices.size > 0) secondaryIndices.forEach(i => initialFront.add(i));
const edgeCount = rawNormalized.length;
const frontIndices = new Set();
initialFront.forEach(i => { if (Number.isInteger(i) && i >= 0 && i < edgeCount) frontIndices.add(i); });
const combinedEdgeTypes = {};
Object.keys(edgeTypes || {}).forEach(k => {
const idx = parseInt(k);
if (!Number.isNaN(idx) && idx >= 0 && idx < edgeCount && !frontIndices.has(idx)) combinedEdgeTypes[idx] = edgeTypes[k];
});
secondaryIndices.forEach(idx => {
if (idx >= 0 && idx < edgeCount && !frontIndices.has(idx) && !combinedEdgeTypes[idx]) combinedEdgeTypes[idx] = 'side';
});
const hasExplicitBack = Object.values(combinedEdgeTypes).includes('back');
if ((!hasExplicitBack || sideM > 0) && normalizedPoints.length > 2 && frontIndices.size > 0) {
const centroid = getPolygonCentroid(normalizedPoints);
let frontNormal = { x: 0, y: 0 }; let count = 0;
normalizedPoints.forEach((p, i) => {
const orig = edgeMap[i];
if (frontIndices.has(orig)) {
const p2 = normalizedPoints[(i + 1) % normalizedPoints.length];
const n = getSegmentNormal(p, p2, centroid);
frontNormal.x += n.x; frontNormal.y += n.y; count++;
}
});
if (count > 0) {
const len = Math.sqrt(frontNormal.x * frontNormal.x + frontNormal.y * frontNormal.y);
if (len > 0) {
frontNormal.x /= len; frontNormal.y /= len;
if (!hasExplicitBack) {
normalizedPoints.forEach((p, i) => {
const origIdx = edgeMap[i];
if (!frontIndices.has(origIdx) && !combinedEdgeTypes[origIdx]) {
const p2 = normalizedPoints[(i + 1) % normalizedPoints.length];
const n = getSegmentNormal(p, p2, centroid);
const dot = n.x * frontNormal.x + n.y * frontNormal.y;
if (dot < -0.5) combinedEdgeTypes[origIdx] = 'back';
}
});
}
const hasExplicitSide = Object.values(combinedEdgeTypes).includes('side');
if (!hasExplicitSide && sideM > 0) {
const desiredSign = sideDir === 'left' ? 1 : -1;
const candidates = [];
normalizedPoints.forEach((p, i) => {
const origIdx = edgeMap[i];
if (frontIndices.has(origIdx) || combinedEdgeTypes[origIdx]) return;
const p2 = normalizedPoints[(i + 1) % normalizedPoints.length];
const n = getSegmentNormal(p, p2, centroid);
const dot = n.x * frontNormal.x + n.y * frontNormal.y;
const cross = frontNormal.x * n.y - frontNormal.y * n.x;
candidates.push({ origIdx, dot, cross });
});
let selected = candidates.filter(c => Math.abs(c.dot) < 0.3 && desiredSign * c.cross > 0);
if (selected.length === 0) {
selected = candidates.filter(c => desiredSign * c.cross > 0).sort((a, b) => Math.abs(a.dot) - Math.abs(b.dot));
}
selected.forEach(c => { combinedEdgeTypes[c.origIdx] = 'side'; });
}
}
}
}
const centroid = getPolygonCentroid(normalizedPoints);
const getDepthByType = (type) => {
if (type === 'front') return arcadeM > 0 ? arcadeM : frontM;
if (type === 'back') return backM;
if (type === 'side') return sideM;
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
base: isDarkMode ? "rgba(244, 63, 94, 0.22)" : "rgba(244, 63, 94, 0.18)",
stripe: isDarkMode ? "rgba(244, 63, 94, 0.55)" : "rgba(244, 63, 94, 0.35)"
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
<svg width={w} height={d} viewBox={`0 0 ${w} ${d}`} style={{ overflow: 'visible', position: 'absolute', top: -d/2, left: -w/2 }}>
<defs>
<pattern id={fillIds[type]} x="0" y="0" width={hatchSize} height={hatchSize} patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" patternTransform="rotate(45)">
<rect width={hatchSize} height={hatchSize} fill={hatchPalette[type].base} />
<rect width={hatchSize / 2} height={hatchSize} fill={hatchPalette[type].stripe} />
</pattern>
</defs>
<path d={dPath} fill={`url(#${fillIds[type]})`} stroke="none" fillRule="evenodd" />
</svg>
</React.Fragment>
);
});

const labels = [];
const colorByType = { front: "#f43f5e", back: "#10b981", side: "#3b82f6" };
const labelByType = { front: arcadeM > 0 ? "騎樓" : "前院", back: "後院", side: "側院" };
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

return (
<div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
{paths}
<svg width={w} height={d} viewBox={`0 0 ${w} ${d}`} style={{ overflow: 'visible', position: 'absolute', top: -d/2, left: -w/2 }}>
{labels.map(label => (
<text key={label.key} x={label.x * scale + w / 2} y={label.y * scale + d / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(14 * (scale / 20), 4)} fill={label.color} opacity={0.9} className="select-none">
{label.text}
</text>
))}
</svg>
</div>
);
};