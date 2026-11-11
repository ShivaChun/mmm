const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// 1. Add state for isFullscreen
code = code.replace(
    /const \[isLandscapeMode, setIsLandscapeMode\] = useState\(false\);/,
    "const [isLandscapeMode, setIsLandscapeMode] = useState(false);\n    const [isFullscreen, setIsFullscreen] = useState(false);"
);

// 2. Modify root div className
code = code.replace(
    /return \(\s*<div className="w-full h-full flex flex-col font-\['GenYoGothic',_sans-serif\] relative bg-sky-50 dark:bg-slate-900 overflow-hidden">/,
    \eturn (
        <div className={\\\w-full flex flex-col font-['GenYoGothic',_sans-serif] \ bg-sky-50 dark:bg-slate-900 overflow-hidden\\\}>\
);

// 3. Add Fullscreen toggle button
code = code.replace(
    /<button onClick=\{resetView\} className=\{p-2 rounded-full transition-all theme-text hover:text-\[var\(--text-accent\)\] hover:opacity-80\} title="重置視角">\s*<RotateCcw size=\{18\} \/>\s*<\/button>/,
    \<button onClick={resetView} className={\\\p-2 rounded-full transition-all theme-text hover:text-[var(--text-accent)] hover:opacity-80\\\} title="重置視角">
                                <RotateCcw size={18} />
                            </button>
                            <button onClick={() => setIsFullscreen(!isFullscreen)} className={\\\p-2 rounded-full transition-all theme-text hover:text-[var(--text-accent)] hover:opacity-80\\\} title={isFullscreen ? "退出全螢幕" : "全螢幕模式"}>
                                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>\
);

// Add Minimize2 and Maximize2 to lucide imports if needed
if (!code.includes('Minimize2')) {
    code = code.replace(/Maximize2,/, 'Maximize2, Minimize2,');
}

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
console.log('Added fullscreen mode');
