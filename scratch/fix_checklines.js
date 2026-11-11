const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// Fix Front Height Ratio & WeiLao directions in calculateCheckLines
code = code.replace(
    /const p_out_M = \{ x: mid\.x \+ normal\.x \* primRoadW_M, y: mid\.y \+ normal\.y \* primRoadW_M \};/,
    "const p_out_M = { x: mid.x - normal.x * primRoadW_M, y: mid.y - normal.y * primRoadW_M };"
);
code = code.replace(
    /const p_center_M = \{ x: mid\.x \+ normal\.x \* \(primRoadW_M \/ 2\), y: mid\.y \+ normal\.y \* \(primRoadW_M \/ 2\) \};/,
    "const p_center_M = { x: mid.x - normal.x * (primRoadW_M / 2), y: mid.y - normal.y * (primRoadW_M / 2) };"
);
code = code.replace(
    /const p_setback_M = \{ x: mid\.x - normal\.x \* fD, y: mid\.y - normal\.y \* fD \};/g,
    "const p_setback_M = { x: mid.x + normal.x * fD, y: mid.y + normal.y * fD };"
);

// Fix Backyard direction
code = code.replace(
    /const p_setback_M = \{ x: mid\.x - normal\.x \* reqDist, y: mid\.y - normal\.y \* reqDist \};/,
    "const p_setback_M = { x: mid.x + normal.x * reqDist, y: mid.y + normal.y * reqDist };"
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
console.log('Fixed checklines directions');
