const fs = require('fs');
const content = fs.readFileSync('C:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/App.jsx', 'utf8');

const lines = content.split(/\r?\n/);
let idx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('{/* DATA TABLE SECTION */}')) {
        idx = i;
        break;
    }
}

if (idx !== -1 && lines[idx+3].includes('</section>')) {
    const replacementScript = fs.readFileSync('scratch/restore.cjs', 'utf8');
    const match = replacementScript.split('const replacement = `')[1].split('`;')[0];
    const replacementLines = match.split('\n');
    lines.splice(idx, 4, ...replacementLines);
    fs.writeFileSync('C:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/App.jsx', lines.join('\n'));
    console.log('Restored App.jsx successfully!');
} else {
    console.log('Could not find target block correctly');
}
