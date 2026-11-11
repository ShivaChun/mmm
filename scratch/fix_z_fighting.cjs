const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

code = code.replace(
    /transform: \	ranslate3d\\(\\$\\$\\{([\\s\\S]*?)\\}\\* scale\\}px, \\$\\$\\{([\\s\\S]*?)\\}\\* scale\\}px, 0\\) rotateZ\\(\\$\\$\\{([\\s\\S]*?)\\}\\*rad\\)\,/,
    "transform: \	ranslate3d(\px, \px, \px) rotateZ(\rad)\,"
);

// We need to use exactly string match because regex with backticks and variables is very hard.
const searchStr = "transform: \	ranslate3d(\px, \px, 0) rotateZ(\rad)\,";
const replaceStr = "transform: \	ranslate3d(\px, \px, \px) rotateZ(\rad)\,";

code = code.replace(searchStr, replaceStr);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
