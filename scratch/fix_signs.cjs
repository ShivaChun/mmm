const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// Fix 1: renderReviewSurfaces front
code = code.replace(
    /const p1Out = \{ x: p1\.x - n\.x \* primRoadW_M, y: p1\.y - n\.y \* primRoadW_M \};\s*const p2Out = \{ x: p2\.x - n\.x \* primRoadW_M, y: p2\.y - n\.y \* primRoadW_M \};\s*const p1In = \{ x: p1\.x \+ n\.x \* fD, y: p1\.y \+ n\.y \* fD \};\s*const p2In = \{ x: p2\.x \+ n\.x \* fD, y: p2\.y \+ n\.y \* fD \};/g,
    \const p1Out = { x: p1.x + n.x * primRoadW_M, y: p1.y + n.y * primRoadW_M };
                const p2Out = { x: p2.x + n.x * primRoadW_M, y: p2.y + n.y * primRoadW_M };
                const p1In = { x: p1.x - n.x * fD, y: p1.y - n.y * fD };
                const p2In = { x: p2.x - n.x * fD, y: p2.y - n.y * fD };\
);

// Fix 2: renderReviewSurfaces back
code = code.replace(
    /const p1In = \{ x: p1\.x \+ n\.x \* reqDist, y: p1\.y \+ n\.y \* reqDist \};\s*const p2In = \{ x: p2\.x \+ n\.x \* reqDist, y: p2\.y \+ n\.y \* reqDist \};/g,
    \const p1In = { x: p1.x - n.x * reqDist, y: p1.y - n.y * reqDist };
                const p2In = { x: p2.x - n.x * reqDist, y: p2.y - n.y * reqDist };\
);

// Fix 3: calculateCheckLines front
code = code.replace(
    /const p_out_M = \{ x: mid\.x - normal\.x \* primRoadW_M, y: mid\.y - normal\.y \* primRoadW_M \};\s*const p_center_M = \{ x: mid\.x - normal\.x \* \(primRoadW_M \/ 2\), y: mid\.y - normal\.y \* \(primRoadW_M \/ 2\) \};\s*const p_setback_M = \{ x: mid\.x \+ normal\.x \* fD, y: mid\.y \+ normal\.y \* fD \};/g,
    \const p_out_M = { x: mid.x + normal.x * primRoadW_M, y: mid.y + normal.y * primRoadW_M };
                const p_center_M = { x: mid.x + normal.x * (primRoadW_M / 2), y: mid.y + normal.y * (primRoadW_M / 2) };
                const p_setback_M = { x: mid.x - normal.x * fD, y: mid.y - normal.y * fD };\
);

// Fix 4: calculateCheckLines back (around line 2459)
// Let's check what's there for back checklines.
