const fs = require('fs');
let src = fs.readFileSync('src/components/Si.jsx', 'utf8');

src = src.replace(/export const CheckLine = React\.memo\(\(\{\, zoom = 1\}\) => \{/, 'export const CheckLine = React.memo(({ id, start, end, label, color, dashed, labelPosRatio = 0.5, thick, baseRotation, rotationZ, viewAngleX, visible, isDarkMode, zoom = 1 }) => {');

fs.writeFileSync('src/components/Si.jsx', src, 'utf8');
console.log('Fixed CheckLine args!');
