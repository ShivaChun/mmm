const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');
code = code.replace(/newPos.x = apA.x - ux.x \* \(\(wA \+ wNew\) \/ 2\);/g, 'newPos.x = apA.x - ux.x * ((wA + wNew) / 2 + gap);');
code = code.replace(/newPos.y = apA.y - ux.y \* \(\(wA \+ wNew\) \/ 2\);/g, 'newPos.y = apA.y - ux.y * ((wA + wNew) / 2 + gap);');
code = code.replace(/newPos.x = apA.x \+ ux.x \* \(\(wA \+ wNew\) \/ 2\);/g, 'newPos.x = apA.x + ux.x * ((wA + wNew) / 2 + gap);');
code = code.replace(/newPos.y = apA.y \+ ux.y \* \(\(wA \+ wNew\) \/ 2\);/g, 'newPos.y = apA.y + ux.y * ((wA + wNew) / 2 + gap);');
fs.writeFileSync('src/App.jsx', code, 'utf8');
