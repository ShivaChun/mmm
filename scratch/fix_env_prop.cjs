const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const regex = /showSummaryPanel=\{activePanels\.includes\('summary'\)\}\s*setShowSummaryPanel=\{\(s\) => setActivePanels\(prev => s \? \[\.\.\.prev, 'summary'\] : prev\.filter\(p => p !== 'summary'\)\)\}\s*\/>/;

if (regex.test(code)) {
    code = code.replace(regex, \showSummaryPanel={activePanels.includes('summary')}
                    setShowSummaryPanel={(s) => setActivePanels(prev => s ? [...prev, 'summary'] : prev.filter(p => p !== 'summary'))}
                    showEnvPanel={activePanels.includes('env')}
                    onCloseEnvPanel={() => setActivePanels(prev => prev.filter(p => p !== 'env'))}
                />\);
    fs.writeFileSync('src/App.jsx', code, 'utf8');
    console.log("Fixed App props!");
} else {
    console.log("Not found!");
}
