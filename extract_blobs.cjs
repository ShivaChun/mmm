
const { execSync } = require('child_process');
const fs = require('fs');

if (!fs.existsSync('recovered_blobs')) fs.mkdirSync('recovered_blobs');

let output = '';
try {
    output = execSync('git fsck --lost-found').toString();
} catch(e) {
    if (e.stdout) output = e.stdout.toString();
}

const lines = output.split('\n');
for (const line of lines) {
    if (line.includes('dangling blob')) {
        const hash = line.split(' ')[2].trim();
        try {
            const content = execSync('git show ' + hash).toString();
            fs.writeFileSync('recovered_blobs/' + hash + '.txt', content);
        } catch(err) {}
    }
}

