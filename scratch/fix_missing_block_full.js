const fs = require('fs');
const file = 'c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/components/PlanAnalysis3D.jsx';
let content = fs.readFileSync(file, 'utf8');

const searchStr = "return parcels;";
let idx = content.indexOf(searchStr);
while (idx !== -1) {
    const sub = content.substring(idx, idx + 200);
    if (sub.includes('];') && sub.includes('previewColor')) {
        console.log("Found match at index:", idx);
        break;
    }
    idx = content.indexOf(searchStr, idx + 1);
}

if (idx === -1) {
    console.error("Match not found!");
    process.exit(1);
}

const searchPartStart = idx;
const searchPartEnd = content.indexOf("const previewColor =", idx);

const before = content.substring(0, searchPartStart);
const after = content.substring(searchPartEnd);

const replacement = `return parcels;
                                                      })()}

                                                     {/* Render CheckLines for Active Site */}
                                                     {isPrimary && calculateCheckLines().map(line => (
                                                         <CheckLine key={line.id} {...line} baseRotation={0} viewAngleX={viewAngleX} rotationZ={rotationZ} visible={true} dashed={line.dashed} thick={line.thick} isDarkMode={isDarkMode} labelPosRatio={0.2} />
                                                     ))}

                                                     {/* Render Massing Layers */}
                                                     {ps.massing.layers.map((layer, i) => (
                                                         <BuildingLayer 
                                                             key={\`fl-\${ps.site.id}-\${layer.id}\`} 
                                                             width={layer.widthPx} 
                                                             depth={layer.depthPx} 
                                                             height={layer.height} 
                                                             x={layer.shiftX} 
                                                             y={layer.shiftYPx} 
                                                             z={layer.z} 
                                                             rotation={layer.rotation} 
                                                             pivot={isPrimary && selectedFloor?.id === layer.id ? selectedFloor.pivot : (ps.site.floorSettings?.[layer.id]?.pivot || {x: 0, y: 0})} 
                                                             scale={scale} 
                                                             points={layer.points} 
                                                             curves={layer.curves} 
                                                             color={isPrimary ? colors.floor : "rgba(148, 163, 184, 0.4)"} 
                                                             strokeColor={isPrimary ? colors.stroke : "rgba(100, 116, 139, 0.5)"} 
                                                             showFrame={true} 
                                                             opacity={layer.opacity || 1}
                                                             visible={layer.visible !== false}
                                                             isSlabMode={false}
                                                             isDarkMode={isDarkMode}
                                                             isViolation={layer.isViolation} 
                                                             onClick={(e) => isPrimary && handleLayerClick(e, layer)} 
                                                         />
                                                     ))}
                                                 </div>
                                             );
                                         })}
                                         
                                         {/* 獨立放置精準預覽 (Independent Placement Preview) */}
                                         {placementMode === 'independent' && placementPreview && (() => {
                                             const pW = placementPreview.width;
                                             const pD = placementPreview.depth;
                                             const previewPoints = [
                                                 { x: -pW/2, y: -pD/2 },
                                                 { x: pW/2, y: -pD/2 },
                                                 { x: pW/2, y: pD/2 },
                                                 { x: -pW/2, y: pD/2 }
                                             ];
                                             `;

fs.writeFileSync(file, before + replacement + after, 'utf8');
console.log("Successfully restored missing blocks!");
