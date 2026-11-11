const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const oldLabelBlock = /\{\/\* 3D 空間基地標籤 \*\/\}[^]+?<\/div>/;
code = code.replace(oldLabelBlock, "");

const newLabelCode = 
                                                    {/* Site Label */}
                                                    <Si 
                                                        key={\site-lbl-\\}
                                                        text={\● \\}
                                                        x={(ps.normalized.centroid?.x || 0) * scale + w / 2}
                                                        y={(ps.normalized.centroid?.y || 0) * scale + d / 2}
                                                        z={(ps.massing?.totalHeight || 0) * scale + 1.5 * scale}
                                                        rotationZ={layout.rotation * 180 / Math.PI}
                                                        baseRotation={0}
                                                        viewAngleX={viewAngleX}
                                                        visible={true}
                                                        className={\	ext-[10px] px-2 py-0.5 rounded-none shadow-[2px_2px_0_#000] font-black border-2 border-black flex items-center gap-1.5 transition-all duration-300 \\}
                                                        onClick={(e) => {
                                                            if (!isConstraintMode) {
                                                                const sIdx = sites.findIndex(s => s.id === ps.site.id);
                                                                if (sIdx !== -1 && typeof setActiveSiteIndex === 'function') {
                                                                    e.stopPropagation();
                                                                    setActiveSiteIndex(sIdx);
                                                                }
                                                            }
                                                        }}
                                                    />;

code = code.replace(/\{renderPolygonSetbacks\(ps\)\}/, "{renderPolygonSetbacks(ps)}\n" + newLabelCode);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
console.log('Fixed Site Label Drift');
