const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

code = code.replace(
    /transform: \	ranslate3d\(\$\{\(layoutCenterX\) \* scale\}px, \$\{\(layoutCenterY\) \* scale\}px, 0\) rotateZ\(\$\{layout\.rotation\}rad\)\,/g,
    "transform: 	ranslate3d(px, px, 0) rotateZ(rad),"
);

code = code.replace(
    /className=\{\	ext-\[10px\] px-2 py-0.5 rounded font-black border-2 border-black flex items-center gap-1.5 transition-all duration-300 \$\{hoveredSiteId === ps.site.id \? 'bg-\[var\(--text-accent\)\] text-white scale-110 -translate-y-1' : \(activeSiteId === ps.site.id \? 'bg-slate-900 text-white' : 'bg-white text-slate-800 hover:bg-slate-50'\)\}\\}/g,
    "className={	ext-[10px] px-2 py-0.5 rounded font-black border-2 border-black flex items-center gap-1.5 transition-all duration-300 }"
);

// Road labels inside renderRoads
code = code.replace(
    /className=\{\	ext-\[10px\] px-2 py-0\.5 rounded-none shadow-lg font-black border-2 border-black theme-panel-glass\\}/g,
    "className={	ext-[10px] px-2 py-0.5 rounded font-black border-2 border-black bg-white text-black}"
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
console.log('Fixed transform and labels');
