const fs = require('fs');
const content = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const regex = /const calculateCheckLines = \(\) => \{[\s\S]*?\n    \};/;
const match = content.match(regex);
if (match) {
    fs.writeFileSync('scratch/calc_checklines_output.txt', match[0]);
    console.log('Found calculateCheckLines, saved to output');
} else {
    console.log('calculateCheckLines not found');
}
