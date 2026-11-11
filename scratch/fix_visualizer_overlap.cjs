const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const replacementStr = `let pts = siteBasePoints;
            if (!pts || pts.length < 3) {
                const ew = parseFloat(site.inputs?.baseWidthM || site.inputs?.baseWidth) || Math.sqrt(site.inputs?.baseArea || 239);
                const ed = parseFloat(site.inputs?.baseDepthM) || ((site.inputs?.baseArea || 239) / ew);
                pts = [
                    { x: -ew/2, y: -ed/2 }, { x: ew/2, y: -ed/2 },
                    { x: ew/2, y: ed/2 }, { x: -ew/2, y: ed/2 }
                ];
            }
            const normalized = normalizeWithCurves(pts, siteBaseCurves);`;

code = code.replace(
    /const normalized = siteBasePoints\s*\?\s*normalizeWithCurves\(siteBasePoints, siteBaseCurves\)\s*:\s*\{\s*points:\s*\[\{x:-10,y:-10\},\s*\{x:10,y:-10\},\s*\{x:10,y:10\},\s*\{x:-10,y:10\}\],\s*curves:\s*null,\s*centroid:\s*\{x:0,y:0\}\s*\};/,
    replacementStr
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
console.log('Fixed Visualizer3D Overlap');
