const fs = require('fs');
let src = fs.readFileSync('src/components/Si.jsx', 'utf8');

src = src.replace(
    /fontSize: \`\$\{baseSize \* Math.max\(1, zoom\)\}px\`/,
    'fontSize: `${baseSize / zoom}px`'
);
src = src.replace(
    /padding: \`\$\{4 \* Math.max\(1, zoom\)\}px \$\{8 \* Math.max\(1, zoom\)\}px\`/,
    'padding: `${4 / zoom}px ${8 / zoom}px`'
);
src = src.replace(
    /borderWidth: \`\$\{2 \* Math.max\(1, zoom\)\}px\`/,
    'borderWidth: `${2 / zoom}px`'
);
src = src.replace(
    /transform: \`translate\(-50%, -50%\) scale\(\$\{1\/zoom\}\)\`/,
    'transform: `translate(-50%, -50%)`'
);
src = src.replace(
    /width: \`\$\{16\*zoom\}px\`, height: \`\$\{2\*zoom\}px\`/g,
    'width: `${16 / zoom}px`, height: `${2 / zoom}px`'
);

fs.writeFileSync('src/components/Si.jsx', src, 'utf8');
console.log('Fixed Si.jsx blurriness!');
