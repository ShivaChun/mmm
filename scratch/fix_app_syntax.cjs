const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

// The faulty block is:
// appState={{ ... }}
//     </div>
// )}
// </div>
// </section>

code = code.replace(
    /appState=\{\{([^}]*)\}\}\s*<\/div>\s*\)\}\s*<\/div>\s*<\/section>/,
    'appState={{}}\n                />\n            </div>'
);

// We need to make sure the closing tags for the main container are correct since we removed </section>
// We just need to close the outer div and the return.
// But wait, the previous code had an <section> for Visualizer3D, which we removed the closing tag for!
// Wait! App_reconstructed.jsx IS ALREADY FULLSCREEN!
// So there is NO <main className="grid"> and NO <section className="lg:col-span-8">.
// Instead, it has <div className="absolute inset-0 z-0"> and inside it Visualizer3D!

fs.writeFileSync('src/App.jsx', code);
console.log('Fixed syntax error in App.jsx');
