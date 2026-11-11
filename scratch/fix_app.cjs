const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

code = code.replace(/const \[activePanel, setActivePanel\] = useState\(null\);/g, 
    "const [activePanels, setActivePanels] = useState([]);\n    const togglePanel = (p) => setActivePanels(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);");

const actionReplacements = [
    { old: /if \(action === 'toggle_project_panel'\) setActivePanel\(prev => prev === 'project' \? null : 'project'\);/g, new: "if (action === 'toggle_project_panel') togglePanel('project');" },
    { old: /if \(action === 'toggle_sites_panel'\) setActivePanel\(prev => prev === 'sites' \? null : 'sites'\);/g, new: "if (action === 'toggle_sites_panel') togglePanel('sites');" },
    { old: /if \(action === 'toggle_info_panel'\) setActivePanel\(prev => prev === 'info' \? null : 'info'\);/g, new: "if (action === 'toggle_info_panel') togglePanel('info');" },
    { old: /if \(action === 'toggle_results_panel'\) setActivePanel\(prev => prev === 'results' \? null : 'results'\);/g, new: "if (action === 'toggle_results_panel') togglePanel('results');" },
    { old: /if \(action === 'toggle_combined_table'\) setActivePanel\(prev => prev === 'combined' \? null : 'combined'\);/g, new: "if (action === 'toggle_combined_table') togglePanel('combined');" },
    { old: /if \(action === 'toggle_summary_panel'\) setActivePanel\(prev => prev === 'summary' \? null : 'summary'\);/g, new: "if (action === 'toggle_summary_panel') togglePanel('summary');" }
];
actionReplacements.forEach(r => { code = code.replace(r.old, r.new); });

code = code.replace(/if \(action === 'toggle_summary_panel'\) togglePanel\('summary'\);/g,
    "if (action === 'toggle_summary_panel') togglePanel('summary');\n        if (action === 'toggle_env_panel') togglePanel('env');");

code = code.replace(/setActivePanel\(null\);/g, "setActivePanels([]);");

code = code.replace(/\{activePanel === 'summary' && \(/g, "{activePanels.includes('summary') && (");
code = code.replace(/<DraggablePanel title="專案摘要 \(Project Summary\)" onClose=\{[^}]+\}/g, '<DraggablePanel title="專案摘要 (Project Summary)" onClose={() => togglePanel(\'summary\')}');
code = code.replace(/\{activePanel === 'project' && \(/g, "{activePanels.includes('project') && (");
code = code.replace(/<DraggablePanel title="專案設定" onClose=\{[^}]+\}/g, '<DraggablePanel title="專案設定" onClose={() => togglePanel(\'project\')}');
code = code.replace(/\{activePanel === 'sites' && \(/g, "{activePanels.includes('sites') && (");
code = code.replace(/<DraggablePanel title="基地切換與管理" onClose=\{[^}]+\}/g, '<DraggablePanel title="基地切換與管理" onClose={() => togglePanel(\'sites\')}');
code = code.replace(/\{activePanel === 'info' && \(/g, "{activePanels.includes('info') && (");
code = code.replace(/<DraggablePanel title="基地與法規設定" onClose=\{[^}]+\}/g, '<DraggablePanel title="基地與法規設定" onClose={() => togglePanel(\'info\')}');
code = code.replace(/\{activePanel === 'results' && \(/g, "{activePanels.includes('results') && (");
code = code.replace(/<DraggablePanel title="詳細計算表" onClose=\{[^}]+\}/g, '<DraggablePanel title="詳細計算表" onClose={() => togglePanel(\'results\')}');
code = code.replace(/\{activePanel === 'combined' && sites\.length > 1 && \(/g, "{activePanels.includes('combined') && sites.length > 1 && (");
code = code.replace(/<DraggablePanel title="整體合併檢討表" onClose=\{[^}]+\}/g, '<DraggablePanel title="整體合併檢討表" onClose={() => togglePanel(\'combined\')}');

code = code.replace(/showSummaryPanel=\{showSummaryPanel\}/g, "showSummaryPanel={showSummaryPanel}\n                                    showEnvPanel={activePanels.includes('env')}\n                                    onCloseEnvPanel={() => togglePanel('env')}");

fs.writeFileSync('src/App.jsx', code, 'utf8');
console.log('Fixed App.jsx');
