const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Fix missing handleCanvasAction
if (!code.includes('const handleCanvasAction =')) {
    const handleCanvasActionStr = 
    const togglePanel = (panel) => {
        setActivePanels(prev => prev.includes(panel) ? prev.filter(p => p !== panel) : [...prev, panel]);
    };

    const handleCanvasAction = (action) => {
        switch (action) {
            case 'toggle_check_lines': setShowCheckLines(prev => !prev); break;
            case 'toggle_height_ratio': setShowHeightRatio(prev => !prev); break;
            case 'toggle_wei_lao': setShowWeiLao(prev => !prev); break;
            case 'toggle_backyard': setShowBackyard(prev => !prev); break;
            case 'toggle_dark_mode': setIsDarkMode(prev => !prev); break;
            case 'toggle_summary_panel': togglePanel('summary'); break;
            case 'toggle_results_panel': togglePanel('results'); break;
            case 'toggle_info_panel': togglePanel('inputs'); break;
            case 'toggle_env_panel': togglePanel('env_panel'); break;
            case 'toggle_combined_table': setShowCombinedTable(prev => !prev); break;
            case 'toggle_landscape': 
                if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
                if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
                    window.screen.orientation.lock("landscape").catch(()=>console.log("Orientation lock not supported"));
                }
                break;
        }
    };
;
    // Insert before "const inputClass ="
    code = code.replace('const inputClass =', handleCanvasActionStr + '\n    const inputClass =');
}

// 2. Fix activePanels state definition if missing
if (!code.includes('const [activePanels, setActivePanels]')) {
    code = code.replace('const [contextMenu, setContextMenu]', 'const [activePanels, setActivePanels] = useState(["summary"]);\n    const [contextMenu, setContextMenu]');
}

// 3. Replace all remaining activePanel === '...'
code = code.replace(/activePanel\s*===\s*'([^']+)'/g, "activePanels.includes('')");

// 4. Add onAction to ContextMenu
code = code.replace(/<ContextMenu ([^>]+) \/>/, "<ContextMenu  onAction={handleCanvasAction} />");

fs.writeFileSync('src/App.jsx', code);
console.log('App.jsx fixed');
