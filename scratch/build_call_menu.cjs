const fs = require('fs');
let appSrc = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add activePanels state
appSrc = appSrc.replace(
    /const \[showCombinedTable, setShowCombinedTable\] = useState\(true\);/,
    const [showCombinedTable, setShowCombinedTable] = useState(true);
    const [activePanels, setActivePanels] = useState([]);
    
    const togglePanel = (panelId) => {
        setActivePanels(prev => prev.includes(panelId) ? prev.filter(p => p !== panelId) : [...prev, panelId]);
    };
);

// 2. Remove the inline grid for basic info and replace with DraggablePanels
// We will replace <section className="space-y-4"> ... </section> for INFO & PLANNING SECTION
appSrc = appSrc.replace(
    /\{\/\* INFO & PLANNING SECTION \*\/\}.*?\{\/\* COMBINED TABLE SECTION \*\/\}/s,
    {/* DRAGGABLE PANELS (Managed by Call Menu) */}
                {activePanels.includes('basic') && (
                    <DraggablePanel title="基本資料" onClose={() => togglePanel('basic')} defaultSize={{w: 360, h: 500}}>
                        <div className="space-y-6">
                            <div>
                                <label className={labelClass}>行政區</label>
                                <input type="text" name="district" value={inputs.district} onChange={handleInputChange} className={inputClass} />
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b-4 border-[var(--border-strong)] pb-2">
                                    <h4 className="font-bold text-lg flex items-center gap-2"><MapPin size={18}/> 土地資訊</h4>
                                </div>
                                <div className="space-y-2">
                                    {lots.map((lot, idx) => (
                                        <div key={lot.id} className="flex gap-2 items-start">
                                            <div className="flex-1">
                                                <input type="text" placeholder="地號 (例: 123-4)" value={lot.lot} onChange={(e) => updateLot(lot.id, 'lot', e.target.value)} className={inputClass} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="relative">
                                                    <input type="number" placeholder="面積" value={lot.area || ''} onChange={(e) => updateLot(lot.id, 'area', e.target.value)} className={inputClass} />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--text-muted)]">㎡</span>
                                                </div>
                                            </div>
                                            {lots.length > 1 && (
                                                <button onClick={() => removeLot(lot.id)} className="p-3 text-red-500 hover:bg-red-50 font-black border-2 border-red-200 transition-colors">
                                                    <X size={16} strokeWidth={3} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button onClick={addLot} className="w-full py-3 border-4 border-dashed border-[var(--border-strong)] text-[var(--text-muted)] font-black hover:border-black hover:text-black transition-all flex items-center justify-center gap-2">
                                        <Plus size={18} strokeWidth={3} /> 新增地號
                                    </button>
                                </div>
                                <InputRow label="基準基地寬" name="baseWidthM" value={inputs.baseWidthM} onChange={handleInputChange} unit="m" />
                                <InputRow label="基準基地深" name="baseDepthM" value={inputs.baseDepthM} onChange={handleInputChange} unit="m" />
                                <div className="flex justify-between items-center p-3 bg-stone-100 border-2 border-stone-200">
                                    <span className="font-bold text-stone-600">總基地面積</span>
                                    <span className="font-black text-lg text-black">{totalBaseArea.toFixed(2)} ㎡</span>
                                </div>
                            </div>
                        </div>
                    </DraggablePanel>
                )}
                
                {activePanels.includes('regulations') && (
                    <DraggablePanel title="法規檢討" onClose={() => togglePanel('regulations')} defaultSize={{w: 360, h: 500}}>
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b-4 border-[var(--border-strong)] pb-2">
                                    <h4 className="font-bold text-lg flex items-center gap-2"><BookOpen size={18}/> 法規檢討</h4>
                                </div>
                                <InputRow label="分區" name="zoneType" value={inputs.zoneType} onChange={handleInputChange} />
                                <div className="grid grid-cols-2 gap-4">
                                    <InputRow label="建蔽率" name="coverageRatio" value={inputs.coverageRatio} onChange={handleInputChange} unit="%" />
                                    <InputRow label="容積率" name="floorRatio" value={inputs.floorRatio} onChange={handleInputChange} unit="%" />
                                </div>
                                <InputRow label="開挖率" name="excavationRatio" value={inputs.excavationRatio} onChange={handleInputChange} unit="%" />
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b-4 border-[var(--border-strong)] pb-2 mt-6">
                                    <h4 className="font-bold text-lg flex items-center gap-2"><Ruler size={18}/> 退縮與獎勵</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputRow label="前院退縮" name="frontYardDepth" value={inputs.frontYardDepth} onChange={handleInputChange} unit="m" />
                                    <InputRow label="後院退縮" name="backYardDepth" value={inputs.backYardDepth} onChange={handleInputChange} unit="m" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputRow label="側院退縮" name="sideYardDepth" value={inputs.sideYardDepth} onChange={handleInputChange} unit="m" />
                                    <div>
                                        <label className={labelClass}>側院方向</label>
                                        <select name="sideYardDirection" value={inputs.sideYardDirection} onChange={handleInputChange} className={inputClass}>
                                            <option value="none">無 (雙拼/連棟)</option>
                                            <option value="left">左側 (單邊)</option>
                                            <option value="right">右側 (單邊)</option>
                                            <option value="both">雙側 (獨棟)</option>
                                        </select>
                                    </div>
                                </div>
                                <InputRow label="免計容積比例" name="exemptRate" value={params.exemptRate} onChange={(e) => setParams({...params, exemptRate: parseFloat(e.target.value)||0})} unit="%" />
                            </div>
                        </div>
                    </DraggablePanel>
                )}

                {activePanels.includes('details') && (
                    <DraggablePanel title="詳細計算表" onClose={() => togglePanel('details')} defaultSize={{w: 460, h: 500}}>
                        <div className="space-y-4">
                            <h4 className="font-bold text-lg border-b-4 border-[var(--border-strong)] pb-2 mb-4">開發強度計算</h4>
                            <div className="overflow-x-auto border-2 border-black">
                                <table className="w-full text-sm font-bold text-left">
                                    <thead className="bg-[var(--text-primary)] text-white">
                                        <tr>
                                            <th className="p-3 border-r-2 border-stone-700">項目</th>
                                            <th className="p-3 border-r-2 border-stone-700 text-right">數值 (㎡)</th>
                                            <th className="p-3 text-right">坪數 (坪)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        <tr className="border-b-2 border-[var(--border-strong)]">
                                            <td className="p-3 border-r-2 border-[var(--border-strong)]">法定建蔽面積</td>
                                            <td className="p-3 border-r-2 border-[var(--border-strong)] text-right">{formatNum(results.legalCoverageArea)}</td>
                                            <td className="p-3 text-right">{formatNum(toPing(results.legalCoverageArea))}</td>
                                        </tr>
                                        <tr className="border-b-2 border-[var(--border-strong)]">
                                            <td className="p-3 border-r-2 border-[var(--border-strong)]">法定容積面積</td>
                                            <td className="p-3 border-r-2 border-[var(--border-strong)] text-right">{formatNum(results.legalFloorArea)}</td>
                                            <td className="p-3 text-right">{formatNum(toPing(results.legalFloorArea))}</td>
                                        </tr>
                                        <tr className="border-b-2 border-[var(--border-strong)] bg-stone-50">
                                            <td className="p-3 border-r-2 border-[var(--border-strong)]">總允建容積 (含獎勵)</td>
                                            <td className="p-3 border-r-2 border-[var(--border-strong)] text-right text-[var(--text-accent)]">{formatNum(results.totalAllowedFloorArea)}</td>
                                            <td className="p-3 text-right text-[var(--text-accent)]">{formatNum(toPing(results.totalAllowedFloorArea))}</td>
                                        </tr>
                                        <tr className="border-b-2 border-[var(--border-strong)]">
                                            <td className="p-3 border-r-2 border-[var(--border-strong)]">免計容積上限</td>
                                            <td className="p-3 border-r-2 border-[var(--border-strong)] text-right">{formatNum(results.maxExemptArea)}</td>
                                            <td className="p-3 text-right">{formatNum(toPing(results.maxExemptArea))}</td>
                                        </tr>
                                    </tbody>
                                    <tfoot className="bg-[var(--text-primary)] text-white">
                                        <tr>
                                            <td className="p-3 border-r-2 border-stone-700 font-black">總銷建坪估算</td>
                                            <td className="p-3 border-r-2 border-stone-700 text-right font-black text-lg">{formatNum(results.estimatedTotalSalesArea)}</td>
                                            <td className="p-3 text-right font-black text-lg">{formatNum(toPing(results.estimatedTotalSalesArea))}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </DraggablePanel>
                )}

                {/* COMBINED TABLE SECTION */}
);

// 3. Update Visualizer3D props to pass the activePanels state for env and project panels
appSrc = appSrc.replace(
    /setActiveSiteIndex=\{setActiveSiteIndex\}/,
    setActiveSiteIndex={setActiveSiteIndex}
                                    showEnvPanel={activePanels.includes('envSettings')}
                                    onCloseEnvPanel={() => togglePanel('envSettings')}
                                    showSummaryPanel={activePanels.includes('projectSummary')}
                                    setShowSummaryPanel={() => togglePanel('projectSummary')}
);

// 4. Add the Call Menu UI to the top level (absolute positioned)
const callMenuUI = 
            {/* CALL MENU (呼叫選單) */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
                <div className="flex flex-col gap-2 pointer-events-auto items-end">
                    {[
                        { id: 'projectSummary', label: '專案摘要', icon: '??' },
                        { id: 'basic', label: '基本資料', icon: '??' },
                        { id: 'regulations', label: '法規檢討', icon: '??' },
                        { id: 'details', label: '詳細計算', icon: '??' },
                        { id: 'envSettings', label: '環境設定', icon: '??' }
                    ].map(btn => {
                        const isActive = activePanels.includes(btn.id);
                        return (
                            <button
                                key={btn.id}
                                onClick={() => togglePanel(btn.id)}
                                className={\lex items-center gap-2 px-4 py-3 rounded-full font-black text-sm transition-all shadow-[4px_4px_0_#000] border-4 border-black \\}
                            >
                                <span>{btn.icon}</span>
                                {btn.label}
                            </button>
                        );
                    })}
                </div>
            </div>
;
appSrc = appSrc.replace(/<div className="fixed top-6 right-6 z-50 flex items-center gap-2">/, callMenuUI + '\n            <div className="fixed top-6 right-6 z-50 flex items-center gap-2">');

// 5. Add import for DraggablePanel
if (!appSrc.includes("import { DraggablePanel }")) {
    appSrc = appSrc.replace(/import { CollapsibleSection, InputRow, SectionHeader } from '\.\/components\/Si\.jsx';/, import { CollapsibleSection, InputRow, SectionHeader } from './components/Si.jsx';\nimport { DraggablePanel } from './components/DraggablePanel';);
}

fs.writeFileSync('src/App.jsx', appSrc);
