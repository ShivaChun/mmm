const fs = require('fs');
const code = fs.readFileSync('src/App.jsx', 'utf8');
const exportIdx = code.indexOf('export default Cal;');
if (exportIdx !== -1) {
    const cleanCode = code.substring(0, exportIdx + 'export default Cal;'.length) + '\n';
    fs.writeFileSync('src/App.jsx', cleanCode);
    console.log('Truncated App.jsx');
} else {
    console.log('Could not find export default Cal;');
}
