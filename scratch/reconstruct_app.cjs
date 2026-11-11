const fs = require('fs');

const srcCode = fs.readFileSync('src/App_reconstructed.jsx', 'utf8');
const lines = srcCode.split('\n');

// Take lines 1 to 785 (0-indexed 0 to 785)
const cleanHeader = lines.slice(0, 785).join('\n');

const labelClass = 'block text-xs font-black theme-text-muted uppercase mb-1 tracking-wider';
const inputClass = 'w-full p-2 border border-stone-300 rounded outline-none theme-input text-xs font-bold num-font focus:border-[var(--text-accent)] transition-all';

const panelsJSX = `
            {/* 新增基地對話框 */}
            {showAddSiteDialog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddSiteDialog(false)} />
                    <div className="relative bg-white shadow-2xl border-4 border-black p-8 max-w-md w-full mx-4">
                        <button onClick={() => setShowAddSiteDialog(false)} className="absolute top-4 right-4 text-stone-400 hover:text-black"><X size={20} /></button>
                        <h3 className="text-2xl font-black mb-2 flex items-center gap-3"><MapPinned size={24} className="text-[var(--text-accent)]" /> 新增基地</h3>
                        <p className="text-sm text-stone-500 mb-6">是否緊貼 <span className="font-black text-black">{activeSite.name}</span>？</p>
                        <div className="space-y-3">
                            <button onClick={() => handleAddSite('back')} className="w-full p-4 border-4 border-black font-bold hover:bg-stone-100 text-left flex items-center gap-3 transition-colors">🔗 緊貼後方（背面）</button>
                            <button onClick={() => handleAddSite('left')} className="w-full p-4 border-4 border-black font-bold hover:bg-stone-100 text-left flex items-center gap-3 transition-colors">🔗 緊貼左側</button>
                            <button onClick={() => handleAddSite('right')} className="w-full p-4 border-4 border-black font-bold hover:bg-stone-100 text-left flex items-center gap-3 transition-colors">🔗 緊貼右側</button>
                            <div className="border-t-4 border-stone-200 my-2" />
                            <button onClick={() => handleAddSite('free')} className="w-full p-4 border-4 border-dashed border-stone-400 font-bold hover:bg-stone-50 text-left flex items-center gap-3 text-stone-600 transition-colors">📍 獨立放置（不緊貼）</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 基地與法規設定 */}
            {activePanels.includes('info') && (
                <DraggablePanel title="基地與法規設定" onClose={() => togglePanel('info')} defaultSize={{ w: 850, h: 600 }}>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[75vh] overflow-y-auto custom-scrollbar text-stone-850">
                        {/* 1. 基本資料 */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-black border-b-2 border-stone-200 pb-1 flex items-center gap-1.5 theme-text">
                                <MapPin size={16} className="text-[var(--text-accent)]" /> 基本資料
                            </h4>
                            <div>
                                <label className="block text-xs font-black theme-text-muted uppercase mb-1 tracking-wider">行政區</label>
                                <input type="text" name="district" value={inputs.district} onChange={handleInputChange} className="w-full p-2 border border-stone-300 rounded outline-none theme-input text-xs font-bold num-font focus:border-[var(--text-accent)] transition-all" />
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center border-b border-stone-200 pb-1.5">
                                    <label className="block text-xs font-black theme-text-muted uppercase mb-1 tracking-wider">地號與面積 (㎡)</label>
                                    <button onClick={addLot} className="font-black text-xs text-[var(--text-accent)] hover:scale-105 transition-transform flex items-center gap-0.5">
                                        <Plus size={14} strokeWidth={3} /> 新增
                                    </button>
                                </div>
                                <div className="max-h-48 overflow-y-auto pr-1 space-y-2 thin-scrollbar">
                                    {lots.map(l => (
                                        <div key={l.id} className="flex gap-1.5 items-center">
                                            <input type="text" placeholder="地號" value={l.lot} onChange={(e) => updateLot(l.id, 'lot', e.target.value)} className="w-full p-2 border border-stone-300 rounded outline-none theme-input text-xs font-bold num-font focus:border-[var(--text-accent)] transition-all text-xs p-2" />
                                            <input type="number" placeholder="面積" value={l.area} onChange={(e) => updateLot(l.id, 'area', e.target.value)} className="w-full p-2 border border-stone-300 rounded outline-none theme-input text-xs font-bold num-font focus:border-[var(--text-accent)] transition-all text-xs p-2 w-24 text-right" />
                                            {lots.length > 1 && (
                                                <button onClick={() => removeLot(l.id)} className="p-2 border border-red-200 text-red-500 hover:bg-red-500 hover:text-white transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="text-right text-sm font-black bg-stone-100 p-2 border-l-4 border-[var(--text-accent)]">
                                    合計: {formatNum(totalBaseArea)} ㎡ ({formatNum(toPing(totalBaseArea))} 坪)
                                </div>
                            </div>
                            
                            <div className="space-y-3 pt-3 border-t border-stone-200">
                                <div className="flex justify-between items-center">
                                    <label className="block text-xs font-black theme-text-muted uppercase mb-1 tracking-wider">臨路狀況</label>
                                    <button onClick={addRoad} className="font-black text-xs text-[var(--text-accent)] hover:scale-105 transition-transform flex items-center gap-0.5">
                                        <Plus size={14} strokeWidth={3} /> 新增道路
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 thin-scrollbar">
                                    {inputs.roads.map(r => (
                                        <div key={r.id} className="p-3 bg-stone-50 border border-stone-200 rounded-sm">
                                            <div className="grid grid-cols-2 gap-2 mb-2">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase theme-text-muted">路名</label>
                                                    <input type="text" value={r.name} onChange={(e) => updateRoad(r.id, 'name', e.target.value)} className="w-full p-2 border border-stone-300 rounded outline-none theme-input text-xs font-bold num-font focus:border-[var(--text-accent)] transition-all p-1 text-xs" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-center block theme-text-muted">寬(M)</label>
                                                    <input type="number" value={r.width} onChange={(e) => updateRoad(r.id, 'width', e.target.value)} className="w-full p-2 border border-stone-300 rounded outline-none theme-input text-xs font-bold num-font focus:border-[var(--text-accent)] transition-all p-1 text-xs text-center" />
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-stone-300 rounded text-stone-600">
                                                    方位: {r.edgeIndex !== undefined ? '邊線 ' + r.edgeIndex : r.orientation}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="flex items-center gap-1 text-xs font-black cursor-pointer select-none">
                                                        <input type="checkbox" checked={r.type === 'primary'} onChange={(e) => updateRoad(r.id, 'type', e.target.checked ? 'primary' : 'secondary')} className="w-4 h-4 border border-stone-300 rounded-sm checked:bg-[var(--text-accent)]" />
                                                        主路
                                                    </label>
                                                    {inputs.roads.length > 1 && (
                                                        <button onClick={() => removeRoad(r.id)} className="text-red-500 hover:scale-105 transition-transform"><Trash2 size={14} /></button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 2. 法規參數 */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-black border-b-2 border-stone-200 pb-1 flex items-center gap-1.5 theme-text">
                                <FileText size={16} className="text-sky-500" /> 法規參數
                            </h4>
                            <div><label className="block text-xs font-black theme-text-muted uppercase mb-1 tracking-wider">使用分區</label><input type="text" name="zoneType" value={inputs.zoneType} onChange={handleInputChange} className="w-full p-2 border border-stone-300 rounded outline-none theme-input text-xs font-bold num-font focus:border-[var(--text-accent)] transition-all" /></div>
                            <div><label className="block text-xs font-black theme-text-muted uppercase mb-1 tracking-wider">都市計畫名稱</label><input type="text" name="urbanPlanName" value={inputs.urbanPlanName} onChange={handleInputChange} className="w-full p-2 border border-stone-300 rounded outline-none theme-input text-xs font-bold num-font focus:border-[var(--text-accent)] transition-all" /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-sky-50/50 p-2.5 border border-sky-200 rounded">
                                    <label className="block text-xs font-black theme-text-muted uppercase mb-1 tracking-wider text-sky-700">建蔽率 (%)</label>
                                    <input type="number" name="coverageRatio" value={inputs.coverageRatio} onChange={handleInputChange} className="w-full p-2 border border-stone-300 rounded outline-none theme-input text-xs font-bold num-font focus:border-[var(--text-accent)] transition-all font-black text-sky-800 border-sky-300 bg-white" />
                                </div>
                                <div className="bg-sky-50/50 p-2.5 border border-sky-200 rounded">
                                    <label className="block text-xs font-black theme-text-muted uppercase mb-1 tracking-wider text-sky-700">容積率 (%)</label>
                                    <input type="number" name="floorRatio" value={inputs.floorRatio} onChange={handleInputChange} className="w-full p-2 border border-stone-300 rounded outline-none theme-input text-xs font-bold num-font focus:border-[var(--text-accent)] transition-all font-black text-sky-800 border-sky-300 bg-white" />
                                </div>
                            </div>
                            <div className="bg-amber-50/50 p-3 border border-amber-200 rounded">
                                <label className="block text-xs font-black theme-text-muted uppercase mb-1 tracking-wider text-amber-700">地下室開挖率 (%)</label>
                                <input type="number" name="excavationRatio" value={inputs.excavationRatio} onChange={handleInputChange} className="w-full p-2 border border-stone-300 rounded outline-none theme-input text-xs font-bold num-font focus:border-[var(--text-accent)] transition-all font-black text-amber-800 border-amber-300 bg-white" />
                            </div>
                        </div>

                        {/* 3. 樓層規劃 */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-black border-b-2 border-stone-200 pb-1 flex items-center gap-1.5 theme-text">
                                <Layers size={16} className="text-indigo-500" /> 樓層規劃
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded">
                                    <label className="block text-xs font-black theme-text-muted uppercase mb-1 tracking-wider text-indigo-700">地上樓層數</label>
                                    <div className="text-3xl font-black text-indigo-900 flex flex-col">
                                        <span>{finalRes.floorsAbove}F</span>
                                        <span className="text-[9px] font-bold text-indigo-400 mt-0.5 uppercase">自動估算結果</span>
                                    </div>
                                </div>
                                <div className="p-3 bg-stone-50 border border-stone-200 rounded">
                                    <label className="block text-xs font-black theme-text-muted uppercase mb-1 tracking-wider">地下樓層數</label>
                                    <input type="number" name="floorsBelow" value={inputs.floorsBelow} onChange={handleInputChange} className="w-full p-2 border border-stone-300 rounded outline-none theme-input text-xs font-bold num-font focus:border-[var(--text-accent)] transition-all" />
                                </div>
                            </div>
                            <div className="p-4 bg-slate-900 text-white rounded shadow-md border-l-4 border-[var(--text-accent)]">
                                <label className="text-[10px] font-black uppercase text-[var(--text-accent)] mb-1 block">允建總樓地板面積 (Total CFA)</label>
                                <div className="text-3xl font-black text-right border-b border-white/20 pb-1.5 flex justify-between items-baseline">
                                    <span className="text-[10px] font-bold text-white/40">SQM</span>
                                    {formatNum(finalRes.totalCFA)}
                                </div>
                                <div className="text-lg font-black text-right mt-1.5 text-[var(--text-accent)] flex justify-between items-baseline">
                                    <span className="text-[10px] font-bold text-white/40 uppercase">Pings</span>
                                    {formatNum(toPing(finalRes.totalCFA))} 坪
                                </div>
                            </div>
                        </div>
                    </div>
                </DraggablePanel>
            )}

            {/* 詳細計算表 */}
            {activePanels.includes('results') && (
                <DraggablePanel title="詳細計算表" onClose={() => togglePanel('results')} defaultSize={{ w: 900, h: 650 }}>
                    <div className="overflow-x-auto text-stone-850 p-2">
                        <table className="w-full text-left border-collapse num-font bg-white text-xs">
                            <thead>
                                <tr className="bg-stone-100 text-stone-700 font-bold border-b border-stone-300">
                                    <th className="p-3 w-1/4">評估項目</th>
                                    <th className="p-3 w-1/6 text-right">數值/面積 (㎡)</th>
                                    <th className="p-3 w-1/6 text-right">坪數 (坪)</th>
                                    {isEditMode && (
                                        <>
                                            <th className="p-3 text-indigo-700 bg-indigo-50/50 w-1/4">參數設定</th>
                                            <th className="p-3 text-indigo-700 bg-indigo-50/50">註解與說明</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                <SectionHeader title="A. 基地基礎法規檢討" />
                                <InputRow id="base" label="1. 基地面積" value={finalRes.base} calculatedValue={results.base} formula="SUM(地號面積)" note="多筆地號加總" isEditMode={isEditMode} onOverride={handleOverride} />
                                <InputRow id="maxBuildingArea" label="2. 允建建築面積" value={finalRes.maxBuildingArea} calculatedValue={results.maxBuildingArea} formula="基地面積 × 法定建蔽率" note={'建蔽率 ' + inputs.coverageRatio + '%，單層最大面積'} isEditMode={isEditMode} onOverride={handleOverride} highlight />
                                <InputRow id="statutoryFA" label="3. 法定容積 (FA)" value={finalRes.statutoryFA} calculatedValue={results.statutoryFA} formula="基地面積 × 法定容積率" note={'容積率 ' + inputs.floorRatio + '%，不含獎勵'} isEditMode={isEditMode} onOverride={handleOverride} highlight />
                                
                                <SectionHeader title="B. 免計容積與獎勵試算" />
                                <InputRow id="incentiveArea" label="4. 獎勵容積" value={inputs.incentiveArea} calculatedValue={inputs.incentiveArea} formula="自行輸入" note="都更、危老等獎勵" isEditMode={isEditMode} onOverride={handleInputChange} />
                                <InputRow id="transferArea" label="5. 移轉容積" value={inputs.transferArea} calculatedValue={inputs.transferArea} formula="自行輸入" note="容積移轉" isEditMode={isEditMode} onOverride={handleInputChange} />
                                <InputRow id="exempt15" label={'6. 免計容積 (' + params.exemptRate + '%)'} value={finalRes.exempt15} calculatedValue={results.exempt15} formula="法定容積 FA × 免計率" note="機電設備、安全梯等 (法規上限)" isEditMode={isEditMode} onOverride={handleOverride} paramKey="exemptRate" paramValue={params.exemptRate} onParamChange={handleParamChange} />
                                <InputRow id="exemptStair" label="7. 免計梯廳" value={finalRes.exemptStair} calculatedValue={results.exemptStair} formula={'法定容積 FA × ' + params.stairRate + '%'} note="梯廳獎勵，需視設計而定" isEditMode={isEditMode} onOverride={handleOverride} paramKey="stairRate" paramValue={params.stairRate} onParamChange={handleParamChange} />
                                <InputRow id="exemptIndoor" label="8. 免計容積室內合計" value={finalRes.exemptIndoor} calculatedValue={results.exemptIndoor} formula="Item 6 + Item 7" note="免計容積總和" isEditMode={isEditMode} onOverride={handleOverride} subTotal />
                                <InputRow id="balcony" label="9. 免計容積陽台" value={finalRes.balcony} calculatedValue={results.balcony} formula={'法定容積 FA × ' + params.balconyRate + '%'} note="每層樓地板 1/8 或 FA 10%" isEditMode={isEditMode} onOverride={handleOverride} paramKey="balconyRate" paramValue={params.balconyRate} onParamChange={handleParamChange} />
                                
                                <SectionHeader title="C. 允建面積總表" />
                                <InputRow id="permittedIndoor" label="10. 允建室內面積" value={finalRes.permittedIndoor} calculatedValue={results.permittedIndoor} formula="法定 + 獎勵 + 移轉 + 免計" note="不含陽台之室內實際使用空間" isEditMode={isEditMode} onOverride={handleOverride} bold />
                                <InputRow id="roofProtrusion" label="11. 允建屋突面積" value={finalRes.roofProtrusion} calculatedValue={results.roofProtrusion} formula="(建築面積 × 1/8) × 2層" note="屋頂突出物 (水箱、電梯機房)" isEditMode={isEditMode} onOverride={handleOverride} />
                                <InputRow id="totalBasementArea" label="12. 地下室總面積" value={finalRes.totalBasementArea} calculatedValue={results.totalBasementArea} formula="基地 × 開挖率 × 地下層數" note={'開挖率 ' + inputs.excavationRatio + '%，地下 ' + inputs.floorsBelow + ' 層'} isEditMode={isEditMode} onOverride={handleOverride} />
                                
                                <tr className="bg-amber-50 border-y border-amber-250 font-bold text-stone-850">
                                    <td className="p-3">
                                        13. 允建總樓地板面積 (Total CFA)
                                        {unusedArea > 0.1 && (
                                            <div className="text-[10px] text-emerald-600 font-normal mt-0.5">
                                                還有 {formatNum(toPing(unusedArea))} 坪 ({formatNum(unusedArea)} m²) 未使用
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 text-right">
                                        {isEditMode ? (
                                            <div className="flex items-center justify-end gap-1.5">
                                                {Math.abs(finalRes.totalCFA - results.totalCFA) > 0.01 && (
                                                    <div className="text-red-500 flex items-center text-[10px]" title="與公式計算值衝突">
                                                        <AlertTriangle size={12}/>
                                                    </div>
                                                )}
                                                <input type="number" value={finalRes.totalCFA} onChange={(e) => handleOverride('totalCFA', e.target.value)} className="w-20 p-1 text-right border border-stone-300 rounded bg-white text-xs"/>
                                            </div>
                                        ) : formatNum(finalRes.totalCFA)}
                                    </td>
                                    <td className="p-3 text-right">{formatNum(toPing(finalRes.totalCFA))}</td>
                                    {isEditMode && (
                                        <>
                                            <td className="p-3 font-mono text-[10px] text-stone-500">允建室內+陽台+屋突</td>
                                            <td className="p-3 text-[10px] text-stone-500">鎖定上限 (含獎勵/免計)</td>
                                        </>
                                    )}
                                </tr>
                                <tr className="bg-stone-50 border-y border-stone-200">
                                    <td className="p-3 font-bold">工程預算評估</td>
                                    <td className="p-3 text-right font-bold" colSpan={2}>
                                        <div className="flex items-center justify-end gap-1.5">
                                            <span className="text-[10px] text-stone-500 font-normal mr-1">單價(萬/坪):</span>
                                            {isEditMode ? (
                                                <input type="number" value={params.pricePerPing} onChange={(e) => handleParamChange('pricePerPing', e.target.value)} className="w-16 p-1 text-right border border-stone-300 rounded bg-white font-bold text-xs"/>
                                            ) : (
                                                <span className="font-bold underline decoration-dotted decoration-stone-400">{params.pricePerPing}</span>
                                            )}
                                            <span className="text-[10px] text-stone-500 mx-1">=</span>
                                            <span>{formatNum(finalRes.estimatedBudget)} 萬</span>
                                        </div>
                                    </td>
                                    {isEditMode && (
                                        <>
                                            <td className="p-3 font-mono text-[10px] text-stone-500">Total CFA (坪) × 單價</td>
                                            <td className="p-3 text-[10px] text-stone-500">概估造價 (未含設計監造/稅)</td>
                                        </>
                                    )}
                                </tr>
                                
                                <SectionHeader title="D. 空間與停車檢討" />
                                <tr className="hover:bg-stone-50"><td className="p-3 pl-6 border-l-4 border-stone-300 font-medium">12. 地上樓層估算</td><td className="p-3 text-right" colSpan={2}>約 <span className="font-bold text-indigo-650">{formatNum(finalRes.floorsAbove)}</span> 層</td>{isEditMode && <><td className="p-3 font-mono text-[10px] text-stone-500">C8 / A2</td><td className="p-3 text-[10px] text-stone-500">允建室內 / 允建建築面積</td></>}</tr>
                                <tr className="hover:bg-stone-50"><td className="p-3 pl-6 border-l-4 border-stone-300 font-medium">13. 地下層開挖檢討</td><td className="p-3 text-right" colSpan={2}>B1 ~ B{inputs.floorsBelow} (單層 {formatNum(toPing(finalRes.basementAreaPerFloor))} 坪)</td>{isEditMode && <><td className="p-3 font-mono text-[10px] text-stone-500">基地 × {inputs.excavationRatio}%</td><td className="p-3 text-[10px] text-stone-500">單層最大開挖面積</td></>}</tr>
                                <tr className="hover:bg-stone-50"><td className="p-3 pl-6 border-l-4 border-stone-300 font-medium flex items-center gap-1.5"><Car size={14}/> 14. 停車空間檢討</td><td className="p-3 text-right" colSpan={2}>法定約 {formatNum(finalRes.statutoryParking)} 部 / 空間可停 {formatNum(finalRes.possibleParking)} 部</td>{isEditMode && <><td className="p-3 font-mono text-[10px] text-stone-500">總樓地板/150 (法定)</td><td className="p-3 text-[10px] text-stone-500">空間以每車 {inputs.avgCarArea}m² 預估</td></>}</tr>
                                <tr className="hover:bg-stone-50"><td className="p-3 pl-6 border-l-4 border-stone-300 font-medium">*. 地下室免計容積</td><td className="p-3 text-right" colSpan={2}>{formatNum(finalRes.exemptBasement)} ㎡ ({formatNum(toPing(finalRes.exemptBasement))} 坪)</td>{isEditMode && <><td className="p-3 font-mono text-[10px] text-stone-500">40 × 法定停車</td><td className="p-3 text-[10px] text-stone-500">地下室停車免計面積</td></>}</tr>
                                <tr className="hover:bg-stone-50"><td className="p-3 pl-6 border-l-4 border-stone-300 font-medium">15. 坪效分析 (倍數)</td><td className="p-3 text-right font-bold text-emerald-650" colSpan={2}>{formatNum(finalRes.efficiency)} 倍</td>{isEditMode && <><td className="p-3 font-mono text-[10px] text-stone-500">總銷坪 / 基地坪</td><td className="p-3 text-[10px] text-stone-500">投入 1 坪土地可蓋出的坪數</td></>}</tr>
                                
                                <SectionHeader title="E. 高度比與退縮檢討" />
                                <tr className="hover:bg-stone-50"><td className="p-3 pl-6 border-l-4 border-stone-300 font-medium">16. 前院退縮</td><td className="p-3 text-right"><div className="flex items-center justify-end gap-1.5"><input type="number" name="frontYardDepth" value={inputs.frontYardDepth} onChange={handleInputChange} className="w-16 p-1 text-right border border-stone-300 rounded text-xs"/> m</div></td><td className="p-3 text-right text-stone-500"></td>{isEditMode && <><td className="p-3 font-mono text-[10px] text-stone-500">自行輸入</td><td className="p-3 text-[10px] text-stone-500">3D圖面顯示退縮</td></>}</tr>
                                <tr className="hover:bg-stone-50"><td className="p-3 pl-6 border-l-4 border-stone-300 font-medium">17. 側院退縮</td><td className="p-3 text-right"><div className="flex items-center justify-end gap-1.5"><select name="sideYardDirection" value={inputs.sideYardDirection || 'right'} onChange={handleInputChange} className="text-[10px] p-1 rounded border border-stone-300 bg-white"><option value="right">右側</option><option value="left">左側</option></select><input type="number" name="sideYardDepth" value={inputs.sideYardDepth || 0} onChange={handleInputChange} className="w-16 p-1 text-right border border-stone-300 rounded text-xs"/> m</div></td><td className="p-3 text-right text-stone-500"></td>{isEditMode && <><td className="p-3 font-mono text-[10px] text-stone-500">自行輸入</td><td className="p-3 text-[10px] text-stone-500">設定側院方向與深度</td></>}</tr>
                                <tr className="hover:bg-stone-50"><td className="p-3 pl-6 border-l-4 border-stone-300 font-medium">18. 後院退縮</td><td className="p-3 text-right"><div className="flex items-center justify-end gap-1.5"><input type="number" name="backYardDepth" value={inputs.backYardDepth} onChange={handleInputChange} className="w-16 p-1 text-right border border-stone-300 rounded text-xs"/> m</div></td><td className="p-3 text-right text-stone-500"></td>{isEditMode && <><td className="p-3 font-mono text-[10px] text-stone-500">自行輸入</td><td className="p-3 text-[10px] text-stone-500">3D圖面顯示退縮</td></>}</tr>
                                <tr className="hover:bg-stone-50">
                                    <td className="p-3 pl-6 border-l-4 border-stone-300 font-medium">19. 樓層高度設定</td>
                                    <td className="p-3 text-right" colSpan={2}>
                                        <div className="flex flex-col gap-1.5 items-end">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-stone-500">1F:</span>
                                                <input type="number" name="floorHeight1F" value={inputs.floorHeight1F} onChange={handleInputChange} className={'w-14 p-1 text-right border rounded text-xs ' + (inputs.zoneType === '住宅區' && parseFloat(inputs.floorHeight1F) > 4.2 ? 'border-rose-400 bg-rose-50' : 'border-stone-300')}/>
                                                {inputs.arcadeDepth > 0 && inputs.frontYardDepth == 0 && parseFloat(inputs.floorHeight1F) < 3 && <span className="text-[9px] text-red-500 font-bold bg-red-50 px-1 rounded animate-pulse">騎樓需&gt;3m</span>}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-stone-500">其他:</span>
                                                <input type="number" name="floorHeightOther" value={inputs.floorHeightOther} onChange={handleInputChange} className={'w-14 p-1 text-right border rounded text-xs ' + (inputs.zoneType === '住宅區' && parseFloat(inputs.floorHeightOther) > 3.6 ? 'border-rose-400 bg-rose-50' : 'border-stone-300')}/>
                                            </div>
                                        </div>
                                    </td>
                                    {isEditMode && <><td className="p-3 text-[10px] text-stone-500">住宅區 1F≤4.2, 其他≤3.6</td><td className="p-3 text-[10px] text-stone-500">自行輸入 (超限變紅)</td></>}
                                </tr>
                                <InputRow id="buildingHeight" label="20. 建築物高度" value={finalRes.buildingHeight} calculatedValue={finalRes.buildingHeight} formula="1F+(其他×(F-1))+9" note={finalRes.isSuperHighRise ? "超高層建築 (>100m)" : finalRes.isHighRise ? "高層建築 (>24m)" : "一般建築"} isEditMode={isEditMode} onOverride={handleOverride} highlight />
                                <InputRow id="heightRatio" label="21. 高度比" value={finalRes.heightRatio} calculatedValue={finalRes.heightRatio} formula="高度 / (路寬+前院)" note="建築高度 / (主路寬+前院深)" isEditMode={isEditMode} onOverride={handleOverride} highlight />
                                <tr className="hover:bg-stone-50"><td className="p-3 pl-6 border-l-4 border-stone-300 font-medium">22. 最小後院深度比 (檢討)</td><td className="p-3 text-right"><div className="flex flex-col items-end gap-1"><div className="flex items-center justify-end gap-1.5"><input type="number" name="minBackyardDepthRatio" value={inputs.minBackyardDepthRatio || 0} onChange={handleInputChange} className="w-16 p-1 text-right border border-stone-300 rounded text-xs"/></div></div></td><td className="p-3 text-right text-stone-500"></td>{isEditMode && <><td className="p-3 font-mono text-[10px] text-stone-500">自行輸入</td><td className="p-3 text-[10px] text-stone-500">設定比值 (如 2 代表深度 &gt; 高度/2)</td></>}</tr>
                                <InputRow id="weiLaoRatio" label="23.危老評估 (路心比)" value={finalRes.weiLaoRatio} calculatedValue={finalRes.weiLaoRatio} formula="5 / (0.5×路寬 + 前院)" note="危老條例高度檢討係數" isEditMode={isEditMode} onOverride={handleOverride} highlight />
                                {inputs.frontYardDepth == 0 && (
                                    <tr className="hover:bg-indigo-50/30 border-t border-indigo-100">
                                       <td className="p-3 pl-6 border-l-4 border-indigo-400 font-bold text-indigo-700">24. 騎樓深度</td>
                                       <td className="p-3 text-right">
                                           <div className="flex items-center justify-end gap-1.5">
                                               <input type="number" name="arcadeDepth" value={inputs.arcadeDepth} onChange={handleInputChange} className="w-16 p-1 text-right border border-indigo-300 rounded font-bold text-indigo-650 bg-white text-xs"/> m
                                           </div>
                                       </td>
                                       <td className="p-3 text-right text-stone-500"></td>
                                       {isEditMode && <><td className="p-3 font-mono text-[10px] text-indigo-500">僅當前院=0時可用</td><td className="p-3 text-[10px] text-indigo-500">設定後1F自動退縮，樓高需&gt;3m</td></>}
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </DraggablePanel>
            )}

            {/* 整體合併容積檢討表 */}
            {activePanels.includes('combined') && sites.length > 1 && (
                <DraggablePanel title="整體合併容積檢討表" onClose={() => togglePanel('combined')} defaultSize={{ w: 800, h: 600 }}>
                    <div className="overflow-x-auto text-stone-850 p-2">
                        <table className="w-full text-left border-collapse num-font bg-white text-xs">
                            <thead>
                                <tr className="bg-emerald-850 text-stone-700 font-bold border-b border-stone-300">
                                    <th className="p-4 w-1/2">整體合併項目</th>
                                    <th className="p-4 w-1/4 text-right">數值 (㎡)</th>
                                    <th className="p-4 w-1/4 text-right">坪數 (坪)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="bg-emerald-50 text-emerald-800">
                                    <td colSpan={3} className="p-3 pl-6 font-black text-xs uppercase tracking-widest">各基地允建 CFA 摘要</td>
                                </tr>
                                {siteResults.map((sr, i) => (
                                    <tr key={sr.siteId} className="hover:bg-stone-50 transition-colors">
                                        <td className="p-3 pl-6 border-l-4 border-emerald-500 font-bold">
                                            {sites[i].name}
                                            <span className="ml-2 text-[10px] text-stone-400 font-normal">
                                                (建蔽 {sites[i].inputs.coverageRatio}% / 容積 {sites[i].inputs.floorRatio}%)
                                            </span>
                                        </td>
                                        <td className="p-3 text-right font-bold">{formatNum(sr.finalRes.totalCFA)}</td>
                                        <td className="p-3 text-right font-bold text-stone-500">{formatNum(toPing(sr.finalRes.totalCFA))}</td>
                                    </tr>
                                ))}
                                <tr className="bg-emerald-50 text-emerald-800">
                                    <td colSpan={3} className="p-3 pl-6 font-black text-xs uppercase tracking-widest">合計彙總</td>
                                </tr>
                                <tr className="hover:bg-stone-50">
                                    <td className="p-3 pl-6 border-l-4 border-emerald-500 font-bold">合計基地面積</td>
                                    <td className="p-3 text-right font-bold">{formatNum(combined.totalBase)}</td>
                                    <td className="p-3 text-right font-bold text-stone-500">{formatNum(toPing(combined.totalBase))}</td>
                                </tr>
                                <tr className="hover:bg-stone-50">
                                    <td className="p-3 pl-6 border-l-4 border-emerald-500 font-bold">合計允建建築面積</td>
                                    <td className="p-3 text-right font-bold">{formatNum(combined.totalMaxBuildingArea)}</td>
                                    <td className="p-3 text-right font-bold text-stone-500">{formatNum(toPing(combined.totalMaxBuildingArea))}</td>
                                </tr>
                                <tr className="hover:bg-stone-50">
                                    <td className="p-3 pl-6 border-l-4 border-emerald-500 font-bold">合計法定容積</td>
                                    <td className="p-3 text-right font-bold">{formatNum(combined.totalStatutoryFA)}</td>
                                    <td className="p-3 text-right font-bold text-stone-500">{formatNum(toPing(combined.totalStatutoryFA))}</td>
                                </tr>
                                <tr className="bg-emerald-800 text-white font-bold border-y border-emerald-900 text-sm">
                                    <td className="p-4 font-black">合計允建總樓地板面積 (Total CFA)</td>
                                    <td className="p-4 text-right font-black">{formatNum(combined.totalCFA)}</td>
                                    <td className="p-4 text-right font-black">{formatNum(toPing(combined.totalCFA))}</td>
                                </tr>
                                <tr className="bg-emerald-950 text-white font-bold text-sm">
                                    <td className="p-4 font-black">綜合坪效</td>
                                    <td className="p-4 text-right font-black text-emerald-300 italic" colSpan={2}>
                                        {formatNum(combined.avgEfficiency, 2)} 倍
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </DraggablePanel>
            )}
        </div>
    );
};

export default Cal;
`;

// Replace onAction prop in ContextMenu call inside cleanHeader
let cleanHeaderFixed = cleanHeader.replace(
    /activePanels=\{activePanels\}\s*onTogglePanel=\{\(panel\) => setActivePanels\(prev => prev\.includes\(panel\) \? prev\.filter\(p => p !== panel\) : \[\.\.\.prev, panel\]\)\}/g,
    'activePanels={activePanels} onTogglePanel={(panel) => togglePanel(panel)} onAction={handleCanvasAction}'
);

// Verify if togglePanel and handleCanvasAction are defined
if (!cleanHeaderFixed.includes('const togglePanel =')) {
    cleanHeaderFixed = cleanHeaderFixed.replace(
        'const [activePanels, setActivePanels] = useState([]);',
        'const [activePanels, setActivePanels] = useState([]);\n    const togglePanel = (p) => setActivePanels(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);\n    const handleCanvasAction = (action) => {\n        if (action === \'toggle_info_panel\') togglePanel(\'info\');\n        if (action === \'toggle_results_panel\') togglePanel(\'results\');\n        if (action === \'toggle_combined_table\') togglePanel(\'combined\');\n        if (action === \'toggle_summary_panel\') togglePanel(\'summary\');\n        if (action === \'toggle_dark_mode\') setIsDarkMode(prev => !prev);\n        if (action === \'toggle_check_lines\') setShowCheckLines(prev => !prev);\n        if (action === \'toggle_height_ratio\') setShowHeightRatio(prev => !prev);\n        if (action === \'toggle_wei_lao\') setShowWeiLao(prev => !prev);\n        if (action === \'toggle_backyard\') setShowBackyard(prev => !prev);\n        if (action === \'open_add_site\') setShowAddSiteDialog(true);\n    };'
    );
}

fs.writeFileSync('src/App.jsx', cleanHeaderFixed + panelsJSX, 'utf8');
console.log('Successfully reconstructed App.jsx!');
