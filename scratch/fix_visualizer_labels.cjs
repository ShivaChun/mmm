const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

code = code.replace(
    /const cx = layout\.x \+ \(center\.x \* cos - center\.y \* sin\);\s*const cy = layout\.y \+ \(center\.x \* sin \+ center\.y \* cos\);/,
    "const cx = (layout.x - projectBounds.center.x + center.x * cos - center.y * sin) * scale;\n                                            const cy = (layout.y - projectBounds.center.y + center.x * sin + center.y * cos) * scale;"
);

code = code.replace(
    /z=\{zHeight \+ 1\.5\}/,
    "z={(zHeight + 1.5) * scale}"
);

code = code.replace(
    /baseRotation=\{site\.inputs\.northAngle \|\| 0\}/g,
    "baseRotation={(ps.layout.rotation * 180 / Math.PI)}"
);

code = code.replace(
    /<CheckLine key=\{line\.id\} \{\.\.\.line\} baseRotation=\{0\}/g,
    "<CheckLine key={line.id} {...line} baseRotation={(ps.layout.rotation * 180 / Math.PI)}"
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
console.log('Fixed Visualizer3D Labels');
