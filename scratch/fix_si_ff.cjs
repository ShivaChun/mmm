const fs = require('fs');
let src = fs.readFileSync('src/components/Si.jsx', 'utf8');

src = src.replace('const scaleFactor = (1 / zoom) / hiResMulti;', 'const scaleFactor = (1 / zoom) / hiResMulti;\n    const isFirefox = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("firefox");');

src = src.replace('transform: `translate3d(${x}px, ${y}px, ${z}px) rotateZ(${-(rotationZ + baseRotation)}deg) rotateX(${-viewAngleX}deg)`, zoom: scaleFactor', 
                  'transform: `translate3d(${x}px, ${y}px, ${z}px) rotateZ(${-(rotationZ + baseRotation)}deg) rotateX(${-viewAngleX}deg) ${isFirefox ? `scale(${scaleFactor})` : ""}`, zoom: isFirefox ? 1 : scaleFactor');

fs.writeFileSync('src/components/Si.jsx', src, 'utf8');
console.log('Fixed Si zoom with Firefox fallback!');
