const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

code = code.replace(
    /<DraggablePanel title="專案摘要 \(Project Summary\)" onClose=\{\(\) => setActivePanel\(null\)\}/g,
    '<DraggablePanel title="專案摘要 (Project Summary)" onClose={() => togglePanel("summary")}'
);

code = code.replace(
    /<DraggablePanel title="專案設定" onClose=\{\(\) => setActivePanel\(null\)\}>/g,
    '<DraggablePanel title="專案設定" onClose={() => togglePanel("project")}>'
);

code = code.replace(
    /<DraggablePanel title="基地切換與管理" onClose=\{\(\) => setActivePanel\(null\)\}>/g,
    '<DraggablePanel title="基地切換與管理" onClose={() => togglePanel("sites")}>'
);

code = code.replace(
    /<DraggablePanel title="基地與法規設定" onClose=\{\(\) => setActivePanel\(null\)\}/g,
    '<DraggablePanel title="基地與法規設定" onClose={() => togglePanel("info")}'
);

code = code.replace(
    /<DraggablePanel title="詳細計算表" onClose=\{\(\) => setActivePanel\(null\)\}/g,
    '<DraggablePanel title="詳細計算表" onClose={() => togglePanel("calc")}'
);

code = code.replace(
    /<DraggablePanel title="整體合併檢討表" onClose=\{\(\) => setActivePanel\(null\)\}/g,
    '<DraggablePanel title="整體合併檢討表" onClose={() => togglePanel("combined")}'
);

fs.writeFileSync('src/App.jsx', code, 'utf8');
console.log('Fixed Panel Close Handlers properly');
