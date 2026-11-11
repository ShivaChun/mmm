import { useMemo } from 'react';
import { toPing } from '../utils/geometry';

/**
 * Compute site-analysis results for a single site.
 * Same logic as useSiteAnalysis but pure-function form (no React hooks inside).
 */
function computeSiteResults(lots, inputs, params) {
    const totalBaseArea = lots.reduce((acc, curr) => acc + curr.area, 0);
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

    return {
        totalBaseArea, base, maxBuildingArea, statutoryFA, exempt15, exemptStair, exemptIndoor,
        balcony, permittedIndoor, roofProtrusion, basementAreaPerFloor, totalBasementArea,
        totalCFA, efficiency, statutoryParking, possibleParking, calculatedFloors, floorsAbove,
        estimatedBudget, buildingHeight, heightRatio, backyardDepthRatio, isHighRise,
        isSuperHighRise, weiLaoRatio, exemptBasement
    };
}

/**
 * Hook for multi-site analysis.
 * @param {Array} sites - array of { id, name, lots, inputs, overrides, position }
 * @param {Object} params - shared params (exemptRate, stairRate, balconyRate, pricePerPing)
 * @returns {{ siteResults: Array, combined: Object }}
 */
export function useMultiSiteAnalysis(sites, params) {
    const siteResults = useMemo(() => {
        return sites.map(site => {
            const results = computeSiteResults(site.lots, site.inputs, params);
            const finalRes = { ...results, ...site.overrides };
            return {
                siteId: site.id,
                siteName: site.name,
                totalBaseArea: results.totalBaseArea,
                results,
                finalRes,
            };
        });
    }, [sites, params]);

    const combined = useMemo(() => {
        const totalBase = siteResults.reduce((acc, s) => acc + s.finalRes.base, 0);
        const totalMaxBuildingArea = siteResults.reduce((acc, s) => acc + s.finalRes.maxBuildingArea, 0);
        const totalStatutoryFA = siteResults.reduce((acc, s) => acc + s.finalRes.statutoryFA, 0);
        const totalPermittedIndoor = siteResults.reduce((acc, s) => acc + s.finalRes.permittedIndoor, 0);
        const totalCFA = siteResults.reduce((acc, s) => acc + s.finalRes.totalCFA, 0);
        const totalBasementArea = siteResults.reduce((acc, s) => acc + s.finalRes.totalBasementArea, 0);
        const totalStatutoryParking = siteResults.reduce((acc, s) => acc + s.finalRes.statutoryParking, 0);
        const totalPossibleParking = siteResults.reduce((acc, s) => acc + s.finalRes.possibleParking, 0);
        const totalEstimatedBudget = siteResults.reduce((acc, s) => acc + s.finalRes.estimatedBudget, 0);
        const avgEfficiency = toPing(totalBase) > 0 ? toPing(totalCFA + totalBasementArea) / toPing(totalBase) : 0;

        return {
            totalBase,
            totalMaxBuildingArea,
            totalStatutoryFA,
            totalPermittedIndoor,
            totalCFA,
            totalBasementArea,
            totalStatutoryParking,
            totalPossibleParking,
            totalEstimatedBudget,
            avgEfficiency,
            siteCount: sites.length,
        };
    }, [siteResults]);

    return { siteResults, combined };
}
