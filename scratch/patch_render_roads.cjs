const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

src = src.replace(
    'const normalizedPoints = toWorldPts(normalizedData.points, ps.layout);',
    'const normalizedPoints = normalizedData.points;' // removed toWorldPts to prevent double transform
);
src = src.replace(
    'const normalizedCurves = normalizedData.curves ? normalizedData.curves.map(c => c ? toWorldPts([c], ps.layout)[0] : null) : [];',
    'const normalizedCurves = normalizedData.curves;' // removed toWorldPts
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
console.log('Patched renderRoads successfully!');
