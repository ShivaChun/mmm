import { useMemo } from 'react';
import { useFloorStore } from '../store/floorStore';
import { calculatePolygonArea, scalePolygon } from '../utils/polygon';
import { toPing } from '../utils/geometry';

export function useSiteAnalysis(lots, inputs, params, overrides) {
    const { layerData, setFloorSettings } = useFloorStore();

    const totalBaseArea = useMemo(() => lots.reduce((acc, curr) => acc + curr.area, 0), [lots]);

    const results = useMemo(() => {
        const base = inputs.baseArea || totalBaseArea;
        const maxBuildingArea = base * (inputs.coverageRatio / 100);
        const statutoryFA = base * (inputs.floorRatio / 100);
        const exempt15 = statutoryFA * (params.exemptRate / 100);
        const exemptStair = statutoryFA * (params.stairRate / 100);
        const exemptIndoor = exempt15 + exemptStair;
        const balcony = statutoryFA * (params.balconyRate / 100);
        const incentive = parseFloat(inputs.incentiveArea) || 0;
        const transfer = parseFloat(inputs.transferArea) || 0;
        const permittedIndoor = statutoryFA + exemptIndoor + incentive + transfer;
        const roofProtrusion = maxBuildingArea * 0.125 * 2;
        const basementAreaPerFloor = base * (inputs.excavationRatio / 100);
        const totalBasementArea = basementAreaPerFloor * inputs.floorsBelow;

        const statutoryParking = Math.floor((statutoryFA + incentive + transfer) / 150);
        const possibleParking = Math.floor(totalBasementArea / inputs.avgCarArea);

        const exemptBasement = statutoryParking * 40;

        const totalCFA = permittedIndoor + balcony + roofProtrusion;

        const efficiency = toPing(base) > 0 ? toPing(totalCFA + totalBasementArea) / toPing(base) : 0;

        const calculatedFloors = maxBuildingArea > 0 ? permittedIndoor / maxBuildingArea : 0;
        const floorsAbove = Math.ceil(calculatedFloors);
        const estimatedBudget = toPing(totalCFA + totalBasementArea) * params.pricePerPing;
        const fh1 = parseFloat(inputs.floorHeight1F) || 0;
        const fhO = parseFloat(inputs.floorHeightOther) || 0;
        const buildingHeight = fh1 + (fhO * Math.max(0, floorsAbove - 1)) + 9;
        const mainRoad = inputs.roads.find(r => r.type === 'primary') || inputs.roads[0];
        const roadWidth = mainRoad ? parseFloat(mainRoad.width) : 0;
        const frontYard = parseFloat(inputs.frontYardDepth) || 0;
        const backYard = parseFloat(inputs.backYardDepth) || 0;
        const heightRatio = (roadWidth + frontYard) > 0 ? buildingHeight / (roadWidth + frontYard) : 0;
        const backyardDepthRatio = backYard > 0 ? buildingHeight / backYard : 0;
        const isHighRise = buildingHeight > 24;
        const isSuperHighRise = buildingHeight > 100;
        const weiLaoRatio = (0.5 * roadWidth + frontYard) > 0 ? 5 / (0.5 * roadWidth + frontYard) : 0;

        return { base, maxBuildingArea, statutoryFA, exempt15, exemptStair, exemptIndoor, balcony, permittedIndoor, roofProtrusion, basementAreaPerFloor, totalBasementArea, totalCFA, efficiency, statutoryParking, possibleParking, calculatedFloors, floorsAbove, estimatedBudget, buildingHeight, heightRatio, backyardDepthRatio, isHighRise, isSuperHighRise, weiLaoRatio, exemptBasement };
    }, [inputs, totalBaseArea, params]);

    const finalRes = useMemo(() => ({ ...results, ...overrides }), [results, overrides]);

    const handleAutoDistributeUnusedArea = (unusedArea) => {
        const remainingTotal = Math.max(0, unusedArea);
        if (remainingTotal <= 0.1) return;
        const layerMap = new Map();
        layerData.forEach(layer => {
            if (/^\d+F$/.test(layer.id)) layerMap.set(layer.id, layer);
        });
        const candidateIds = Array.from(layerMap.keys()).sort((a, b) => parseInt(a) - parseInt(b));
        if (candidateIds.length === 0) return;
        const slackById = new Map();
        candidateIds.forEach(id => {
            const layer = layerMap.get(id);
            const maxArea = Math.max(0, layer?.maxGeometricArea || 0);
            const currentArea = Math.max(0, layer?.realArea || 0);
            const slack = Math.max(0, maxArea - currentArea);
            if (slack > 0.1) slackById.set(id, slack);
        });
        const activeCandidates = Array.from(slackById.keys());
        if (activeCandidates.length === 0) return;
        const allocations = {};
        let remaining = remainingTotal;
        let active = activeCandidates.slice();
        let guard = 0;
        while (remaining > 0.01 && active.length > 0 && guard < 10) {
            const per = remaining / active.length;
            const next = [];
            active.forEach(id => {
                const slack = (slackById.get(id) || 0) - (allocations[id] || 0);
                const add = Math.min(slack, per);
                if (add > 0) {
                    allocations[id] = (allocations[id] || 0) + add;
                    remaining -= add;
                }
                if (slack - add > 0.01) next.push(id);
            });
            active = next;
            guard += 1;
        }
        const floorEntries = Object.entries(allocations).filter(([, v]) => v > 0.01);
        if (floorEntries.length === 0) return;
        setFloorSettings(prev => {
            const next = { ...prev };
            floorEntries.forEach(([id, addArea]) => {
                const layer = layerMap.get(id);
                if (!layer) return;
                const currentArea = Math.max(0, layer.realArea || 0);
                const newArea = currentArea + addArea;
                const current = next[id] || {};
                if (layer.points && layer.points.length >= 3) {
                    const basePoints = current.points || layer.points;
                    const baseCurves = current.curves || layer.curves || null;
                    const baseArea = calculatePolygonArea(basePoints);
                    if (baseArea > 0) {
                        const scaleRate = Math.sqrt(newArea / baseArea);
                        const scaled = scalePolygon(basePoints, baseCurves, scaleRate);
                        next[id] = { ...current, points: scaled.points, curves: scaled.curves, area: newArea, manualArea: true, manualDim: false };
                        delete next[id].width;
                        delete next[id].depth;
                    }
                } else {
                    const baseW = current.width || layer.realWidth || 0;
                    const baseD = current.depth || layer.realDepth || 0;
                    const baseArea = baseW * baseD;
                    if (baseArea > 0) {
                        const scaleRate = Math.sqrt(newArea / baseArea);
                        const width = baseW * scaleRate;
                        const depth = baseD * scaleRate;
                        next[id] = { ...current, width, depth, manualDim: true, manualArea: false, area: width * depth };
                        delete next[id].points;
                        delete next[id].curves;
                    }
                }
            });
            return next;
        });
    };

    return { totalBaseArea, results, finalRes, handleAutoDistributeUnusedArea };
}
