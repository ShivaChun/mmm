
const fs = require('fs');
const files = fs.readdirSync('unknown');
for (const file of files) {
    if (!file.endsWith('.txt')) continue;
    const content = fs.readFileSync('unknown/' + file, 'utf8');
    console.log('--- ' + file + ' (' + content.length + ' bytes) ---');
    console.log(content.substring(0, 200));
}

