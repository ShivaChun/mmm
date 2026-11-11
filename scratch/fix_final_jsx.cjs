const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// I will find the exact lines at the end of placementPreview block
const regex = /                                        \}\)\(\)\}\n([\s\S]*?)                <\/DraggablePanel>/;

const replacement = `                                        })()}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            {showEnvPanel && (
                <DraggablePanel title="環境模擬設定" onClose={onCloseEnvPanel}>`;

let newSrc = src.replace(regex, replacement);
fs.writeFileSync('src/components/PlanAnalysis3D.jsx', newSrc, 'utf8');
console.log('Fixed tags completely!');
