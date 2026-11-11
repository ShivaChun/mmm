const fs = require('fs');
let content = fs.readFileSync('src/components/Si.jsx', 'utf8');

const siRegex = /export const Si = React\.memo\(\(\{\s*text,[\s\S]*?\}\)\s*=>\s*\{[\s\S]*?return visible \? \([\s\S]*?\)\s*:\s*null;\n\}\);/;
const newSi = `export const Si = React.memo(({ text, x, y, z, rotationZ, baseRotation, viewAngleX, visible, className, lineConnector, isRoadLabel, onClick, onMouseEnter, onMouseLeave, zoom = 1, children }) => {
    const isSmall = className?.includes('text-[10px]') || className?.includes('text-xs');
    const hiResMulti = 4;
    const baseSize = (isSmall ? 10 : 12) * hiResMulti;
    
    // Determine background classes to prevent white-on-white text (Site A blank label fix)
    const hasBg = className?.includes('bg-') || className?.includes('theme-panel-glass');
    const finalClass = hasBg ? className : \`bg-white/90 text-stone-800 \${className || ''}\`;

    const scaleFactor = (1 / zoom) / hiResMulti;

    return visible ? (
        <div className="absolute pointer-events-none" style={{ left: 0, top: 0, transform: \`translate3d(\${x}px, \${y}px, \${z}px) rotateZ(\${isRoadLabel ? -(rotationZ + baseRotation) : -(rotationZ + baseRotation)}deg) rotateX(\${-viewAngleX}deg) scale(\${scaleFactor})\` }}>
            <div className="flex items-center" style={{ transform: \`translate(-50%, -50%)\`, pointerEvents: onClick ? 'auto' : 'none', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
                {lineConnector && <div className="bg-stone-400" style={{ width: \`\${16 * hiResMulti}px\`, height: \`\${2 * hiResMulti}px\` }}></div>}
                <div 
                    className={\`whitespace-nowrap num-font font-black \${finalClass}\`} 
                    style={{ 
                        fontSize: \`\${baseSize}px\`, 
                        padding: \`\${4 * hiResMulti}px \${8 * hiResMulti}px\`, 
                        borderWidth: \`\${2 * hiResMulti}px\`,
                        borderColor: 'black',
                        borderRadius: className?.includes('rounded-none') ? '0' : \`\${4 * hiResMulti}px\`,
                        boxShadow: \`0px 0px \${8 * hiResMulti}px rgba(0,0,0,0.5)\`,
                        backdropFilter: 'blur(4px)'
                    }}
                >
                    {text || children || " "}
                </div>
            </div>
        </div>
    ) : null;
});`;

content = content.replace(siRegex, newSi);
fs.writeFileSync('src/components/Si.jsx', content, 'utf8');
console.log('Si updated');
