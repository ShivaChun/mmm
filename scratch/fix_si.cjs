const fs = require('fs');
let src = fs.readFileSync('src/components/Si.jsx', 'utf8');

const newSi = `export const Si = React.memo(({ text, x, y, z, rotationZ, baseRotation, viewAngleX, visible, className, lineConnector, isRoadLabel, onClick, onMouseEnter, onMouseLeave, zoom = 1, children }) => {
    const isSmall = className?.includes('text-[10px]') || className?.includes('text-xs');
    const hiResMulti = 5; // Reduced multiplier to prevent texture size limits
    const zFactor = 1 / zoom;
    const baseSize = (isSmall ? 10 : 12) * hiResMulti * zFactor;
    
    // Determine background classes to prevent white-on-white text (Site A blank label fix)
    // The issue was that text-white was applied but it might have been overridden or clipped
    const hasBg = className?.includes('bg-') || className?.includes('theme-panel-glass');
    const finalClass = hasBg ? (className?.includes('text-') ? className : \`text-stone-800 \${className}\`) : \`bg-white/90 text-stone-800 \${className || ''}\`;

    const scaleFactor = 1 / hiResMulti;
    const isFirefox = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("firefox");

    return visible ? (
        <div className="absolute pointer-events-none" style={{ left: 0, top: 0, transform: \`translate3d(\${x}px, \${y}px, \${z}px) rotateZ(\${-(rotationZ + baseRotation)}deg) rotateX(\${-viewAngleX}deg) scale(\${scaleFactor})\` }}>
            <div className="flex items-center" style={{ transform: \`translate(-50%, -50%)\`, pointerEvents: onClick ? 'auto' : 'none', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
                {lineConnector && <div className="bg-stone-400" style={{ width: \`\${16 * hiResMulti * zFactor}px\`, height: \`\${2 * hiResMulti * zFactor}px\` }}></div>}
                <div 
                    className={\`whitespace-nowrap num-font font-black \${finalClass}\`} 
                    style={{ 
                        fontSize: \`\${baseSize}px\`, 
                        lineHeight: \`\${baseSize * 1.2}px\`, // explicitly set lineHeight to prevent clipping
                        padding: \`\${4 * hiResMulti * zFactor}px \${8 * hiResMulti * zFactor}px\`, 
                        borderWidth: \`\${2 * hiResMulti * zFactor}px\`,
                        borderColor: 'black',
                        borderStyle: 'solid',
                        borderRadius: className?.includes('rounded-none') ? '0' : \`\${4 * hiResMulti * zFactor}px\`,
                        boxShadow: \`0px 0px \${8 * hiResMulti * zFactor}px rgba(0,0,0,0.5)\`,
                    }}
                >
                    {text || children || " "}
                </div>
            </div>
        </div>
    ) : null;
});`;

src = src.replace(/export const Si = React\.memo\(\(\{[\s\S]+?\}\);\n/, newSi + '\n');
fs.writeFileSync('src/components/Si.jsx', src, 'utf8');
console.log('Fixed Si.jsx');
