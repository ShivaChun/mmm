const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');
const search = `    const calculateCheckLines = (ps) => {
        const lines = [];
        const offX = 0;
        const offY = 0;`;
const replacement = `    const calculateCheckLines = (ps) => {
        const lines = [];
        const offX = w / 2;
        const offY = d / 2;`;

if (src.includes(search)) {
    src = src.replace(search, replacement);
    fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
    console.log("Fixed offX/offY!");
} else {
    console.log("Not found!");
}
