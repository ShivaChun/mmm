const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const regex = /                                        \}\)\(\)\}\n                                    <\/div>\n                                \);\n                            \}\)}\n                        <\/div>\n                    <\/div>\n                <\/div>\n            <\/>\n        \)\}\n    <\/div>/m;

const replacement = `                                        })()}
                                    </div>
                                );
                            })}
                            </div>
                        </>
                    )}
                </div>
            </div>`;

let newSrc = src.replace(regex, replacement);
fs.writeFileSync('src/components/PlanAnalysis3D.jsx', newSrc, 'utf8');
console.log('Fixed tags!');
