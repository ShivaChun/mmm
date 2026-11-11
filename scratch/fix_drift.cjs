const fs = require('fs');
const path = 'src/components/PlanAnalysis3D.jsx';
let content = fs.readFileSync(path, 'utf8');

// fix calculateCheckLines offX/offY
content = content.replace(/start: \{ x: ([^,]+)\.x \* scale, y: ([^,]+)\.y \* scale/g, 'start: { x: $1.x * scale + offX, y: $2.y * scale + offY');
content = content.replace(/end: \{ x: ([^,]+)\.x \* scale, y: ([^,]+)\.y \* scale/g, 'end: { x: $1.x * scale + offX, y: $2.y * scale + offY');

// fix renderRoads labels
content = content.replace(
    'const labelX = (p1.x + p2.x) / 2 * scale + l.vec.x * scale * 1.2;',
    'const labelX = (p1.x + p2.x) / 2 * scale + l.vec.x * scale * 1.2 + w / 2;'
);
content = content.replace(
    'const labelY = (p1.y + p2.y) / 2 * scale + l.vec.y * scale * 1.2;',
    'const labelY = (p1.y + p2.y) / 2 * scale + l.vec.y * scale * 1.2 + d / 2;'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed drift');
