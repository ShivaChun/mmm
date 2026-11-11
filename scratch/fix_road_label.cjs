const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const target2 = `const labelX = (p1.x + p2.x) / 2 * scale + w / 2 + l.vec.x / 2 * scale;
                    const labelY = (p1.y + p2.y) / 2 * scale + d / 2 + l.vec.y / 2 * scale;`;

const newCode2 = `const labelX = (p1.x + p2.x) / 2 * scale + w / 2 + l.vec.x * scale * 1.2;
                    const labelY = (p1.y + p2.y) / 2 * scale + d / 2 + l.vec.y * scale * 1.2;`;

if (code.includes(target2)) {
    code = code.replace(target2, newCode2);
} else {
    code = code.replace(target2.replace(/\n/g, '\r\n'), newCode2);
}

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
console.log('Road label offset fixed!');
