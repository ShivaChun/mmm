const fs = require('fs');
let code = fs.readFileSync('src/App_reconstructed.jsx', 'utf8');

const anchor = 'handleAddSite: () => setShowAddSiteDialog(true) }}';
const anchorIdx = code.indexOf(anchor);

if (anchorIdx !== -1) {
    const startCode = code.substring(0, anchorIdx + anchor.length);
    const endCode = 
                />
            </div>
            {/* Context menu etc could be added here later */}
        </div>
    );
};

export default Cal;
;
    fs.writeFileSync('src/App.jsx', startCode + endCode);
    console.log('Fixed App.jsx successfully!');
} else {
    console.log('Anchor not found');
}
