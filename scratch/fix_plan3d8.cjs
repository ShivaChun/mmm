const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const badStr = `                const p = outerPoints[i]; const x = p.x * scale + w / 2; const y = p.y * scale + d / 2;
                if (i === outerPoints.length - 1) outerPathD += \` L \${x} \${y}\`;
                else { const curve = finalCurves[i]; if (curve) { const l = lines[i]; const cp = { x: curve.x * scale + w / 2 + l.vec.x * scale, y: curve.y * scale + d / 2 + l.vec.y * scale }; outerPathD += \` Q \${cp.x} \${cp.y}, \${x} \${y}\`; } else outerPathD += \` L \${x} \${y}\`; }
            }
            paths.push`;

const goodStr = `                const op = outerPoints[i]; const ox = op.x * scale + w / 2; const oy = op.y * scale + d / 2;
                if (i === outerPoints.length - 1) outerPathD += \` L \${ox} \${oy}\`;
                else { const curve = finalCurves[i]; if (curve) { const l = lines[i]; const cp = { x: curve.x * scale + w / 2 + l.vec.x * scale, y: curve.y * scale + d / 2 + l.vec.y * scale }; outerPathD += \` Q \${cp.x} \${cp.y}, \${ox} \${oy}\`; } else outerPathD += \` L \${ox} \${oy}\`; }
            });
            paths.push`;

code = code.replace(badStr, goodStr);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code);
console.log('Fixed outerPoints declaration and closing brace!');
