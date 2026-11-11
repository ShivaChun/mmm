const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const badStr = `        return (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'translateZ(-0.2px)', transformStyle: 'preserve-3d' }}>
                <svg width="100%" height="100%" viewBox={\`0 0 \${w} \${d}\`} style={{ overflow: 'visible' }}>{paths}</svg>

        return (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'translateZ(-0.2px)', transformStyle: 'preserve-3d' }}>
                <svg width="100%" height="100%" viewBox={\`0 0 \${w} \${d}\`} style={{ overflow: 'visible' }}>{paths}</svg>
                {labels}
            </div>
        );`;

const goodStr = `        return (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'translateZ(-0.2px)', transformStyle: 'preserve-3d' }}>
                <svg width="100%" height="100%" viewBox={\`0 0 \${w} \${d}\`} style={{ overflow: 'visible' }}>{paths}</svg>
                {labels}
            </div>
        );`;

code = code.replace(badStr, goodStr);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code);
console.log('Fixed return duplication!');
