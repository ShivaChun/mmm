const fs = require('fs');
const file = 'src/components/PlanAnalysis3D.jsx';
let src = fs.readFileSync(file, 'utf8');

src = src.replace(/start: \{ x: offX \+ p_out_M\.x \* scale, y: offY \+ p_out_M\.y \* scale/g, 'start: { x: p_out_M.x * scale, y: p_out_M.y * scale');
src = src.replace(/end: \{ x: offX \+ p_setback_M\.x \* scale, y: offY \+ p_setback_M\.y \* scale/g, 'end: { x: p_setback_M.x * scale, y: p_setback_M.y * scale');

src = src.replace(/start: \{ x: offX \+ p_center_M\.x \* scale, y: offY \+ p_center_M\.y \* scale/g, 'start: { x: p_center_M.x * scale, y: p_center_M.y * scale');

src = src.replace(/start: \{ x: offX \+ startM\.x \* scale, y: offY \+ startM\.y \* scale/g, 'start: { x: startM.x * scale, y: startM.y * scale');
src = src.replace(/end: \{ x: offX \+ p_envelope_M\.x \* scale, y: offY \+ p_envelope_M\.y \* scale/g, 'end: { x: p_envelope_M.x * scale, y: p_envelope_M.y * scale');

src = src.replace(/start: \{ x: offX \+ p_start_M\.x \* scale, y: offY \+ p_start_M\.y \* scale/g, 'start: { x: p_start_M.x * scale, y: p_start_M.y * scale');
src = src.replace(/end: \{ x: offX \+ p_end_M\.x \* scale, y: offY \+ p_end_M\.y \* scale/g, 'end: { x: p_end_M.x * scale, y: p_end_M.y * scale');

fs.writeFileSync(file, src, 'utf8');
console.log("Check lines offset fixed!");
