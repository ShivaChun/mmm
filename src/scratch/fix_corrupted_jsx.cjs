const fs = require('fs');
const backupCode = fs.readFileSync('c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/components/PlanAnalysis3D_backup.jsx', 'utf8');
let currentCode = fs.readFileSync('c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/components/PlanAnalysis3D.jsx', 'utf8');

const calcStart = backupCode.indexOf('    const calculateCheckLines = () => {');
const calcEnd = backupCode.indexOf('    const landscapeStyle = ');
let calcCode = backupCode.substring(calcStart, calcEnd);

// Apply fixes to calcCode
calcCode = calcCode.replace(
    'const calculateCheckLines = () => {',
    'const calculateCheckLines = (ps) => {'
);
calcCode = calcCode.replace(
    /const getPrimaryRoadInfo = \(\) => \{[\s\S]*?return \{ widthPx: parseFloat\(road\.width\) \* scale.*?\};\s*\};/,
    `const getPrimaryRoadInfo = () => {
            const siteInputs = ps.site.inputs || {};
            const siteRoads = ps.site.roads || siteInputs.roads || [];
            let road = siteRoads.find(r => r.type === 'primary');
            if (!road) return { widthPx: 6 * scale, widthM: 6, isDefault: true, roadObj: null };
            return { widthPx: parseFloat(road.width) * scale, widthM: parseFloat(road.width), isDefault: false, roadObj: road };
        };
        const siteInputs = ps.site.inputs || {};`
);

calcCode = calcCode.replace(/inputs\./g, 'siteInputs.');
calcCode = calcCode.replace(/normalizedData\./g, 'ps.normalized.');

// We also need to fix the call in currentCode: `{isPrimary && calculateCheckLines().map` -> `calculateCheckLines(ps)`
// The previous script already replaced it in currentCode, so we are fine.

const badStart = currentCode.indexOf('        const getPrimaryRoadInfo = () => {');
const badEnd = currentCode.indexOf('    const landscapeStyle = ');
if (badStart !== -1 && badEnd !== -1) {
    let newCode = currentCode.substring(0, badStart) + '        };\n    };\n\n' + calcCode + currentCode.substring(badEnd);
    fs.writeFileSync('c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/components/PlanAnalysis3D.jsx', newCode);
    console.log('Fixed syntax error!');
}
