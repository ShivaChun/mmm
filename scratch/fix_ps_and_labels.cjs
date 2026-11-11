const fs = require('fs');

// 1. Fix PlanAnalysis3D.jsx
let p = 'src/components/PlanAnalysis3D.jsx';
let c = fs.readFileSync(p, 'utf8');

// Fix calculateCheckLines signature and offX/offY
c = c.replace(/const calculateCheckLines = \(\) => \{/, 'const calculateCheckLines = (ps) => {');
c = c.replace(/const offX = w \/ 2;\s*const offY = d \/ 2;/, 'const offX = 0;\n        const offY = 0;');

// Fix labelPosRatio for different lines inside calculateCheckLines
c = c.replace(/id: `height-front-\$\{i\}`,\s*type: 'height',/g, 'id: `height-front-${i}`,\n                        type: \'height\',\n                        labelPosRatio: 0.3,');
c = c.replace(/id: `weilao-\$\{i\}`,\s*type: 'weilao',/g, 'id: `weilao-${i}`,\n                        type: \'weilao\',\n                        labelPosRatio: 0.6,');
c = c.replace(/id: `height-back-\$\{i\}`,\s*type: 'height',/g, 'id: `height-back-${i}`,\n                        type: \'height\',\n                        labelPosRatio: 0.3,');
c = c.replace(/id: `backyard-\$\{i\}`,\s*type: 'backyard',/g, 'id: `backyard-${i}`,\n                        type: \'backyard\',\n                        labelPosRatio: 0.7,');
c = c.replace(/id: `falling-\$\{i\}`,\s*type: 'falling',/g, 'id: `falling-${i}`,\n                        type: \'falling\',\n                        labelPosRatio: 0.4,');

// Fix CheckLine render call to pass ps and line.labelPosRatio
c = c.replace(/calculateCheckLines\(\)\.map/g, 'calculateCheckLines(ps).map');
c = c.replace(/labelPosRatio=\{0\.2\}/g, 'labelPosRatio={line.labelPosRatio || 0.2}');

// Fix Si label x and y for Site Label
c = c.replace(/<Si \s*text=\{ps\.site\.name\?\.trim\(\) \? `基地 \$\{ps\.site\.name\}` : `基地`\}\s*x=\{w \/ 2\}\s*y=\{d \/ 2\}/, '<Si \n                                                        text={ps.site.name?.trim() ? `基地 ${ps.site.name}` : `基地`}\n                                                        x={0}\n                                                        y={0}');

fs.writeFileSync(p, c, 'utf8');
console.log('PlanAnalysis3D.jsx fixed!');

// 2. Fix Si.jsx for text resolution
let p2 = 'src/components/Si.jsx';
let c2 = fs.readFileSync(p2, 'utf8');
// Increase hiResMulti from 10 to 20
c2 = c2.replace(/const hiResMulti = 10;/, 'const hiResMulti = 20;');
// Ensure CheckLine uses labelPosRatio
c2 = c2.replace(/const lx = start\.x \+ dx \* labelPosRatio;/, 'const lx = start.x + dx * (labelPosRatio || 0.5);');

fs.writeFileSync(p2, c2, 'utf8');
console.log('Si.jsx fixed!');
