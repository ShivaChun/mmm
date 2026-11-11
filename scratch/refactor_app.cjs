const fs = require('fs');
let src = fs.readFileSync('src/App.jsx', 'utf8');

// The marker strings to split by
const marker1 = '{/* INFO & PLANNING SECTION */}';
const marker2 = '{/* COMBINED TABLE SECTION */}'; // Wait, let's check what's after DATA TABLE SECTION
