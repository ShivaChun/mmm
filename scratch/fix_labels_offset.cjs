const fs = require('fs');
const file = 'src/components/PlanAnalysis3D.jsx';
let src = fs.readFileSync(file, 'utf8');

src = src.replace(/const labelX = \(\(p1\.x \+ p2\.x\) \/ 2 \* scale\) \+ w \/ 2 \+ l\.vec\.x \* scale \* 1\.2;/g, 'const labelX = ((p1.x + p2.x) / 2 * scale) + l.vec.x * scale * 1.2;');
src = src.replace(/const labelY = \(\(p1\.y \+ p2\.y\) \/ 2 \* scale\) \+ d \/ 2 \+ l\.vec\.y \* scale \* 1\.2;/g, 'const labelY = ((p1.y + p2.y) / 2 * scale) + l.vec.y * scale * 1.2;');

src = src.replace(/const labelX = \(p1\.x \+ p2\.x\) \/ 2 \* scale \+ w \/ 2 \+ l\.vec\.x \* scale \* 1\.2;/g, 'const labelX = (p1.x + p2.x) / 2 * scale + l.vec.x * scale * 1.2;');
src = src.replace(/const labelY = \(p1\.y \+ p2\.y\) \/ 2 \* scale \+ d \/ 2 \+ l\.vec\.y \* scale \* 1\.2;/g, 'const labelY = (p1.y + p2.y) / 2 * scale + l.vec.y * scale * 1.2;');

src = src.replace(/x=\{\(ps\.normalized\.centroid\?\.x \|\| 0\) \* scale \+ w \/ 2\}/g, 'x={(ps.normalized.centroid?.x || 0) * scale}');
src = src.replace(/y=\{\(ps\.normalized\.centroid\?\.y \|\| 0\) \* scale \+ d \/ 2\}/g, 'y={(ps.normalized.centroid?.y || 0) * scale}');

fs.writeFileSync(file, src, 'utf8');
console.log("Labels offset fixed!");
