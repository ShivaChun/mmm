const fs = require('fs');
const content = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => { 
    if(l.includes('高度比') || l.includes('heightRatio')) {
        console.log('Line ' + i + ': ' + l.trim());
    }
});
