const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// Find the corrupted part where the onClick handler was left dangling
const corruptedRegex = /const sIdx = sites\.findIndex\(s => s\.id === ps\.site\.id\);\s+if \(sIdx !== -1 && typeof setActiveSiteIndex === 'function'\) \{\s+setActiveSiteIndex\(sIdx\);\s+\}\s+\}\s+\}\s+\/>\s+\);\s+\}\)\s*<\/div>\s*<\/div>/;

if (corruptedRegex.test(code)) {
    code = code.replace(corruptedRegex, "/* Base label moved inside */\n                                    </div>\n                                </div>");
    fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
    console.log("Fixed corrupted jsx!");
} else {
    console.log("Not found!");
}
