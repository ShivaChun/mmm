const fs = require('fs');
let content = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const target1 = `                    const hRatioH = 3.6 * (primRoadW_M + fD) * scale;`;
const replacement1 = `                    const hRatioH = 3.6 * (edgeRoadW_M + fD) * scale;`;
content = content.replace(target1, replacement1);

const target2 = `                    const wlH = 5 * (0.5 * primRoadW_M + fD) * scale;`;
const replacement2 = `                    const wlH = 5 * (0.5 * edgeRoadW_M + fD) * scale;`;
content = content.replace(target2, replacement2);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', content, 'utf8');
console.log('Heights updated');
