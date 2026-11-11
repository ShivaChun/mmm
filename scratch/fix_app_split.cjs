const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const part1 = code.split('// 完全繼承主基地 A 的主要幾何尺寸與 inputs，確保共用同一個 WCS 軸線')[0];
const part2 = code.split('// 計算新基地的世界坐標多邊形端點，用以做防碰撞重疊檢查')[1];

const newCode = `// 完全繼承主基地 A 的主要幾何尺寸與 inputs，確保共用同一個 WCS 軸線
        const wA = parseFloat(siteA.inputs.baseWidthM || siteA.inputs.baseWidth) || Math.sqrt(siteA.inputs.baseArea || 239);
        const dA = parseFloat(siteA.inputs.baseDepthM) || ((siteA.inputs.baseArea || 239) / wA);
        
        newSite.inputs = {
            ...siteA.inputs,
            projectName: siteA.inputs.projectName || '',
            baseWidth: siteA.inputs.baseWidth,
            baseWidthM: siteA.inputs.baseWidthM,
            baseDepthM: siteA.inputs.baseDepthM,
            baseArea: siteA.inputs.baseArea,
            roads: [] // 新基地不自帶實體道路，共享道路系統
        };

        const wNew = wA;
        const dNew = dA;

        const cosA = Math.cos(radA);
        const sinA = Math.sin(radA);
        const ux = { x: cosA, y: sinA };
        const uy = { x: -sinA, y: cosA };

        let minX = -wA/2, maxX = wA/2, minY = -dA/2, maxY = dA/2;
        const ptsA = siteA.baseGeometry?.points || siteA.basePoints;
        if (ptsA && ptsA.length > 2) {
            minX = Math.min(...ptsA.map(p => p.x));
            maxX = Math.max(...ptsA.map(p => p.x));
            minY = Math.min(...ptsA.map(p => p.y));
            maxY = Math.max(...ptsA.map(p => p.y));
        }

        let newPos = { x: 0, y: 0, rotation: radA };
        if (snapDir === 'back') {
            const dist = -minY + dNew / 2;
            newPos.x = apA.x - uy.x * dist;
            newPos.y = apA.y - uy.y * dist;
        } else if (snapDir === 'left') {
            const dist = -minX + wNew / 2;
            newPos.x = apA.x - ux.x * dist;
            newPos.y = apA.y - ux.y * dist;
        } else if (snapDir === 'right') {
            const dist = maxX + wNew / 2;
            newPos.x = apA.x + ux.x * dist;
            newPos.y = apA.y + ux.y * dist;
        }

        // 計算新基地的世界坐標多邊形端點，用以做防碰撞重疊檢查`;

if (part1 && part2) {
    fs.writeFileSync('src/App.jsx', part1 + newCode + part2, 'utf8');
    console.log('App.jsx repaired using split!');
} else {
    console.log('Split failed to match bounds.');
}
