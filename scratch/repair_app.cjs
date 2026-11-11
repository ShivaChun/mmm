const fs = require('fs');
let src = fs.readFileSync('src/App.jsx', 'utf8');

if (!src.includes('import { ContextMenu }')) { 
    src = src.replace("import Visualizer3D from './components/PlanAnalysis3D';", "import Visualizer3D from './components/PlanAnalysis3D';\nimport { ContextMenu } from './components/ContextMenu';\nimport { DraggablePanel } from './components/DraggablePanel';"); 
} 
if (!src.includes('Menu } from \'lucide-react\'')) { 
    src = src.replace("} from 'lucide-react';", ", Menu } from 'lucide-react';"); 
} 
if (!src.includes('activePanels')) { 
    src = src.replace("const [isDarkMode, setIsDarkMode] = useState(false);", "const [isDarkMode, setIsDarkMode] = useState(false);\n    const [activePanels, setActivePanels] = useState([]);\n    const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);\n    const togglePanel = (p) => setActivePanels(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);"); 
} 

const headerMatch = src.match(/{\/\* HEADER \*\/}([\s\S]*?){\/\* ADD SITE DIALOG \*\/}/); 
const addSiteMatch = src.match(/{\/\* ADD SITE DIALOG \*\/}([\s\S]*?){\/\* SITE TABS \*\/}/); 
const siteTabsMatch = src.match(/{\/\* SITE TABS \*\/}([\s\S]*?){\/\* PLACEMENT MODE UI \*\/}/); 
const placementModeMatch = src.match(/{\/\* PLACEMENT MODE UI \*\/}([\s\S]*?){\/\* 3D VISUALIZER SECTION \*\/}/); 
const visualizerMatch = src.match(/<Visualizer3D\s+([\s\S]*?)\/>/); 
const infoSectionMatch = src.match(/{\/\* INFO & PLANNING SECTION \*\/}([\s\S]*?){\/\* DATA TABLE SECTION \*\/}/); 
const resultsMatch = src.match(/{\/\* DATA TABLE SECTION \*\/}([\s\S]*?){\/\* COMBINED REVIEW TABLE \(shown when >1 site\) \*\/}/); 
const combinedMatch = src.match(/{\/\* COMBINED REVIEW TABLE \(shown when >1 site\) \*\/}([\s\S]*?)<\/div>\s*<\/div>\s*\);\s*};/); 

if (!headerMatch || !infoSectionMatch || !resultsMatch || !combinedMatch) { 
    console.log('Regex failed'); process.exit(1); 
} 

const headerStr = headerMatch[1]; 
const addSiteStr = addSiteMatch[1]; 
const siteTabsStr = siteTabsMatch[1]; 
const placementModeStr = placementModeMatch[1]; 
const infoSectionStr = infoSectionMatch[1].replace(/<section className="space-y-4">/, '<div className="space-y-4">').replace(/<\/section>/, '</div>'); 
const resultsStr = resultsMatch[1].replace(/<section className="space-y-4">/, '<div className="space-y-4">').replace(/<\/section>/, '</div>'); 
const combinedStr = combinedMatch[1].replace(/<section className="space-y-4">/, '<div className="space-y-4">').replace(/<\/section>/, '</div>'); 

let visProps = visualizerMatch[1]; 
visProps = visProps.replace(/showSummaryPanel=\{[^\}]+\}/g, 'showSummaryPanel={activePanels.includes("summary")}')
                   .replace(/setShowSummaryPanel=\{[^\}]+\}/g, 'setShowSummaryPanel={() => togglePanel("summary")}')
                   .replace(/showEnvPanel=\{[^\}]+\}/g, 'showEnvPanel={activePanels.includes("env")}')
                   .replace(/onCloseEnvPanel=\{[^\}]+\}/g, 'onCloseEnvPanel={() => togglePanel("env")}'); 

if (!visProps.includes('showEnvPanel')) { 
    visProps += '\n                    showEnvPanel={activePanels.includes("env")}\n                    onCloseEnvPanel={() => togglePanel("env")}'; 
} 

const newReturn = "    return (\n" +
"        <div className=\"w-screen h-screen overflow-hidden fixed inset-0 z-0 bg-sky-50 dark:bg-slate-900 font-['GenYoGothic',_sans-serif]\">\n" +
"            <div className=\"absolute inset-0 z-0 pointer-events-auto\">\n" +
"                <Visualizer3D \n" +
"                    " + visProps + "\n" +
"                />\n" +
"            </div>\n" +
"            <div className=\"absolute inset-0 z-10 pointer-events-none\">\n" +
"                <div className=\"absolute top-4 right-4 pointer-events-auto z-50\">\n" +
"                    <button onClick={() => setIsContextMenuOpen(!isContextMenuOpen)} className=\"w-12 h-12 bg-white/90 dark:bg-slate-800/90 rounded-full shadow-lg border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center hover:scale-105 transition-transform backdrop-blur\">\n" +
"                        <Menu size={24} className=\"text-slate-800 dark:text-slate-200\" />\n" +
"                    </button>\n" +
"                    <ContextMenu isOpen={isContextMenuOpen} onClose={() => setIsContextMenuOpen(false)} isDarkMode={isDarkMode} onAction={(action) => { if (action === 'toggle_dark_mode') setIsDarkMode(!isDarkMode); if (action === 'toggle_check_lines') setShowCheckLines(!showCheckLines); if (action === 'toggle_height_ratio') setShowHeightRatio(!showHeightRatio); if (action === 'toggle_wei_lao') setShowWeiLao(!showWeiLao); if (action === 'toggle_backyard') setShowBackyard(!showBackyard); if (action === 'toggle_summary_panel') togglePanel('summary'); if (action === 'toggle_env_panel') togglePanel('env'); if (action === 'toggle_info_panel') togglePanel('info'); if (action === 'toggle_results_panel') togglePanel('results'); if (action === 'toggle_combined_table') togglePanel('combined'); }} showCheckLines={showCheckLines} showHeightRatio={showHeightRatio} showWeiLao={showWeiLao} showBackyard={showBackyard} />\n" +
"                </div>\n" +
"                " + placementModeStr + "\n" +
"                {activePanels.includes('summary') && (\n" +
"                    <DraggablePanel title=\"專案摘要\" onClose={() => togglePanel('summary')} defaultPosition={{x: 20, y: 20}} defaultSize={{w: 600, h: 400}}>\n" +
"                        <div className=\"pointer-events-auto overflow-y-auto max-h-[80vh] p-4 w-full h-full theme-bg\">\n" +
"                            " + headerStr + "\n" +
"                        </div>\n" +
"                    </DraggablePanel>\n" +
"                )}\n" +
"                {activePanels.includes('info') && (\n" +
"                    <DraggablePanel title=\"基本資訊與規劃\" onClose={() => togglePanel('info')} defaultPosition={{x: 20, y: 100}} defaultSize={{w: 800, h: 600}}>\n" +
"                         <div className=\"pointer-events-auto overflow-y-auto max-h-[80vh] p-4 w-full h-full theme-bg\">\n" +
"                             " + siteTabsStr + "\n" +
"                             " + addSiteStr + "\n" +
"                             " + infoSectionStr + "\n" +
"                         </div>\n" +
"                    </DraggablePanel>\n" +
"                )}\n" +
"                {activePanels.includes('results') && (\n" +
"                    <DraggablePanel title=\"詳細計算表\" onClose={() => togglePanel('results')} defaultPosition={{x: 20, y: 150}} defaultSize={{w: 900, h: 700}}>\n" +
"                         <div className=\"pointer-events-auto overflow-y-auto max-h-[80vh] p-4 w-full h-full theme-bg\">\n" +
"                             " + resultsStr + "\n" +
"                         </div>\n" +
"                    </DraggablePanel>\n" +
"                )}\n" +
"                {activePanels.includes('combined') && (\n" +
"                    <DraggablePanel title=\"合併檢討表\" onClose={() => togglePanel('combined')} defaultPosition={{x: 100, y: 200}} defaultSize={{w: 800, h: 600}}>\n" +
"                         <div className=\"pointer-events-auto overflow-y-auto max-h-[80vh] p-4 w-full h-full theme-bg\">\n" +
"                             " + combinedStr + "\n" +
"                         </div>\n" +
"                    </DraggablePanel>\n" +
"                )}\n" +
"            </div>\n" +
"        </div>\n" +
"    );\n" +
"};\n";

src = src.replace(/return \(\s*<div className="min-h-screen[\s\S]*?<\/div>\s*<\/div>\s*\);\s*};/, newReturn); 
fs.writeFileSync('src/App.jsx', src, 'utf8'); 
console.log('Success');
