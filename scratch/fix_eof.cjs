const fs = require('fs');

let lines = fs.readFileSync('src/App.jsx', 'utf8').split('\n');

let lastValidIndex = -1;
for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('?? ¿W¥ß©ñ¸m')) {
        lastValidIndex = i;
        break;
    }
}

if (lastValidIndex !== -1) {
    let cleanCode = lines.slice(0, lastValidIndex + 1).join('\n');
    cleanCode += `
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Cal;
`;
    fs.writeFileSync('src/App.jsx', cleanCode);
    console.log('Fixed EOF!');
}
