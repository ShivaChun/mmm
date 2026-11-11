const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const badStr = `                });\n\n                    curves: layerCurves,\n\n                    // Task 2 Data\n                    staticPoints: staticPolygon,\n                    unusedReviewArea: Math.max(0, staticArea - usedAreaM2)\n                });`;

code = code.replace(badStr, `                });`);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code);
console.log('Fixed duplication!');
