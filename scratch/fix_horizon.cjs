const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// 1. Remove the grid lines
src = src.replace(/<div className="absolute inset-0 pointer-events-none" style=\{\{\s*backgroundImage: isDarkMode \?[\s\S]+?\}\}><\/div>/, '');

// 2. Fix the horizon math
// `linear-gradient(to bottom, #87CEEB ${Math.max(...)}%, #cbd5e1 ${Math.max(...)}%)`
const horizonMath = `(viewAngleX / 90) * 50`; // 0 degrees -> 0% sky (top of screen), 90 degrees -> 50% sky (middle of screen)
src = src.replace(/Math\.max\(0, 50 - \(viewAngleX \/ 90\) \* 50\)/g, `Math.max(0, Math.min(100, (viewAngleX / 90) * 50))`);

// Let's also make sure the Sky color is actually Sky and Ground is Ground in Sketchup style
// Sketchup: Sky is light blue gradient, Ground is solid grayish-green/brown or solid grey.
const newBgStyle = `background: isDarkMode ? \`linear-gradient(to bottom, #0f172a \${Math.max(0, Math.min(100, (viewAngleX / 90) * 55))}%, #1e293b \${Math.max(0, Math.min(100, (viewAngleX / 90) * 55))}%, #0f172a 100%)\` : \`linear-gradient(to bottom, #87CEEB 0%, #e0f2fe \${Math.max(0, Math.min(100, (viewAngleX / 90) * 55))}%, #e2e8f0 \${Math.max(0, Math.min(100, (viewAngleX / 90) * 55))}%, #cbd5e1 100%)\``;
src = src.replace(/background: isDarkMode \? `linear-gradient[^`]+` : `linear-gradient[^`]+`/, newBgStyle);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
console.log('Fixed horizon and grid!');
