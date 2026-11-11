const fs = require('fs');

// Fix the overlap in App.jsx when adding new site
let appCode = fs.readFileSync('src/App.jsx', 'utf8');
appCode = appCode.replace(
    /newPos\.x = apA\.x \+ ux\.x \* \(\(wA \+ wNew\) \/ 2\);/,
    'newPos.x = apA.x + ux.x * ((wA + wNew) / 2 + 10);'
);
appCode = appCode.replace(
    /newPos\.y = apA\.y \+ ux\.y \* \(\(wA \+ wNew\) \/ 2\);/,
    'newPos.y = apA.y + ux.y * ((wA + wNew) / 2 + 10);'
);
appCode = appCode.replace(
    /newPos\.x = apA\.x - ux\.x \* \(\(wA \+ wNew\) \/ 2\);/,
    'newPos.x = apA.x - ux.x * ((wA + wNew) / 2 + 10);'
);
appCode = appCode.replace(
    /newPos\.y = apA\.y - ux\.y \* \(\(wA \+ wNew\) \/ 2\);/,
    'newPos.y = apA.y - ux.y * ((wA + wNew) / 2 + 10);'
);
appCode = appCode.replace(
    /newPos\.x = apA\.x - uy\.x \* \(\(dA \+ dNew\) \/ 2\);/,
    'newPos.x = apA.x - uy.x * ((dA + dNew) / 2 + 10);'
);
appCode = appCode.replace(
    /newPos\.y = apA\.y - uy\.y \* \(\(dA \+ dNew\) \/ 2\);/,
    'newPos.y = apA.y - uy.y * ((dA + dNew) / 2 + 10);'
);

fs.writeFileSync('src/App.jsx', appCode);
console.log('Fixed overlap in App!');
