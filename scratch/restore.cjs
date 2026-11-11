const fs = require('fs');
const content = fs.readFileSync('C:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/App.jsx', 'utf8');

const replacement = `                {/* DATA TABLE SECTION */}
                <section className="space-y-4">
                    <div className="theme-panel bg-[var(--text-primary)] p-0">
                        <div 
                            className="p-6 flex justify-between items-center cursor-pointer hover:bg-[var(--text-accent)] transition-colors group" 
                            onClick={() => setShowDetail(!showDetail)}
                        >
                            <h3 className="text-2xl font-black text-white flex items-center gap-3">
                                <FileText size={24} strokeWidth={3} /> 詳細計算表
                            </h3>
                            <div className="text-white group-hover:scale-125 transition-transform">
                                {showDetail ? <ChevronUp size={28} strokeWidth={3} /> : <ChevronDown size={28} strokeWidth={3} />}
                            </div>
                        </div>
                    </div>
                    
                    <div className={\`transition-all duration-500 ease-in-out \${showDetail ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}\`}>
                        <div className="theme-panel overflow-hidden border-8">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[800px] text-left border-collapse num-font bg-white">
                                    <thead>
                                        <tr className="bg-[var(--text-primary)] text-white border-b-8 border-black">
                                            <th className="p-6 text-xl font-black uppercase">評估項目</th>
                                            <th className="p-6 text-xl font-black uppercase text-right">數值/面積 (㎡)</th>
                                            <th className="p-6 text-xl font-black uppercase text-right">坪數 (坪)</th>
                                            {isEditMode && (
                                                <>
                                                    <th className="p-6 text-xl font-black uppercase text-[var(--text-accent)] bg-stone-900 border-l-4 border-black">參數設定</th>
                                                    <th className="p-6 text-xl font-black uppercase text-[var(--text-accent)] bg-stone-900 border-l-4 border-black">註解</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y-4 divide-black">
                                        <SectionHeader title="A. 基地基礎法規檢討" />
                                        <InputRow id="base" label="1. 基地面積" value={finalRes.base} calculatedValue={results.base} formula="SUM(地號面積)" note="多筆地號加總" isEditMode={isEditMode} onOverride={handleOverride} />
                                        <InputRow id="maxBuildingArea" label="2. 允建建築面積" value={finalRes.maxBuildingArea} calculatedValue={results.maxBuildingArea} formula="基地面積 × 法定建蔽率" note={\`建蔽率 \${inputs.coverageRatio}%\`} isEditMode={isEditMode} onOverride={handleOverride} highlight />
                                        <InputRow id="statutoryFA" label="3. 法定容積 (FA)" value={finalRes.statutoryFA} calculatedValue={results.statutoryFA} formula="基地面積 × 法定容積率" note={\`容積率 \${inputs.floorRatio}%\`} isEditMode={isEditMode} onOverride={handleOverride} highlight />
                                        
                                        <SectionHeader title="B. 免計容積與獎勵試算" />
                                        <InputRow id="incentiveArea" label="4. 獎勵容積" value={inputs.incentiveArea} calculatedValue={inputs.incentiveArea} formula="自行輸入" note="如都更獎勵" isEditMode={isEditMode} onOverride={handleInputChange} />
                                        <InputRow id="transferArea" label="5. 移轉容積" value={inputs.transferArea} calculatedValue={inputs.transferArea} formula="自行輸入" note="容積移轉" isEditMode={isEditMode} onOverride={handleInputChange} />
                                        <InputRow id="exempt15" label={\`6. 免計容積 (\${params.exemptRate}%)\`} value={finalRes.exempt15} calculatedValue={results.exempt15} formula="FA × 免計率" note="機電設備上限" isEditMode={isEditMode} onOverride={handleOverride} paramKey="exemptRate" paramValue={params.exemptRate} onParamChange={handleParamChange} />
                                        <InputRow id="exemptStair" label="7. 免計梯廳" value={finalRes.exemptStair} calculatedValue={results.exemptStair} formula={\`FA × \${params.stairRate}%\`} note="梯廳獎勵" isEditMode={isEditMode} onOverride={handleOverride} paramKey="stairRate" paramValue={params.stairRate} onParamChange={handleParamChange} />
                                        <InputRow id="exemptIndoor" label="8. 免計容積室內合計" value={finalRes.exemptIndoor} calculatedValue={results.exemptIndoor} formula="Item 6 + Item 7" note="免計容積總和" isEditMode={isEditMode} onOverride={handleOverride} subTotal />
                                        <InputRow id="balcony" label="9. 免計容積陽台" value={finalRes.balcony} calculatedValue={results.balcony} formula={\`FA × \${params.balconyRate}%\`} note="陽台獎勵" isEditMode={isEditMode} onOverride={handleOverride} paramKey="balconyRate" paramValue={params.balconyRate} onParamChange={handleParamChange} />
                                        
                                        <SectionHeader title="C. 允建面積總表" />
                                        <InputRow id="permittedIndoor" label="10. 允建室內面積" value={finalRes.permittedIndoor} calculatedValue={results.permittedIndoor} formula="法定+獎勵+移轉+免計" note="不含陽台" isEditMode={isEditMode} onOverride={handleOverride} bold />
                                        <InputRow id="roofProtrusion" label="11. 允建屋突面積" value={finalRes.roofProtrusion} calculatedValue={results.roofProtrusion} formula="(建築面積×1/8)×2" note="屋頂突出物" isEditMode={isEditMode} onOverride={handleOverride} />
                                        <InputRow id="totalBasementArea" label="12. 地下室總面積" value={finalRes.totalBasementArea} calculatedValue={results.totalBasementArea} formula="基地×開挖×層數" note={\`開挖率 \${inputs.excavationRatio}%\`} isEditMode={isEditMode} onOverride={handleOverride} />

                                        <tr className="bg-[var(--text-accent)] text-white border-y-8 border-black">
                                            <td className="p-8 font-black text-3xl italic uppercase leading-none">
                                                13. 允建總樓地板面積 (CFA)
                                                {unusedArea > 0.1 && <div className="text-xs font-bold text-black bg-white inline-block px-2 py-1 mt-2">餘 {formatNum(toPing(unusedArea))} 坪未用</div>}
                                            </td>
                                            <td className="p-8 text-right font-black text-4xl leading-none">
                                                {formatNum(finalRes.totalCFA)}
                                            </td>
                                            <td className="p-8 text-right font-black text-4xl leading-none">
                                                {formatNum(toPing(finalRes.totalCFA))}
                                            </td>
                                            {isEditMode && (
                                                <>
                                                    <td className="p-8 font-black text-sm bg-black/20 border-l-4 border-black">TOTAL CFA</td>
                                                    <td className="p-8 font-black text-sm bg-black/20 border-l-4 border-black">鎖定上限值</td>
                                                </>
                                            )}
                                        </tr>

                                        <tr className="theme-panel border-y-4 border-black">
                                            <td className="p-6 font-black text-xl theme-text-title uppercase">工程預算評估</td>
                                            <td className="p-6 text-right font-black text-2xl" colSpan={2}>
                                                <div className="flex items-center justify-end gap-3">
                                                    <span className="text-xs font-bold theme-text-muted">單價(萬/坪):</span>
                                                    <input 
                                                        type="number" 
                                                        value={params.pricePerPing} 
                                                        onChange={(e) => handleParamChange('pricePerPing', e.target.value)} 
                                                        className="w-24 p-2 text-right border-4 border-black rounded-none theme-bg theme-text font-black outline-none focus:border-[var(--text-accent)]" 
                                                    />
                                                    <span className="text-xs font-bold theme-text-muted">=</span>
                                                    <span className="theme-text-accent text-3xl italic">{formatNum(finalRes.estimatedBudget)} 萬</span>
                                                </div>
                                            </td>
                                            {isEditMode && (
                                                <>
                                                    <td className="p-6 font-black text-xs theme-text-muted bg-stone-50 border-l-4 border-black">Total CFA × 單價</td>
                                                    <td className="p-6 font-black text-xs theme-text-muted bg-stone-50">概估造價</td>
                                                </>
                                            )}
                                        </tr>

                                        <SectionHeader title="D. 空間與停車檢討" />
                                        <tr className="hover:bg-stone-50 transition-colors">
                                            <td className="p-6 pl-10 border-l-8 border-black font-bold">12. 地上樓層估算</td>
                                            <td className="p-6 text-right font-black text-2xl" colSpan={2}>約 <span className="theme-text-accent italic">{formatNum(finalRes.floorsAbove)}</span> 層</td>
                                            {isEditMode && <><td className="p-6 font-black text-xs theme-text-muted bg-stone-50 border-l-4 border-black">允建室內 / 允建建築面積</td><td className="p-6 font-black text-xs theme-text-muted bg-stone-50">自動推算層數</td></>}
                                        </tr>
                                        <tr className="hover:bg-stone-50 transition-colors">
                                            <td className="p-6 pl-10 border-l-8 border-black font-bold">13. 地下層開挖檢討</td>
                                            <td className="p-6 text-right font-black text-2xl" colSpan={2}>B1 ~ B{inputs.floorsBelow} (單層 {formatNum(toPing(finalRes.basementAreaPerFloor))} 坪)</td>
                                            {isEditMode && <><td className="p-6 font-black text-xs theme-text-muted bg-stone-50 border-l-4 border-black">基地 × {inputs.excavationRatio}%</td><td className="p-6 font-black text-xs theme-text-muted bg-stone-50">單層最大開挖面積</td></>}
                                        </tr>
                                        <tr className="hover:bg-stone-50 transition-colors">
                                            <td className="p-6 pl-10 border-l-8 border-black font-bold">14. 停車空間檢討</td>
                                            <td className="p-6 text-right font-black text-2xl" colSpan={2}>法定 {formatNum(finalRes.statutoryParking)} 部 / 空間估計可停 {formatNum(finalRes.possibleParking)} 部</td>
                                            {isEditMode && <><td className="p-6 font-black text-xs theme-text-muted bg-stone-50 border-l-4 border-black">CFA / 150 (法定)</td><td className="p-6 font-black text-xs theme-text-muted bg-stone-50">空間以每車 {inputs.avgCarArea}m² 預估</td></>}
                                        </tr>
                                        <InputRow id="exemptBasement" label="*. 地下室免計容積" value={finalRes.exemptBasement} calculatedValue={results.exemptBasement} formula="40 × 法定停車" note="地下室停車不計容積上限" isEditMode={isEditMode} onOverride={handleOverride} />
                                        <tr className="hover:bg-stone-100 transition-colors border-t-4 border-black">
                                            <td className="p-6 font-black uppercase text-xl border-l-8 border-[var(--text-accent)]">15. 坪效分析 (倍數)</td>
                                            <td className="p-6 text-right font-black text-3xl text-[var(--text-accent)] italic" colSpan={2}>{formatNum(finalRes.efficiency)} 倍</td>
                                            {isEditMode && <><td className="p-6 font-black text-xs text-stone-500 bg-stone-50 border-l-4 border-black">總銷坪 / 基地坪</td><td className="p-6 font-black text-xs text-stone-500 bg-stone-50">土地開發倍數</td></>}
                                        </tr>

                                        <SectionHeader title="E. 高度比與退縮檢討" />
                                        <tr className="hover:bg-stone-50">
                                            <td className="p-6 pl-10 border-l-8 border-black font-bold">16. 前院深度</td>
                                            <td className="p-6 text-right" colSpan={2}>
                                                <div className="flex items-center justify-end gap-3 font-black text-2xl">
                                                    <input type="number" name="frontYardDepth" value={inputs.frontYardDepth} onChange={handleInputChange} className="w-24 p-2 text-right border-4 border-black rounded-none theme-bg theme-text outline-none focus:border-[var(--text-accent)]" /> 
                                                    <span className="text-sm theme-text-muted">m</span>
                                                </div>
                                            </td>
                                            {isEditMode && <><td className="p-6 font-black text-xs theme-text-muted bg-stone-50 border-l-4 border-black">自行輸入</td><td className="p-6 font-black text-xs theme-text-muted bg-stone-50">臨路側退縮</td></>}
                                        </tr>
                                        <tr className="hover:bg-stone-50">
                                            <td className="p-6 pl-10 border-l-8 border-black font-bold">17. 側院深度</td>
                                            <td className="p-6 text-right" colSpan={2}>
                                                <div className="flex items-center justify-end gap-3 font-black text-2xl">
                                                    <select name="sideYardDirection" value={inputs.sideYardDirection || 'right'} onChange={handleInputChange} className="p-2 border-4 border-black rounded-none theme-bg theme-text text-sm outline-none focus:border-[var(--text-accent)]">
                                                        <option value="right">右側</option>
                                                        <option value="left">左側</option>
                                                    </select>
                                                    <input type="number" name="sideYardDepth" value={inputs.sideYardDepth || 0} onChange={handleInputChange} className="w-24 p-2 text-right border-4 border-black rounded-none theme-bg theme-text outline-none focus:border-[var(--text-accent)]" /> 
                                                    <span className="text-sm theme-text-muted">m</span>
                                                </div>
                                            </td>
                                            {isEditMode && <><td className="p-6 font-black text-xs theme-text-muted bg-stone-50 border-l-4 border-black">自行輸入</td><td className="p-6 font-black text-xs theme-text-muted bg-stone-50">側向退縮深度</td></>}
                                        </tr>
                                        <tr className="hover:bg-stone-50">
                                            <td className="p-6 pl-10 border-l-8 border-black font-bold">18. 後院深度</td>
                                            <td className="p-6 text-right" colSpan={2}>
                                                <div className="flex items-center justify-end gap-3 font-black text-2xl">
                                                    <input type="number" name="backYardDepth" value={inputs.backYardDepth} onChange={handleInputChange} className="w-24 p-2 text-right border-4 border-black rounded-none theme-bg theme-text outline-none focus:border-[var(--text-accent)]" /> 
                                                    <span className="text-sm theme-text-muted">m</span>
                                                </div>
                                            </td>
                                            {isEditMode && <><td className="p-6 font-black text-xs theme-text-muted bg-stone-50 border-l-4 border-black">自行輸入</td><td className="p-6 font-black text-xs theme-text-muted bg-stone-50">背側退縮深度</td></>}
                                        </tr>
                                        <tr className="hover:bg-stone-50">
                                            <td className="p-6 pl-10 border-l-8 border-black font-bold">19. 樓層高度設定</td>
                                            <td className="p-6 text-right font-black" colSpan={2}>
                                                <div className="flex flex-col gap-3 items-end">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs font-black text-[var(--text-accent)] uppercase">1F:</span>
                                                        <input type="number" name="floorHeight1F" value={inputs.floorHeight1F} onChange={handleInputChange} className="w-20 p-2 text-right border-4 border-black rounded-none theme-bg theme-text focus:border-[var(--text-accent)] outline-none" />
                                                        <span className="text-xs theme-text-muted">m</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs font-black text-[var(--text-accent)] uppercase">Other:</span>
                                                        <input type="number" name="floorHeightOther" value={inputs.floorHeightOther} onChange={handleInputChange} className="w-20 p-2 text-right border-4 border-black rounded-none theme-bg theme-text focus:border-[var(--text-accent)] outline-none" />
                                                        <span className="text-xs theme-text-muted">m</span>
                                                    </div>
                                                </div>
                                            </td>
                                            {isEditMode && <><td className="p-6 font-black text-xs theme-text-muted bg-stone-50 border-l-4 border-black">1F 建議 ≤4.2, 其他 ≤3.6</td><td className="p-6 font-black text-xs theme-text-muted bg-stone-50">依規範自動校準</td></>}
                                        </tr>
                                        <InputRow id="buildingHeight" label="20. 建築物高度" value={finalRes.buildingHeight} calculatedValue={finalRes.buildingHeight} formula="1F+(其他×(F-1))+9" note={finalRes.isHighRise ? "高層建築" : "一般建築"} isEditMode={isEditMode} onOverride={handleOverride} highlight />
                                        <InputRow id="heightRatio" label="21. 高度比" value={finalRes.heightRatio} calculatedValue={finalRes.heightRatio} formula="高度 / (路寬 + 前院)" note={finalRes.heightRatio > 3.6 ? "🚨 高度比超限！(限 3.6)" : "主路寬 + 前院深度"} isEditMode={isEditMode} onOverride={handleOverride} highlight isAlert={finalRes.heightRatio > 3.6} />
                                        <tr className="hover:bg-stone-50">
                                            <td className="p-6 pl-10 border-l-8 border-black font-bold">22. 最小後院深度比 (檢討)</td>
                                            <td className="p-6 text-right" colSpan={2}>
                                                <div className="flex items-center justify-end gap-3 font-black text-2xl">
                                                    <input type="number" name="minBackyardDepthRatio" value={inputs.minBackyardDepthRatio || 0} onChange={handleInputChange} className="w-24 p-2 text-right border-4 border-black rounded-none theme-bg theme-text outline-none focus:border-[var(--text-accent)] text-amber-600" />
                                                </div>
                                            </td>
                                            {isEditMode && <><td className="p-6 font-black text-xs theme-text-muted bg-stone-50 border-l-4 border-black">如：2 (深度 &gt; 高度/2)</td><td className="p-6 font-black text-xs theme-text-muted bg-stone-50">自行設定檢討比率</td></>}
                                        </tr>
                                        <InputRow id="weiLaoRatio" label="23. 危老評估 (路心比)" value={finalRes.weiLaoRatio} calculatedValue={finalRes.weiLaoRatio} formula="5 / (0.5×路寬 + 前院)" note="危老條例高度係數" isEditMode={isEditMode} onOverride={handleOverride} highlight />
                                        
                                        {inputs.frontYardDepth == 0 && (
                                            <tr className="bg-indigo-50/50 border-y-4 border-indigo-200">
                                                <td className="p-6 pl-10 border-l-8 border-indigo-600 font-black text-[var(--text-accent)]">24. 騎樓深度</td>
                                                <td className="p-6 text-right" colSpan={2}>
                                                    <div className="flex items-center justify-end gap-3 font-black text-2xl">
                                                        <input type="number" name="arcadeDepth" value={inputs.arcadeDepth} onChange={handleInputChange} className="w-24 p-2 text-right border-4 border-indigo-600 rounded-none theme-bg theme-text outline-none focus:border-indigo-400" /> 
                                                        <span className="text-sm theme-text-muted">m</span>
                                                    </div>
                                                </td>
                                                {isEditMode && <><td className="p-6 font-black text-xs text-indigo-700 bg-indigo-50 border-l-4 border-indigo-200 uppercase">當前院=0時可用</td><td className="p-6 font-black text-xs text-indigo-700 bg-indigo-50">設定1F入口退縮</td></>}
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>`;

const target = `                {/* DATA TABLE SECTION */}
                        </div>
                    </div>
                </section>`;

const newContent = content.replace(target, replacement);
if (newContent !== content) {
    fs.writeFileSync('C:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/App.jsx', newContent);
    console.log('Restored table in App.jsx');
} else {
    console.log('Target not found!');
}
