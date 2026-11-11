const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const replacement = `            {showEnvPanel && (
                <DraggablePanel title="環境模擬設定" onClose={onCloseEnvPanel}>
                    <div className="p-4 theme-panel flex flex-col gap-4" style={{ minWidth: 280 }}>
                        {/* 臨地顯示 */}
                        <div>
                            <div className="theme-text-muted text-sm font-bold uppercase mb-3 flex items-center justify-between">
                                <span className="flex items-center gap-2">臨地顯示</span>
                                <button onClick={() => setAdjacentLandEnabled(prev => !prev)} className={\`px-3 py-1 rounded-full border shadow-sm flex items-center gap-2 text-xs font-bold transition-colors \${adjacentLandEnabled ? 'bg-purple-50 border-purple-200 text-purple-600' : 'theme-panel theme-border theme-text-muted'}\`}>
                                    {adjacentLandEnabled ? '開啟' : '關閉'}
                                </button>
                            </div>
                            {adjacentLandEnabled && (
                                <div className="mt-2">
                                    <div className="text-xs theme-text-muted mb-2">設定臨地組合：</div>
                                    {adjacentLandGroups.map((group, gIdx) => (
                                        <div key={group.id} className="mb-2 p-2 theme-panel-glass rounded border theme-border">
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="text-xs font-bold theme-text">臨地組合 {gIdx + 1}</div>
                                                {gIdx > 0 && (
                                                    <button onClick={() => setAdjacentLandGroups(prev => prev.filter(g => g.id !== group.id))} className="text-red-500 hover:text-red-600 px-1"><X size={12}/></button>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {(normalizedData.points || []).map((_, i) => {
                                                    const inOtherGroup = adjacentLandGroups.some(g => g.id !== group.id && g.edges.has(i));
                                                    const isActive = group.edges.has(i);
                                                    return (
                                                        <button 
                                                            key={i} 
                                                            onClick={() => {
                                                                if (inOtherGroup) return;
                                                                setAdjacentLandGroups(prev => prev.map(g => {
                                                                    if (g.id === group.id) {
                                                                        const newEdges = new Set(g.edges);
                                                                        if (newEdges.has(i)) newEdges.delete(i);
                                                                        else newEdges.add(i);
                                                                        return { ...g, edges: newEdges };
                                                                    }
                                                                    return g;
                                                                }));
                                                            }}
                                                            className={\`px-2 py-1 rounded text-[10px] font-bold border transition-colors \${
                                                                isActive ? 'bg-purple-600 text-white border-purple-700 shadow-sm' : 
                                                                inOtherGroup ? 'opacity-30 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400' :
                                                                'theme-panel theme-text-muted theme-border hover:opacity-80'
                                                            }\`}
                                                        >邊 {i}</button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={() => setAdjacentLandGroups(prev => [...prev, { id: Date.now(), edges: new Set() }])} className="w-full py-1.5 text-xs font-bold theme-text-muted border mt-1 rounded border-dashed hover:opacity-80 transition-opacity">
                                        + 新增臨地組合
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* 簡易造型 */}
                        <div className="pt-4 border-t theme-border">
                            <div className="theme-text-muted text-sm font-bold uppercase mb-3 flex items-center justify-between">
                                <span className="flex items-center gap-2">簡易造型 (隨機)</span>
                                <button onClick={() => { setRandomSlabEnabled(true); setRandomSlabSeed(Date.now()); setFloorSettings(prev => { const next = { ...prev }; Object.keys(next).forEach(k => { if (/^\\d+F$/.test(k)) { delete next[k].manualArea; delete next[k].manualDim; delete next[k].width; delete next[k].depth; delete next[k].area; delete next[k].offset; } }); return next; }); }} className="px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold shadow-sm hover:bg-indigo-700">
                                    {randomSlabEnabled ? '重新隨機' : '啟用隨機'}
                                </button>
                            </div>
                            {randomSlabEnabled && (
                                <div className="mt-2">
                                    <button onClick={() => setRandomSlabEnabled(false)} className="w-full py-1.5 text-xs font-bold theme-text-muted border mt-1 rounded border-dashed hover:opacity-80 transition-opacity mb-2">關閉隨機造型</button>
                                    <div className="flex gap-1 bg-stone-100 p-1 rounded-lg">
                                        <button onClick={() => setRandomSlabShapeMode('all')} className={\`flex-1 py-1 text-xs font-bold rounded \${randomSlabShapeMode === 'all' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'}\`}>綜合</button>
                                        <button onClick={() => setRandomSlabShapeMode('rect')} className={\`flex-1 py-1 text-xs font-bold rounded \${randomSlabShapeMode === 'rect' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'}\`}>矩形</button>
                                        <button onClick={() => setRandomSlabShapeMode('curve')} className={\`flex-1 py-1 text-xs font-bold rounded \${randomSlabShapeMode === 'curve' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500'}\`}>弧形</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </DraggablePanel>
            )}`;

// We need to replace whatever is there currently
const marker = '{showEnvPanel && (';
const idx = src.indexOf(marker);
if (idx !== -1) {
    const newSrc = src.substring(0, idx) + replacement + '\n        </div>\n    );\n};\n\nexport default Visualizer3D;';
    fs.writeFileSync('src/components/PlanAnalysis3D.jsx', newSrc, 'utf8');
    console.log('Restored the whole panel successfully!');
} else {
    console.log('Marker not found!');
}
