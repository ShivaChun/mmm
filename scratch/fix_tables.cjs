const fs = require('fs');

const files = ['src/App.jsx', 'src/components/ContextMenu.jsx', 'src/components/PlanAnalysis3D.jsx'];

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let src = fs.readFileSync(file, 'utf8');
    
    // Simple regex to wrap <table ...>...</table> in <div className="overflow-x-auto w-full">
    // Wait, regex for HTML tags is risky if nested. But these tables are usually flat.
    // Actually, I can just replace <table className=" with <div className="w-full overflow-x-auto"><table className="
    // and </table> with </table></div>
    
    let modified = false;
    
    // In App.jsx, the tables might already have a wrapper?
    // Let's check App.jsx:
    if (src.includes('<table ')) {
        const parts = src.split('<table ');
        let newSrc = parts[0];
        for (let i = 1; i < parts.length; i++) {
            if (!parts[i - 1].endsWith('<div className="w-full overflow-x-auto">') && !parts[i - 1].endsWith('<div className="w-full overflow-x-auto">\n') && !parts[i - 1].endsWith('<div className="overflow-x-auto w-full">')) {
                newSrc += '<div className="w-full overflow-x-auto pb-2"><table ' + parts[i];
                modified = true;
            } else {
                newSrc += '<table ' + parts[i];
            }
        }
        
        if (modified) {
            newSrc = newSrc.replace(/<\/table>/g, '</table></div>');
            fs.writeFileSync(file, newSrc, 'utf8');
            console.log("Fixed tables in", file);
        }
    }
});
