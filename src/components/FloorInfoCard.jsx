import React from 'react';
import { Layers, Map as MapIcon, Shovel, Undo2 } from 'lucide-react';
import { toPing, formatNum } from '../utils/geometry';

export const FloorInfoCard = ({ data, isDarkMode, onReset, isConstraintMode, inputs }) => {
    if (!data) return null;
    const isBase = data.id === 'base';
    const isExcavation = data.id === 'excavation';
    const baseAreaFallback = parseFloat(inputs?.baseArea) || 0;
    const excavationAreaFallback = baseAreaFallback * ((parseFloat(inputs?.excavationRatio) || 60) / 100);
    const area = data.realArea || data.area || (isBase ? baseAreaFallback : (isExcavation ? excavationAreaFallback : 0));
    const pingText = formatNum(toPing(area), 2);
    const sqmText = formatNum(area, 1);

    const titleText = isBase
        ? `基地 ${pingText} 坪`
        : isExcavation
            ? `開挖範圍 ${pingText} 坪`
            : `${data.id || ''} 樓板`;

    return (
        <div
            className={`absolute z-40 pointer-events-auto transition-opacity duration-200 ease-out no-context-menu ${data ? 'opacity-100' : 'opacity-0'}`}
            style={{ top: '68px', right: '16px' }}
        >
            <div className={`yra-card rounded-2xl px-3.5 py-2.5 min-w-[164px] ${isDarkMode ? 'text-[#F5F3EF]' : 'text-[#171614]'}`}>
                <div className="flex justify-between items-center gap-2 pb-1.5 mb-1.5 border-b border-[#E5E0D6] dark:border-white/15">
                    <h3 className="font-bold text-xs tracking-wide flex items-center gap-1.5">
                        {isBase ? (
                            <MapIcon size={14} strokeWidth={2.2} className="text-[#E85D2A] shrink-0" />
                        ) : isExcavation ? (
                            <Shovel size={14} strokeWidth={2.2} className="text-[#E85D2A] shrink-0" />
                        ) : (
                            <Layers size={14} strokeWidth={2.2} className="text-[#E85D2A] shrink-0" />
                        )}
                        <span>{titleText}</span>
                    </h3>
                    {!isConstraintMode && !isBase && !isExcavation && onReset && (
                        <button
                            type="button"
                            onClick={() => onReset(data.id)}
                            className="p-1 rounded-lg hover:bg-black/10 transition-colors"
                            title="重設此樓層形狀"
                            aria-label="重設此樓層形狀"
                        >
                            <Undo2 size={13} strokeWidth={2.2} />
                        </button>
                    )}
                </div>

                <div className="space-y-1 text-xs">
                    <div className="flex justify-between items-baseline gap-3">
                        <span className="text-[11px] font-medium text-[#767168]">面積</span>
                        <span className="font-black text-base yra-num">
                            {pingText} <span className="text-[11px] font-bold">坪</span>
                        </span>
                    </div>
                    <div className="flex justify-between items-baseline gap-3 text-[11px] text-[#767168] yra-num">
                        <span>平方公尺</span>
                        <span>{sqmText} ㎡</span>
                    </div>
                    {(data.points || data.manualArea) && (
                        <div className="text-center py-0.5 px-2 text-[10px] font-bold rounded-full bg-[#171614] text-white mt-1.5">
                            {data.points ? '自訂基地形狀' : '手動設定面積'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
