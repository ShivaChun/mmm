const fs = require('fs');
const file = 'src/components/PlanAnalysis3D.jsx';
let src = fs.readFileSync(file, 'utf8');

// Fix front checklines
src = src.replace(
    /const p_out_M = { x: mid\.x \+ normal\.x \* primRoadW_M, y: mid\.y \+ normal\.y \* primRoadW_M };\s*const p_center_M = { x: mid\.x \+ normal\.x \* \(primRoadW_M \/ 2\), y: mid\.y \+ normal\.y \* \(primRoadW_M \/ 2\) };\s*const p_setback_M = { x: mid\.x - normal\.x \* fD, y: mid\.y - normal\.y \* fD };/g,
    `const p_out_M = { x: mid.x - normal.x * primRoadW_M, y: mid.y - normal.y * primRoadW_M };
                const p_center_M = { x: mid.x - normal.x * (primRoadW_M / 2), y: mid.y - normal.y * (primRoadW_M / 2) };
                const p_setback_M = { x: mid.x + normal.x * fD, y: mid.y + normal.y * fD };`
);

// Fix backyard start
src = src.replace(
    /const startM = { x: mid\.x - normal\.x \* backM, y: mid\.y - normal\.y \* backM };/g,
    `const startM = { x: mid.x + normal.x * backM, y: mid.y + normal.y * backM };`
);

// Fix backyard envelope
src = src.replace(
    /const p_envelope_M = { x: startM\.x - normal\.x \* reqDist, y: startM\.y - normal\.y \* reqDist };/g,
    `const p_envelope_M = { x: startM.x + normal.x * reqDist, y: startM.y + normal.y * reqDist };`
);

fs.writeFileSync(file, src, 'utf8');
console.log('Fixed checklines directions!');
