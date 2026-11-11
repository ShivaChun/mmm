const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const badStr = `        while (remaining > 0.01 && active.length > 0 && guard < 10) {
            const per = remaining / active.length;
            const next = [];

            guard += 1;
        }`;

const goodStr = `        while (remaining > 0.01 && active.length > 0 && guard < 10) {
            const per = remaining / active.length;
            const next = [];
            active.forEach(id => {
                const slack = (slackById.get(id) || 0) - (allocations[id] || 0);
                const add = Math.min(slack, per);
                if (add > 0) {
                    allocations[id] = (allocations[id] || 0) + add;
                    remaining -= add;
                }
                if (slack - add > 0.01) next.push(id);
            });
            active = next;
            guard += 1;
        }`;

code = code.replace(badStr, goodStr);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code);
console.log('Fixed while block in PlanAnalysis3D!');
