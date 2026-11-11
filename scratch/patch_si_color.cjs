const fs = require('fs');
let content = fs.readFileSync('src/components/Si.jsx', 'utf8');

const targetStr = `const finalClass = hasBg ? className : \`bg-white/90 text-stone-800 \${className || ''}\`;`;
const replacementStr = `const finalClass = hasBg ? (className?.includes('text-') ? className : \`text-stone-800 \${className}\`) : \`bg-white/90 text-stone-800 \${className || ''}\`;`;
content = content.replace(targetStr, replacementStr);

fs.writeFileSync('src/components/Si.jsx', content, 'utf8');
console.log('Si color patched');
