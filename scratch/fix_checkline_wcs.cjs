const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

src = src.replace(/\/\/ workingPoints = toWorldPts\(workingPoints, layoutA\);/g, 'workingPoints = toWorldPts(workingPoints, layoutA);');

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
console.log('Uncommented toWorldPts for checklines!');
