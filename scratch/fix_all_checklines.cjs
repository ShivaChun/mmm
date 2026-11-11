const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const startIdx = src.indexOf('const calculateCheckLines');
const endIdx = src.indexOf('return lines;', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    let block = src.substring(startIdx, endIdx);
    
    // Replace all start: { x: val * scale, y: val * scale, z: val } with offX/offY
    block = block.replace(/start:\s*\{\s*x:\s*([^,]+?)\s*,\s*y:\s*([^,]+?)\s*,\s*z:\s*([^}]+?)\s*\}/g, (match, p1, p2, p3) => {
        if (!p1.includes('offX')) {
            return `start: { x: ${p1} + offX, y: ${p2} + offY, z: ${p3} }`;
        }
        return match;
    });

    block = block.replace(/end:\s*\{\s*x:\s*([^,]+?)\s*,\s*y:\s*([^,]+?)\s*,\s*z:\s*([^}]+?)\s*\}/g, (match, p1, p2, p3) => {
        if (!p1.includes('offX')) {
            return `end: { x: ${p1} + offX, y: ${p2} + offY, z: ${p3} }`;
        }
        return match;
    });

    src = src.substring(0, startIdx) + block + src.substring(endIdx);
    fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
    console.log('Fixed all checklines coordinates successfully!');
} else {
    console.log('calculateCheckLines block not found');
}
