const fs = require('fs');
const content = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// 1. Search for calculateCheckLines to find where Height Ratio and Wei-Lao are calculated
const lines = content.split('\n');
const calcIdx = lines.findIndex(l => l.includes('function calculateCheckLines'));
console.log('calculateCheckLines at line:', calcIdx);
if (calcIdx !== -1) {
    console.log(lines.slice(calcIdx, calcIdx + 100).join('\n'));
}

// 2. Search for Label / Canvas drawing
const labelIdx = lines.findIndex(l => l.includes('function drawLabelToCanvas') || l.includes('canvas.getContext') || l.includes('new THREE.Sprite'));
console.log('label creation around line:', labelIdx);
if (labelIdx !== -1) {
    console.log(lines.slice(Math.max(0, labelIdx - 10), labelIdx + 30).join('\n'));
}

// 3. Search for "基地" label blank issue
const siteLabelIdx = lines.findIndex(l => l.includes('text={`${ps.site.name || \'基地\'}`}') || l.includes('基地 A'));
console.log('site label around line:', siteLabelIdx);
if (siteLabelIdx !== -1) {
    console.log(lines.slice(Math.max(0, siteLabelIdx - 10), siteLabelIdx + 20).join('\n'));
}

