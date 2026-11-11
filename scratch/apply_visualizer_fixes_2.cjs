const fs = require('fs');

// --- 1. Fix PlanAnalysis3D.jsx ---
let content3D = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// Add translateZ to renderRoads
content3D = content3D.replace(
    /return \(\s*<div style=\{\{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 \}\}>/g,
    "return (\n            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'translateZ(-0.2px)', transformStyle: 'preserve-3d' }}>"
);

// Remove the embedded Project Summary for mobile
content3D = content3D.replace(/\{\s*isMobile && isProjectSummaryVisible && \([\s\S]*?\)\s*\}/g, "");
content3D = content3D.replace(/\{\s*isMobile && !isProjectSummaryVisible && \([\s\S]*?\)\s*\}/g, "");

// Add sky background to viewport
content3D = content3D.replace(
    /style=\{\{ \.\.\.landscapeStyle \}\}/g,
    "style={{ ...landscapeStyle, backgroundColor: isDarkMode ? '#0f172a' : '#87CEEB' }}"
);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', content3D, 'utf8');
console.log('Fixed PlanAnalysis3D.jsx');

// --- 2. Fix App.jsx ---
let contentApp = fs.readFileSync('src/App.jsx', 'utf8');

// Change toggle_summary_panel action
contentApp = contentApp.replace(
    /if \(action === 'toggle_summary_panel'\) setShowSummaryPanel\(prev => !prev\);/g,
    "if (action === 'toggle_summary_panel') setActivePanel(prev => prev === 'summary' ? null : 'summary');"
);

// Add SummaryRow import if missing
if (!contentApp.includes("SummaryRow")) {
    contentApp = contentApp.replace(
        "import { CollapsibleSection, InputRow, SectionHeader } from './components/Si.jsx';",
        "import { CollapsibleSection, InputRow, SectionHeader } from './components/Si.jsx';\nimport { SummaryRow } from './components/SitePolygonEditor';"
    );
}

// Add the DraggablePanel for summary
if (!contentApp.includes("activePanel === 'summary'")) {
    const summaryPanelCode = `
                {activePanel === 'summary' && (
                    <DraggablePanel title="專案摘要 (Project Summary)" onClose={() => setActivePanel(null)} defaultSize={{ w: 320, h: 260 }}>
                        <div className="space-y-4">
                            <SummaryRow label="專案名稱" value={inputs.projectName || '未命名'} />
                            <SummaryRow label="工程預算" value={\`\${(results?.estimatedBudget || 0).toLocaleString()} 萬\`} highlight />
                            <SummaryRow label="建築物總高度" value={\`\${(siteResults?.[0]?.massingLayers?.totalHeight || 0).toLocaleString()} m\`} />
                        </div>
                    </DraggablePanel>
                )}
`;
    // Insert before {activePanel === 'project' && (
    contentApp = contentApp.replace(
        /\{\s*activePanel === 'project' && \(/,
        summaryPanelCode + "\n                {activePanel === 'project' && ("
    );
}

fs.writeFileSync('src/App.jsx', contentApp, 'utf8');
console.log('Fixed App.jsx');
