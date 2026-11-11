const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

src = src.replace(
    /text=\{\` \$\{ps.site.name\?\.trim\(\) \|\| \`a \$\{ps.site.id\}\`\}\`\}/g,
    'text={ps.site.name?.trim() ? `基地 ${ps.site.name.trim()}` : `基地 ${ps.site.id}`}'
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
console.log('Fixed SiteLabel text!');
