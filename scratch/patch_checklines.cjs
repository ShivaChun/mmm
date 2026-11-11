const fs = require('fs');
let content = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const targetStr = `            // 1. WeiLao (Frontage)
            if (frontIndices.has(originalIdx)) {
                const fD = parseFloat(inputs.frontYardDepth || 0);

                const p_out_M = { x: mid.x - normal.x * primRoadW_M, y: mid.y - normal.y * primRoadW_M };
                const p_center_M = { x: mid.x - normal.x * (primRoadW_M / 2), y: mid.y - normal.y * (primRoadW_M / 2) };
                const p_setback_M = { x: mid.x + normal.x * fD, y: mid.y + normal.y * fD };`;

const replacement = `            // 1. WeiLao (Frontage)
            if (frontIndices.has(originalIdx)) {
                const fD = parseFloat(inputs.frontYardDepth || 0);

                let edgeRoadW_M = primRoadW_M;
                const siteRoads = getSiteRoads ? getSiteRoads(ps.site) : [];
                if (siteRoads.length > 0) {
                    const matchedRoad = siteRoads.find(r => {
                        const indices = r.edgeIndices || (r.edgeIndex !== undefined && r.edgeIndex !== "" ? [parseInt(r.edgeIndex)] : []);
                        return indices.includes(originalIdx);
                    });
                    if (matchedRoad) {
                        edgeRoadW_M = parseFloat(matchedRoad.width) || primRoadW_M;
                    }
                }

                const p_out_M = { x: mid.x - normal.x * edgeRoadW_M, y: mid.y - normal.y * edgeRoadW_M };
                const p_center_M = { x: mid.x - normal.x * (edgeRoadW_M / 2), y: mid.y - normal.y * (edgeRoadW_M / 2) };
                const p_setback_M = { x: mid.x + normal.x * fD, y: mid.y + normal.y * fD };`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacement);
    fs.writeFileSync('src/components/PlanAnalysis3D.jsx', content, 'utf8');
    console.log('Checklines updated');
} else {
    console.log('Target string not found in PlanAnalysis3D.jsx');
}
