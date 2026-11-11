const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

code = code.replace(/const calculateCheckLines = \\(\\) => \\{/, \const calculateCheckLines = (ps) => {
        const normalizedData = ps.normalized;
        const inputs = ps.site.inputs;
        const res = ps.res;
        const massingLayers = ps.massing;
        const site = ps.site;\);

code = code.replace(/let currentFrontM = frontM;/g, 'let currentFrontM = res.frontM || 0;');
code = code.replace(/let effectiveBackM = backM;/g, 'let effectiveBackM = res.backM || 0;');
code = code.replace(/let effectiveSideM = sideM;/g, 'let effectiveSideM = res.sideM || 0;');
code = code.replace(/let baseFrontM = frontM;/g, 'let baseFrontM = res.frontM || 0;');
code = code.replace(/let baseBackM = backM;/g, 'let baseBackM = res.backM || 0;');
code = code.replace(/byRatio <= 0/g, '(res.byRatio || 0) <= 0');
code = code.replace(/byRatio > 0/g, '(res.byRatio || 0) > 0');
code = code.replace(/checkZ \\/ byRatio/g, 'checkZ / (res.byRatio || 1)');
code = code.replace(/fallingCurveRequired/g, 'res.fallingCurveRequired');
code = code.replace(/fallingCurveD/g, 'res.fallingCurveD');

code = code.replace(/calculateCheckLines\\(\\)\\.map/g, 'calculateCheckLines(ps).map');

code = code.replace(/<Si key=\\{\\oad-label-\\$\\{ps\\.site\\.id\\}-\\$\\{gIdx\\}\\\\} (.*?) rotationZ=\\{rotationZ\\} (.*?) \\/>/g, '<Si key={\oad-label-\-\\}  rotationZ={0}  />');
code = code.replace(/<CheckLine key=\\{line\\.id\\} \\{\\.\\.\\.line\\} baseRotation=\\{\\(ps\\.layout\\.rotation \\* 180 \\/ Math\\.PI\\)\\} viewAngleX=\\{viewAngleX\\} rotationZ=\\{rotationZ\\}/g, '<CheckLine key={line.id} {...line} baseRotation={(ps.layout.rotation * 180 / Math.PI)} viewAngleX={viewAngleX} rotationZ={0}');

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code);
console.log('Fixed calculateCheckLines and text labels.');
