const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');
if (!code.includes('import ContextMenu')) {
    code = code.replace(/import \{ DraggablePanel \} from '\.\/components\/DraggablePanel';/, "import { DraggablePanel } from './components/DraggablePanel';\nimport ContextMenu from './components/ContextMenu';");
    fs.writeFileSync('src/App.jsx', code);
    console.log('Imported ContextMenu');
}
