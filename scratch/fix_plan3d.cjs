const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// Simple string replacement function
function replaceAll(str, find, replace) {
  return str.split(find).join(replace);
}

code = replaceAll(code, 'const x = p.x * scale + w / 2; const y = p.y * scale + d / 2;', 'const x = p.x * scale; const y = p.y * scale;');
code = replaceAll(code, 'innerPathD += ` Q ${curve.x * scale + w / 2} ${curve.y * scale + d / 2}, ${x} ${y}`;', 'innerPathD += ` Q ${curve.x * scale} ${curve.y * scale}, ${x} ${y}`;');

code = replaceAll(code, 'const x = pt.x * scale + w / 2; const y = pt.y * scale + d / 2;', 'const x = pt.x * scale; const y = pt.y * scale;');
code = replaceAll(code, 'outerPathD += ` Q ${curve.x * scale + w / 2} ${curve.y * scale + d / 2}, ${x} ${y}`;', 'outerPathD += ` Q ${curve.x * scale} ${curve.y * scale}, ${x} ${y}`;');

code = replaceAll(code, 'const labelX = (p1.x + p2.x) / 2 * scale + w / 2 + l.vec.x / 2 * scale;', 'const labelX = (p1.x + p2.x) / 2 * scale + l.vec.x / 2 * scale;');
code = replaceAll(code, 'const labelY = (p1.y + p2.y) / 2 * scale + d / 2 + l.vec.y / 2 * scale;', 'const labelY = (p1.y + p2.y) / 2 * scale + l.vec.y / 2 * scale;');

code = replaceAll(code, '<svg width="100%" height="100%" viewBox={`0 0 ${w} ${d}`} style={{ overflow: \'visible\' }}>', '<svg style={{ position: \'absolute\', top: 0, left: 0, overflow: \'visible\' }}>');

code = replaceAll(code, 'const path = generateSvgPath(pts, scale, w / 2, d / 2);', 'const path = generateSvgPath(pts, scale, 0, 0);');

code = replaceAll(code, 'const offX = w / 2;', 'const offX = 0;');
code = replaceAll(code, 'const offY = d / 2;', 'const offY = 0;');

code = replaceAll(code, '<path d={generateSvgPath(patchPts, scale, w/2, d/2)} fill={isDarkMode ? \'rgba(168,85,247,0.1)\' : \'rgba(168,85,247,0.15)\'} />', '<path d={generateSvgPath(patchPts, scale, 0, 0)} fill={isDarkMode ? \'rgba(168,85,247,0.1)\' : \'rgba(168,85,247,0.15)\'} />');
code = replaceAll(code, '<text x={w/2+cx*scale} y={d/2+cy*scale}', '<text x={cx*scale} y={cy*scale}');

code = replaceAll(code, 'const toggleFullscreen = () => { if (isSummaryOpen) { setIsSummaryOpen(false); } else { setIsSummaryOpen(true); } };', 'const toggleFullscreen = () => { if (typeof onToggleFullscreen === "function") { onToggleFullscreen(); } else { setIsSummaryOpen(!isSummaryOpen); } };');

const oldLabelRegex = /\{isPrimary && \([\s\S]*?<div style=\{\{ position: 'absolute', top: 0, left: 0, width: `\$\{ps\.site\.inputs\.baseWidthM \* scale\}px`, height: `\$\{ps\.site\.inputs\.baseDepthM \* scale\}px`, transform: 'translate\(-50%, -50%\)', pointerEvents: 'none', zIndex: 11 \}\}>[\s\S]*?<div className="absolute inset-0 border-2 border-indigo-500\/30 rounded shadow-\[0_0_15px_rgba\(79,70,229,0\.1\)\]"><\/div>[\s\S]*?<div className="absolute top-0 left-1\/2 -translate-x-1\/2 -translate-y-full pb-2"><div className="bg-indigo-600 text-white text-\[10px\] font-bold px-2 py-0\.5 rounded shadow-sm whitespace-nowrap">\{ps\.site\.name\} \(編輯中\)<\/div><\/div>[\s\S]*?<\/div>[\s\S]*?\)\}/;

const newLabelStr = `{/* Primary border */}
{isPrimary && (
    <div style={{ position: 'absolute', top: 0, left: 0, width: \`\${ps.site.inputs.baseWidthM * scale}px\`, height: \`\${ps.site.inputs.baseDepthM * scale}px\`, transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 11 }}>
        <div className="absolute inset-0 border-2 border-indigo-500/30 rounded shadow-[0_0_15px_rgba(79,70,229,0.1)]"></div>
    </div>
)}
{/* Label for ALL sites */}
<div style={{ position: 'absolute', top: 0, left: 0, transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 12 }}>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2">
        <div className="bg-indigo-600/90 backdrop-blur-sm border border-indigo-400/50 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
            {ps.site.name || \`基地 \${ps.site.id}\`} {isPrimary && " (編輯中)"}
        </div>
    </div>
</div>`;

code = code.replace(oldLabelRegex, newLabelStr);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
console.log('Done!');
