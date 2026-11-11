const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const oldLogic = `            // 1. WeiLao (Frontage)
            if (frontIndices.has(originalIdx)) {
                const fD = parseFloat(inputs.frontYardDepth || 0);

                const p_out_M = { x: mid.x - normal.x * primRoadW_M, y: mid.y - normal.y * primRoadW_M };
                const p_center_M = { x: mid.x - normal.x * (primRoadW_M / 2), y: mid.y - normal.y * (primRoadW_M / 2) };
                const p_setback_M = { x: mid.x + normal.x * fD, y: mid.y + normal.y * fD };`;

const newLogic = `            // 1. WeiLao (Frontage)
            if (frontIndices.has(originalIdx)) {
                const fD = parseFloat(inputs.frontYardDepth || 0);
                
                // Get the exact road width for this edge
                let actualRoadW_M = primRoadW_M;
                if (inputs.roads) {
                    const r = inputs.roads.find(r => {
                        const indices = r.edgeIndices || (r.edgeIndex !== undefined && r.edgeIndex !== "" ? [parseInt(r.edgeIndex)] : []);
                        return indices.includes(originalIdx);
                    });
                    if (r) actualRoadW_M = parseFloat(r.width) || 6;
                }

                // normal points INWARD. So -normal points OUTWARD towards the road.
                // Outer edge is mid - normal * roadWidth
                const p_out_M = { x: mid.x - normal.x * actualRoadW_M, y: mid.y - normal.y * actualRoadW_M };
                const p_center_M = { x: mid.x - normal.x * (actualRoadW_M / 2), y: mid.y - normal.y * (actualRoadW_M / 2) };
                const p_setback_M = { x: mid.x + normal.x * fD, y: mid.y + normal.y * fD };`;

code = code.replace(oldLogic, newLogic);

// Wait, I need to make sure the heights use actualRoadW_M as well!
const oldHeights = `                if (showCheckLines && useFrontHeightRatio) {
                    const hRatioH = 3.6 * (primRoadW_M + fD) * scale;`;
const newHeights = `                if (showCheckLines && useFrontHeightRatio) {
                    const hRatioH = 3.6 * (actualRoadW_M + fD) * scale;`;

code = code.replace(oldHeights, newHeights);

const oldWlH = `                if (showCheckLines && showWeiLao) {
                    const wlH = 5 * (0.5 * primRoadW_M + fD) * scale;`;
const newWlH = `                if (showCheckLines && showWeiLao) {
                    const wlH = 5 * (0.5 * actualRoadW_M + fD) * scale;`;

code = code.replace(oldWlH, newWlH);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code);
console.log('Fixed checklines road width!');
