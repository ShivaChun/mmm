const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

src = src.replace(/<SiteLabel/g, '<Si');
src = src.replace(/<\/SiteLabel>/g, '</Si>');

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
console.log('Replaced SiteLabel with Si');
