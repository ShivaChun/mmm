const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

src = src.replace(
    /const normalizedPoints = toWorldPts\(normalizedData\.points, ps\.layout\);/,
    `const normalizedPoints = toWorldPts(normalizedData.points, ps.layout);
        const normalizedCurves = normalizedData.curves ? normalizedData.curves.map(c => c ? toWorldPts([c], ps.layout)[0] : null) : [];`
);

src = src.replace(
    /rawCurves\.push\(normalizedData\.curves\?\.\[seg\.edgeIdx % N\]\);/g,
    'rawCurves.push(normalizedCurves?.[seg.edgeIdx % N]);'
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
console.log('Fixed normalized curves to use WCS!');
