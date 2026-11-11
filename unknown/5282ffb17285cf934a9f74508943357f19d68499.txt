import { useFloorStore } from '../store/floorStore';

export function useRandomShape() {
    const { randomSlabEnabled, setRandomSlabEnabled, setRandomSlabSeed } = useFloorStore();

    const handleToggleRandomSlab = () => {
        setRandomSlabEnabled(prev => !prev);
        setRandomSlabSeed(Date.now());
    };

    return { randomSlabEnabled, handleToggleRandomSlab };
}
