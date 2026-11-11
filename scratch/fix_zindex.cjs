const fs = require('fs');
let src = fs.readFileSync('src/components/Si.jsx', 'utf8');

src = src.replace(/, zIndex: 7000/g, '');

fs.writeFileSync('src/components/Si.jsx', src, 'utf8');
console.log('Removed zIndex from Si.jsx!');
