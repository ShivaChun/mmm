const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

code = code.replace(/showSummaryPanel, setShowSummaryPanel\}\) => \{/, "showSummaryPanel, setShowSummaryPanel, showEnvPanel, onCloseEnvPanel}) => {");

const envPanelJSX = 
            {showEnvPanel && (
                <DraggablePanel title="環境模擬設定" onClose={onCloseEnvPanel}>
                    <div className="p-4 theme-panel border-b theme-border flex flex-col gap-4">
                        {/* 臨地顯示 */}
                        <div>
                            <div className="theme-text-muted text-sm font-bold uppercase mb-3 flex items-center justify-between">
                                <span className="flex items-center gap-2">臨地顯示</span>
                                <button onClick={() => setAdjacentLandEnabled(prev => !prev)} className={\px-3 py-1 rounded-full border shadow-sm flex items-center gap-2 text-xs font-bold transition-colors \\}>
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
                                                    <button onClick={() => setAdjacentLandGroups(prev => prev.filter(g => g.id !== group.id))} className="text-red-500 hover:text-red-600 px-1">X</button>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {(normalizedData.points || []).map((_, i) => {
                                                    const inOtherGroup = adjacentLandGroups.some(g => g.id !== group.id && g.edges.has(i));
                                                    const isActive = group.edges.has(i);
                                                    return (
                                                        <button key={\dj-edge-\-\\}
                                                            disabled={inOtherGroup}
                                                            onClick={() => {
                                                                setAdjacentLandGroups(prev => prev.map(g => {
                                                                    if (g.id === group.id) {
                                                                        const next = new Set(g.edges);
                                                                        if (next.has(i)) next.delete(i); else next.add(i);
                                                                        return { ...g, edges: next };
                                                                    }
                                                                    return g;
                                                                }));
                                                            }}
                                                            className={\px-2 py-1 rounded text-[10px] font-bold border transition-colors \\}
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
                                        <button onClick={() => setRandomSlabShapeMode('all')} className={\lex-1 py-1 text-xs font-bold rounded \\}>綜合</button>
                                        <button onClick={() => setRandomSlabShapeMode('rect')} className={\lex-1 py-1 text-xs font-bold rounded \\}>矩形</button>
                                        <button onClick={() => setRandomSlabShapeMode('curve')} className={\lex-1 py-1 text-xs font-bold rounded \\}>弧形</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </DraggablePanel>
            )}
        </div>
    );
};;

code = code.replace(/        <\/div>\n    \);\n\};\n\nexport default Visualizer3D;/g, envPanelJSX + "\n\nexport default Visualizer3D;");

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
console.log('Fixed PlanAnalysis3D Env Panel');
