const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// Pass zoom to CheckLine
src = src.replace(
    /<CheckLine key=\{line\.id\} \{\.\.\.line\} baseRotation=\{0\} viewAngleX=\{viewAngleX\} rotationZ=\{rotationZ\} visible=\{true\}/g,
    '<CheckLine key={line.id} {...line} baseRotation={0} viewAngleX={viewAngleX} rotationZ={rotationZ} visible={true} zoom={zoom}'
);

// Pass zoom to SiteLabel
src = src.replace(
    /viewAngleX=\{viewAngleX\}\n\s+visible=\{true\}\n\s+className=/g,
    'viewAngleX={viewAngleX}\n                                                        visible={true}\n                                                        zoom={zoom}\n                                                        className='
);

// Pass zoom to road labels
src = src.replace(
    /viewAngleX=\{viewAngleX\} visible=\{true\} className=/g,
    'viewAngleX={viewAngleX} visible={true} zoom={zoom} className='
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
console.log('Passed zoom down!');
