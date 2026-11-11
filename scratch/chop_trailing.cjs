const fs = require('fs');

let lines = fs.readFileSync('src/App.jsx', 'utf8').split('\n');

// Find the last actual closing tag
let lastValidIndex = -1;
for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('export default Cal;')) {
        lastValidIndex = i;
        break;
    }
}

if (lastValidIndex !== -1) {
    fs.writeFileSync('src/App.jsx', lines.slice(0, lastValidIndex + 1).join('\n'));
    console.log('Chopped trailing artifact text!');
} else {
    console.log('Could not find export statement!');
}
