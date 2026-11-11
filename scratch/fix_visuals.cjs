const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// 1. Make base lines more visible
code = code.replace(
    /fill=\{isDarkMode \? 'rgba\\(30, 41, 59, 0\.15\\)' : 'rgba\\(255, 255, 255, 0\.03\\)'\}\s*stroke=\{isDarkMode \? '#334155' : '#e2e8f0'\}/g,
    "fill={isDarkMode ? 'rgba(30, 41, 59, 0.2)' : 'rgba(255, 255, 255, 0.1)'} stroke={isDarkMode ? '#475569' : '#94a3b8'} strokeWidth={2}"
);

// 2. Make road labels semi-transparent and lower z-index
code = code.replace(
    /className=\{\	ext-\\[10px\\] px-2 py-0\.5 rounded-none shadow-lg font-black border-2 border-black theme-panel-glass\\} \/>/g,
    "className={	ext-[10px] px-2 py-0.5 rounded-none font-black border border-black bg-white/70 text-stone-800 opacity-70} />"
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
