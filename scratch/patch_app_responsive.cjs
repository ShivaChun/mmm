const fs = require('fs');
let src = fs.readFileSync('src/App.jsx', 'utf8');

// replace @md: and @lg: with standard responsive prefixes
src = src.replace(/@md:/g, 'md:');
src = src.replace(/@lg:/g, 'lg:');

// fix table classes to prevent squeezing
src = src.replace(
    /table-auto break-words whitespace-normal/g,
    'table-auto min-w-max'
);

// fix InfoPanel table too (Basic Data & Regs)
// the basic data and regs might be inputs or standard divs. Let's make sure its tables are min-w-max too
src = src.replace(
    /w-full border-collapse num-font bg-white/g,
    'w-full border-collapse num-font bg-white min-w-max'
);

fs.writeFileSync('src/App.jsx', src, 'utf8');
console.log('Patched App.jsx successfully!');
