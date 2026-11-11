const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const envPanelStr = `
                {activePanels.includes('env') && (
                    <DraggablePanel title="環境模擬設定" onClose={() => togglePanel('env')} defaultSize={{ w: 320, h: 400 }}>
                        <div className="space-y-4 p-4">
                            <h3 className="font-black text-xl mb-4 border-b-2 border-black pb-2">視覺選項</h3>
                            
                            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-stone-100 transition-colors">
                                <input type="checkbox" checked={showCheckLines} onChange={e => setShowCheckLines(e.target.checked)} className="w-5 h-5 accent-[var(--text-accent)]" />
                                <span className="font-bold">顯示法規檢討線</span>
                            </label>
                            
                            <div className="ml-8 space-y-2">
                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-stone-100 transition-colors">
                                    <input type="checkbox" checked={showHeightRatio} onChange={e => setShowHeightRatio(e.target.checked)} disabled={!showCheckLines} className="w-4 h-4 accent-[var(--text-accent)]" />
                                    <span className={!showCheckLines ? 'font-bold text-stone-400' : 'font-bold'}>高度比</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-stone-100 transition-colors">
                                    <input type="checkbox" checked={showWeiLao} onChange={e => setShowWeiLao(e.target.checked)} disabled={!showCheckLines} className="w-4 h-4 accent-[var(--text-accent)]" />
                                    <span className={!showCheckLines ? 'font-bold text-stone-400' : 'font-bold'}>危老檢討</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-stone-100 transition-colors">
                                    <input type="checkbox" checked={showBackyard} onChange={e => setShowBackyard(e.target.checked)} disabled={!showCheckLines} className="w-4 h-4 accent-[var(--text-accent)]" />
                                    <span className={!showCheckLines ? 'font-bold text-stone-400' : 'font-bold'}>後院深度比</span>
                                </label>
                            </div>
                            
                            <h3 className="font-black text-xl mb-4 mt-6 border-b-2 border-black pb-2">模型選項</h3>
                            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-stone-100 transition-colors">
                                <input type="checkbox" checked={isLandscapeMode} onChange={e => setIsLandscapeMode(e.target.checked)} className="w-5 h-5 accent-[var(--text-accent)]" />
                                <span className="font-bold">新增臨房環境</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-stone-100 transition-colors">
                                <input type="checkbox" checked={isConstraintMode} onChange={e => setIsConstraintMode(e.target.checked)} className="w-5 h-5 accent-[var(--text-accent)]" />
                                <span className="font-bold">簡易造型 (法規量體)</span>
                            </label>
                        </div>
                    </DraggablePanel>
                )}
`;

code = code.replace(
    /\{\s*activePanels\.includes\('summary'\)\s*&&\s*\(/,
    envPanelStr + "\n                {activePanels.includes('summary') && ("
);

fs.writeFileSync('src/App.jsx', code, 'utf8');
console.log('Added env panel');
