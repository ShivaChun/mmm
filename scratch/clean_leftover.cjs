const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const targetStr = `                                                    {renderPolygonSetbacks(ps)}
                                                    
                                                        className={\`text-[10px] px-2 py-0.5 rounded-none shadow-[2px_2px_0_#000] font-black border-2 border-black flex items-center gap-1.5 transition-all duration-300 \${hoveredSiteId === ps.site.id ? 'bg-[var(--text-accent)] text-white scale-110 -translate-y-1' : (isPrimary ? 'bg-slate-900 text-white' : 'theme-panel-glass text-slate-800 hover:bg-slate-50')}\`}
                                                        onClick={(e) => {
                                                            if (!isConstraintMode) {
                                                                const sIdx = sites.findIndex(s => s.id === ps.site.id);
                                                                if (sIdx !== -1 && typeof setActiveSiteIndex === 'function') {
                                                                    e.stopPropagation();
                                                                    setActiveSiteIndex(sIdx);
                                                                }
                                                            }
                                                        }}
                                                     />`;

// Replace targetStr (or relaxed newline variation)
if (src.includes(targetStr)) {
    src = src.replace(targetStr, '                                                    {renderPolygonSetbacks(ps)}');
    fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
    console.log("Successfully cleaned leftover syntax!");
} else {
    // Try simplified replace
    const startIdx = src.indexOf('className={`text-[10px] px-2 py-0.5 rounded-none shadow-[2px_2px_0_#000] font-black border-2 border-black flex items-center gap-1.5 transition-all duration-300');
    if (startIdx !== -1) {
        const endIdx = src.indexOf('/>', startIdx);
        if (endIdx !== -1) {
            const before = src.substring(0, startIdx);
            const after = src.substring(endIdx + 2);
            // Search backward to remove whitespace/indent
            const cleanBefore = before.trimEnd();
            src = cleanBefore + '\n' + after;
            fs.writeFileSync('src/components/PlanAnalysis3D.jsx', src, 'utf8');
            console.log("Successfully cleaned leftover syntax (fallback)!");
        }
    } else {
        console.log("Marker not found!");
    }
}
