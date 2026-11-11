const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const badStr = `                    else { const l1 = lines[i - 1]; const l2 = lines[i]; pt = getIntersection(l1, l2) || { x: finalPoints[i].x + l1.vec.x, y: finalPoints[i].y + l1.vec.y }; }
                }
                    else { const l1 = lines[i - 1]; const l2 = lines[i]; pt = getIntersection(l1, l2) || { x: finalPoints[i].x + l1.vec.x, y: finalPoints[i].y + l1.vec.y }; }
                }`;

const goodStr = `                    else { const l1 = lines[i - 1]; const l2 = lines[i]; pt = getIntersection(l1, l2) || { x: finalPoints[i].x + l1.vec.x, y: finalPoints[i].y + l1.vec.y }; }
                }`;

code = code.replace(badStr, goodStr);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code);
console.log('Fixed else duplication!');
