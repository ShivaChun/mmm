const fs = require('fs');
let src = fs.readFileSync('c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/components/PlanAnalysis3D.jsx', 'utf8');

// We will inject globalLabels right after offY in renderPolygonSetbacks, wait, no, at the top of Visualizer3D!
src = src.replace(
    'const { widthPx: pW, depthPx: pD } = projectInputs;',
    'const { widthPx: pW, depthPx: pD } = projectInputs;\n    const globalLabels = [];'
);

// Road labels
const roadLabelsRegex = /labels\.push\(\<Si key=\{`road-label-\$\{ps\.site\.id\}-\$\{gIdx\}`\}.*?\/\>\);/g;
src = src.replace(roadLabelsRegex, 'globalLabels.push({ id: `road-label-${ps.site.id}-${gIdx}`, text: `${seg.name} ${seg.width}m`, x: labelX, y: labelY, z: 2 });');

fs.writeFileSync('c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/components/PlanAnalysis3D.jsx', src);
console.log('Script written');
