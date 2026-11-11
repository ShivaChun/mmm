const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

src = src.replace(
    /<div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'translateZ\(-0.2px\)', transformStyle: 'preserve-3d' }}>\s*<svg width="100%" height="100%" viewBox=\{`0 0 \$\{w\} \$\{d\}`\} style={{ overflow: 'visible' }}>/g,
    `<div style={{ position: 'absolute', top: -d/2, left: -w/2, width: w, height: d, pointerEvents: 'none', transform: 'translateZ(-0.2px)', transformStyle: 'preserve-3d' }}>\n                <svg width={w} height={d} viewBox={\`0 0 \${w} \${d}\`} style={{ overflow: 'visible' }}>`
);

src = src.replace(
    /<div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'translateZ\(0\)', transformStyle: 'preserve-3d' }}>\s*<svg width="100%" height="100%" viewBox=\{`0 0 \$\{w\} \$\{d\}`\} style={{ overflow: 'visible' }}>/g,
    `<div style={{ position: 'absolute', top: -d/2, left: -w/2, width: w, height: d, pointerEvents: 'none', transform: 'translateZ(0)', transformStyle: 'preserve-3d' }}>\n                <svg width={w} height={d} viewBox={\`0 0 \${w} \${d}\`} style={{ overflow: 'visible' }}>`
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
console.log('Fixed SVG containers!');
