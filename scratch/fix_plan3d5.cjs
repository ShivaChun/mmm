const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

code = code.replace(
    /        candidateId\n            const maxArea = Math.max\(0, layer\?.maxGeometricArea \|\| 0\);/g,
    `        candidateIds.forEach(id => {
            const layer = layerMap.get(id);
            const maxArea = Math.max(0, layer?.maxGeometricArea || 0);`
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code);
console.log('Fixed candidateId error!');
