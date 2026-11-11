const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const oldCode = \        const ux = { x: cosA, y: sinA };
        const uy = { x: -sinA, y: cosA };

        let newPos = { x: 0, y: 0, rotation: radA };
        if (snapDir === 'back') {
            // 緊貼後方：沿著基地 A 的 -uy 方向推出
            newPos.x = apA.x - uy.x * ((dA + dNew) / 2);
            newPos.y = apA.y - uy.y * ((dA + dNew) / 2);
        } else if (snapDir === 'left') {
            // 緊貼左側：沿著基地 A 的 -ux 方向推出
            newPos.x = apA.x - ux.x * ((wA + wNew) / 2);
            newPos.y = apA.y - ux.y * ((wA + wNew) / 2);
        } else if (snapDir === 'right') {
            // 緊貼右側：沿著基地 A 的 +ux 方向推出
            newPos.x = apA.x + ux.x * ((wA + wNew) / 2);
            newPos.y = apA.y + ux.y * ((wA + wNew) / 2);
        }\;

const newCode = \        const ux = { x: cosA, y: sinA };
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
            // 緊貼後方：沿著基地 A 的 -uy 方向推出 (y軸朝下為前，朝上為後)
            const dist = -minY + dNew / 2;
            newPos.x = apA.x - uy.x * dist;
            newPos.y = apA.y - uy.y * dist;
        } else if (snapDir === 'left') {
            // 緊貼左側：沿著基地 A 的 -ux 方向推出
            const dist = -minX + wNew / 2;
            newPos.x = apA.x - ux.x * dist;
            newPos.y = apA.y - ux.y * dist;
        } else if (snapDir === 'right') {
            // 緊貼右側：沿著基地 A 的 +ux 方向推出
            const dist = maxX + wNew / 2;
            newPos.x = apA.x + ux.x * dist;
            newPos.y = apA.y + ux.y * dist;
        }\;

code = code.replace(oldCode, newCode);

fs.writeFileSync('src/App.jsx', code, 'utf8');
console.log('Fixed App.jsx handleAddSite');
