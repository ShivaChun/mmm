const fs = require('fs');
let content = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const targetStr = 'export default Visualizer3D;';
const idx = content.indexOf(targetStr);

if (idx !== -1) {
    const fixedContent = content.substring(0, idx + targetStr.length) + '\n';
    fs.writeFileSync('src/components/PlanAnalysis3D.jsx', fixedContent);
    console.log("Fixed EOF successfully.");
} else {
    console.log("Could not find export statement.");
}
