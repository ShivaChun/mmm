const fs = require('fs');

const pathPlanAnalysis3D = 'c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/components/PlanAnalysis3D.jsx';
const pathApp = 'c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/App.jsx';
const pathCheckLine = 'c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/components/Si.jsx';

let planCode = fs.readFileSync(pathPlanAnalysis3D, 'utf8');
let appCode = fs.readFileSync(pathApp, 'utf8');

// 1. Fix Road Label
planCode = planCode.replace(
    "const labelX = curve.x * scale + w / 2 + l.vec.x * scale / 2;",
    "const labelX = curve.x * scale + w / 2 + l.vec.x * scale * 1.5;"
);
planCode = planCode.replace(
    "const labelY = curve.y * scale + d / 2 + l.vec.y * scale / 2;",
    "const labelY = curve.y * scale + d / 2 + l.vec.y * scale * 1.5;"
);
if (!planCode.includes('strokeDasharray="4,4" opacity="0.6"')) {
    planCode = planCode.replace(
        "labels.push(",
        `labels.push(
                <line key={\`conn-\${gIdx}-\${j}\`} x1={curve.x * scale + w/2 + l.vec.x * scale * 0.5} y1={curve.y * scale + d/2 + l.vec.y * scale * 0.5} x2={labelX} y2={labelY} stroke={isDarkMode ? "#52525b" : "#a8a29e"} strokeWidth="1" strokeDasharray="4,4" opacity="0.6" />
            );
            labels.push(`
    );
}

// 2. Fix Calculate CheckLines
planCode = planCode.replace(
    "const calculateCheckLines = () => {",
    "const calculateCheckLines = (ps) => {"
);
planCode = planCode.replace(
    /const getPrimaryRoadInfo = \(\) => \{[\s\S]*?return \{ widthPx: parseFloat\(road\.width\) \* scale, widthM: parseFloat\(road\.width\), isDefault: false, roadObj: road \};\n\s*\};/,
    `const getPrimaryRoadInfo = () => {
            const siteInputs = ps.site.inputs || {};
            const siteRoads = ps.site.roads || siteInputs.roads || [];
            let road = siteRoads.find(r => r.type === 'primary');
            if (!road) return { widthPx: 6 * scale, widthM: 6, isDefault: true, roadObj: null };
            return { widthPx: parseFloat(road.width) * scale, widthM: parseFloat(road.width), isDefault: false, roadObj: road };
        };\n        const siteInputs = ps.site.inputs || {};`
);

// Replace inputs with siteInputs in calculateCheckLines
const checkLinesStart = planCode.indexOf('const calculateCheckLines = (ps) => {');
const checkLinesEnd = planCode.indexOf('const renderMassing = () => {');
if (checkLinesStart !== -1 && checkLinesEnd !== -1) {
    let checkLinesCode = planCode.substring(checkLinesStart, checkLinesEnd);
    checkLinesCode = checkLinesCode.replace(/inputs\./g, 'siteInputs.');
    checkLinesCode = checkLinesCode.replace(/normalizedData\./g, 'ps.normalized.');
    planCode = planCode.substring(0, checkLinesStart) + checkLinesCode + planCode.substring(checkLinesEnd);
}

// Update the call to calculateCheckLines
planCode = planCode.replace(
    "{isPrimary && calculateCheckLines().map(line => (",
    "{isPrimary && calculateCheckLines(ps).map(line => ("
);

// 3. Fix Full Screen Mode
if (!planCode.includes('isFullscreen')) {
    planCode = planCode.replace(
        "const [isDarkMode, setIsDarkMode] = useState(false);",
        "const [isDarkMode, setIsDarkMode] = useState(false);\n    const [isFullscreen, setIsFullscreen] = useState(false);"
    );
    planCode = planCode.replace(
        "<button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded transition-colors ${isDarkMode ? 'bg-stone-700 text-yellow-400' : 'bg-stone-200 text-stone-600 hover:bg-stone-300'}`} title=\"切換日夜模式\">",
        `<button onClick={() => setIsFullscreen(!isFullscreen)} className={\`p-2 rounded transition-colors \${isDarkMode ? 'bg-stone-700 text-blue-400' : 'bg-stone-200 text-blue-600 hover:bg-stone-300'}\`} title="切換全螢幕">
                                            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                        </button>
                                        <button onClick={() => setIsDarkMode(!isDarkMode)} className={\`p-2 rounded transition-colors \${isDarkMode ? 'bg-stone-700 text-yellow-400' : 'bg-stone-200 text-stone-600 hover:bg-stone-300'}\`} title="切換日夜模式">`
    );
    planCode = planCode.replace(
        "import { Sun, Moon, Map, Plus, Minus, Move, Eye, RotateCcw, Box, Home } from 'lucide-react';",
        "import { Sun, Moon, Map, Plus, Minus, Move, Eye, RotateCcw, Box, Home, Maximize2, Minimize2 } from 'lucide-react';"
    );
    planCode = planCode.replace(
        '<div className="w-full h-[800px] md:h-[900px] lg:h-[1000px] relative overflow-hidden bg-stone-900/5 rounded-xl border border-stone-200 shadow-inner group">',
        '<div className={isFullscreen ? "fixed inset-0 z-[100] bg-white overflow-hidden" : "w-full h-[800px] md:h-[900px] lg:h-[1000px] relative overflow-hidden bg-stone-900/5 rounded-xl border border-stone-200 shadow-inner group"}>'
    );
}

fs.writeFileSync(pathPlanAnalysis3D, planCode);

// 4. Fix App.jsx Layout Engine offset
appCode = appCode.replace(
    /const gap = 15;/,
    "const gap = 30;"
);

// 5. Restore ContextMenu in App.jsx
if (!appCode.includes('import { ContextMenu }')) {
    appCode = appCode.replace(
        "import { Building2, Plus, Pencil, Check, X, Move, ChevronDown, ChevronUp, Layers, MousePointer2, Grid3x3, RefreshCw, Trash2, Maximize2, Minimize2, Save, Download, Upload, MapPin, Eye, MousePointerClick, CheckSquare, Settings2, MapPinned } from 'lucide-react';",
        "import { Building2, Plus, Pencil, Check, X, Move, ChevronDown, ChevronUp, Layers, MousePointer2, Grid3x3, RefreshCw, Trash2, Maximize2, Minimize2, Save, Download, Upload, MapPin, Eye, MousePointerClick, CheckSquare, Settings2, MapPinned } from 'lucide-react';\nimport { ContextMenu } from './components/ContextMenu';"
    );
    appCode = appCode.replace(
        /const handleResetLayout = \(\) => \{/,
        `const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, isOpen: false });
    useEffect(() => {
        const handleContextMenu = (e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, isOpen: true });
        };
        document.addEventListener('contextmenu', handleContextMenu);
        return () => document.removeEventListener('contextmenu', handleContextMenu);
    }, []);\n\n    const handleResetLayout = () => {`
    );
    appCode = appCode.replace(
        "{/* HEADER */}",
        `<ContextMenu x={contextMenu.x} y={contextMenu.y} isOpen={contextMenu.isOpen} onClose={() => setContextMenu({ ...contextMenu, isOpen: false })} activePanels={activePanels} onTogglePanel={(panel) => setActivePanels(prev => prev.includes(panel) ? prev.filter(p => p !== panel) : [...prev, panel])} />\n                {/* HEADER */}`
    );
}

fs.writeFileSync(pathApp, appCode);

// 6. Fix CheckLine shadow drift
let siCode = fs.readFileSync(pathCheckLine, 'utf8');
siCode = siCode.replace(/shadow-lg/g, '');
siCode = siCode.replace(/shadow-md/g, '');
siCode = siCode.replace(/shadow-sm/g, '');
siCode = siCode.replace(/theme-panel-glass/g, 'bg-white border-2 border-stone-200');
fs.writeFileSync(pathCheckLine, siCode);

console.log('Fixed Visualizer');
