const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// Fix 1: Site Label
code = code.replace(
    /\{isPrimary && \(\s*<div style=\{\{ position: 'absolute', top: '50%', left: '50%'.*?\{ps\.site\.name\} \(½s¿è¤¤\)<\/div><\/div>\s*<\/div>\s*\)\}/g,
    \{isPrimary && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: \\\\px\\\, height: \\\\px\\\, transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 11 }}>
            <div className="absolute inset-0 border-2 border-indigo-500/30 rounded shadow-[0_0_15px_rgba(79,70,229,0.1)]"></div>
        </div>
    )}
    <Si 
        key={\\\site-label-\\\\} 
        text={<span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400"></div>{ps.site.name}{isPrimary ? " (½s¿è¤¤)" : ""}</span>} 
        x={w/2} 
        y={d/2 - (ps.site.inputs.baseDepthM * scale)/2 - 10} 
        z={30} 
        rotationZ={rotationZ} 
        baseRotation={layout.rotation * (180/Math.PI)} 
        viewAngleX={viewAngleX} 
        visible={true} 
        className="text-[10px] font-bold bg-slate-900/90 text-white px-2 py-0.5 rounded-full shadow-lg border-2 border-slate-700/50 backdrop-blur-sm" 
    />\
);

// Fix 2: Road label z-index/height so it doesn't obscure base label
code = code.replace(
    /z=\{2\}/g,
    'z={5}'
);

// Fix 3: Use actual road width for CheckLines
const getRoadWBlock = \
            const roadObj = getSiteRoads(ps.site).find(r => r.edgeIndex === originalIdx || (r.edgeIndices && r.edgeIndices.includes(originalIdx)));
            const actualRoadW_M = roadObj ? parseFloat(roadObj.width) : primRoadW_M;
\;
code = code.replace(
    /const fD = parseFloat\(inputs\.frontYardDepth \|\| 0\);\s*const p_out_M = \{ x: mid\.x - normal\.x \* primRoadW_M, y: mid\.y - normal\.y \* primRoadW_M \};\s*const p_center_M = \{ x: mid\.x - normal\.x \* \(primRoadW_M \/ 2\), y: mid\.y - normal\.y \* \(primRoadW_M \/ 2\) \};/g,
    \const fD = parseFloat(inputs.frontYardDepth || 0);
                \
                const p_out_M = { x: mid.x - normal.x * actualRoadW_M, y: mid.y - normal.y * actualRoadW_M };
                const p_center_M = { x: mid.x - normal.x * (actualRoadW_M / 2), y: mid.y - normal.y * (actualRoadW_M / 2) };\
);

code = code.replace(
    /const hRatioH = 3\.6 \* \(primRoadW_M \+ fD\) \* scale;/g,
    \const hRatioH = 3.6 * (actualRoadW_M + fD) * scale;\
);

code = code.replace(
    /const wlH = 5 \* \(0\.5 \* primRoadW_M \+ fD\) \* scale;/g,
    \const wlH = 5 * (0.5 * actualRoadW_M + fD) * scale;\
);

// Fix 4: Also fix groupsFrontOuter and groupsFrontInner for shading
code = code.replace(
    /const p1Out = \{ x: p1\.x - n\.x \* primRoadW_M, y: p1\.y - n\.y \* primRoadW_M \};\s*const p2Out = \{ x: p2\.x - n\.x \* primRoadW_M, y: p2\.y - n\.y \* primRoadW_M \};/g,
    \const roadObj = getSiteRoads(ps.site).find(r => r.edgeIndex === originalIdx || (r.edgeIndices && r.edgeIndices.includes(originalIdx)));
                const actualRoadW_M = roadObj ? parseFloat(roadObj.width) : primRoadW_M;
                const p1Out = { x: p1.x - n.x * actualRoadW_M, y: p1.y - n.y * actualRoadW_M };
                const p2Out = { x: p2.x - n.x * actualRoadW_M, y: p2.y - n.y * actualRoadW_M };\
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
console.log('Fixed labels and CheckLines!');
