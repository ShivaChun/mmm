import fs from 'fs';
const data = JSON.parse(fs.readFileSync('./lint2.json', 'utf8'));

data.forEach(file => {
    file.messages.forEach(msg => {
        if (msg.ruleId === "react-refresh/only-export-components") {
            console.log(`File: ${file.filePath}`);
            console.log(`Line: ${msg.line}, Col: ${msg.column}`);
            console.log(`Message: ${msg.message}`);
        }
    });
});
