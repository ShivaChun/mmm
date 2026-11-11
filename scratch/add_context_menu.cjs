const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add import ContextMenu
if (!code.includes('import { ContextMenu }')) {
    code = code.replace(
        /import Visualizer3D from '.\/components\/PlanAnalysis3D';/,
        "import Visualizer3D from './components/PlanAnalysis3D';\nimport { ContextMenu } from './components/ContextMenu';"
    );
}

// 2. Add state and handlers
if (!code.includes('const [contextMenuState')) {
    code = code.replace(
        /const \[placementOffset, setPlacementOffset\] = useState\(\{ x: 0, y: 0 \}\);/,
        \const [placementOffset, setPlacementOffset] = useState({ x: 0, y: 0 });

    // ¢w¢w Context Menu State ¢w¢w
    const [contextMenuState, setContextMenuState] = useState({ isOpen: false, x: 0, y: 0 });
    const handleContextMenu = (e) => {
        e.preventDefault();
        setContextMenuState({ isOpen: true, x: e.clientX, y: e.clientY });
    };
    const closeContextMenu = () => {
        setContextMenuState(prev => ({ ...prev, isOpen: false }));
    };\
    );
}

// 3. Add onContextMenu to root div
code = code.replace(
    /<div className="min-h-screen theme-bg px-4 md:px-12 py-8 theme-text selection:bg-\[var\(--text-accent\)\] selection:text-white">/,
    '<div className="min-h-screen theme-bg px-4 md:px-12 py-8 theme-text selection:bg-[var(--text-accent)] selection:text-white" onContextMenu={handleContextMenu}>'
);

// 4. Render ContextMenu at the end of the root div
if (!code.includes('<ContextMenu')) {
    code = code.replace(
        /(\s*)<\/div>\s*<\/div>\s*\)\;\s*\}/,
        \$1    {contextMenuState.isOpen && (
        <ContextMenu
            x={contextMenuState.x}
            y={contextMenuState.y}
            onClose={closeContextMenu}
            isDarkMode={isDarkMode}
            sitesCount={sites.length}
            isMobile={isMobile}
            sites={sites}
            activeSiteIndex={activeSiteIndex}
            onSwitchSite={setActiveSiteIndex}
            onAddSite={() => setShowAddSiteDialog(true)}
            onRemoveSite={handleRemoveSite}
            inputs={inputs}
            onInputChange={handleInputChange}
            showCheckLines={showCheckLines}
            showHeightRatio={showHeightRatio}
            showWeiLao={showWeiLao}
            showBackyard={showBackyard}
            res={finalRes}
            unusedArea={unusedArea}
            onAction={(action) => {
                if (action === 'toggle_check_lines') setShowCheckLines(!showCheckLines);
                if (action === 'toggle_height_ratio') setShowHeightRatio(!showHeightRatio);
                if (action === 'toggle_wei_lao') setShowWeiLao(!showWeiLao);
                if (action === 'toggle_backyard') setShowBackyard(!showBackyard);
                if (action === 'toggle_dark_mode') setIsDarkMode(!isDarkMode);
                if (action === 'open_add_site') setShowAddSiteDialog(true);
                closeContextMenu();
            }}
        />
    )}
</div>
        </div>
    );
}\
    );
}

fs.writeFileSync('src/App.jsx', code, 'utf8');
console.log('Added ContextMenu to App.jsx');
