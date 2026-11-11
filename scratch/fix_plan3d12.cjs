const fs = require('fs');
const plan3dPath = 'src/components/PlanAnalysis3D.jsx';
let code = fs.readFileSync(plan3dPath, 'utf8');

const scratchPath = 'C:/Users/Shiva.C/.gemini/antigravity/brain/c5180444-e177-4bd9-8082-1b94d6e24c21/scratch/renderPolygonSetbacks.js';
let scratchCode = fs.readFileSync(scratchPath, 'utf8');

// remove line numbers like "1912: "
scratchCode = scratchCode.replace(/^\d+:\s/gm, '');

const startScratch = scratchCode.indexOf('    const renderPolygonSetbacks = (ps) => {');
const endScratch = scratchCode.indexOf('    const landscapeStyle = isLandscapeMode ?');
const replacementCode = scratchCode.substring(startScratch, endScratch);

const startAutoMaxArea = `
    const handleAutoMaxArea = () => {
        if (!massingLayers || massingLayers.layers.length === 0) return;
        const remainingTotal = massingLayers.remainingArea;
        if (remainingTotal <= 0.1) return;
        const layerMap = new Map();
        massingLayers.layers.forEach(layer => {
            if (/^\\d+F$/.test(layer.id)) layerMap.set(layer.id, layer);
        });
        const candidateIds = Array.from(layerMap.keys()).sort((a, b) => parseInt(a) - parseInt(b));
        if (candidateIds.length === 0) return;
        const slackById = new Map();
        candidateIds.forEach(id => {
            const layer = layerMap.get(id);
            const maxArea = Math.max(0, layer?.maxGeometricArea || 0);
            const currentArea = Math.max(0, layer?.realArea || 0);
            const slack = Math.max(0, maxArea - currentArea);
            if (slack > 0.1) slackById.set(id, slack);
        });
        const activeCandidates = Array.from(slackById.keys());
        if (activeCandidates.length === 0) return;
        const allocations = {};
        let remaining = remainingTotal;
        let active = activeCandidates.slice();
        let guard = 0;
`;

const finalReplacement = replacementCode + startAutoMaxArea;

// We need to replace the BAD text that currently exists in PlanAnalysis3D.jsx
// That bad text contains the line numbers!
const startTarget = code.indexOf('    const renderPolygonSetbacks = (ps) => {');
const endTarget = code.indexOf('        while (remaining > 0.01 && active.length > 0 && guard < 10) {');

if (startTarget > -1 && endTarget > -1) {
    const newCode = code.substring(0, startTarget) + finalReplacement + code.substring(endTarget);
    fs.writeFileSync(plan3dPath, newCode);
    console.log('Successfully restored WITHOUT LINE NUMBERS!');
} else {
    console.log('Could not find target strings!');
}
