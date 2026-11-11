const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const anchor1 = "    const [placementPreview, setPlacementPreview] = useState(null);\n\n        const centroid = projectBounds.center;";
const replacement = "    const [placementPreview, setPlacementPreview] = useState(null);\n\n    const toScreenPts = (wx, wy, wz = 0) => {\n        const centroid = projectBounds.center;";
code = code.replace(anchor1, replacement);

const anchor2 = "    };\n\n    };";
code = code.replace(anchor2, "    };");

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code);
console.log('Fixed toScreenPts!');
