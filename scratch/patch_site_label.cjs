const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

src = src.replace(
    /<Si\s+text=\{ps\.site\.name\?\.trim\(\)\s*\?\s*基地\s*:\s*基地\s*\}/g,
    '<Si \n                                                        text={ps.site.name?.trim() ? `基地 ${ps.site.name}` : `基地`}'
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
console.log('Patched Site Label successfully!');
