const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

const actionFunc = \
    const handleContextMenuAction = (action) => {
        switch (action) {
            case 'toggle_check_lines': setShowCheckLines(prev => !prev); break;
            case 'toggle_height_ratio': setShowHeightRatio(prev => !prev); break;
            case 'toggle_wei_lao': setShowWeiLao(prev => !prev); break;
            case 'toggle_backyard': setShowBackyard(prev => !prev); break;
            case 'toggle_info_panel': setActivePanels(prev => prev.includes('inputs') ? prev.filter(p => p !== 'inputs') : [...prev, 'inputs']); break;
            case 'toggle_results_panel': setActivePanels(prev => prev.includes('sites') ? prev.filter(p => p !== 'sites') : [...prev, 'sites']); break;
            case 'toggle_combined_table': setActivePanels(prev => prev.includes('combined') ? prev.filter(p => p !== 'combined') : [...prev, 'combined']); break;
            case 'toggle_summary_panel': setActivePanels(prev => prev.includes('summary') ? prev.filter(p => p !== 'summary') : [...prev, 'summary']); break;
            case 'toggle_env_panel': setActivePanels(prev => prev.includes('env') ? prev.filter(p => p !== 'env') : [...prev, 'env']); break;
            case 'toggle_dark_mode': setIsDarkMode(prev => !prev); break;
            case 'toggle_landscape': 
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen();
                }
                break;
        }
    };
\;

code = code.replace("    const inputClass =", actionFunc + "\n    const inputClass =");
code = code.replace(/<ContextMenu [^>]+>/, "<ContextMenu x={contextMenu.x} y={contextMenu.y} isOpen={contextMenu.isOpen} onClose={() => setContextMenu({ ...contextMenu, isOpen: false })} activePanels={activePanels} onTogglePanel={(panel) => setActivePanels(prev => prev.includes(panel) ? prev.filter(p => p !== panel) : [...prev, panel])} onAction={handleContextMenuAction} showCheckLines={showCheckLines} showHeightRatio={showHeightRatio} showWeiLao={showWeiLao} showBackyard={showBackyard} isDarkMode={isDarkMode} isMobile={false} sitesCount={sites.length} />");

fs.writeFileSync('src/App.jsx', code, 'utf8');
console.log("Fixed App context action!");
