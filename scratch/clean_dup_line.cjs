const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const regex = /                                    <\/div>\n                                                            const sIdx = sites\.findIndex\(s => s\.id === ps\.site\.id\);\n                                                            if \(sIdx !== -1 && typeof setActiveSiteIndex === 'function'\) \{\n                                                                setActiveSiteIndex\(sIdx\);\n                                                            \}\n                                                        \}\n                                                    \}\}\n                                                \/>\n                                            \);\n                                        \}\)}\n                                    <\/div>/;

code = code.replace(regex, "                                    </div>");

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code, 'utf8');
console.log('Fixed broken block');
