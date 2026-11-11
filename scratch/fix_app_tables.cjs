const fs = require('fs');

// 1. Fix App.jsx
let p = 'src/App.jsx';
let c = fs.readFileSync(p, 'utf8');

// Remove min-w-max from tables
c = c.replace(/min-w-max/g, 'w-full');

fs.writeFileSync(p, c, 'utf8');
console.log('App.jsx fixed!');
