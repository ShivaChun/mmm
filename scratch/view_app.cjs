const fs = require('fs');
const src = fs.readFileSync('src/App.jsx', 'utf8');
const lines = src.split('\n');
const idx = lines.findIndex(l => l.includes('return ('));
console.log(lines.slice(idx, idx + 100).join('\n'));
