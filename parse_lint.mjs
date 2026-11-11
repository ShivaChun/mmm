import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
try {
  const out = execSync('npx eslint src/components/PlanAnalysis3D.jsx --format json', { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  const data = JSON.parse(out);
  let lines = [];
  data.forEach(f => { f.messages.forEach(m => { if (m.severity === 2) lines.push(`L${m.line}:${m.column} [${m.ruleId}] ${m.message}`); }); });
  writeFileSync('lint_errors.txt', lines.join('\n'), 'utf8');
  console.log(`Found ${lines.length} errors. Written to lint_errors.txt`);
} catch(e) {
  if (e.stdout) {
    try {
      const data = JSON.parse(e.stdout);
      let lines = [];
      data.forEach(f => { f.messages.forEach(m => { if (m.severity === 2) lines.push(`L${m.line}:${m.column} [${m.ruleId}] ${m.message}`); }); });
      writeFileSync('lint_errors.txt', lines.join('\n'), 'utf8');
      console.log(`Found ${lines.length} errors. Written to lint_errors.txt`);
    } catch(e2) { console.error('Parse error:', e2.message); }
  } else { console.error('Error:', e.message); }
}
