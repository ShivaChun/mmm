const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// 1. Add getRoadWidthForEdge and fix calculateCheckLines
const checkLinesSearch = \const getPrimaryRoadInfo = () => {\;
const checkLinesReplace = \const getRoadWidthForEdge = (edgeIdx) => {
            if (!inputs.roads) return 6;
            const road = inputs.roads.find(r => (r.edgeIndices && r.edgeIndices.includes(edgeIdx)) || (r.edgeIndex !== undefined && parseInt(r.edgeIndex) === edgeIdx));
            if (road) return parseFloat(road.width) || 6;
            return 6; // fallback
        };
        const getPrimaryRoadInfo = () => {\;
code = code.replace(checkLinesSearch, checkLinesReplace);

const frontIndicesSearch = \if (frontIndices.has(originalIdx)) {
                const fD = parseFloat(inputs.frontYardDepth || 0);

                const p_out_M = { x: mid.x - normal.x * primRoadW_M, y: mid.y - normal.y * primRoadW_M };
                const p_center_M = { x: mid.x - normal.x * (primRoadW_M / 2), y: mid.y - normal.y * (primRoadW_M / 2) };\;

const frontIndicesReplace = \if (frontIndices.has(originalIdx)) {
                const fD = parseFloat(inputs.frontYardDepth || 0);
                const currentRoadW_M = getRoadWidthForEdge(originalIdx);

                const p_out_M = { x: mid.x - normal.x * currentRoadW_M, y: mid.y - normal.y * currentRoadW_M };
                const p_center_M = { x: mid.x - normal.x * (currentRoadW_M / 2), y: mid.y - normal.y * (currentRoadW_M / 2) };\;

code = code.replace(frontIndicesSearch, frontIndicesReplace);

// Also replace primRoadW_M inside the loop for Height Ratio and WeiLao:
code = code.replace(/const hRatioH = 3\.6 \* \\(primRoadW_M \+ fD\\) \* scale;/g, "const hRatioH = 3.6 * (currentRoadW_M + fD) * scale;");
code = code.replace(/const wlH = 5 \* \\(0\.5 \* primRoadW_M \+ fD\\) \* scale;/g, "const wlH = 5 * (0.5 * currentRoadW_M + fD) * scale;");

// 2. Add isFullscreen prop
code = code.replace(/const Visualizer3D = \\(\\{ isDarkMode/g, "const Visualizer3D = ({ isFullscreen, setIsFullscreen, isDarkMode");

// 3. Update main wrapper class based on isFullscreen
const wrapperSearch = \eturn (
        <div className="theme-panel rounded-xl p-0 mb-6 shadow-md overflow-hidden relative min-h-[350px] md:min-h-[600px] grid grid-cols-1 md:grid-cols-4 border theme-border font-['GenYoGothic',_sans-serif] md:sticky md:top-0 md:z-40">\;
const wrapperReplace = \eturn (
        <div className={\\\	heme-panel p-0 overflow-hidden relative font-['GenYoGothic',_sans-serif] grid grid-cols-1 md:grid-cols-4 \\\\\\}>\;

if (code.includes(wrapperSearch)) {
    code = code.replace(wrapperSearch, wrapperReplace);
} else {
    const altWrapperSearch = \<div className="w-full h-full flex flex-col font-['GenYoGothic',_sans-serif] relative bg-sky-50 dark:bg-slate-900 overflow-hidden">\;
    const altWrapperReplace = \eturn (
        <div className={\\\ont-['GenYoGothic',_sans-serif] flex flex-col bg-sky-50 dark:bg-slate-900 overflow-hidden \\\\\\}>\;
    code = code.replace(altWrapperSearch, altWrapperReplace);
}

// 4. Add Fullscreen toggle button
const draggerSearch = \<DraggablePanel
                    title="環境模擬"\;
const fullscreenBtn = \
                <button
                    onClick={() => setIsFullscreen && setIsFullscreen(!isFullscreen)}
                    className="absolute top-4 left-4 z-50 bg-white/90 text-stone-700 px-3 py-2 rounded-lg shadow font-bold text-sm hover:bg-stone-100 border border-stone-200 transition-all flex items-center gap-2"
                >
                    {isFullscreen ? '退出全螢幕' : '全螢幕模式'}
                </button>
\;
if (code.includes(draggerSearch)) {
    code = code.replace(draggerSearch, fullscreenBtn + draggerSearch);
} else {
    code = code.replace(/\\{showUnusedPrompt &&/g, fullscreenBtn + "\\n            {showUnusedPrompt &&");
}

// 5. Fix z-fighting for adjacent lands
code = code.replace(/<polygon\\s+key=\\{[\\s\\S]*?\\}\\s+points=\\{scaledPts\\}\\s+fill=/g, (match) => match.replace("fill=", "transform=\\"translate(0, 0)\\" strokeWidth=\\"1\\" fill="));
code = code.replace(/<g transform=\\{[\\s\\S]*?translate3d\\(0,0,\\$\\{ps\\.site\\.id === activeSiteId \\? \\-1 : \\-2\\}px\\)[\\s\\S]*?\\}>/g, "<g transform={\	ranslate3d(0,0,\px)\}>");

// 6. Inject Billboard Labels
const hookInject = \    const cameraRef = useRef(null);
    const [billboardLabels, setBillboardLabels] = useState([]);\;
if (!code.includes('const [billboardLabels, setBillboardLabels] = useState([]);')) {
    code = code.replace(/const massingLayers = calculateMassing\\(\\);/g, hookInject + "\\n    const massingLayers = calculateMassing();");
}

const mapInjectSearch = \const sceneContent = (\;
const mapInjectReplace = \
    // Projections for billboard labels
    useEffect(() => {
        if (!cameraRef.current) return;
        const camera = cameraRef.current;
        const newLabels = sites.map(site => {
            const centroid = site.normalized?.points ? 
                site.normalized.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 }) 
                : { x: 0, y: 0 };
            if (site.normalized?.points) {
                centroid.x /= site.normalized.points.length;
                centroid.y /= site.normalized.points.length;
            }
            const offX = w / 2;
            const offY = d / 2;
            const worldX = offX + centroid.x * scale;
            const worldY = offY + centroid.y * scale;
            const worldZ = 0;

            const hw = w / 2;
            const hh = h / 2;
            
            const radZ = rotationZ * Math.PI / 180;
            const radX = viewAngleX * Math.PI / 180;
            
            let lx = worldX - hw;
            let ly = worldY - hh;
            let lz = worldZ;
            
            const rx = lx * Math.cos(radZ) - ly * Math.sin(radZ);
            const ry = lx * Math.sin(radZ) + ly * Math.cos(radZ);
            
            const finalX = rx;
            const finalY = ry * Math.cos(radX) - lz * Math.sin(radX);
            
            return {
                id: site.id,
                site: site,
                origX: finalX + hw,
                origY: finalY + hh,
                x: finalX + hw,
                y: finalY + hh,
                width: 80,
                height: 24,
                isActive: site.id === activeSiteId,
                isHovered: false
            };
        });
        
        for (let iter = 0; iter < 5; iter++) {
            for (let i = 0; i < newLabels.length; i++) {
                for (let j = i + 1; j < newLabels.length; j++) {
                    const b1 = newLabels[i];
                    const b2 = newLabels[j];
                    const dx = b1.x - b2.x;
                    const dy = b1.y - b2.y;
                    const minW = (b1.width + b2.width) / 2 + 5;
                    const minH = (b1.height + b2.height) / 2 + 5;
                    
                    if (Math.abs(dx) < minW && Math.abs(dy) < minH) {
                        const pushY = (minH - Math.abs(dy)) / 2;
                        if (dy >= 0) { b1.y += pushY; b2.y -= pushY; } else { b1.y -= pushY; b2.y += pushY; }
                        const pushX = (minW - Math.abs(dx)) / 2;
                        if (dx >= 0) { b1.x += pushX; b2.x -= pushX; } else { b1.x -= pushX; b2.x += pushX; }
                    }
                }
            }
        }
        setBillboardLabels(newLabels);
    }, [sites, rotationZ, viewAngleX, w, h, scale, activeSiteId]);

    const sceneContent = (\;

if (code.includes(mapInjectSearch)) {
    code = code.replace(mapInjectSearch, mapInjectReplace);
}

const renderBillboardSearch = \{/* Viewport container */}
            <div 
                className="relative flex-1 overflow-hidden cursor-move touch-none"\;
const renderBillboardReplace = \{/* Viewport container */}
            <div 
                className="relative flex-1 overflow-hidden cursor-move touch-none"
                ref={cameraRef}
                style={{ perspective: '2000px' }}
            >
                {/* 2D Billboard Labels Layer */}
                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 8000 }}>
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                        {billboardLabels.map(b => {
                            const hasMoved = Math.hypot(b.x - b.origX, b.y - b.origY) > 2;
                            if (!hasMoved) return null;
                            return (
                                <line 
                                    key={\\\line-\\\\\\} 
                                    x1={b.origX} y1={b.origY} 
                                    x2={b.x} y2={b.y} 
                                    stroke={isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"} 
                                    strokeWidth="1.5" strokeDasharray="3,3" 
                                />
                            );
                        })}
                    </svg>
                    {billboardLabels.map(b => (
                        <div
                            key={\\\lbl-\\\\\\}
                            style={{
                                position: 'absolute',
                                left: \\\\\\px\\\,
                                top: \\\\\\px\\\,
                                transform: 'translate(-50%, -100%)',
                                pointerEvents: 'auto',
                                cursor: 'pointer',
                                transition: 'transform 0.1s ease-out'
                            }}
                        >
                            <div className={\\\px-2.5 py-1 rounded-none border-2 text-[10px] font-black shadow-[2px_2px_0_#000] flex items-center gap-1.5 transition-all duration-300 \\\\\\}>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>{b.site.name}</span>
                            </div>
                        </div>
                    ))}
                </div>\;

if (code.includes(renderBillboardSearch)) {
    code = code.replace(renderBillboardSearch, renderBillboardReplace);
}

// 7. Make Si Road labels semi-transparent and lower zIndex
code = code.replace(/<Si key=\\{[\\s\\S]*?\\} text=\\{[\\s\\S]*?\\} x=\\{labelX\\} y=\\{labelY\\} z=\\{2\\} rotationZ=\\{rotationZ\\} baseRotation=\\{site\\.inputs\\.northAngle \\|\\| 0\\} viewAngleX=\\{viewAngleX\\} visible=\\{true\\} className=\\{[\\s\\S]*?\\} \\/>/g, 
    "<Si key={\oad-label-\-\\} text={\\ \m\} x={labelX} y={labelY} z={2} rotationZ={rotationZ} baseRotation={site.inputs.northAngle || 0} viewAngleX={viewAngleX} visible={true} className={\	ext-[10px] px-2 py-0.5 rounded-none shadow-sm border border-stone-300 bg-white/60 backdrop-blur-sm text-stone-500 opacity-70\} />");

// Remove the old buggy label
code = code.replace(/<div className="absolute top-0 left-1\\/2 -translate-x-1\\/2 -translate-y-full pb-2"><div className="bg-indigo-600 text-white text-\\[10px\\] font-bold px-2 py-0\\.5 rounded shadow-sm whitespace-nowrap">\\{ps\\.site\\.name\\} \\(編輯中\\)<\\/div><\\/div>/g, "");

// Make sure React imports useRef and useEffect
if (!code.includes('useRef')) {
    code = code.replace(/import React, \\{ useState, useMemo \\} from 'react';/, "import React, { useRef, useState, useMemo, useEffect } from 'react';");
}
if (!code.includes('useEffect')) {
    code = code.replace(/import React, \\{ useRef, useState, useMemo \\} from 'react';/, "import React, { useRef, useState, useMemo, useEffect } from 'react';");
}

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
console.log('PlanAnalysis3D fixed manually');
