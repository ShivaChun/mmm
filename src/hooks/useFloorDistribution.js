import { useFloorStore } from '../store/floorStore';
import { calculatePolygonArea, offsetPolygon, getPolygonCentroid, getSegmentNormal, discretizePolygon, clipPolygonByPolygon, scalePolygon, normalizeWithCurves, fitPolygonWithin, allInsidePolygon, getSplitUnits } from '../utils/polygon';
import { createSeededRandom } from '../utils/random';

export function useFloorDistribution({
    res, activeBasementArea, targetFloorsAbove, minRandomAreaM2, backM, baseDepthM, frontM, baseWidthM, sideM, roadW_M, inputs, normalizedData, byRatio, arcadeM, sideDir, isConstraintMode, showCheckLines, showHeightRatio, showWeiLao, showBackyard, showFallingCurve, unitSettings
}) {
    const { floorSettings, randomSlabEnabled, randomSlabSeed, edgeTypes, frontageIndices, manualFloorsOverride } = useFloorStore();
            const buildMassingLayers = (applyFallingCurve, fallingCurveValue) => {
                const layers = [];
                const limitCFA = res.totalCFA;
                const taxableBasementArea = Math.max(0, activeBasementArea - res.exemptBasement);
                const availableForSuperstructure = Math.max(0, limitCFA - taxableBasementArea);

                let remainingAreaM2 = availableForSuperstructure;

                let currentZM = 0;
                let floorCount = 0;
                let currentTotalUsed = taxableBasementArea;

                const fullFloorsTarget = Math.floor(targetFloorsAbove);
                const isFloorConfigSet = manualFloorsOverride !== null;
                const fractionalFloorRatio = Math.max(0, targetFloorsAbove - fullFloorsTarget);
                const maxSimulatedFloors = Math.min(targetFloorsAbove, 100);
                const targetFloorsInt = Math.max(1, Math.round(targetFloorsAbove || 1));

                let actualMinRandomArea = minRandomAreaM2;
                if (manualFloorsOverride !== null) {
                    actualMinRandomArea = Math.min(minRandomAreaM2, availableForSuperstructure / targetFloorsInt);
                }
                const minRandomTotal = actualMinRandomArea * targetFloorsInt;
                const useRandomSizes = randomSlabEnabled && (availableForSuperstructure >= minRandomTotal || manualFloorsOverride !== null);
                const randomFn = useRandomSizes ? createSeededRandom(randomSlabSeed || 1) : null;
                const buildBackM = backM;
                const buildFrontM = baseDepthM - frontM;
                const buildWidthM = Math.max(0, baseWidthM - sideM);
                const originHeightRatioY = baseDepthM + roadW_M;
                const originWeiLaoY = baseDepthM + roadW_M / 2;

                // 1. Identify Front/Side indices strictly from Roads configuration (Source of Truth)
                const primaryIndices = new Set();
                const secondaryIndices = new Set();

                if (inputs.roads) {
                    inputs.roads.forEach(r => {
                        const indices = new Set();
                        if (r.edgeIndices) r.edgeIndices.forEach(i => indices.add(i));
                        if (r.edgeIndex !== undefined && r.edgeIndex !== "") indices.add(parseInt(r.edgeIndex));

                        if (r.type === 'primary') {
                            indices.forEach(i => primaryIndices.add(i));
                        } else {
                            indices.forEach(i => secondaryIndices.add(i));
                        }
                    });
                }

                const effectiveFrontIndices = new Set();

                // LOGIC FIX: Prioritize Roads over manual frontageIndices state
                if (primaryIndices.size > 0) {
                    primaryIndices.forEach(i => effectiveFrontIndices.add(i));
                } else if (secondaryIndices.size > 0) {
                    secondaryIndices.forEach(i => effectiveFrontIndices.add(i));
                } else if (frontageIndices && frontageIndices.size > 0) {
                    // Only fallback to manual state if no roads define edges
                    frontageIndices.forEach(i => effectiveFrontIndices.add(i));
                }

                // Prepare combined edge types (Secondary -> Side)
                const combinedEdgeTypes = { ...edgeTypes };
                secondaryIndices.forEach(idx => {
                    if (!effectiveFrontIndices.has(idx) && !combinedEdgeTypes[idx]) {
                        combinedEdgeTypes[idx] = 'side';
                    }
                });

                // --- Auto-Detect Back/Side Edges Logic (Sync with CheckLines) ---
                // 使用標準化數據確保計算一致性 (Use normalized data for consistency)
                if (normalizedData.points && normalizedData.points.length > 2) {
                    const normPoints = normalizedData.points;
                    const discretized = discretizePolygon(normPoints, normalizedData.curves, 20);
                    const workingPoints = discretized.points;
                    const workingEdgeIndices = discretized.edgeMap;
                    const centroid = getPolygonCentroid(workingPoints);

                    let frontNormal = { x: 0, y: 0 };
                    let count = 0;

                    workingPoints.forEach((p, i) => {
                        const orig = workingEdgeIndices[i];
                        if (effectiveFrontIndices.has(orig)) {
                            const p2 = workingPoints[(i + 1) % workingPoints.length];
                            const n = getSegmentNormal(p, p2, centroid);
                            frontNormal.x += n.x;
                            frontNormal.y += n.y;
                            count++;
                        }
                    });

                    if (count > 0) {
                        const len = Math.sqrt(frontNormal.x * frontNormal.x + frontNormal.y * frontNormal.y);
                        if (len > 0) {
                            frontNormal.x /= len; frontNormal.y /= len;

                            const hasExplicitBack = Object.values(combinedEdgeTypes).includes('back');
                            if (!hasExplicitBack) {
                                workingPoints.forEach((p, i) => {
                                    const origIdx = workingEdgeIndices[i];
                                    if (!effectiveFrontIndices.has(origIdx) && !combinedEdgeTypes[origIdx]) {
                                        const p2 = workingPoints[(i + 1) % workingPoints.length];
                                        const n = getSegmentNormal(p, p2, centroid);
                                        const dot = n.x * frontNormal.x + n.y * frontNormal.y;
                                        if (dot < -0.5) {
                                            combinedEdgeTypes[origIdx] = 'back';
                                        }
                                    }
                                });
                            }

                            const hasExplicitSide = Object.values(combinedEdgeTypes).includes('side');
                            if (!hasExplicitSide && sideM > 0) {
                                const desiredSign = sideDir === 'left' ? 1 : -1;
                                const candidates = [];
                                workingPoints.forEach((p, i) => {
                                    const origIdx = workingEdgeIndices[i];
                                    if (effectiveFrontIndices.has(origIdx) || combinedEdgeTypes[origIdx]) return;
                                    const p2 = workingPoints[(i + 1) % workingPoints.length];
                                    const n = getSegmentNormal(p, p2, centroid);
                                    const dot = n.x * frontNormal.x + n.y * frontNormal.y;
                                    const cross = frontNormal.x * n.y - frontNormal.y * n.x;
                                    candidates.push({ origIdx, dot, cross });
                                });
                                let selected = candidates.filter(c => Math.abs(c.dot) < 0.3 && desiredSign * c.cross > 0);
                                if (selected.length === 0) {
                                    selected = candidates.filter(c => desiredSign * c.cross > 0).sort((a, b) => Math.abs(a.dot) - Math.abs(b.dot));
                                }
                                selected.forEach(c => { combinedEdgeTypes[c.origIdx] = 'side'; });
                            }
                        }
                    }
                }
                // -----------------------------------------------------------

                const oneFFrontM = arcadeM > 0 ? Math.max(frontM, arcadeM) : frontM;
                let oneFFootprint = null;
                if (normalizedData.points) {
                    const res = offsetPolygon(normalizedData.points, combinedEdgeTypes, { front: oneFFrontM, back: backM, side: sideM }, effectiveFrontIndices, normalizedData.curves);
                    oneFFootprint = res ? res.points : null;
                }
                const oneFFootprintArea = oneFFootprint ? calculatePolygonArea(oneFFootprint) : 0;
                const projectionBoxWidthM = Math.max(0, baseWidthM - sideM);
                const projectionBoxDepthM = Math.max(0, baseDepthM - oneFFrontM - backM);
                const projectionBoxArea = projectionBoxWidthM * projectionBoxDepthM;
                const shouldClampToProjection = isConstraintMode || (showCheckLines && (showHeightRatio || showWeiLao || showBackyard || showFallingCurve));
                const projectionAreaLimit = normalizedData.points ? oneFFootprintArea : projectionBoxArea;
                let firstFloorFinalArea = null;

                // Fix: Strict Area/Floor limit check to avoid generating unused residual areas
                while ((remainingAreaM2 > 0.1 || floorCount < targetFloorsAbove || (randomSlabEnabled && isFloorConfigSet && floorCount < targetFloorsAbove)) && floorCount < maxSimulatedFloors) {
                    if (currentTotalUsed >= limitCFA - 0.1 && (!isFloorConfigSet || floorCount >= targetFloorsAbove)) break;
                    if (currentTotalUsed >= limitCFA && isFloorConfigSet && randomSlabEnabled) break; // Hard stop limit

                    if (remainingAreaM2 <= 0.1 && !isFloorConfigSet) break;
                    const floorId = `${floorCount + 1}F`;
                    const settings = floorSettings[floorId] || {};
                    const h = (floorCount === 0) ? (parseFloat(inputs.floorHeight1F) || 4.2) : (parseFloat(inputs.floorHeightOther) || 3.6);

                    // IMPORTANT: Check constraints at the TOP of the current floor
                    const checkZ = currentZM + h;

                    // --- Dynamic Setback Calculation ---
                    let currentFrontM = frontM;
                    let effectiveBackM = backM;
                    let effectiveSideM = sideM;

                    // Base Setbacks (Without Review Lines) for comparison
                    let baseFrontM = frontM;
                    let baseBackM = backM;

                    // Arcade handling
                    if (floorCount === 0 && arcadeM > 0) {
                        currentFrontM = Math.max(currentFrontM, arcadeM);
                        baseFrontM = Math.max(baseFrontM, arcadeM);
                    }

                    if (isConstraintMode || showCheckLines) {
                        if (showHeightRatio && byRatio <= 0) {
                            const reqFrontHR = (checkZ / 3.6) - roadW_M;
                            if (reqFrontHR > currentFrontM) currentFrontM = reqFrontHR;
                        }
                        if (showWeiLao) {
                            const reqFrontWL = (checkZ / 5.0) - (roadW_M / 2);
                            if (reqFrontWL > currentFrontM) currentFrontM = reqFrontWL;
                        }
                    }

                    if ((isConstraintMode || showCheckLines) && byRatio > 0) {
                        const reqBack = checkZ / byRatio;
                        if (effectiveBackM < reqBack) effectiveBackM = reqBack;
                    }

                    const requireFallingCurve = applyFallingCurve && checkZ > 50;
                    if (requireFallingCurve && fallingCurveValue > 0) {
                        if (currentFrontM < fallingCurveValue) currentFrontM = fallingCurveValue;
                        if (effectiveBackM < fallingCurveValue) effectiveBackM = fallingCurveValue;
                        if (effectiveSideM < fallingCurveValue) effectiveSideM = fallingCurveValue;
                    }

                    const maxBaseBackM = Math.max(0, baseDepthM - baseFrontM);
                    if (baseBackM > maxBaseBackM) baseBackM = maxBaseBackM;

                    const maxFrontM = Math.max(0, baseDepthM - baseBackM);
                    if (currentFrontM > maxFrontM) currentFrontM = maxFrontM;

                    const maxBackM = Math.max(0, baseDepthM - currentFrontM);
                    if (effectiveBackM > maxBackM) effectiveBackM = maxBackM;

                    // Recalculate polygon OR Box dimensions based on dynamic setbacks
                    let floorPolygon = null;
                    let floorPolygonArea = 0;

                    // Calculate Static Polygon (Before Review Cuts) for Unused Area display
                    let staticPolygon = null;
                    let staticArea = 0;

                    // --- Box Mode Calculation Variables ---
                    let boxWidthM = 0;
                    let boxDepthM = 0;
                    let shiftX_M = 0;
                    let shiftY_M = 0;

                    if (normalizedData.points) {
                        // Polygon Mode
                        // 1. Calculate Actual Floor (Dynamic)
                        if (isConstraintMode || (showCheckLines && byRatio > 0) || currentFrontM > frontM || effectiveBackM > backM || effectiveSideM > sideM || (floorCount === 0 && arcadeM > 0)) {
                            const res = offsetPolygon(normalizedData.points, combinedEdgeTypes, { front: currentFrontM, back: effectiveBackM, side: effectiveSideM }, effectiveFrontIndices, normalizedData.curves);
                            floorPolygon = res ? res.points : null;
                        } else {
                            floorPolygon = oneFFootprint; // Reuse 1F if no change
                        }
                        floorPolygonArea = floorPolygon ? calculatePolygonArea(floorPolygon) : 0;

                        // 2. Calculate Static Floor (Base Constraints Only)
                        if (currentFrontM > baseFrontM || effectiveBackM > baseBackM || effectiveSideM > sideM) {
                            const staticRes = offsetPolygon(normalizedData.points, combinedEdgeTypes, { front: baseFrontM, back: baseBackM, side: sideM }, effectiveFrontIndices, normalizedData.curves);
                            staticPolygon = staticRes ? staticRes.points : null;
                            staticArea = staticPolygon ? calculatePolygonArea(staticPolygon) : 0;
                        } else {
                            staticPolygon = floorPolygon;
                            staticArea = floorPolygonArea;
                        }
                        if (shouldClampToProjection && oneFFootprint) {
                            staticPolygon = oneFFootprint;
                            staticArea = oneFFootprintArea;
                        }
                    } else {
                        // Box Mode
                        // Dynamic
                        boxWidthM = Math.max(0, baseWidthM - effectiveSideM);
                        boxDepthM = Math.max(0, baseDepthM - currentFrontM - effectiveBackM);
                        if (shouldClampToProjection && projectionBoxDepthM > 0 && boxDepthM > projectionBoxDepthM) {
                            boxDepthM = projectionBoxDepthM;
                        }
                        floorPolygonArea = boxWidthM * boxDepthM;

                        // Static
                        const staticDepthM = Math.max(0, baseDepthM - baseFrontM - baseBackM);
                        staticArea = boxWidthM * staticDepthM;
                        if (shouldClampToProjection && projectionBoxArea > 0) {
                            staticArea = projectionBoxArea;
                        }
                        // We don't have points for Box Mode easily without generating rects, 
                        // but BuildingLayer handles box mode via width/depth.
                        // We can pass `staticDepth` to layer.

                        // Calculate Shift for Box (Relative to Center)
                        shiftY_M = (effectiveBackM - currentFrontM) / 2;

                        // X Shift: Based on Side Direction
                        if (sideDir === 'left') shiftX_M = effectiveSideM / 2;
                        else if (sideDir === 'right') shiftX_M = -effectiveSideM / 2;
                    }

                    let allowedPolygon = floorPolygon;
                    if (staticPolygon && allowedPolygon) {
                        allowedPolygon = clipPolygonByPolygon(staticPolygon, allowedPolygon);
                    }
                    if (floorCount > 0 && firstFloorFinalArea && allowedPolygon) {
                        allowedPolygon = clipPolygonByPolygon(allowedPolygon, firstFloorFinalArea);
                    }
                    if (allowedPolygon !== floorPolygon) {
                        floorPolygon = allowedPolygon;
                        floorPolygonArea = floorPolygon ? calculatePolygonArea(floorPolygon) : 0;
                    }

                    const coverageLimit = parseFloat(res.maxBuildingArea) || 0;
                    let maxFloorAreaM2 = coverageLimit > 0 ? Math.min(floorPolygonArea, coverageLimit) : floorPolygonArea;
                    if (shouldClampToProjection && projectionAreaLimit > 0) {
                        maxFloorAreaM2 = Math.min(maxFloorAreaM2, projectionAreaLimit);
                    }

                    // Task 2: Do not generate tiny fragments (Unused Area rule), unless we MUST generate the target number of floors
                    if (maxFloorAreaM2 <= 3.0 && !settings.manualDim && !settings.manualArea) {
                        const mustGenerateMore = randomSlabEnabled && isFloorConfigSet && floorCount < targetFloorsAbove;
                        if (!mustGenerateMore) {
                            break;
                        }
                    }

                    let visualWidthM = boxWidthM;
                    let visualDepthM = boxDepthM;
                    let rotation = settings.rotation || 0;
                    let usedAreaM2 = 0;

                    const useEvenArea = manualFloorsOverride !== null && targetFloorsAbove > 0 && !randomSlabEnabled;
                    const evenAreaPerFloor = useEvenArea ? (availableForSuperstructure / targetFloorsAbove) : null;
                    // Determine Area Usage
                    if (settings.manualDim && settings.width !== undefined && settings.depth !== undefined) {
                        visualWidthM = settings.width; visualDepthM = settings.depth; usedAreaM2 = visualWidthM * visualDepthM;
                    }
                    else if (settings.manualArea && settings.area !== undefined) {
                        usedAreaM2 = settings.area;
                    }
                    else {
                        if (useEvenArea && Number.isFinite(evenAreaPerFloor)) {
                            const perFloorAreaCap = Math.min(maxFloorAreaM2, evenAreaPerFloor);
                            usedAreaM2 = Math.min(remainingAreaM2, perFloorAreaCap);
                        } else if (useRandomSizes && randomFn) {
                            const isFractionalFloor = fractionalFloorRatio > 0 && floorCount === fullFloorsTarget;
                            const perFloorAreaCap = isFractionalFloor ? maxFloorAreaM2 * fractionalFloorRatio : maxFloorAreaM2;

                            let currentMin = minRandomAreaM2;
                            if (manualFloorsOverride !== null) {
                                currentMin = Math.min(minRandomAreaM2, availableForSuperstructure / Math.max(1, targetFloorsAbove));
                            }
                            const minAllowed = Math.min(currentMin, perFloorAreaCap);

                            const mustGenerateMore = randomSlabEnabled && isFloorConfigSet && floorCount < targetFloorsAbove;
                            let randArea = minAllowed + (perFloorAreaCap - minAllowed) * randomFn();

                            if (mustGenerateMore && remainingAreaM2 <= minAllowed) {
                                // Strictly cap borrow amount so we do not exceed total CFA
                                const maxBorrowable = limitCFA - currentTotalUsed;
                                usedAreaM2 = Math.min(randArea, maxBorrowable);
                            } else {
                                usedAreaM2 = Math.min(remainingAreaM2, randArea);
                            }
                        } else {
                            const isFractionalFloor = fractionalFloorRatio > 0 && floorCount === fullFloorsTarget;
                            const perFloorAreaCap = isFractionalFloor ? maxFloorAreaM2 * fractionalFloorRatio : maxFloorAreaM2;
                            usedAreaM2 = Math.min(remainingAreaM2, perFloorAreaCap);
                        }
                    }

                    if (shouldClampToProjection && projectionAreaLimit > 0) {
                        usedAreaM2 = Math.min(usedAreaM2, projectionAreaLimit);
                    }

                    if (isConstraintMode) {
                        usedAreaM2 = Math.min(usedAreaM2, maxFloorAreaM2);
                    }

                    // Calculate Final Geometry
                    let layerPoints = settings.points || null;
                    let layerCurves = settings.curves || null;

                    if (layerPoints && normalizedData.centroid) {
                        const c = normalizedData.centroid;
                        layerPoints = layerPoints.map(p => ({ x: p.x - c.x, y: p.y - c.y }));
                        if (layerCurves) {
                            const newC = {};
                            Object.keys(layerCurves).forEach(k => {
                                const cp = layerCurves[k];
                                newC[k] = { x: cp.x - c.x, y: cp.y - c.y };
                            });
                            layerCurves = newC;
                        }
                    }

                    if (useRandomSizes && layerPoints && !settings.manualDim && !settings.manualArea && usedAreaM2 > 0) {
                        const baseArea = calculatePolygonArea(layerPoints);
                        if (baseArea > 0 && Math.abs(baseArea - usedAreaM2) > 0.01) {
                            const scaleRate = Math.sqrt(usedAreaM2 / baseArea);
                            const scaled = scalePolygon(layerPoints, layerCurves, scaleRate);
                            layerPoints = scaled.points;
                            layerCurves = scaled.curves;
                        }
                    }

                    if (layerPoints && shouldClampToProjection && oneFFootprint) {
                        const fitted = fitPolygonWithin(layerPoints, layerCurves, oneFFootprint);
                        layerPoints = fitted.points;
                        layerCurves = fitted.curves;
                        usedAreaM2 = Math.min(usedAreaM2, calculatePolygonArea(layerPoints));
                    }

                    if (!layerPoints && floorPolygon) {
                        layerPoints = floorPolygon;
                        // If we need to scale down (e.g. not enough remaining area)
                        if (usedAreaM2 < floorPolygonArea - 0.1) {
                            const scaleRate = Math.sqrt(usedAreaM2 / floorPolygonArea);
                            const polyCentroid = getPolygonCentroid(floorPolygon);
                            const { points: newPts, curves: newCurves } = scalePolygon(floorPolygon, null, scaleRate, polyCentroid);
                            layerPoints = newPts;
                            layerCurves = newCurves;
                        }
                        if (shouldClampToProjection && oneFFootprint) {
                            const fitted = fitPolygonWithin(layerPoints, layerCurves, oneFFootprint);
                            layerPoints = fitted.points;
                            layerCurves = fitted.curves;
                            const clampedArea = calculatePolygonArea(layerPoints);
                            usedAreaM2 = Math.min(usedAreaM2, clampedArea);
                        }
                    } else if (!layerPoints && !normalizedData.points) {
                        // Box Mode Scaling (if using less than max area)
                        const usageRatio = maxFloorAreaM2 > 0 ? usedAreaM2 / maxFloorAreaM2 : 0;
                        const scaleFactor = Math.sqrt(usageRatio);
                        visualWidthM = boxWidthM * scaleFactor;
                        visualDepthM = boxDepthM * scaleFactor;
                        const visualArea = visualWidthM * visualDepthM;
                        if (shouldClampToProjection && projectionAreaLimit > 0 && visualArea > projectionAreaLimit + 0.01) {
                            const scaleRate = Math.sqrt(projectionAreaLimit / visualArea);
                            visualWidthM *= scaleRate;
                            visualDepthM *= scaleRate;
                            usedAreaM2 = Math.min(usedAreaM2, projectionAreaLimit);
                        }
                    }

                    if (layerPoints && allowedPolygon) {
                        if (!allInsidePolygon(layerPoints, allowedPolygon)) {
                            layerPoints = clipPolygonByPolygon(layerPoints, allowedPolygon);
                            layerCurves = null;
                        }
                        if (layerPoints) {
                            usedAreaM2 = Math.min(usedAreaM2, calculatePolygonArea(layerPoints));
                        } else {
                            usedAreaM2 = 0;
                        }
                    }

                    if (floorCount === 0 && layerPoints) {
                        firstFloorFinalArea = layerPoints;
                    }

                    // Manual Offsets (User dragging)
                    const alignPref = settings.alignment || { x: 'left', y: 'back' };
                    const getOffsets = () => {
                        if (settings.offset) return settings.offset;
                        return { x: 0, y: 0 };
                    }
                    const userOff = getOffsets();

                    let finalShiftYPx, finalShiftX;
                    if (layerPoints) {
                        // Polygon Mode
                        finalShiftYPx = userOff.y * scale;
                        finalShiftX = userOff.x * scale;
                    } else {
                        // Box Mode: Combine calculated shift with user offset
                        finalShiftX = (shiftX_M * scale) + (settings.offset?.x || 0);
                        finalShiftYPx = (shiftY_M * scale) + (settings.offset?.y || 0);
                    }

                    const violations = [];

                    // Task 3: Unit Division Support
                    let splitUnits = null;
                    let isAutoSplit = false;

                    if (unitSettings?.enabled && floorPolygon) {
                        splitUnits = getSplitUnits(floorPolygon, unitSettings);
                        isAutoSplit = true;
                    } else if (settings.units && settings.units.length > 0) {
                        // Manual units
                        splitUnits = settings.units;
                    }

                    if (splitUnits && splitUnits.length > 0) {
                        splitUnits.forEach((uPts, uIdx) => {
                            let finalUPts = uPts;

                            const uArea = calculatePolygonArea(finalUPts);
                            const uUsed = Math.min(uArea, remainingAreaM2); // Cap by FAR

                            layers.push({
                                id: `${floorId}-${String.fromCharCode(65 + uIdx)}`, // A, B, C...
                                z: currentZM * scale,
                                height: h * scale,
                                widthPx: visualWidthM * scale,
                                depthPx: visualDepthM * scale,
                                shiftX: finalShiftX,
                                shiftYPx: finalShiftYPx,
                                rotation: rotation,
                                pivot: settings.pivot,
                                realArea: uUsed,
                                realWidth: visualWidthM, // Approx
                                realDepth: visualDepthM, // Approx
                                realHeight: h,
                                maxGeometricArea: uArea,
                                isViolation: violations.length > 0,
                                violations: violations,
                                points: finalUPts,
                                curves: null, // Curves not supported in split yet
                                staticPoints: null, // Manual mode implies no auto-ghosting
                                unusedReviewArea: 0
                            });

                            let areaToDeduct = uUsed;
                            if (randomSlabEnabled && isFloorConfigSet && remainingAreaM2 <= 0 && uUsed > 0) {
                                areaToDeduct = 0;
                            }
                            remainingAreaM2 -= areaToDeduct;
                            currentTotalUsed += uUsed;
                        });
                    } else {
                        layers.push({
                            id: floorId,
                            z: currentZM * scale,
                            height: h * scale,

                            widthPx: visualWidthM * scale,
                            depthPx: visualDepthM * scale,

                            shiftX: finalShiftX,
                            shiftYPx: finalShiftYPx,

                            rotation: rotation,
                            pivot: settings.pivot,
                            realArea: usedAreaM2,
                            realWidth: visualWidthM,
                            realDepth: visualDepthM,
                            realHeight: h,
                            maxGeometricArea: maxFloorAreaM2,
                            isViolation: violations.length > 0,
                            violations: violations,
                            points: layerPoints,
                            curves: layerCurves,

                            // Task 2 Data
                            staticPoints: staticPolygon,
                            unusedReviewArea: Math.max(0, staticArea - usedAreaM2)
                        });

                        let areaToDeduct = usedAreaM2;
                        if (randomSlabEnabled && isFloorConfigSet && remainingAreaM2 <= 0 && usedAreaM2 > 0) {
                            areaToDeduct = 0;
                        }
                        remainingAreaM2 -= areaToDeduct;
                        currentTotalUsed += usedAreaM2;
                    }
                    currentZM += h; floorCount++;
                }
                return { layers, totalFloors: floorCount, totalHeight: currentZM, currentTotalUsed, remainingArea: Math.max(0, remainingAreaM2) };
            };

    return { buildMassingLayers };
}
