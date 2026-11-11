const fs = require('fs');
let src = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

const target = `                                        })()}
                                    </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>`;

const replacement = `                                        })()}
                                    </div>
                                );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </>
        )}
    </div>`;

// Wait, let's just do a manual string replace of the exact broken part
let lines = src.split('\n');
lines.splice(2814, 0, '                                );', '                            })}');

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', lines.join('\n'), 'utf8');
console.log('Fixed missing map closure');
