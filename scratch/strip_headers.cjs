const fs = require('fs');

const lines = fs.readFileSync('src/App_recovered_jsx_clean.jsx', 'utf8').split('\n');

// Find the first line that starts with "import React"
const startIndex = lines.findIndex(l => l.startsWith('import React'));

let cleanCode = lines.slice(startIndex).join('\n');

// Also apply the buffer patch for snapDir
const oldLogic = `        if (snapDir === 'back') {
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
        }`;

const newLogic = `        const BUFFER = 0.5; // Add a small gap to prevent visual overlap
        if (snapDir === 'back') {
            // 緊貼後方：沿著基地 A 的 -uy 方向推出
            newPos.x = apA.x - uy.x * ((dA + dNew) / 2 + BUFFER);
            newPos.y = apA.y - uy.y * ((dA + dNew) / 2 + BUFFER);
        } else if (snapDir === 'left') {
            // 緊貼左側：沿著基地 A 的 -ux 方向推出
            newPos.x = apA.x - ux.x * ((wA + wNew) / 2 + BUFFER);
            newPos.y = apA.y - ux.y * ((wA + wNew) / 2 + BUFFER);
        } else if (snapDir === 'right') {
            // 緊貼右側：沿著基地 A 的 +ux 方向推出
            newPos.x = apA.x + ux.x * ((wA + wNew) / 2 + BUFFER);
            newPos.y = apA.y + ux.y * ((wA + wNew) / 2 + BUFFER);
        }`;

cleanCode = cleanCode.replace(oldLogic, newLogic);
fs.writeFileSync('src/App.jsx', cleanCode);
console.log('App.jsx stripped and patched!');
