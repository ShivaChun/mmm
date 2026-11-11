const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const missingBlock = `
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
                                             const previewColor = placementPreview.isOverlapping ? "rgba(239, 68, 68, 0.4)" : "rgba(16, 185, 129, 0.4)";
                                             const previewStrokeColor = placementPreview.isOverlapping ? "#ef4444" : "#10b981";
                                             return (
                                                 <div style={{
                                                     position: 'absolute',
                                                     top: '50%', left: '50%',
                                                     transform: \`translate3d(\${(placementPreview.x - projectBounds.center.x) * scale}px, \${(placementPreview.y - projectBounds.center.y) * scale}px, 0) rotateZ(\${placementPreview.rotation}rad)\`,
                                                     transformStyle: 'preserve-3d',
                                                     zIndex: 100
                                                 }}>
                                                     {/* 預覽的 3D 建築體 */}
                                                     <BuildingLayer 
                                                         width={pW} depth={pD} height={placementPreview.height}
                                                         x={0} y={0} z={0} rotation={0}
                                                         scale={scale} color={previewColor} strokeColor={previewStrokeColor}
                                                         showFrame={true} opacity={0.6} visible={true}
                                                         isSlabMode={false} isDarkMode={isDarkMode} isViolation={placementPreview.isOverlapping}
                                                     />
                                                     {/* 預覽的底部 SVG */}
                                                     <svg width="100%" height="100%" style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0, transform: 'translateZ(-0.5px)' }}>
                                                         <path 
                                                             d={\`M \${-pW/2 * scale} \${-pD/2 * scale} L \${pW/2 * scale} \${-pD/2 * scale} L \${pW/2 * scale} \${pD/2 * scale} L \${-pW/2 * scale} \${pD/2 * scale} Z\`} 
                                                             fill={placementPreview.isOverlapping ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'} 
                                                             stroke={previewStrokeColor} 
                                                             strokeWidth="2" 
                                                             strokeDasharray="4,4"
                                                         />
                                                     </svg>
                                                 </div>
                                             );
                                         })()}`;

const target = "return parcels;\n                                                    })()}";
const idx = src.indexOf(target);
if (idx !== -1) {
    const before = src.substring(0, idx + target.length);
    const after = src.substring(idx + target.length);
    const newSrc = before + missingBlock + after;
    fs.writeFileSync('src/components/PlanAnalysis3D.jsx', newSrc, 'utf8');
    console.log("Injected successfully!");
} else {
    console.log("Target not found!");
}
