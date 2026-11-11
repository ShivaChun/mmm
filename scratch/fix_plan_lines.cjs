const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');
let lines = src.split('\n');

// The extra garbage lines are roughly from line 2816 to 2826
// We will find the exact index of `const sIdx = sites.findIndex` and delete until `})}` 
let startIndex = -1;
let endIndex = -1;
for (let i = 2800; i < lines.length; i++) {
    if (lines[i].includes('const sIdx = sites.findIndex(s => s.id === ps.site.id);')) {
        startIndex = i;
    }
    if (startIndex !== -1 && lines[i].includes('})}')) {
        endIndex = i;
        break;
    }
}

if (startIndex !== -1 && endIndex !== -1) {
    lines.splice(startIndex, endIndex - startIndex + 1);
    fs.writeFileSync('src/components/PlanAnalysis3D.jsx', lines.join('\n'), 'utf8');
    console.log('Cleaned up garbage lines');
} else {
    console.log('Could not find bounds');
}
