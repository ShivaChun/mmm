const fs = require('fs');
let code = fs.readFileSync('src/components/ContextMenu.jsx', 'utf8');

code = code.replace(/<button onClick=\{\(e\) => \{ e\.stopPropagation\(\); onAction\('toggle_summary_panel'\); \}\} className="w-full text-left px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-slate-700 flex items-center gap-2 font-bold"><LayoutList size=\{16\} \/> 專案摘要面板<\/button>/g,
    "<button onClick={(e) => { e.stopPropagation(); onAction('toggle_summary_panel'); }} className=\"w-full text-left px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-slate-700 flex items-center gap-2 font-bold\"><LayoutList size={16} /> 專案摘要面板</button>\n                    <button onClick={(e) => { e.stopPropagation(); onAction('toggle_env_panel'); }} className=\"w-full text-left px-3 py-2 text-sm hover:bg-stone-100 dark:hover:bg-slate-700 flex items-center gap-2 font-bold\"><LayoutTemplate size={16} /> 環境模擬設定</button>");

fs.writeFileSync('src/components/ContextMenu.jsx', code, 'utf8');
console.log('Fixed ContextMenu.jsx');
