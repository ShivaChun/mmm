const fs = require('fs');
const file = 'src/components/PlanAnalysis3D.jsx';
let src = fs.readFileSync(file, 'utf8');

src = src.replace(
    /willChange:\s*'transform',\s*backfaceVisibility:\s*'hidden'/g,
    `/* removed willChange for crisp text */`
);

fs.writeFileSync(file, src, 'utf8');
console.log('Removed willChange!');
