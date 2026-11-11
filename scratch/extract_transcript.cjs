const fs = require('fs');
const transcriptPath = 'c:/Users/Shiva.C/.gemini/antigravity/brain/c5180444-e177-4bd9-8082-1b94d6e24c21/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');

for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i]) continue;
    try {
        const obj = JSON.parse(lines[i]);
        if (obj.tool_calls) {
            for (const call of obj.tool_calls) {
                if (call.name === 'default_api:replace_file_content' || call.name === 'replace_file_content' || call.name === 'default_api:write_to_file' || call.name === 'write_to_file' || call.name === 'default_api:multi_replace_file_content') {
                    if (call.args && call.args.TargetFile && call.args.TargetFile.includes('fix_missing_block.js')) {
                        console.log('Found untruncated fix_missing_block.js!');
                        fs.writeFileSync('YRA-React/scratch/fix_missing_block_full.js', call.args.CodeContent || call.args.ReplacementContent || call.args.ReplacementChunks?.[0]?.ReplacementContent || '');
                        process.exit(0);
                    }
                }
            }
        }
    } catch (e) {}
}
console.log('Not found');
