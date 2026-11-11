const fs = require('fs');
const lines = fs.readFileSync('c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/App_reconstructed.jsx', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('<main className="grid'));
console.log(lines.slice(start, start + 30).join('\n'));
