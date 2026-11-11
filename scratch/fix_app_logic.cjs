const fs = require('fs');

let paCode = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// Fix the check line starting points (normal direction)
paCode = paCode.replace(
    /const p_out_M = \{ x: mid\.x - normal\.x \* primRoadW_M, y: mid\.y - normal\.y \* primRoadW_M \};/,
    'const p_out_M = { x: mid.x + normal.x * primRoadW_M, y: mid.y + normal.y * primRoadW_M };'
);
paCode = paCode.replace(
    /const p_center_M = \{ x: mid\.x - normal\.x \* \(primRoadW_M \/ 2\), y: mid\.y - normal\.y \* \(primRoadW_M \/ 2\) \};/,
    'const p_center_M = { x: mid.x + normal.x * (primRoadW_M / 2), y: mid.y + normal.y * (primRoadW_M / 2) };'
);

// Fix the overlap in App.jsx when adding new site
let appCode = fs.readFileSync('src/App.jsx', 'utf8');
appCode = appCode.replace(
    /newPos\.x = apA\.x \+ ux\.x \* \(\(wA \+ wNew\) \/ 2\);/,
    'newPos.x = apA.x + ux.x * ((wA + wNew) / 2 + 10);'
);
appCode = appCode.replace(
    /newPos\.y = apA\.y \+ ux\.y \* \(\(wA \+ wNew\) \/ 2\);/,
    'newPos.y = apA.y + ux.y * ((wA + wNew) / 2 + 10);'
);
appCode = appCode.replace(
    /newPos\.x = apA\.x - ux\.x \* \(\(wA \+ wNew\) \/ 2\);/,
    'newPos.x = apA.x - ux.x * ((wA + wNew) / 2 + 10);'
);
appCode = appCode.replace(
    /newPos\.y = apA\.y - ux\.y \* \(\(wA \+ wNew\) \/ 2\);/,
    'newPos.y = apA.y - ux.y * ((wA + wNew) / 2 + 10);'
);
appCode = appCode.replace(
    /newPos\.x = apA\.x - uy\.x \* \(\(dA \+ dNew\) \/ 2\);/,
    'newPos.x = apA.x - uy.x * ((dA + dNew) / 2 + 10);'
);
appCode = appCode.replace(
    /newPos\.y = apA\.y - uy\.y \* \(\(dA \+ dNew\) \/ 2\);/,
    'newPos.y = apA.y - uy.y * ((dA + dNew) / 2 + 10);'
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', paCode);
fs.writeFileSync('src/App.jsx', appCode);
console.log('Fixed checklines and overlap!');
