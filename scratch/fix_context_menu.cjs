const fs = require('fs');
let src = fs.readFileSync('src/components/ContextMenu.jsx', 'utf8');

// 1. Change activeSubmenu to activeSubmenus
src = src.replace(/const \[activeSubmenu, setActiveSubmenu\] = useState\(null\);/, 'const [activeSubmenus, setActiveSubmenus] = useState([]);\n    const toggleSubmenu = (menu) => setActiveSubmenus(prev => prev.includes(menu) ? prev.filter(m => m !== menu) : [...prev, menu]);');

// 2. Replace onClick={() => setActiveSubmenu(activeSubmenu === 'sites' ? null : 'sites')}
src = src.replace(/onClick=\{\(\) => setActiveSubmenu\(activeSubmenu === '([^']+)' \? null : '[^']+'\)\}/g, 'onClick={() => toggleSubmenu(\'$1\')}');

// 3. Replace activeSubmenu === 'sites' with activeSubmenus.includes('sites')
src = src.replace(/activeSubmenu === '([^']+)'/g, 'activeSubmenus.includes(\'$1\')');

// 4. Calculate scaleFactor based on size.w
src = src.replace(/const \[size, setSize\] = useState\(\{ w: 260, h: 'auto' \}\);/, 'const [size, setSize] = useState({ w: 260, h: \'auto\' });\n    const scaleFactor = typeof size.w === "number" ? Math.max(0.5, Math.min(2.0, size.w / 260)) : 1;');

// 5. Apply zoom to the scrollable container
src = src.replace(/<div className="py-1\.5 flex flex-col gap-0\.5 px-1\.5 flex-1 overflow-y-auto">/, '<div className="py-1.5 flex flex-col gap-0.5 px-1.5 flex-1 overflow-y-auto custom-scrollbar" style={{ zoom: scaleFactor, transformOrigin: "top left" }}>');

fs.writeFileSync('src/components/ContextMenu.jsx', src, 'utf8');
console.log('Fixed ContextMenu activeSubmenus and zoom!');
