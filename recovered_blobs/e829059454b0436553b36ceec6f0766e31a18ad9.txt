const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./lint.json', 'utf8'));

const errors = {};
let totalErrors = 0;
let totalWarnings = 0;

data.forEach(file => {
    file.messages.forEach(msg => {
        if (msg.severity === 2) totalErrors++;
        if (msg.severity === 1) totalWarnings++;
        errors[msg.ruleId] = (errors[msg.ruleId] || 0) + 1;
    });
});

console.log(`Total Errors: ${totalErrors}`);
console.log(`Total Warnings: ${totalWarnings}`);
console.log('\nBreakdown:');
Object.entries(errors)
    .sort((a, b) => b[1] - a[1])
    .forEach(([rule, count]) => console.log(`${rule}: ${count}`));
