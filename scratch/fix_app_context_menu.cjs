const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add import
if (!code.includes('import { ContextMenu }')) {
    code = code.replace(/import Visualizer3D from '.\/components\/PlanAnalysis3D';/g, "import Visualizer3D from './components/PlanAnalysis3D';\nimport { ContextMenu } from './components/ContextMenu.jsx';");
}

// 2. Add state
if (!code.includes('contextMenu')) {
    code = code.replace(/const \[activePanels, setActivePanels\] = useState\(\[\]\);/g, "const [activePanels, setActivePanels] = useState([]);\n    const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0 });\n    const [isFullscreen, setIsFullscreen] = useState(false);");
}

// 3. Add onContextMenu to root div
if (!code.includes('onContextMenu=')) {
    code = code.replace(/<div className="min-h-screen theme-bg px-4 md:px-12 py-8 theme-text selection:bg-\[var\(--text-accent\)\] selection:text-white">/g, "<div className=\"min-h-screen theme-bg px-4 md:px-12 py-8 theme-text selection:bg-[var(--text-accent)] selection:text-white\" onContextMenu={(e) => { e.preventDefault(); setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY }); }}>");
}

// 4. Render ContextMenu at the end of the root div
if (!code.includes('<ContextMenu')) {
    code = code.replace(/<\/div>\s*<\/div>\s*\);\s*};\s*export default Cal;/g, "        <ContextMenu x={contextMenu.x} y={contextMenu.y} isOpen={contextMenu.isOpen} onClose={() => setContextMenu({ ...contextMenu, isOpen: false })} activePanels={activePanels} onTogglePanel={(panel) => setActivePanels(prev => prev.includes(panel) ? prev.filter(p => p !== panel) : [...prev, panel])} />\n            </div>\n        </div>\n    );\n};\n\nexport default Cal;");
}

// 5. Pass isFullscreen and setIsFullscreen to Visualizer3D
if (!code.includes('isFullscreen={isFullscreen}')) {
    code = code.replace(/<Visualizer3D\s+isDarkMode={isDarkMode}/g, "<Visualizer3D\n                                    isFullscreen={isFullscreen}\n                                    setIsFullscreen={setIsFullscreen}\n                                    isDarkMode={isDarkMode}");
}

// 6. Fix full screen class in App.jsx rendering of Visualizer3D if needed
// Actually, Visualizer3D will handle fixed positioning itself.

fs.writeFileSync('src/App.jsx', code, 'utf8');
console.log('App.jsx fixed');
