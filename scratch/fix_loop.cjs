const fs = require('fs');
const { execSync } = require('child_process');

let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

for (let i = 0; i < 5; i++) {
    try {
        console.log(`Trying with ${i} less closing divs...`);
        execSync('npm run build', { stdio: 'ignore' });
        console.log('Build succeeded!');
        break;
    } catch (e) {
        // Find the block and remove one </div>
        src = src.replace('</div>\n            </>\n        )}\n    </div>\n</div>', '</div>\n            </>\n        )}\n    </div>');
        fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
    }
}
