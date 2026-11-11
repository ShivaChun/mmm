const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/components/PlanAnalysis3D.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add overlayLabelsBuffer
content = content.replace(
    /const landscapeStyle = isLandscapeMode \?/,
    'const overlayLabelsBuffer = [];\n    const landscapeStyle = isLandscapeMode ?'
);

// 2. Road Labels (renderRoadsAndBlocks)
content = content.replace(
    /const labelX = \(p1\.x \+ p2\.x\) \/ 2 \* scale \+ w \/ 2 \+ l\.vec\.x \/ 2 \* scale;\s*const labelY = \(p1\.y \+ p2\.y\) \/ 2 \* scale \+ d \/ 2 \+ l\.vec\.y \/ 2 \* scale;\s*labels\.push\(<Si key=\{`road-label-\$\{ps\.site\.id\}-\$\{gIdx\}`\} text=\{`\$\{seg\.name\} \$\{seg\.width\}m`\} x=\{labelX\} y=\{labelY\}[^>]+>\);/,
    `const localX = (p1.x + p2.x) / 2 + l.vec.x / 2 / scale;
                    const localY = (p1.y + p2.y) / 2 + l.vec.y / 2 / scale;
                    const wx = ps.layout.x + localX * Math.cos(ps.layout.rotation) - localY * Math.sin(ps.layout.rotation);
                    const wy = ps.layout.y + localX * Math.sin(ps.layout.rotation) + localY * Math.cos(ps.layout.rotation);
                    const pos = projectWorldToScreen(wx, wy, 2);
                    overlayLabelsBuffer.push({
                        id: \`road-label-\${ps.site.id}-\${gIdx}\`,
                        text: \`\${seg.name} \${seg.width}m\`,
                        origX: pos.x, origY: pos.y, x: pos.x, y: pos.y,
                        width: 70, height: 20,
                        className: "text-[10px] font-bold bg-white/80 text-stone-600 px-1 rounded shadow-sm",
                        drawLeader: false
                    });`
);

// 3. Setback Labels (renderPolygonSetbacks)
content = content.replace(
    /\{labels\.map\(label => \([\s\S]*?<\/div>\s*\)\)\}/,
    `{labels.map(label => {
                    const localX = label.x;
                    const localY = label.y;
                    const wx = ps.layout.x + localX * Math.cos(ps.layout.rotation) - localY * Math.sin(ps.layout.rotation);
                    const wy = ps.layout.y + localX * Math.sin(ps.layout.rotation) + localY * Math.cos(ps.layout.rotation);
                    const pos = projectWorldToScreen(wx, wy, 0);
                    overlayLabelsBuffer.push({
                        id: \`setback-\${ps.site.id}-\${label.key}\`,
                        text: label.text,
                        origX: pos.x, origY: pos.y, x: pos.x, y: pos.y,
                        width: 40, height: 20,
                        style: { color: label.color, textShadow: '1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff', fontWeight: '900', fontSize: '10px' }
                    });
                    return null;
                })}`
);

// 4. Adjacent lands (text tags in SVGs)
content = content.replace(
    /<text x=\{w\/2\+cx\*scale\} y=\{d\/2\+cy\*scale\} textAnchor="middle" fontSize="10" fill="#a855f7" fontWeight="bold" opacity="0\.7">臨地 \{gIdx\+1\}<\/text>/,
    `{(() => {
                                                                            const wx = ps.layout.x + cx * Math.cos(ps.layout.rotation) - cy * Math.sin(ps.layout.rotation);
                                                                            const wy = ps.layout.y + cx * Math.sin(ps.layout.rotation) + cy * Math.cos(ps.layout.rotation);
                                                                            const pos = projectWorldToScreen(wx, wy, 0);
                                                                            overlayLabelsBuffer.push({
                                                                                id: \`adj-\${ps.site.id}-\${group.id}\`,
                                                                                text: \`臨地 \${gIdx+1}\`,
                                                                                origX: pos.x, origY: pos.y, x: pos.x, y: pos.y,
                                                                                width: 40, height: 16,
                                                                                style: { color: '#a855f7', fontWeight: 'bold', fontSize: '10px' }
                                                                            });
                                                                            return null;
                                                                        })()}`
);

// 5. CheckLines labels
content = content.replace(
    /\{ps\.heightRatioLines && ps\.heightRatioLines\.map\(line => \(\s*<CheckLine key=\{line\.id\} \{\.\.\.line\}[^>]+>\s*\)\)\}/,
    `{ps.heightRatioLines && ps.heightRatioLines.map(line => {
                                                        const lx = line.start.x + (line.end.x - line.start.x) * 0.2;
                                                        const ly = line.start.y + (line.end.y - line.start.y) * 0.2;
                                                        const lz = line.start.z + (line.end.z - line.start.z) * 0.2 + 10;
                                                        const pos = projectWorldToScreen(lx, ly, lz);
                                                        overlayLabelsBuffer.push({
                                                            id: \`checkline-\${line.id}\`,
                                                            text: line.label,
                                                            origX: pos.x, origY: pos.y, x: pos.x, y: pos.y,
                                                            width: 80, height: 20,
                                                            className: "text-[10px] px-2 py-0.5 rounded-none shadow-lg font-black border-2 border-black theme-panel-glass text-rose-600"
                                                        });
                                                        return <CheckLine key={line.id} {...line} baseRotation={0} viewAngleX={viewAngleX} rotationZ={rotationZ} visible={true} dashed={line.dashed} thick={line.thick} isDarkMode={isDarkMode} labelPosRatio={0.2} hideLabel={true} />;
                                                    })}`
);

content = content.replace(
    /\{ps\.weiLaoLines && ps\.weiLaoLines\.map\(line => \(\s*<CheckLine key=\{line\.id\} \{\.\.\.line\}[^>]+>\s*\)\)\}/,
    `{ps.weiLaoLines && ps.weiLaoLines.map(line => {
                                                        const lx = line.start.x + (line.end.x - line.start.x) * 0.2;
                                                        const ly = line.start.y + (line.end.y - line.start.y) * 0.2;
                                                        const lz = line.start.z + (line.end.z - line.start.z) * 0.2 + 10;
                                                        const pos = projectWorldToScreen(lx, ly, lz);
                                                        overlayLabelsBuffer.push({
                                                            id: \`weilao-\${line.id}\`,
                                                            text: line.label,
                                                            origX: pos.x, origY: pos.y, x: pos.x, y: pos.y,
                                                            width: 80, height: 20,
                                                            className: "text-[10px] px-2 py-0.5 rounded-none shadow-lg font-black border-2 border-black theme-panel-glass text-purple-600"
                                                        });
                                                        return <CheckLine key={line.id} {...line} baseRotation={0} viewAngleX={viewAngleX} rotationZ={rotationZ} visible={true} dashed={line.dashed} thick={line.thick} isDarkMode={isDarkMode} labelPosRatio={0.2} hideLabel={true} />;
                                                    })}`
);

content = content.replace(
    /\{ps\.backyardLines && ps\.backyardLines\.map\(line => \(\s*<CheckLine key=\{line\.id\} \{\.\.\.line\}[^>]+>\s*\)\)\}/,
    `{ps.backyardLines && ps.backyardLines.map(line => {
                                                        const lx = line.start.x + (line.end.x - line.start.x) * 0.2;
                                                        const ly = line.start.y + (line.end.y - line.start.y) * 0.2;
                                                        const lz = line.start.z + (line.end.z - line.start.z) * 0.2 + 10;
                                                        const pos = projectWorldToScreen(lx, ly, lz);
                                                        overlayLabelsBuffer.push({
                                                            id: \`backyard-\${line.id}\`,
                                                            text: line.label,
                                                            origX: pos.x, origY: pos.y, x: pos.x, y: pos.y,
                                                            width: 80, height: 20,
                                                            className: "text-[10px] px-2 py-0.5 rounded-none shadow-lg font-black border-2 border-black theme-panel-glass text-teal-600"
                                                        });
                                                        return <CheckLine key={line.id} {...line} baseRotation={0} viewAngleX={viewAngleX} rotationZ={rotationZ} visible={true} dashed={line.dashed} thick={line.thick} isDarkMode={isDarkMode} labelPosRatio={0.2} hideLabel={true} />;
                                                    })}`
);


// 6. Site labels & Overlay
const oldBillboardRegex = /\/\/ 1\. 計算標籤之螢幕投影[\s\S]*?\{\/\* 獨立放置預覽/;
let overlayCode = `
                                            // Extract Site label
                                            const layout = ps.layout;
                                            const totalH = ps.massing.totalHeight || 0;
                                            const origPos = projectWorldToScreen(layout.x, layout.y, totalH);
                                            overlayLabelsBuffer.push({
                                                id: \`site-\${ps.site.id}\`,
                                                siteId: ps.site.id,
                                                text: ps.site.name,
                                                origX: origPos.x, origY: origPos.y, x: origPos.x, y: origPos.y,
                                                width: 85, height: 26,
                                                className: \`px-3 py-1.5 rounded shadow-lg backdrop-blur text-sm font-black border-2 border-black flex items-center gap-1.5 transition-colors \${hoveredSiteId === ps.site.id ? 'bg-[var(--text-accent)] text-white' : (ps.site.id === activeSiteId ? 'bg-black text-white' : 'theme-panel-glass theme-text')}\`,
                                                isSite: true
                                            });
                                        })();
                                        return (
                                            <div 
                                                key={ps.site.id} 
                                                onMouseEnter={() => setHoveredSiteId(ps.site.id)}
                                                onMouseLeave={() => setHoveredSiteId(null)}
                                                style={{
                                                    position: 'absolute',
                                                    top: '50%', left: '50%',
                                                    width: w, height: d,
                                                    marginLeft: -w/2, marginTop: -d/2,
                                                    transform: \`translate3d(\${(layout.x - projectBounds.center.x) * scale}px, \${(layout.y - projectBounds.center.y) * scale}px, 0) rotateZ(\${layout.rotation}rad)\`,
                                                    transformStyle: 'preserve-3d'
                                                }}
                                            >
                                                {/* renderRoadsAndBlocks etc. are left intact inside the map */}`;

const overlayEndRegex = /\{\/\* 2D 螢幕投影懸浮標籤 \(Screen-Space Billboard Labels\) \*\/\}[\s\S]*?\{\/\* 獨立放置預覽/;
// Wait, the site labels mapping was right before independent placement preview.
// Let's just find the entire billboardLabels section and replace it.
const overlayFinalRegex = /\{\/\* 2D 螢幕投影懸浮標籤 \(Screen-Space Billboard Labels\) \*\/\}[\s\S]*?\}\)\(\)\}\s*<\/div>/;

const newOverlaySection = `{/* 2D 螢幕投影懸浮標籤 (Screen-Space Billboard Labels) */}
                                    <div style={{
                                        position: 'absolute',
                                        top: '50%', left: '50%',
                                        width: \`\${w}px\`, height: \`\${d}px\`,
                                        marginLeft: -w/2, marginTop: -d/2,
                                        pointerEvents: 'none',
                                        zIndex: 150
                                    }}>
                                        {(() => {
                                            for (let iter = 0; iter < 8; iter++) {
                                                for (let i = 0; i < overlayLabelsBuffer.length; i++) {
                                                    for (let j = i + 1; j < overlayLabelsBuffer.length; j++) {
                                                        const b1 = overlayLabelsBuffer[i];
                                                        const b2 = overlayLabelsBuffer[j];
                                                        const dx = b1.x - b2.x;
                                                        const dy = b1.y - b2.y;
                                                        const absDx = Math.abs(dx);
                                                        const absDy = Math.abs(dy);
                                                        const minW = (b1.width + b2.width) / 2 + 10;
                                                        const minH = (b1.height + b2.height) / 2 + 6;
                                                        
                                                        if (absDx < minW && absDy < minH) {
                                                            const overlapY = minH - absDy;
                                                            const pushY = overlapY / 2;
                                                            if (dy >= 0) { b1.y += pushY; b2.y -= pushY; } 
                                                            else { b1.y -= pushY; b2.y += pushY; }
                                                            
                                                            const overlapX = minW - absDx;
                                                            const pushX = (overlapX / 2) * 0.2;
                                                            if (dx >= 0) { b1.x += pushX; b2.x -= pushX; } 
                                                            else { b1.x -= pushX; b2.x += pushX; }
                                                        }
                                                    }
                                                }
                                            }
                                            
                                            return (
                                                <>
                                                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                                                        {overlayLabelsBuffer.map(b => {
                                                            const hasMoved = Math.hypot(b.x - b.origX, b.y - b.origY) > 2;
                                                            if (!hasMoved) return null;
                                                            return (
                                                                <line 
                                                                    key={\`line-\${b.id}\`} 
                                                                    x1={b.origX} y1={b.origY} x2={b.x} y2={b.y} 
                                                                    stroke={isDarkMode ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"} 
                                                                    strokeWidth="1.5" strokeDasharray="3,3" 
                                                                />
                                                            );
                                                        })}
                                                    </svg>
                                                    {overlayLabelsBuffer.map(b => (
                                                        <div
                                                            key={b.id}
                                                            className={\`absolute select-none transform -translate-x-1/2 -translate-y-1/2 \${b.className || ''}\`}
                                                            style={{
                                                                left: \`\${b.x}px\`,
                                                                top: \`\${b.y}px\`,
                                                                pointerEvents: b.isSite ? 'auto' : 'none',
                                                                cursor: b.isSite ? 'pointer' : 'default',
                                                                ...(b.style || {})
                                                            }}
                                                            onMouseEnter={b.isSite ? (() => setHoveredSiteId(b.siteId)) : undefined}
                                                            onMouseLeave={b.isSite ? (() => setHoveredSiteId(null)) : undefined}
                                                            onClick={b.isSite ? ((e) => { e.stopPropagation(); onSwitchSite(b.siteId); }) : undefined}
                                                        >
                                                            {b.isSite ? (
                                                                <>
                                                                    <MapPin size={14} className={b.siteId === activeSiteId ? 'text-white' : 'theme-text'} />
                                                                    <span>{b.text}</span>
                                                                </>
                                                            ) : b.text}
                                                        </div>
                                                    ))}
                                                </>
                                            );
                                        })()}
                                    </div>`;

content = content.replace(overlayFinalRegex, newOverlaySection);

// Site Label Population (needs to be right after `const isPrimary = ...`)
// Before:
// const isPrimary = ps.site.id === activeSiteId;
// return (
//     <div
//         key={ps.site.id}
content = content.replace(
    /const isPrimary = ps\.site\.id === activeSiteId;\s*return \(\s*<div\s*key=\{ps\.site\.id\}/,
    `const isPrimary = ps.site.id === activeSiteId;
                                            const totalH = ps.massing.totalHeight || 0;
                                            const origPos = projectWorldToScreen(ps.layout.x, ps.layout.y, totalH);
                                            overlayLabelsBuffer.push({
                                                id: \`site-\${ps.site.id}\`,
                                                siteId: ps.site.id,
                                                text: ps.site.name,
                                                origX: origPos.x, origY: origPos.y, x: origPos.x, y: origPos.y,
                                                width: 85, height: 26,
                                                className: \`px-3 py-1.5 rounded shadow-lg backdrop-blur text-sm font-black border-2 border-black flex items-center gap-1.5 transition-colors \${hoveredSiteId === ps.site.id ? 'bg-[var(--text-accent)] text-white' : (ps.site.id === activeSiteId ? 'bg-black text-white' : 'theme-panel-glass theme-text')}\`,
                                                isSite: true
                                            });
                                            return (
                                                <div 
                                                    key={ps.site.id}`
);

fs.writeFileSync('c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/scratch/apply_labels.js', content, 'utf8');
console.log('Done generating preview file.');
