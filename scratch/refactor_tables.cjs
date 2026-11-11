const fs = require('fs');
const appPath = 'c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/App.jsx';
let appCode = fs.readFileSync(appPath, 'utf8');

// Section 2: DATA TABLE SECTION
appCode = appCode.replace(/\{\/\* DATA TABLE SECTION \*\/\}\s*<section className="space-y-4">[\s\S]*?(<div className="overflow-x-auto">[\s\S]*?<\/div>)\s*<\/div>\s*<\/div>\s*<\/section>/, (match, content) => {
    return `{/* DATA TABLE SECTION (DraggablePanel) */}
                {activePanels.includes('results') && (
                    <DraggablePanel title="詳細計算表" onClose={() => togglePanel('results')} defaultSize={{ w: 800, h: 600 }}>
                        <div className="p-4 overflow-x-auto overflow-y-auto w-full h-full">
                            <div className="min-w-max">
                                ${content}
                            </div>
                        </div>
                    </DraggablePanel>
                )}`;
});

// Section 3: COMBINED TABLE SECTION
appCode = appCode.replace(/\{sites\.length > 1 && combined && \(\s*<section className="space-y-4">[\s\S]*?(<div className="overflow-x-auto">[\s\S]*?<\/div>)\s*<\/div>\s*<\/div>\s*<\/section>\s*\)\}/, (match, content) => {
    return `{/* COMBINED TABLE SECTION (DraggablePanel) */}
                {sites.length > 1 && combined && activePanels.includes('combined') && (
                    <DraggablePanel title="整體合併容積檢討表" onClose={() => togglePanel('combined')} defaultSize={{ w: 800, h: 500 }}>
                        <div className="p-4 overflow-x-auto overflow-y-auto w-full h-full">
                            <div className="min-w-max">
                                ${content}
                            </div>
                        </div>
                    </DraggablePanel>
                )}`;
});

fs.writeFileSync(appPath, appCode);
console.log('App.jsx tables refactored successfully.');
