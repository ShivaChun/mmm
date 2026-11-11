const fs = require('fs');
const plan3dPath = 'src/components/PlanAnalysis3D.jsx';
let code = fs.readFileSync(plan3dPath, 'utf8');

// Inside renderPolygons:
// Find labels.push({ ... })
const oldPush = `labels.push({
                x: mid.x + n.x * depth * 0.5,
                y: mid.y + n.y * depth * 0.5,
                text: labelByType[regionType],
                color: colorByType[regionType],
                key: \`\${regionType}-\${origIdx}\`
            });`;

const newPush = `const lx = mid.x + n.x * depth * 0.5;
            const ly = mid.y + n.y * depth * 0.5;
            labels.push(<Si key={\`\${regionType}-\${origIdx}\`} text={labelByType[regionType]} x={lx * scale + w / 2} y={ly * scale + d / 2} z={1} rotationZ={rotationZ} baseRotation={site.inputs.northAngle || 0} viewAngleX={viewAngleX} visible={true} className={\`text-[10px] font-bold bg-white/50 px-1 rounded shadow-sm\`} style={{ color: colorByType[regionType] }} />);`;

code = code.replace(oldPush, newPush);

const oldSvgText = `<svg width="100%" height="100%" viewBox={\`0 0 \${w} \${d}\`} style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0 }}>
                    {labels.map(label => (
                        <text key={label.key} x={label.x * scale + w / 2} y={label.y * scale + d / 2} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill={label.color} opacity={0.9} className="select-none">
                            {label.text}
                        </text>
                    ))}
                </svg>`;

const newSvgText = `{labels}`;

code = code.replace(oldSvgText, newSvgText);

fs.writeFileSync(plan3dPath, code);
console.log('Fixed base labels!');
