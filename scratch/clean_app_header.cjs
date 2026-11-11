const fs = require('fs');
const lines = fs.readFileSync('src/App.jsx', 'utf8').split('\n');
const importIdx = lines.findIndex(l => l.startsWith('import '));
if (importIdx > 0) {
    fs.writeFileSync('src/App.jsx', lines.slice(importIdx).join('\n'));
    console.log('Cleaned header');
}
