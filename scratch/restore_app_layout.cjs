const fs = require('fs');

let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add imports if missing
if (!code.includes('import { ContextMenu }')) {
    code = code.replace("import Visualizer3D from './components/PlanAnalysis3D';", "import Visualizer3D from './components/PlanAnalysis3D';\nimport { ContextMenu } from './components/ContextMenu.jsx';\nimport { DraggablePanel } from './components/DraggablePanel.jsx';");
}

// 2. Add contextMenu state
if (!code.includes('const [contextMenu,')) {
    code = code.replace("const [activeSiteIndex, setActiveSiteIndex] = useState(0);", "const [activeSiteIndex, setActiveSiteIndex] = useState(0);\n    const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0 });\n    const [activePanels, setActivePanels] = useState(['detail', 'basePanels', 'combinedTable']);");
}

// 3. Find the main return block
const returnStart = code.indexOf('    return (\n        <div className="min-h-screen theme-bg');
if (returnStart === -1) {
    console.error('Could not find return block');
    process.exit(1);
}

// We will replace the entire return block with a structured floating panel layout.
// Since the user liked the new "theme" classes, we'll keep them inside the panels.

let newReturnBlock = `    return (
        <div 
            className="fixed inset-0 w-full h-full bg-stone-100 overflow-hidden text-stone-800 font-sans selection:bg-[var(--text-accent)] selection:text-white"
            onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY });
            }}
        >
            <ContextMenu 
                x={contextMenu.x} 
                y={contextMenu.y} 
                isOpen={contextMenu.isOpen} 
                onClose={() => setContextMenu({ ...contextMenu, isOpen: false })} 
                activePanels={activePanels} 
                onTogglePanel={(panel) => setActivePanels(prev => prev.includes(panel) ? prev.filter(p => p !== panel) : [...prev, panel])} 
            />

            {/* FULL SCREEN VISUALIZER (Z=0) */}
            <div className="absolute inset-0 z-0">
                <Visualizer3D
                    isDarkMode={isDarkMode}
                    setIsDarkMode={setIsDarkMode}
                    sites={sites}
                    activeSiteId={activeSite.id}
                    inputs={{ ...inputs, baseArea: finalRes.base, floorsAbove: finalRes.floorsAbove }}
                    res={finalRes}
                    siteResults={siteResults}
                    onUpdateBaseDim={updateBaseDim}
                    onUpdateRoads={handleUpdateRoads}
                    onUpdateInputs={handleUpdateInputs}
                    onUpdateSiteSetting={handleUpdateSiteSetting}
                    showCheckLines={showCheckLines}
                    setShowCheckLines={setShowCheckLines}
                    showHeightRatio={showHeightRatio}
                    setShowHeightRatio={setShowHeightRatio}
                    showWeiLao={showWeiLao}
                    setShowWeiLao={setShowWeiLao}
                    showBackyard={showBackyard}
                    setShowBackyard={setShowBackyard}
                    isConstraintMode={isConstraintMode}
                    setIsConstraintMode={setIsConstraintMode}
                    onUnusedAreaChange={setUnusedArea}
                    placementMode={placementMode}
                    referenceEdge={referenceEdge}
                    setReferenceEdge={setReferenceEdge}
                    placementOffset={placementOffset}
                    setPlacementOffset={setPlacementOffset}
                    onConfirmPlacement={handleConfirmPlacement}
                />
            </div>
`;

// Now extract the existing components to put them into DraggablePanels
// 1. Header (not draggable, just floating top-left)
// 2. Base Panels (site list & editing)
// 3. Combined Table (results)

const headerHtml = `
            {/* FLOATING HEADER */}
            <div className="absolute top-4 left-4 z-10 pointer-events-auto theme-panel p-6 shadow-xl bg-white/90 backdrop-blur w-[400px]">
                <div className="space-y-4">
                    <h1 className="text-3xl font-black flex items-center gap-3 theme-text-title leading-tight">
                        <Building2 className="text-[var(--text-accent)]" size={32} strokeWidth={3} />
                        自地自建評估
                    </h1>
                    <div className="flex flex-col mt-4">
                        <label className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">專案名稱</label>
                        <input 
                            type="text" 
                            name="projectName" 
                            value={inputs.projectName} 
                            onChange={handleInputChange} 
                            placeholder="輸入專案名稱" 
                            className="border-b-2 border-[var(--border-strong)] focus:border-[var(--text-accent)] outline-none bg-transparent py-1 text-xl font-black theme-text placeholder:text-stone-400" 
                        />
                    </div>
                </div>
            </div>
`;

// To avoid writing huge strings, I'll extract the DOM trees of the components directly from the existing code by searching for known keywords.

code = code.substring(0, returnStart) + newReturnBlock + headerHtml + '\n            {/* THE REST WILL BE ADDED BELOW */}\n        </div>\n    );\n};\nexport default Cal;\n';

fs.writeFileSync('src/App_temp.jsx', code);
console.log('App_temp.jsx generated');
