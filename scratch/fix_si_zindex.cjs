const fs = require('fs');
let code = fs.readFileSync('src/components/Si.jsx', 'utf8');
code = code.replace(
    '({ text, x, y, z, rotationZ, baseRotation, viewAngleX, visible, className, lineConnector, isRoadLabel })',
    '({ text, x, y, z, rotationZ, baseRotation, viewAngleX, visible, className, lineConnector, isRoadLabel, zIndex = 7000 })'
);
code = code.replace(
    'zIndex: 7000',
    'zIndex'
);
fs.writeFileSync('src/components/Si.jsx', code);

// In PlanAnalysis3D, set road label zIndex
let planCode = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');
planCode = planCode.replace(
    /className=\{\`text-\[10px\] font-bold bg-white\/80 text-stone-600 px-1 rounded shadow-sm\`\} \/>\)/g,
    'className={`text-[10px] font-bold bg-white/80 text-stone-600 px-1 rounded shadow-sm`} zIndex={20} />)'
);
fs.writeFileSync('src/components/PlanAnalysis3D.jsx', planCode);
console.log('Fixed Si zIndex');
