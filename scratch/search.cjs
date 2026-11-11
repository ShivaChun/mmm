const fs = require('fs');
const content = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => { 
    if(l.includes('text={`● ${ps.site.name ||')) console.log(i + ': ' + l.trim()); 
});
