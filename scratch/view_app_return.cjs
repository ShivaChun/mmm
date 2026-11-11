const fs = require('fs');
const src = fs.readFileSync('src/App.jsx', 'utf8');
const lines = src.split('\n');
const startIndex = lines.findIndex(l => l.includes('return ('));
console.log(lines.slice(startIndex, startIndex + 30).join('\n'));
