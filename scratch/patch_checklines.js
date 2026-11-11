const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// Fix front checklines
code = code.replace(
    /const p_out_M = \{ x: mid\.x \+ normal\.x \* primRoadW_M, y: mid\.y \+ normal\.y \* primRoadW_M \};\n\s*const p_center_M = \{ x: mid\.x \+ normal\.x \* \(primRoadW_M \/ 2\), y: mid\.y \+ normal\.y \* \(primRoadW_M \/ 2\) \};\n\s*const p_setback_M = \{ x: mid\.x - normal\.x \* fD, y: mid\.y - normal\.y \* fD \};/,
    "const p_out_M = { x: mid.x - normal.x * primRoadW_M, y: mid.y - normal.y * primRoadW_M };\n                const p_center_M = { x: mid.x - normal.x * (primRoadW_M / 2), y: mid.y - normal.y * (primRoadW_M / 2) };\n                const p_setback_M = { x: mid.x + normal.x * fD, y: mid.y + normal.y * fD };"
);

// Fix backyard checklines
code = code.replace(
    /const startM = \{ x: mid\.x - normal\.x \* backM, y: mid\.y - normal\.y \* backM \};\n\s*const vizHeight = 30;\n\s*const reqDist = vizHeight \/ minBYRatio;\n\s*const p_envelope_M = \{ x: startM\.x - normal\.x \* reqDist, y: startM\.y - normal\.y \* reqDist \};/,
    "const startM = { x: mid.x + normal.x * backM, y: mid.y + normal.y * backM };\n                const vizHeight = 30;\n                const reqDist = vizHeight / minBYRatio;\n\n                const p_envelope_M = { x: startM.x + normal.x * reqDist, y: startM.y + normal.y * reqDist };"
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
