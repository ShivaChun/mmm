const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// 1. Remove `workingPoints = toWorldPts(workingPoints, layoutA);`
src = src.replace(
    'const layoutA = siteLayouts.get(sites[0].id) || { x: sites[0].position?.x || 0, y: sites[0].position?.y || 0, rotation: 0 };\n        workingPoints = toWorldPts(workingPoints, layoutA);',
    '// workingPoints remains in local coordinates for rendering inside the site container.'
);

// 2. Remove `+ offX` and `+ offY` from all lines inside calculateCheckLines
const calculateCheckLinesStart = src.indexOf('const calculateCheckLines = () => {');
const calculateCheckLinesEnd = src.indexOf('return lines;', calculateCheckLinesStart);
if (calculateCheckLinesStart !== -1 && calculateCheckLinesEnd !== -1) {
    let funcBody = src.substring(calculateCheckLinesStart, calculateCheckLinesEnd);
    funcBody = funcBody.replace(/\+ offX/g, '');
    funcBody = funcBody.replace(/\+ offY/g, '');
    src = src.substring(0, calculateCheckLinesStart) + funcBody + src.substring(calculateCheckLinesEnd);
    
    fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
    console.log('Fixed checklines position calculation!');
} else {
    console.log('Could not find calculateCheckLines bounds');
}
