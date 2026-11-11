const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// The line: const normalizedPoints = normalizedData.points;
// needs to be replaced with: const normalizedPoints = toWorldPts(normalizedData.points, ps.layout);
src = src.replace(/const normalizedPoints = normalizedData\.points;/g, 'const normalizedPoints = toWorldPts(normalizedData.points, ps.layout);');

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
console.log('Fixed normalizedPoints to use toWorldPts!');
