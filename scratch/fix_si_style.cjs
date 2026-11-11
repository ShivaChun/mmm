const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// Replace theme-panel-glass in Si components for CheckLines and Roads
code = code.replace(/className=\{\	ext-\[10px\] px-2 py-0\.5 rounded-none shadow-lg font-black border-2 border-black theme-panel-glass\\}/g, "className={\	ext-[10px] px-2 py-0.5 rounded-none shadow-md font-black border-2 border-black bg-white/90 text-stone-900\}");

code = code.replace(/<Si text=\{\基地 \$\{ps\.site\.name\}\\} x=\{c\.x \* scale \+ w \/ 2\} y=\{c\.y \* scale \+ d \/ 2\} z=\{2\} rotationZ=\{rotationZ\} baseRotation=\{ps\.layout\.rotation \* 180 \/ Math\.PI\} viewAngleX=\{viewAngleX\} visible=\{true\} className="text-xs px-2 py-0\.5 rounded-none shadow-lg font-black border-2 border-black theme-panel-glass" \/>/g, 
    '<Si text={基地 } x={c.x * scale + w / 2} y={c.y * scale + d / 2} z={2} rotationZ={rotationZ} baseRotation={ps.layout.rotation * 180 / Math.PI} viewAngleX={viewAngleX} visible={true} className="text-xs px-2 py-0.5 rounded-none shadow-md font-black border-2 border-black bg-white/90 text-stone-900" />');

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');

let siCode = fs.readFileSync('src/components/Si.jsx', 'utf8');
siCode = siCode.replace(/theme-panel-glass/g, "bg-white/90 text-stone-900 shadow-md");
fs.writeFileSync('src/components/Si.jsx', siCode, 'utf8');
console.log('Fixed Si style');
