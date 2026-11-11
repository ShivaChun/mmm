const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'PlanAnalysis3D.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// In renderRoads
content = content.replace(
    /const normalizedPoints = toWorldPts\(normalizedData\.points, ps\.layout\);/g,
    'const normalizedPoints = normalizedData.points;'
);

// In renderPolygonSetbacks
content = content.replace(
    /let { points: normalizedPoints, edgeMap } = discretizePolygon\(rawNormalized, normalizedData\.curves, 15\);\n\s*normalizedPoints = toWorldPts\(normalizedPoints, ps\.layout\);/g,
    'let { points: normalizedPoints, edgeMap } = discretizePolygon(rawNormalized, normalizedData.curves, 15);\n        // normalizedPoints = toWorldPts(normalizedPoints, ps.layout); // Removed to avoid double transform'
);

// In renderReviewSurfaces
content = content.replace(
    /workingPoints = toWorldPts\(workingPoints, ps\.layout\);/g,
    '// workingPoints = toWorldPts(workingPoints, ps.layout); // Removed to avoid double transform'
);

fs.writeFileSync(filePath, content);
console.log('Fixed toWorldPts double transforms');
