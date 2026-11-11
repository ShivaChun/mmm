/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';

const FloorContext = createContext();

export function FloorProvider({ children }) {
    const [floorSettings, setFloorSettings] = useState({});
    const [selectedFloorId, setSelectedFloorId] = useState(null);
    const [selectedFloor, setSelectedFloor] = useState(null);
    const [layerData, setLayerData] = useState([]); // to store massingLayers result
    const [randomSlabEnabled, setRandomSlabEnabled] = useState(false);
    const [randomSlabSeed, setRandomSlabSeed] = useState(0);
    const [edgeTypes, setEdgeTypes] = useState({});
    const [frontageIndices, setFrontageIndices] = useState(new Set());
    const [manualFloorsOverride, setManualFloorsOverride] = useState(null);

    const value = {
        floorSettings,
        setFloorSettings,
        selectedFloorId,
        setSelectedFloorId,
        selectedFloor,
        setSelectedFloor,
        layerData,
        setLayerData,
        randomSlabEnabled,
        setRandomSlabEnabled,
        randomSlabSeed,
        setRandomSlabSeed,
        edgeTypes,
        setEdgeTypes,
        frontageIndices,
        setFrontageIndices,
        manualFloorsOverride,
        setManualFloorsOverride
    };

    return (
        <FloorContext.Provider value={value}>
            {children}
        </FloorContext.Provider>
    );
}

export function useFloorStore() {
    return useContext(FloorContext);
}
