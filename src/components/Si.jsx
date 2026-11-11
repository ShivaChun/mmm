import React, { useState } from 'react';
import { ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { formatNum, toPing } from '../utils/geometry';

export const Si = React.memo(({ text, x, y, z, rotationZ, baseRotation, viewAngleX, visible, className, lineConnector, isRoadLabel, zIndex = 7000, onClick }) => (
    visible ? (<div className={`absolute ${onClick ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`} onClick={onClick} style={{ left: 0, top: 0, transform: `translate3d(${x}px, ${y}px, ${z}px) rotateZ(${isRoadLabel ? -(rotationZ + baseRotation) : -(rotationZ + baseRotation)}deg) rotateX(${-viewAngleX}deg)`, zIndex }}><div className="flex items-center" style={{ transform: 'translate(-50%, -50%)' }}>{lineConnector && <div className="w-4 h-[1px] bg-stone-400"></div>}<div className={`whitespace-nowrap px-2 py-0.5 rounded-none  text-sm backdrop-blur-sm num-font border-2 border-black bg-white/90 font-black ${className}`}>{text}</div></div></div>) : null
));

export const CheckLine = React.memo(({ start, end, color, label, rotationZ, baseRotation, viewAngleX, visible, dashed, thick, labelPosRatio = 0.5, isDarkMode }) => {
    const dx = end.x - start.x; const dy = end.y - start.y; const dz = end.z - start.z; const length = Math.sqrt(dx * dx + dy * dy + dz * dz); const lx = start.x + dx * labelPosRatio; const ly = start.y + dy * labelPosRatio; const lz = start.z + dz * labelPosRatio; const angleZ = Math.atan2(dy, dx) * (180 / Math.PI); const angleY = -Math.atan2(dz, Math.sqrt(dx * dx + dy * dy)) * (180 / Math.PI); const isSteep = viewAngleX > 75; const thickness = thick ? (isSteep ? "6px" : "3px") : (isSteep ? "4px" : "2px");
    return ( <> <div className="absolute origin-left" style={{ left: 0, top: 0, width: `${length}px`, height: thickness, backgroundColor: dashed ? 'transparent' : color, borderTop: dashed ? `2px dashed ${color}` : 'none', transform: `translate3d(${start.x}px, ${start.y}px, ${start.z}px) rotateZ(${angleZ}deg) rotateY(${angleY}deg)`, opacity: visible ? (isSteep ? 1 : 0.9) : 0, pointerEvents: 'none', boxShadow: isSteep ? `0 0 4px ${color}` : 'none', zIndex: 60 }}></div> {isSteep && (<div className="absolute origin-left" style={{ left: 0, top: 0, width: `${length}px`, height: thickness, backgroundColor: color, transform: `translate3d(${start.x}px, ${start.y}px, ${start.z}px) rotateZ(${angleZ}deg) rotateY(${angleY}deg) rotateX(90deg)`, opacity: visible ? 1 : 0, pointerEvents: 'none', zIndex: 60 }}></div>)} {visible && label && (<Si text={label} x={lx} y={ly} z={lz + 10} rotationZ={rotationZ} baseRotation={baseRotation} viewAngleX={viewAngleX} visible={visible} className="text-[10px] px-2 py-0.5 rounded-none  font-black border-2 border-black " />)} </> );
});

export const CollapsibleSection = ({ title, icon, children, defaultOpen = true, className = "" }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return ( 
        <div className={`theme-panel rounded-none border-2 @[480px]:border-4 border-black shadow-[4px_4px_0_#111111] @[480px]:shadow-[6px_6px_0_#111111] overflow-hidden min-w-0 ${className}`}>
            <div className="flex items-center justify-between p-3 @[480px]:p-4 cursor-pointer hover:bg-[var(--text-accent)] hover:text-white transition-colors border-b-2 @[480px]:border-b-4 border-black group" onClick={() => setIsOpen(!isOpen)}>
                <h3 className="text-sm @[480px]:text-base @[640px]:text-lg font-black theme-text-title flex items-center gap-2 truncate">{icon} <span className="truncate">{title}</span></h3>
                <div className="group-hover:scale-110 transition-transform shrink-0">{isOpen ? <ChevronUp size={20} strokeWidth={3} /> : <ChevronDown size={20} strokeWidth={3} />}</div>
            </div>
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[2500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-3 @[480px]:p-4 @[640px]:p-5 bg-white min-w-0">{children}</div>
            </div>
        </div> 
    );
};

export const InputRow = ({ id, label, value, calculatedValue, formula, note, isEditMode, onOverride, highlight = false, subTotal = false, bold = false, paramKey, paramValue, onParamChange, isArea = true, unit = '' }) => {
    const isConflict = isEditMode && calculatedValue !== undefined && Math.abs(value - calculatedValue) > 0.01;
    const displayValue = formatNum(value, isArea ? 0 : 2);
    const displayPing = isArea ? formatNum(toPing(value)) : (unit || '-');
    return ( 
        <tr className={`hover:bg-stone-50 transition-colors ${subTotal ? 'bg-stone-100 italic theme-text-muted' : ''}`}>
            <td className={`p-2 @[480px]:p-3 @[680px]:p-4 pl-3 @[480px]:pl-5 border-l-4 @[480px]:border-l-8 text-xs @[480px]:text-sm break-words ${highlight ? 'border-[var(--text-accent)] font-black text-[var(--text-accent)] uppercase' : 'border-black font-bold'}`}>{label}</td>
            <td className={`p-2 @[480px]:p-3 @[680px]:p-4 text-right whitespace-nowrap text-xs @[480px]:text-sm @[680px]:text-base ${highlight ? 'font-black text-[var(--text-accent)] @[480px]:text-lg' : ''} ${bold ? 'font-black' : ''}`}>
                {isEditMode ? (
                    <div className="flex items-center justify-end gap-1.5 relative">
                        {isConflict && <div className="text-red-600 animate-pulse border border-red-600 p-0.5 shrink-0" title="警告：數據衝突"><AlertTriangle size={14} strokeWidth={3} /></div>}
                        <input type="number" value={value} onChange={(e) => onOverride(id, e.target.value)} className={`w-20 @[480px]:w-28 p-1 @[480px]:p-1.5 text-right border-2 border-black rounded-none outline-none focus:border-[var(--text-accent)] focus:bg-white ${isConflict ? 'border-red-500 bg-red-50' : 'border-black theme-bg theme-text'} font-black text-xs @[480px]:text-sm num-font`} />
                    </div>
                ) : (<span className="num-font font-black">{displayValue}</span>)}
            </td>
            <td className={`p-2 @[480px]:p-3 @[680px]:p-4 text-right whitespace-nowrap theme-text-muted text-xs @[480px]:text-sm @[680px]:text-base ${highlight ? 'font-black text-[var(--text-accent)]' : ''} ${bold ? 'font-black' : ''} num-font`}>{displayPing}</td>
            {isEditMode && (
                <>
                    <td className="p-2 @[480px]:p-3 font-mono text-[10px] @[480px]:text-xs font-black bg-stone-50 border-l-2 border-black">
                        {paramKey ? (
                            <div className="flex items-center gap-1 flex-wrap"><span className="uppercase text-[10px]">{paramKey === 'exemptRate' ? '免計率' : paramKey === 'stairRate' ? '梯廳率' : '陽台率'}:</span><input type="number" value={paramValue} onChange={(e) => onParamChange(paramKey, e.target.value)} className="w-14 p-0.5 border-2 border-black rounded-none text-center font-black bg-white num-font text-xs" /><span>%</span></div>
                        ) : formula}
                    </td>
                    <td className="p-2 @[480px]:p-3 text-[11px] @[480px]:text-xs font-bold text-stone-500 bg-stone-50">{note}</td>
                </>
            )}
        </tr> 
    );
};

export const SectionHeader = ({ title }) => ( 
    <tr className="bg-black text-white">
        <td colSpan={10} className="p-2 @[480px]:p-3 pl-3 @[480px]:pl-6 font-black text-xs @[480px]:text-sm uppercase tracking-widest leading-tight">{title}</td>
    </tr> 
);
