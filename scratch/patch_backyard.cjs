const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

src = src.replace(
    /const startM = \{ x: mid\.x \+ normal\.x \* backM, y: mid\.y \+ normal\.y \* backM \};/,
    'const startM = { x: mid.x, y: mid.y };'
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
console.log('Patched Backyard successfully!');
