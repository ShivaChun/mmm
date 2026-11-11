const fs = require('fs');
const file = 'c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/App.jsx';
let src = fs.readFileSync(file, 'utf8');

src = src.replace(/<DraggablePanel title="專案摘要 \(Project Summary\)" onClose=\{\(\) => setActivePanel\(null\)\} defaultSize=\{\{ w: 320, h: 260 \}\}>/g, '<DraggablePanel title="專案摘要 (Project Summary)" onClose={() => togglePanel(\'summary\')} defaultSize={{ w: 400, h: 600 }}>');

src = src.replace(/<DraggablePanel title="專案設定" onClose=\{\(\) => setActivePanel\(null\)\}>/g, '<DraggablePanel title="專案設定" onClose={() => togglePanel(\'project\')} defaultSize={{ w: 400, h: 500 }}>');

src = src.replace(/<DraggablePanel title="基地切換與管理" onClose=\{\(\) => setActivePanel\(null\)\}>/g, '<DraggablePanel title="基地切換與管理" onClose={() => togglePanel(\'sites\')} defaultSize={{ w: 450, h: 600 }}>');

src = src.replace(/<DraggablePanel title="基地與法規設定" onClose=\{\(\) => setActivePanel\(null\)\}>/g, '<DraggablePanel title="基地與法規設定" onClose={() => togglePanel(\'info\')} defaultSize={{ w: 550, h: 650 }}>');

src = src.replace(/<DraggablePanel title="詳細計算表" onClose=\{\(\) => setActivePanel\(null\)\}>/g, '<DraggablePanel title="詳細計算表" onClose={() => togglePanel(\'results\')} defaultSize={{ w: 800, h: 650 }}>');

src = src.replace(/<DraggablePanel title="整體合併檢討表" onClose=\{\(\) => setActivePanel\(null\)\}>/g, '<DraggablePanel title="整體合併檢討表" onClose={() => togglePanel(\'combined\')} defaultSize={{ w: 800, h: 650 }}>');

fs.writeFileSync(file, src);
