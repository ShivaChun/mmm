const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const regex = /transform: \	ranslate3d\(\$\{\(layout\.x - projectBounds\.center\.x\) \* scale\}px, \$\{\(layout\.y - projectBounds\.center\.y\) \* scale\}px, 0\) rotateZ\(\$\{layout\.rotation\}rad\)\,\s*pointerEvents: 'none',\s*zIndex: isPrimary \? 20 : 10/;

if (regex.test(code)) {
    code = code.replace(regex, \	ransform: \\\	ranslate3d(\px, \px, 0) rotateZ(\rad)\\\,
                                                        transformStyle: 'preserve-3d',
                                                        pointerEvents: 'none',
                                                        zIndex: isPrimary ? 20 : 10\);
    fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
    console.log("Fixed preserve-3d!");
} else {
    console.log("Not found!");
}
