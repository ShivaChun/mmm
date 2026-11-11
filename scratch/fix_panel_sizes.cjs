const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

code = code.replace(
    /<DraggablePanel title="基地與法規設定" onClose=\{\(\) => setActivePanel\(null\)\}>/g,
    '<DraggablePanel title="基地與法規設定" onClose={() => setActivePanel(null)} defaultSize={{ w: 420, h: 600 }}>'
);

code = code.replace(
    /<DraggablePanel title="詳細計算表" onClose=\{\(\) => setActivePanel\(null\)\}>/g,
    '<DraggablePanel title="詳細計算表" onClose={() => setActivePanel(null)} defaultSize={{ w: 800, h: 600 }}>'
);

code = code.replace(
    /<DraggablePanel title="整體合併檢討表" onClose=\{\(\) => setActivePanel\(null\)\}>/g,
    '<DraggablePanel title="整體合併檢討表" onClose={() => setActivePanel(null)} defaultSize={{ w: 800, h: 600 }}>'
);

fs.writeFileSync('src/App.jsx', code, 'utf8');
console.log('Fixed Panel Sizes');
