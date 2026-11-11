const fs = require('fs');

let oldCode = fs.readFileSync('src/App.jsx', 'utf8');

// The original UI sections in App.jsx start around <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
// Let's use Regex or simple splitting to get them.

const matchHeader = oldCode.match(/<header[\s\S]*?<\/header>/);
const header = matchHeader ? matchHeader[0] : '';

// Find the grid container that holds the panels
const gridStartStr = '<div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start relative z-10">';
const gridStartIdx = oldCode.indexOf(gridStartStr);

let mainContent = oldCode.substring(gridStartIdx);

// It's too complex to parse the JSX manually with substring.
// Let's instead patch App.jsx return block via replace.

let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. imports
if (!code.includes('import { ContextMenu }')) {
    code = code.replace("import Visualizer3D from './components/PlanAnalysis3D';", "import Visualizer3D from './components/PlanAnalysis3D';\nimport { ContextMenu } from './components/ContextMenu.jsx';\nimport { DraggablePanel } from './components/DraggablePanel.jsx';");
}

// 2. state
if (!code.includes('const [contextMenu,')) {
    code = code.replace("const [activeSiteIndex, setActiveSiteIndex] = useState(0);", "const [activeSiteIndex, setActiveSiteIndex] = useState(0);\n    const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0 });\n    const [activePanels, setActivePanels] = useState(['detail', 'basePanels', 'combinedTable']);");
}

// 3. return wrap
const returnPrefix = `    return (
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
            
            {/* FLOATING HEADER */}
            <div className="absolute top-4 left-4 z-10 pointer-events-auto theme-panel p-4 shadow-xl bg-white/90 backdrop-blur w-[350px]">
                <div className="space-y-4">
                    <h1 className="text-2xl font-black flex items-center gap-3 theme-text-title leading-tight">
                        <Building2 className="text-[var(--text-accent)]" size={24} strokeWidth={3} />
                        自地自建評估
                    </h1>
                    <div className="flex flex-col mt-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">專案名稱</label>
                        <input 
                            type="text" 
                            name="projectName" 
                            value={inputs.projectName} 
                            onChange={handleInputChange} 
                            placeholder="輸入專案名稱" 
                            className="border-b-2 border-[var(--border-strong)] focus:border-[var(--text-accent)] outline-none bg-transparent py-1 text-lg font-black theme-text placeholder:text-stone-400" 
                        />
                    </div>
                </div>
            </div>

            {/* ALL PANELS ABSOLUTE OVERLAY */}
            <div className="absolute inset-0 z-10 pointer-events-none">
                <div className="pointer-events-auto">
`;

const returnSuffix = `
                </div>
            </div>
        </div>
    );
`;

// Replace the entire wrapper.
// This requires finding the start of `<div className="w-full max-w-none mx-auto space-y-12">` 
// and its closing `</div>`, but wait, we can just replace `<div className="min-h-screen...` with `returnPrefix`,
// and wrap `DraggablePanel` around the three main blocks!

// I will just use the restored app file and integrate the collision/multi-site logic into it.
// That is much safer!
