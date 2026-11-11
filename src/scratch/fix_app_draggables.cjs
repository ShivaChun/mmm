const fs = require('fs');

const path3D = 'c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/components/PlanAnalysis3D.jsx';
let code3D = fs.readFileSync(path3D, 'utf8');

const pathApp = 'c:/Users/Shiva.C/Documents/trae_projects/ARCHI/cal_base/dist/YRA-React/src/App.jsx';
let codeApp = fs.readFileSync(pathApp, 'utf8');

// 1. 修改 App.jsx 引入 DraggablePanel
if (!codeApp.includes("import { DraggablePanel }")) {
    codeApp = codeApp.replace(
        "import { ContextMenu } from './components/ContextMenu';",
        "import { ContextMenu } from './components/ContextMenu';\nimport { DraggablePanel } from './components/DraggablePanel';"
    );
}

// 2. 修改 PlanAnalysis3D.jsx 引入 DraggablePanel
if (!code3D.includes("import { DraggablePanel }")) {
    code3D = code3D.replace(
        "import { ArtisticCompass } from './ArtisticCompass';",
        "import { ArtisticCompass } from './ArtisticCompass';\nimport { DraggablePanel } from './DraggablePanel';"
    );
}

// 3. 修改 PlanAnalysis3D.jsx 中最外層的佈局，讓畫布滿版，並將 Project Summary 包進 DraggablePanel
// 首先找到 2962 行附近的 isSummaryOpen 的那個 div
const searchStr = '<div className={`col-span-1 md:col-span-1 transition-all duration-500 ease-in-out border-l theme-border theme-bg flex flex-col num-font z-10 relative overflow-hidden ${isMobile ? (isSummaryOpen ? \'fixed inset-y-0 right-0 w-[85%] max-w-[360px] shadow-2xl\' : \'fixed inset-y-0 right-0 w-0\') : (isSummaryOpen ? \'w-full opacity-100\' : \'w-0 opacity-0 border-none\')}`}>';

if (code3D.includes(searchStr)) {
    const replacementStr = `{isSummaryOpen && (
                <DraggablePanel title="專案摘要 (Project Summary)" onClose={() => setShowSummaryPanel(false)} defaultSize={{w: 360, h: 'auto'}}>
                    <div className="flex flex-col num-font overflow-y-auto">
`;
    code3D = code3D.replace(searchStr, replacementStr);
    
    // 將後面的 </div> 補齊。
    // 在原本的代碼中，<div className="flex-1 overflow-y-auto p-6"> 是接著的，然後一直到檔案底部
    // 我們需要把最後的 </div></div> 換成 </div></DraggablePanel>
    
    // 尋找最後的回傳結尾
    //   </div>
    // </div>
    // );
    const endStr = `                </div>
            </div>
        </div>
    );
};`;
    const newEndStr = `                </div>
                </DraggablePanel>
            )}
        </div>
    );
};`;
    code3D = code3D.replace(endStr, newEndStr);
}

// 修正最外層的 className 讓畫布永遠佔滿
code3D = code3D.replace(
    '<div className={`w-full h-full flex flex-col md:flex-row theme-bg ${isDarkMode ? \'dark\' : \'\'} ${isLandscapeMode ? \'landscape-mode\' : \'\'}`}>',
    '<div className={`w-full h-full relative theme-bg ${isDarkMode ? \'dark\' : \'\'} ${isLandscapeMode ? \'landscape-mode\' : \'\'}`}>'
);

// 修正畫布區塊的 className 讓它滿版
code3D = code3D.replace(
    '<div className={`flex-1 relative transition-all duration-500 ease-in-out z-0 overflow-hidden ${isSummaryOpen && !isMobile ? \'md:w-3/4\' : \'w-full\'}`}>',
    '<div className={`absolute inset-0 z-0 overflow-hidden`}>'
);

// 4. 天地消線 (Sky & Ground) 實作
// 在 scene 的初始化中，加一個 Scene background 與霧氣
const sceneRegex = /const scene = new THREE\.Scene\(\);/;
const sceneReplacement = `const scene = new THREE.Scene();
        // 天地消線：利用背景顏色與霧氣模擬 SketchUp 風格
        if (isDarkMode) {
            scene.background = new THREE.Color('#1e1e24'); // 夜空色
            scene.fog = new THREE.Fog('#1e1e24', 50, 150);
        } else {
            scene.background = new THREE.Color('#d9e6f2'); // 晴空藍色
            scene.fog = new THREE.Fog('#d9e6f2', 50, 150);
        }
        
        // 加上一塊無限大的地平面 (Ground plane) 以遮蔽下方的天空色
        const groundGeo = new THREE.PlaneGeometry(1000, 1000);
        const groundMat = new THREE.MeshBasicMaterial({ 
            color: isDarkMode ? 0x111115 : 0xf0f0f0, 
            depthWrite: false 
        });
        const groundMesh = new THREE.Mesh(groundGeo, groundMat);
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.position.y = -0.05; // 稍微低於 0，避免 z-fighting
        groundMesh.renderOrder = -1; // 最先渲染
        scene.add(groundMesh);
`;

if (code3D.includes("const scene = new THREE.Scene();") && !code3D.includes("scene.fog = new THREE.Fog")) {
    code3D = code3D.replace("const scene = new THREE.Scene();", sceneReplacement);
}

// 修改 toggleDarkMode 的 effect，讓天地色能切換
const darkEffectRegex = /useEffect\(\(\) => \{\s*if \(!mountRef\.current\) return;\s*const scene = mountRef\.current\.children\[0\];/;
const darkEffectReplacement = `useEffect(() => {
        if (!mountRef.current) return;
        const scene = mountRef.current.children[0];
        if (scene && scene.isScene) {
            if (isDarkMode) {
                scene.background = new THREE.Color('#1e1e24');
                if (scene.fog) scene.fog.color.set('#1e1e24');
            } else {
                scene.background = new THREE.Color('#d9e6f2');
                if (scene.fog) scene.fog.color.set('#d9e6f2');
            }
            scene.children.forEach(child => {
                if (child.geometry && child.geometry.type === 'PlaneGeometry' && child.scale.x === 1) {
                    if (child.material && child.material.depthWrite === false) {
                        child.material.color.set(isDarkMode ? 0x111115 : 0xf0f0f0);
                    }
                }
            });
        }
    `;

if (code3D.includes("if (!mountRef.current) return;\n        const scene = mountRef.current.children[0];") && !code3D.includes("scene.background = new THREE.Color('#1e1e24');")) {
    code3D = code3D.replace("if (!mountRef.current) return;\n        const scene = mountRef.current.children[0];", "if (!mountRef.current) return;\n        const scene = mountRef.current.children[0];\n        if (scene && scene.isScene) {\n            if (isDarkMode) {\n                scene.background = new THREE.Color('#1e1e24');\n                if (scene.fog) scene.fog.color.set('#1e1e24');\n            } else {\n                scene.background = new THREE.Color('#d9e6f2');\n                if (scene.fog) scene.fog.color.set('#d9e6f2');\n            }\n            scene.children.forEach(child => {\n                if (child.geometry && child.geometry.type === 'PlaneGeometry') {\n                    if (child.material && child.material.depthWrite === false) {\n                        child.material.color.set(isDarkMode ? 0x111115 : 0xf0f0f0);\n                    }\n                }\n            });\n        }\n");
}


// 5. 確保網格線關閉 (GridHelper 取消)
if (code3D.includes("const gridHelper = new THREE.GridHelper")) {
    code3D = code3D.replace(
        "const gridHelper = new THREE.GridHelper(100, 100, isDarkMode ? 0x444444 : 0xcccccc, isDarkMode ? 0x222222 : 0xeeeeee);\n        scene.add(gridHelper);",
        "// 網格線依使用者要求取消顯示\n        // const gridHelper = new THREE.GridHelper(100, 100, isDarkMode ? 0x444444 : 0xcccccc, isDarkMode ? 0x222222 : 0xeeeeee);\n        // scene.add(gridHelper);"
    );
}

// 將修改寫回
fs.writeFileSync(pathApp, codeApp, 'utf8');
fs.writeFileSync(path3D, code3D, 'utf8');

console.log('App.jsx & PlanAnalysis3D.jsx patched successfully.');
