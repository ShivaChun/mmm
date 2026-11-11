const fs = require('fs');
let code = fs.readFileSync('src/components/PlanAnalysis3D.jsx', 'utf8');

// 1. Remove duplicate useEffect and floorLayers definitions
const badStr1 = `    useEffect(() => { if (selectedFloor) { const layer = massingLayers.layers.find(l => l.id === selectedFloor.id); if (layer) { setSelectedFloor({ ...layer, rotation: floorSettings[layer.id]?.rotation || 0, pivot: floorSettings[layer.id]?.pivot || { x: 0, y: 0 }, alignment: floorSettings[layer.id]?.alignment || { x: 'left', y: 'back' }, violations: layer.violations, points: floorSettings[layer.id]?.points || null, curves: floorSettings[layer.id]?.curves || null }); } } }, [floorSettings, isConstraintMode]);

    const floorLayers = massingLayers.layers;
    const colors = { bg: isDarkMode ? "#0f172a" : "#fafaf9", grid: isDarkMode ? "linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)" : "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)", floor: showCheckLines ? (isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.3)") : (isDarkMode ? "rgba(255, 255, 255, 0.9)" : "#ffffff"), stroke: showCheckLines ? "#fb923c" : (isDarkMode ? "#94a3b8" : "#a8a29e") };
    const visualTotalH_Px = massingLayers.totalHeight * scale;
    const visualFloorsAbove = massingLayers.totalFloors;
    const floorsAboveValue = manualFloorsOverride !== null ? manualFloorsOverride : (parseFloat(inputs.floorsAbove || 0) || res.floorsAbove);
    const totalAreaViolation = massingLayers.currentTotalUsed > volumeLimit;
    const unusedArea = massingLayers.remainingArea;

`;

code = code.replace(badStr1, "");

// 2. Fix broken useEffect that misses the if statement
const badStr2 = `    useEffect(() => {
        } else if (showUnusedPrompt) {
            setShowUnusedPrompt(false);
        }
    }, [unusedArea, visualFloorsAbove, inputs.floorsBelow, res.totalCFA, unusedPromptKey, showUnusedPrompt]);`;

const goodStr2 = `    useEffect(() => {
        if (unusedArea > 0.1 && visualFloorsAbove > 0) {
            if (!showUnusedPrompt) setShowUnusedPrompt(true);
        } else if (showUnusedPrompt) {
            setShowUnusedPrompt(false);
        }
    }, [unusedArea, visualFloorsAbove, inputs.floorsBelow, res.totalCFA, unusedPromptKey, showUnusedPrompt]);`;

code = code.replace(badStr2, goodStr2);

// 3. Remove trailing broken duplication
const badStr3 = `            setShowUnusedPrompt(false);
        }
    }, [unusedArea, visualFloorsAbove, inputs.floorsBelow, res.totalCFA, unusedPromptKey, showUnusedPrompt]);

    // Pre-calculate Normalized Base Points for the entire visualization context
    // This ensures all layers share the same "Site Center" origin.
    // OLD: const normalizedBasePoints = useMemo(...) -> Replaced by normalizedData above`;

code = code.replace(badStr3, `    // Pre-calculate Normalized Base Points for the entire visualization context
    // This ensures all layers share the same "Site Center" origin.
    // OLD: const normalizedBasePoints = useMemo(...) -> Replaced by normalizedData above`);

fs.writeFileSync('src/components/PlanAnalysis3D.jsx', code);
console.log('Fixed duplication 6!');
