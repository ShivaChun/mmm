const fs = require('fs');
let src = fs.readFileSync('src/App.jsx', 'utf8');

// The main return block starts around line 663
const returnStart = src.indexOf('    return (');
const preReturn = src.substring(0, returnStart);

// We need to extract:
// 1. HEADER
const headerMatch = src.match(/<header.*?<\/header>/s);
const header = headerMatch ? headerMatch[0] : '';

// 2. SETTINGS GEAR
const settingsMatch = src.match(/<div className="fixed top-6 right-6 z-50 flex items-center gap-2">.*?<\/div>/s);
const settings = settingsMatch ? settingsMatch[0] : '';

// 3. ADD SITE DIALOG
const addSiteMatch = src.match(/\{showAddSiteDialog && \(.*?\}\)/s);
const addSite = addSiteMatch ? addSiteMatch[0] : '';

// 4. SITE TABS
const siteTabsMatch = src.match(/\{sites\.length > 0 && \(.*?\}\)/s);
const siteTabs = siteTabsMatch ? siteTabsMatch[0] : '';

// 5. PLACEMENT MODE UI
const placementMatch = src.match(/\{placementMode === 'independent' && \(.*?\}\)/s);
const placement = placementMatch ? placementMatch[0] : '';

// 6. Basic Info Content (inside CollapsibleSection title="基本資料")
const basicInfoRegex = /<CollapsibleSection title="基本資料"[^>]*>(.*?)<\/CollapsibleSection>/s;
const basicInfoMatch = src.match(basicInfoRegex);
const basicInfoContent = basicInfoMatch ? basicInfoMatch[1] : '';

// 7. Regulations Content (inside CollapsibleSection title="法規檢討")
const regsRegex = /<CollapsibleSection title="法規檢討"[^>]*>(.*?)<\/CollapsibleSection>/s;
const regsMatch = src.match(regsRegex);
const regsContent = regsMatch ? regsMatch[1] : '';

// 8. Details Content (inside CollapsibleSection title="詳細計算表")
const detailsRegex = /<CollapsibleSection title="詳細計算表"[^>]*>(.*?)<\/CollapsibleSection>/s;
const detailsMatch = src.match(detailsRegex);
const detailsContent = detailsMatch ? detailsMatch[1] : '';

const newReturn = \    return (
        <div className="fixed inset-0 overflow-hidden theme-bg text-[var(--text-main)] font-sans">
            {/* 3D VISUALIZER BACKGROUND */}
            <div className="absolute inset-0 z-0">
                <Visualizer3D
                    isDarkMode={isDarkMode}
                    setIsDarkMode={setIsDarkMode}
                    sites={sites}
                    activeSiteId={activeSite.id}
                    inputs={{ ...inputs, baseArea: finalRes.base, floorsAbove: finalRes.floorsAbove }}
                    res={finalRes}
                    siteResults={siteResults}
                    aggregateResults={combined}
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
                    onUpdateSiteGeometry={(geom) => handleUpdateSiteGeometry(activeSiteIndex, geom)}
                    setActiveSiteIndex={setActiveSiteIndex}
                    showEnvPanel={activePanels.includes('env')}
                    onCloseEnvPanel={() => togglePanel('env')}
                    showSummaryPanel={activePanels.includes('project')}
                    setShowSummaryPanel={() => togglePanel('project')}
                />
            </div>

            {/* UI OVERLAY */}
            <div className="absolute inset-0 pointer-events-none z-10 p-4 md:p-8 flex flex-col">
                <div className="pointer-events-auto w-full max-w-5xl theme-panel-glass p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center border theme-border mb-6 shadow-xl backdrop-blur-xl">
                    <div className="space-y-2">
                        <h1 className="text-3xl md:text-4xl font-black flex items-center gap-4 theme-text-title tracking-tight">
                            <Building2 className="text-[var(--text-accent)]" size={36} strokeWidth={3} />
                            自地自建評估
                        </h1>
                    </div>
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mt-4 md:mt-0">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">專案名稱</label>
                            <input 
                                type="text" 
                                value={inputs.projectName} 
                                onChange={(e) => setInputs(prev => ({...prev, projectName: e.target.value}))}
                                placeholder="輸入專案名稱..."
                                className="bg-white/50 dark:bg-black/20 border-2 border-transparent focus:border-[var(--text-accent)] outline-none px-4 py-2 rounded-lg font-bold text-sm transition-all"
                            />
                        </div>
                    </div>
                </div>

                <div className="pointer-events-auto flex items-center gap-2 flex-wrap mb-4">
                    \
                </div>

                <div className="pointer-events-auto absolute top-6 right-6">
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-12 h-12 rounded-xl flex items-center justify-center theme-panel-glass border theme-border hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shadow-lg backdrop-blur">
                        {isDarkMode ? <Sun size={22} className="text-stone-300"/> : <Moon size={22} className="text-stone-700"/>}
                    </button>
                </div>

                \
                \
            </div>

            {/* CALL MENU */}
            <div className="fixed bottom-8 right-8 z-[60] flex flex-col gap-3 pointer-events-none items-end">
                {[
                    { id: 'project', label: '專案摘要', icon: '??' },
                    { id: 'basic', label: '基本資料', icon: '??' },
                    { id: 'regulations', label: '法規檢討', icon: '??' },
                    { id: 'details', label: '詳細計算', icon: '??' },
                    { id: 'env', label: '環境設定', icon: '??' }
                ].map(btn => {
                    const isActive = activePanels.includes(btn.id);
                    return (
                        <button
                            key={btn.id}
                            onClick={() => togglePanel(btn.id)}
                            className={\pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl font-black text-sm transition-all \\}
                        >
                            <span className="text-lg">{btn.icon}</span>
                            {btn.label}
                        </button>
                    );
                })}
            </div>

            {/* DRAGGABLE PANELS */}
            {activePanels.includes('basic') && (
                <DraggablePanel title="基本資料" onClose={() => togglePanel('basic')} defaultSize={{w: 380, h: 560}}>
                    \
                </DraggablePanel>
            )}

            {activePanels.includes('regulations') && (
                <DraggablePanel title="法規檢討" onClose={() => togglePanel('regulations')} defaultSize={{w: 380, h: 620}}>
                    \
                </DraggablePanel>
            )}

            {activePanels.includes('details') && (
                <DraggablePanel title="詳細計算表" onClose={() => togglePanel('details')} defaultSize={{w: 520, h: 640}}>
                    \
                </DraggablePanel>
            )}
        </div>
    );
};

export default App;\;

fs.writeFileSync('src/App.jsx', preReturn + newReturn);
console.log('Done!');
