const fs = require('fs');
let code = fs.readFileSync('src/utils/polygon.js', 'utf8');

code = code.replace(
    /const toCentroidX = centroid\.x - midX;\s*const toCentroidY = centroid\.y - midY;\s*if \(nx \* toCentroidX \+ ny \* toCentroidY < 0\) \{\s*nx = -nx;\s*ny = -ny;\s*\}/,
    \if (centroid) {
        const toCentroidX = centroid.x - midX;
        const toCentroidY = centroid.y - midY;
        if (nx * toCentroidX + ny * toCentroidY < 0) {
            nx = -nx;
            ny = -ny;
        }
    }\
);

fs.writeFileSync('src/utils/polygon.js', code, 'utf8');
console.log('Fixed polygon centroid bug');
