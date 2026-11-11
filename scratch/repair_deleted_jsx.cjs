const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const junkRegex = /\s*const sIdx = sites\.findIndex\(s => s\.id === ps\.site\.id\);\s*if \(sIdx !== -1 && typeof setActiveSiteIndex === 'function'\) \{\s*setActiveSiteIndex\(sIdx\);\s*\}\s*\}\s*\}\s*onMouseEnter=\{\(\) => setHoveredSiteId\(ps\.site\.id\)\}\s*onMouseLeave=\{\(\) => setHoveredSiteId\(null\)\}\s*\/>\s*\);\s*\}\)\}\s*<\/div>/;

if (junkRegex.test(code)) {
    code = code.replace(junkRegex, "");
    fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
    console.log("Junk removed!");
} else {
    console.log("Junk not found!");
}
