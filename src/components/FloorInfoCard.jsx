import React, { useState } from 'react';
import { Layers, Map as MapIcon, RotateCw, Type, AlignLeft, Hexagon, Maximize2, Move, Box, CheckCircle2, ChevronDown, ChevronUp, Lock, Unlock, AlertTriangle, DivideSquare, Edit2, Shovel, Undo2 } from 'lucide-react';
import { EditableInput } from './SitePolygonEditor';
import { toPing, formatNum } from '../utils/geometry';
import { calculatePolygonArea } from '../utils/polygon';

export const FloorInfoCard = ({ data, isDarkMode, onReset, isConstraintMode, inputs, onUpdateSetting }) => {
    if (!data) return null;
    const isBase = data.id === 'base';
    const isExcavation = data.id === 'excavation';
    const area = data.realArea || data.area || 0;

    return (
        <div
            className={`absolute z-50 pointer-events-auto transition-opacity duration-300 ease-out ${data ? 'opacity-100' : 'opacity-0'}`}
                    style={{
                        top: '56px', right: '16px',
                    }}
                >
                    <div className="bg-white border-2 border-black shadow-[4px_4px_0_#000] p-3 min-w-[140px] transform scale-90 origin-top-right">
                        <div className="flex justify-between items-center mb-2 pb-1 border-b-2 border-black">
                            <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                {isBase ? <MapIcon size={14} strokeWidth={3} className="text-black" /> : (isExcavation ? <Shovel size={14} strokeWidth={3} className="text-amber-600" /> : <Layers size={14} strokeWidth={3} className="text-indigo-600" />)}
                                {isBase ? 'SITE AREA' : (isExcavation ? 'EXCAVATION' : `${data.id || ''} FLOOR`)}
                            </h3>
                            {!isConstraintMode && !isBase && !isExcavation && onReset && <button onClick={() => onReset(data.id)} className="p-0.5 hover:bg-black hover:text-white transition-colors" title="重置設定"><Undo2 size={12} strokeWidth={3} /></button>}
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-end">
                                <span className="font-black uppercase text-[10px] text-stone-400">AREA</span>
                                <span className="font-black text-xl num-font text-black">{formatNum(toPing(area))} <span className="text-[10px] font-bold">P</span></span>
                            </div>
                            {(data.points || data.manualArea) && (
                                <div className="text-center py-1 text-[9px] font-black uppercase tracking-widest text-white bg-black mt-2">
                                    {data.points ? 'CUSTOM POLYGON' : 'MANUAL AREA'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        };
