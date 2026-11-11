const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Replace the outer container
code = code.replace(
    /<div className="min-h-screen theme-bg px-4 md:px-12 py-8 theme-text selection:bg-\[var\(--text-accent\)\] selection:text-white"[^>]*>/,
    '<div className="fixed inset-0 w-screen h-screen overflow-hidden theme-bg selection:bg-[var(--text-accent)] selection:text-white" onContextMenu={handleContextMenu} onClick={handleBgClick}>'
);

// 2. Put Visualizer3D into absolute background
code = code.replace(
    /<main className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">[\s\S]*?<Visualizer3D([\s\S]*?)\/>\s*<\/div>\s*<\/section>/,
    '<div className="absolute inset-0 z-0"><Visualizer3D/></div><div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between overflow-hidden"><div className="flex flex-col justify-start p-4">'
);

// 3. Move the INFO & PLANNING SECTION into a floating absolute container
code = code.replace(
    /<section className="space-y-4">\s*\{\/\* INFO & PLANNING SECTION \*\/\}/,
    '</div><div className="absolute right-4 top-24 bottom-4 w-96 overflow-y-auto pointer-events-auto custom-scrollbar drop-shadow-xl z-20"><section className="space-y-4">{/* INFO & PLANNING SECTION */}'
);

// 4. Adjust main closing tags
code = code.replace(/<\/main>/, '</div>');

// 5. Adjust the max-w-none wrapper inside
code = code.replace(/<div className="w-full max-w-none mx-auto space-y-12">/, '');
code = code.replace(/<\/div>\s*\{showContextMenu &&/, '{showContextMenu &&');

// 6. Make Header and Site Tabs pointer-events-auto
code = code.replace(/<header className="flex flex-col md:flex-row/, '<header className="pointer-events-auto flex flex-col md:flex-row');
code = code.replace(/<div className="flex items-center gap-2 flex-wrap">/, '<div className="pointer-events-auto flex items-center gap-2 flex-wrap mt-4">');

// Ensure handleContextMenu and handleBgClick are defined
if (!code.includes('const handleContextMenu')) {
    code = code.replace('const [showAddSiteDialog, setShowAddSiteDialog] = useState(false);', "const [showAddSiteDialog, setShowAddSiteDialog] = useState(false);\n    const [showContextMenu, setShowContextMenu] = useState(false);\n    const [contextMenuPos, setContextMenuPos] = useState({x:0,y:0});\n    const handleContextMenu = (e) => { e.preventDefault(); setContextMenuPos({x: e.clientX, y: e.clientY}); setShowContextMenu(true); };\n    const handleBgClick = () => { if(showContextMenu) setShowContextMenu(false); };");
}

fs.writeFileSync('src/App.jsx', code);
console.log('App.jsx converted to fullscreen!');
