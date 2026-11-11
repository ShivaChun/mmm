const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const target = '                        </>\n                    {/* 2D HUD';
const replacement = '                        </>\n                    )}\n                    {/* 2D HUD';

if (src.includes(target)) {
    src = src.replace(target, replacement);
    fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
    console.log("Successfully fixed HUD syntax!");
} else {
    // Try CRLF variation
    const targetCRLF = '                        </>\r\n                    {/* 2D HUD';
    const replacementCRLF = '                        </>\r\n                    )}\r\n                    {/* 2D HUD';
    if (src.includes(targetCRLF)) {
        src = src.replace(targetCRLF, replacementCRLF);
        fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
        console.log("Successfully fixed HUD syntax (CRLF)!");
    } else {
        console.log("Target not found!");
    }
}
