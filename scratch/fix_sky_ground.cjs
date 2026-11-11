const fs = require('fs');

let p = 'src/components/PlanAnalysis3D.jsx';
let c = fs.readFileSync(p, 'utf8');

// 1. Remove the grid (usually an SVG with pattern or path grid)
c = c.replace(/<svg[^>]*>[\s\S]*?<pattern id="grid"[\s\S]*?<\/svg>/, '');
c = c.replace(/<rect width="100%" height="100%" fill="url\(#grid\)" \/>/g, '');

// 2. Add Sky/Ground 
// Sky is the container background
c = c.replace(/className="relative flex-1 overflow-hidden h-full flex flex-col [^"]*"/, 'className={`relative flex-1 overflow-hidden h-full flex flex-col ${isDarkMode ? \'bg-[#0f172a]\' : \'bg-[#e0f2fe]\'}`}`');

// Wait, the previous regex might be too greedy or might not match. Let's do it safer.
c = c.replace(/className="relative flex-1 overflow-hidden h-full flex flex-col bg-slate-900"/, 'className={`relative flex-1 overflow-hidden h-full flex flex-col ${isDarkMode ? \'bg-[#0f172a]\' : \'bg-[#e0f2fe]\'}`}');

// Ground is the large 40000px interaction plane
c = c.replace(/<div style=\{\{ position: 'absolute', top: '50%', left: '50%', width: '40000px', height: '40000px', marginLeft: '-20000px', marginTop: '-20000px', backgroundColor: 'transparent', transform: 'translateZ\(-0\.5px\)', pointerEvents: 'auto' \}\} onMouseDown=\{handleMouseDown\} onTouchStart=\{handleTouchStart\}><\/div>/, `<div style={{ position: 'absolute', top: '50%', left: '50%', width: '100000px', height: '100000px', marginLeft: '-50000px', marginTop: '-50000px', backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', transform: 'translateZ(-0.5px)', pointerEvents: 'auto' }} onMouseDown={handleMouseDown} onTouchStart={handleTouchStart}></div>`);

fs.writeFileSync(p, c, 'utf8');
console.log('PlanAnalysis3D.jsx sky/ground fixed!');
