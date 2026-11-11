const fs = require('fs');

let p = 'src/components/DraggablePanel.jsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/const \[size, setSize\] = useState\(defaultSize\);/, `const [size, setSize] = useState(defaultSize);`);
c = c.replace(/useEffect\(\(\) => \{\s*if \(typeof window !== 'undefined'\) \{\s*setPos\(\{\s*x: Math\.max\(20, window\.innerWidth \/ 2 - defaultSize\.w \/ 2\),\s*y: Math\.max\(20, window\.innerHeight \/ 2 - defaultSize\.h \/ 2\)\s*\}\);\s*\}\s*\}, \[defaultSize\.w, defaultSize\.h\]\);/, `useEffect(() => {
        if (typeof window !== 'undefined') {
            const startW = Math.min(defaultSize.w, window.innerWidth - 40);
            const startH = typeof defaultSize.h === 'number' ? Math.min(defaultSize.h, window.innerHeight - 40) : defaultSize.h;
            setSize({ w: startW, h: startH });
            
            // Stagger based on title length to prevent exact overlap
            const staggerX = (title.length % 5) * 20;
            const staggerY = (title.length % 7) * 20;
            
            setPos({
                x: Math.max(10, window.innerWidth / 2 - startW / 2 + staggerX - 40),
                y: Math.max(10, window.innerHeight / 2 - (typeof startH === 'number' ? startH : 400) / 2 + staggerY - 40)
            });
        }
    }, [defaultSize.w, defaultSize.h, title]);`);

fs.writeFileSync(p, c, 'utf8');
console.log('DraggablePanel.jsx fixed!');
