import React, { useState, useMemo } from 'react';
import {
    X,
    Image as ImageIcon,
    Link2,
    Printer,
    Copy,
    Check,
    Sun,
    User,
    Info,
    CheckSquare,
    Square
} from 'lucide-react';
import { toPing, formatNum } from '../utils/geometry';
import { formatRange, buildPlainTextSummary } from '../utils/summaryText';
import { buildReadOnlyShareUrl } from '../utils/projectStorage';
import { computeSunState } from './SunPathControls';
import { SunShadowMiniSvg } from './SunComparisonModal';

/**
 * 使用 HTML5 Canvas 繪製適合 LINE 傳送的高質感 750px 寬長圖
 */
function renderLineLongImage({
    projectName,
    activeSite,
    inputs,
    finalRes,
    params,
    massingSummary,
    designer,
    includeSunInReport
}) {
    const W = 750;
    const H = includeSunInReport ? 1760 : 1260;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const baseM2 = finalRes.base || 0;
    const basePing = toPing(baseM2);
    const totalCfaPing = toPing(finalRes.totalCFA || 0);
    const cfaRange = formatRange(totalCfaPing, 0.05, totalCfaPing >= 100 ? 5 : 2);
    const floorsAbove = massingSummary?.visualFloorsAbove || finalRes.floorsAbove || 1;
    const floorsBelow = parseInt(inputs.floorsBelow || 0, 10);
    const budgetRange = formatRange(finalRes.estimatedBudget || 0, 0.12, (finalRes.estimatedBudget || 0) >= 1000 ? 100 : 50);
    const priceLow = Math.max(10, Math.round((params.pricePerPing || 25) * 0.88));
    const priceHigh = Math.round((params.pricePerPing || 25) * 1.12);
    const covLimit = parseFloat(inputs.coverageRatio) || 50;
    const farLimit = parseFloat(inputs.floorRatio) || 150;
    const actualFootprintM2 = massingSummary?.actualFootprintM2 || finalRes.maxBuildingArea || 0;
    const actualCovPct = baseM2 > 0 ? (actualFootprintM2 / baseM2) * 100 : covLimit;
    const buildingH = massingSummary?.totalHeight || finalRes.buildingHeight || 15;
    const mainRoad = (inputs.roads || []).find(r => r.type === 'primary') || (inputs.roads || [])[0];

    // 圓角矩形輔助函式
    const roundRect = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    };

    // 1. 暖灰底色
    ctx.fillStyle = '#F4F2EE';
    ctx.fillRect(0, 0, W, H);

    // 2. 頁首品牌與案名
    ctx.fillStyle = '#171614';
    ctx.font = '900 28px "Noto Sans TC", sans-serif';
    ctx.fillText('YRA.', 44, 68);
    ctx.fillStyle = '#767168';
    ctx.font = '600 15px "Noto Sans TC", sans-serif';
    ctx.fillText('自地自建基地快速評估報告', 124, 65);

    ctx.fillStyle = '#E85D2A';
    ctx.font = '700 14px "Noto Sans TC", sans-serif';
    const dateStr = new Date().toLocaleDateString('zh-TW');
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, W - 44, 65);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#171614';
    ctx.font = '900 34px "Noto Sans TC", sans-serif';
    ctx.fillText(projectName || activeSite?.name || '自地自建評估案', 44, 122);

    ctx.fillStyle = '#767168';
    ctx.font = '500 18px "Noto Sans TC", sans-serif';
    ctx.fillText(
        `${inputs.district || '未填寫行政區'}  ·  ${inputs.zoneType || '住宅區'}  ·  面前道路 ${mainRoad ? `${mainRoad.width}m` : '未設定'}`,
        44,
        156
    );

    // 3. 等角白模量體示意卡片
    const isoY = 186;
    const isoH = 310;
    roundRect(44, isoY, W - 88, isoH, 24);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#DDD8CE';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 繪製柔和等角基地與白模量體
    const cx = W / 2;
    const baseCy = isoY + 215;
    // 基地菱形
    ctx.beginPath();
    ctx.moveTo(cx, baseCy - 72);
    ctx.lineTo(cx + 155, baseCy);
    ctx.lineTo(cx, baseCy + 72);
    ctx.lineTo(cx - 155, baseCy);
    ctx.closePath();
    ctx.fillStyle = '#EDEAE2';
    ctx.fill();
    ctx.strokeStyle = '#B7B1A6';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 地面柔和陰影
    ctx.beginPath();
    ctx.moveTo(cx + 70, baseCy + 6);
    ctx.lineTo(cx + 150, baseCy + 28);
    ctx.lineTo(cx + 62, baseCy + 66);
    ctx.lineTo(cx - 12, baseCy + 38);
    ctx.closePath();
    ctx.fillStyle = 'rgba(23, 22, 20, 0.14)';
    ctx.fill();

    // 等角白模樓層堆疊
    const drawFloors = Math.min(8, Math.max(1, floorsAbove));
    const layerH = Math.min(26, Math.max(14, Math.floor(135 / drawFloors)));
    const bw = 74;
    const bd = 36;
    for (let i = 0; i < drawFloors; i++) {
        const shrink = i === drawFloors - 1 && drawFloors >= 4 ? 0.78 : 1;
        const w = bw * shrink;
        const d = bd * shrink;
        const yBot = baseCy - i * layerH;
        const yTop = yBot - layerH;

        // 左側面（略暗暖灰）
        ctx.beginPath();
        ctx.moveTo(cx - w, yBot);
        ctx.lineTo(cx, yBot + d);
        ctx.lineTo(cx, yTop + d);
        ctx.lineTo(cx - w, yTop);
        ctx.closePath();
        ctx.fillStyle = '#EAE7E0';
        ctx.fill();
        ctx.strokeStyle = '#9E988E';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 右側面（中性灰）
        ctx.beginPath();
        ctx.moveTo(cx + w, yBot);
        ctx.lineTo(cx, yBot + d);
        ctx.lineTo(cx, yTop + d);
        ctx.lineTo(cx + w, yTop);
        ctx.closePath();
        ctx.fillStyle = '#DAD6CD';
        ctx.fill();
        ctx.stroke();

        // 頂面（最亮白）
        if (i === drawFloors - 1) {
            ctx.beginPath();
            ctx.moveTo(cx, yTop - d);
            ctx.lineTo(cx + w, yTop);
            ctx.lineTo(cx, yTop + d);
            ctx.lineTo(cx - w, yTop);
            ctx.closePath();
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
            ctx.strokeStyle = '#171614';
            ctx.lineWidth = 1.4;
            ctx.stroke();
        }
    }

    // 層高標註文字
    ctx.fillStyle = '#767168';
    ctx.font = '700 14px "Noto Sans TC", sans-serif';
    ctx.fillText(`白模量體示意 · 地上 ${floorsAbove}F${floorsBelow > 0 ? ` / 地下 B${floorsBelow}` : ''} · 總高約 ${formatNum(buildingH, 1)}m`, 68, isoY + isoH - 20);

    // 4. 關鍵數字 2x3 卡片區
    const gridY = isoY + isoH + 24;
    const cardW = (W - 88 - 18) / 2;
    const cardH = 112;
    const stats = [
        { label: '基地面積', val: `基地 ${formatNum(basePing, 2)} 坪`, sub: `${formatNum(baseM2, 1)} ㎡` },
        { label: '概估總樓地板面積', val: `${cfaRange} 坪`, sub: '含梯廳陽台與屋突區間' },
        { label: '建議量體層數', val: `地上 ${floorsAbove}F`, sub: floorsBelow > 0 ? `地下開挖 B${floorsBelow}` : '無地下室開挖' },
        { label: '概估營建造價區間', val: `${budgetRange} 萬`, sub: `每坪約 ${priceLow}–${priceHigh} 萬（不含裝修）`, accent: true },
        { label: '建蔽率使用 / 法定', val: `${formatNum(actualCovPct, 1)}% / ${covLimit}%`, sub: `留設約 ${Math.max(0, Math.round(100 - actualCovPct))}% 空地` },
        { label: '法定容積率', val: `${farLimit}%`, sub: `預估車位約 ${Math.max(1, (finalRes.possibleParking || 2) - 1)}–${(finalRes.possibleParking || 2) + 1} 席` }
    ];

    stats.forEach((st, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const x = 44 + col * (cardW + 18);
        const y = gridY + row * (cardH + 14);
        roundRect(x, y, cardW, cardH, 18);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#DDD8CE';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#767168';
        ctx.font = '700 14px "Noto Sans TC", sans-serif';
        ctx.fillText(st.label, x + 20, y + 32);

        ctx.fillStyle = st.accent ? '#E85D2A' : '#171614';
        ctx.font = '900 26px "Noto Sans TC", sans-serif';
        ctx.fillText(st.val, x + 20, y + 68);

        ctx.fillStyle = '#767168';
        ctx.font = '500 13px "Noto Sans TC", sans-serif';
        ctx.fillText(st.sub, x + 20, y + 94);
    });

    let cursorY = gridY + 3 * (cardH + 14) + 16;

    // 5. 日照對比快照（6 格：冬至 / 夏至 × 9, 12, 15）
    if (includeSunInReport) {
        roundRect(44, cursorY, W - 88, 470, 24);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#DDD8CE';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#171614';
        ctx.font = '900 20px "Noto Sans TC", sans-serif';
        ctx.fillText('日照陰影對比（冬至 vs 夏至）', 68, cursorY + 38);
        ctx.fillStyle = '#767168';
        ctx.font = '500 13px "Noto Sans TC", sans-serif';
        ctx.fillText(`台灣 25°N · 基地北向 ${(inputs.northAngle || 0).toFixed(0)}°`, 68, cursorY + 60);

        const seasons = [
            { key: 'winter', label: '冬至 12/21' },
            { key: 'summer', label: '夏至 6/21' }
        ];
        const hours = [9, 12, 15];
        const cellW = 192;
        const cellH = 166;
        const startX = 68;

        seasons.forEach((s, rIdx) => {
            const rowY = cursorY + 80 + rIdx * (cellH + 22);
            hours.forEach((hr, cIdx) => {
                const cellX = startX + cIdx * (cellW + 19);
                roundRect(cellX, rowY, cellW, cellH, 14);
                ctx.fillStyle = '#F7F5F1';
                ctx.fill();

                const sun = computeSunState(hr, s.key, inputs.northAngle || 0);
                const mcx = cellX + cellW / 2;
                const mcy = rowY + cellH / 2 - 4;
                const boxR = 22;

                // 基地框
                ctx.fillStyle = '#EAE6DF';
                ctx.fillRect(mcx - 34, mcy - 34, 68, 68);

                // 投射陰影
                const shDx = Math.max(-44, Math.min(44, sun.shadowDxPerM * 18));
                const shDy = Math.max(-44, Math.min(44, sun.shadowDyPerM * 18));
                ctx.fillStyle = 'rgba(23, 22, 20, 0.22)';
                ctx.beginPath();
                ctx.rect(mcx - boxR + shDx, mcy - boxR + shDy, boxR * 2, boxR * 2);
                ctx.fill();

                // 建築白模
                ctx.fillStyle = '#FFFFFF';
                ctx.strokeStyle = '#171614';
                ctx.lineWidth = 1.6;
                ctx.fillRect(mcx - boxR, mcy - boxR, boxR * 2, boxR * 2);
                ctx.strokeRect(mcx - boxR, mcy - boxR, boxR * 2, boxR * 2);

                // 太陽點
                const sx = mcx + sun.horizX * 54;
                const sy = mcy + sun.horizY * 54;
                ctx.beginPath();
                ctx.arc(sx, sy, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#E85D2A';
                ctx.fill();

                ctx.fillStyle = '#171614';
                ctx.font = '800 13px "Noto Sans TC", sans-serif';
                ctx.fillText(`${s.label} ${String(hr).padStart(2, '0')}:00`, cellX + 12, rowY + cellH - 12);
            });
        });

        cursorY += 492;
    }

    // 6. 假設、免責與設計師聯絡資訊
    roundRect(44, cursorY, W - 88, H - cursorY - 40, 22);
    ctx.fillStyle = '#171614';
    ctx.fill();

    ctx.fillStyle = '#E85D2A';
    ctx.font = '800 15px "Noto Sans TC", sans-serif';
    ctx.fillText('※ 概估，非正式法規審查', 68, cursorY + 38);

    ctx.fillStyle = '#D4CFC6';
    ctx.font = '500 14px "Noto Sans TC", sans-serif';
    ctx.fillText('本報告為自地自建前期量體與預算概估，實際允建面積、退縮與造價', 68, cursorY + 66);
    ctx.fillText('仍需依建築師正式套繪、當地土管規定與營造廠報價為準。', 68, cursorY + 88);

    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(68, cursorY + 114);
    ctx.lineTo(W - 68, cursorY + 114);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 18px "Noto Sans TC", sans-serif';
    ctx.fillText(designer?.firm || 'YRA 建築設計事務所', 68, cursorY + 148);

    ctx.fillStyle = '#A8A39B';
    ctx.font = '500 15px "Noto Sans TC", sans-serif';
    const contactLine = [designer?.name ? `設計師：${designer.name}` : '', designer?.contact ? `聯絡方式：${designer.contact}` : '']
        .filter(Boolean)
        .join('   |   ') || '歡迎聯繫預約基地現場勘查與正式法規檢討';
    ctx.fillText(contactLine, 68, cursorY + 178);

    return canvas.toDataURL('image/png');
}

export const ExportShareModal = ({
    isOpen,
    onClose,
    sites,
    activeSite,
    inputs,
    finalRes,
    params,
    massingSummary,
    designer,
    onUpdateDesigner,
    includeSunInReport,
    onToggleIncludeSunInReport
}) => {
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedText, setCopiedText] = useState(false);
    const [downloadingImg, setDownloadingImg] = useState(false);

    const shareUrl = useMemo(() => {
        if (!isOpen) return '';
        return buildReadOnlyShareUrl({
            v: 1,
            projectName: inputs.projectName || activeSite?.name || '自地自建評估案',
            sites,
            params,
            designer,
            includeSunInReport
        });
    }, [isOpen, inputs.projectName, activeSite?.name, sites, params, designer, includeSunInReport]);

    if (!isOpen) return null;

    const baseM2 = finalRes.base || 0;
    const basePing = toPing(baseM2);
    const totalCfaPing = toPing(finalRes.totalCFA || 0);
    const cfaRange = formatRange(totalCfaPing, 0.05, totalCfaPing >= 100 ? 5 : 2);
    const floorsAbove = massingSummary?.visualFloorsAbove || finalRes.floorsAbove || 1;
    const floorsBelow = parseInt(inputs.floorsBelow || 0, 10);
    const budgetRange = formatRange(finalRes.estimatedBudget || 0, 0.12, (finalRes.estimatedBudget || 0) >= 1000 ? 100 : 50);

    const handleDownloadLineImage = () => {
        setDownloadingImg(true);
        try {
            const dataUrl = renderLineLongImage({
                projectName: inputs.projectName || activeSite?.name,
                activeSite,
                inputs,
                finalRes,
                params,
                massingSummary,
                designer,
                includeSunInReport
            });
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `${inputs.projectName || activeSite?.name || 'YRA基地評估'}_LINE長圖.png`;
            a.click();
        } finally {
            setTimeout(() => setDownloadingImg(false), 300);
        }
    };

    const handleCopyShareLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        } catch {
            setCopiedLink(false);
        }
    };

    const handleCopyText = async () => {
        try {
            const text = buildPlainTextSummary({ activeSite, inputs, finalRes, params, massingSummary });
            await navigator.clipboard.writeText(text);
            setCopiedText(true);
            setTimeout(() => setCopiedText(false), 1800);
        } catch {
            setCopiedText(false);
        }
    };

    const handlePrintPdf = () => {
        window.print();
    };

    return (
        <>
            {/* 互動輸出彈窗（列印時隱藏） */}
            <div
                className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 no-print no-context-menu"
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
                <div
                    className="relative yra-card rounded-3xl w-full max-w-xl max-h-[90dvh] flex flex-col overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 標題列 */}
                    <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
                        <div>
                            <h2 className="font-black text-base normal-case tracking-normal">輸出與分享評估報告</h2>
                            <p className="text-xs text-[var(--text-muted)]">
                                產生 LINE 長圖、唯讀分享連結或 A4 PDF，快速傳給潛在業主
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-black/10"
                            aria-label="關閉輸出視窗"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {/* 報告內容預覽摘要 */}
                        <div className="rounded-2xl p-3.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black">{inputs.projectName || activeSite?.name || '自地自建評估案'}</span>
                                <span className="text-[11px] font-bold text-[#E85D2A] yra-num">基地 {formatNum(basePing, 2)} 坪</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center pt-1">
                                <div className="rounded-xl bg-white/80 dark:bg-black/20 p-2">
                                    <div className="text-[10px] text-[var(--text-muted)]">總樓地板</div>
                                    <div className="text-xs font-black yra-num mt-0.5">{cfaRange} 坪</div>
                                </div>
                                <div className="rounded-xl bg-white/80 dark:bg-black/20 p-2">
                                    <div className="text-[10px] text-[var(--text-muted)]">建議層數</div>
                                    <div className="text-xs font-black yra-num mt-0.5">{floorsAbove}F{floorsBelow > 0 ? `/B${floorsBelow}` : ''}</div>
                                </div>
                                <div className="rounded-xl bg-white/80 dark:bg-black/20 p-2">
                                    <div className="text-[10px] text-[var(--text-muted)]">概估造價</div>
                                    <div className="text-xs font-black text-[#E85D2A] yra-num mt-0.5">{budgetRange} 萬</div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => onToggleIncludeSunInReport && onToggleIncludeSunInReport(!includeSunInReport)}
                                className="w-full pt-1.5 flex items-center gap-2 text-xs font-bold text-left"
                            >
                                {includeSunInReport ? (
                                    <CheckSquare size={15} className="text-[#E85D2A] shrink-0" />
                                ) : (
                                    <Square size={15} className="text-[var(--text-muted)] shrink-0" />
                                )}
                                <Sun size={14} className="text-[#E85D2A] shrink-0" />
                                <span>報告內含「冬至 / 夏至 6 時段日照對比快照」</span>
                            </button>
                        </div>

                        {/* 設計師聯絡資訊（自動儲存於本機） */}
                        <div className="rounded-2xl p-3.5 border border-[var(--border-subtle)] space-y-2.5">
                            <div className="text-xs font-black flex items-center gap-1.5">
                                <User size={14} className="text-[#E85D2A]" />
                                設計師聯絡資訊（顯示於報告頁尾）
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    placeholder="事務所 / 設計團隊名稱"
                                    value={designer?.firm || ''}
                                    onChange={(e) => onUpdateDesigner({ ...designer, firm: e.target.value })}
                                    className="min-h-[42px] px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-transparent text-xs font-bold outline-none focus:border-[#E85D2A]"
                                />
                                <input
                                    type="text"
                                    placeholder="建築師 / 設計師姓名"
                                    value={designer?.name || ''}
                                    onChange={(e) => onUpdateDesigner({ ...designer, name: e.target.value })}
                                    className="min-h-[42px] px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-transparent text-xs font-bold outline-none focus:border-[#E85D2A]"
                                />
                            </div>
                            <input
                                type="text"
                                placeholder="電話 / LINE ID / Email（例：0912-345-678 · LINE: @yra）"
                                value={designer?.contact || ''}
                                onChange={(e) => onUpdateDesigner({ ...designer, contact: e.target.value })}
                                className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-transparent text-xs font-bold outline-none focus:border-[#E85D2A]"
                            />
                        </div>

                        {/* 4 種輸出行動按鈕 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                                type="button"
                                onClick={handleDownloadLineImage}
                                disabled={downloadingImg}
                                className="min-h-[52px] px-4 py-3 rounded-2xl bg-[#E85D2A] text-white text-xs font-bold flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all"
                            >
                                <ImageIcon size={17} />
                                {downloadingImg ? '正在產生長圖…' : '下載 LINE 專屬長圖 (PNG)'}
                            </button>

                            <button
                                type="button"
                                onClick={handleCopyShareLink}
                                className="min-h-[52px] px-4 py-3 rounded-2xl bg-[#171614] text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#2C2A26] active:scale-[0.98] transition-all"
                            >
                                {copiedLink ? <Check size={17} className="text-[#E85D2A]" /> : <Link2 size={17} />}
                                {copiedLink ? '已複製唯讀分享連結' : '複製唯讀分享連結'}
                            </button>

                            <button
                                type="button"
                                onClick={handlePrintPdf}
                                className="min-h-[48px] px-4 py-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-bold flex items-center justify-center gap-2 hover:border-[#171614]"
                            >
                                <Printer size={16} />
                                匯出 / 列印 A4 PDF
                            </button>

                            <button
                                type="button"
                                onClick={handleCopyText}
                                className="min-h-[48px] px-4 py-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-bold flex items-center justify-center gap-2 hover:border-[#171614]"
                            >
                                {copiedText ? <Check size={16} className="text-[#E85D2A]" /> : <Copy size={16} />}
                                {copiedText ? '已複製文字摘要' : '複製純文字摘要'}
                            </button>
                        </div>

                        <div className="flex items-start gap-1.5 text-[11px] text-[var(--text-muted)]">
                            <Info size={13} className="shrink-0 mt-0.5 text-[#E85D2A]" />
                            <span>所有輸出皆自動標註「概估，非正式法規審查」，唯讀連結可直接於手機瀏覽器開啟免登入。</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* A4 PDF 專屬列印版面（平時隱藏，列印/存 PDF 時顯示） */}
            <div className="hidden print-only-report p-6 text-[#171614] bg-white">
                <div className="flex items-baseline justify-between border-b-2 border-[#171614] pb-3 mb-5">
                    <div>
                        <div className="text-xs font-bold text-[#767168]">YRA｜自地自建基地快速評估報告</div>
                        <h1 className="text-2xl font-black mt-1 normal-case">{inputs.projectName || activeSite?.name || '自地自建評估案'}</h1>
                    </div>
                    <div className="text-right text-xs text-[#767168] yra-num">
                        <div>日期：{new Date().toLocaleDateString('zh-TW')}</div>
                        <div>{inputs.district || ''} · {inputs.zoneType || '住宅區'}</div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="p-3 border border-[#DDD8CE] rounded-xl">
                        <div className="text-xs text-[#767168]">基地面積</div>
                        <div className="text-lg font-black yra-num mt-1">基地 {formatNum(basePing, 2)} 坪</div>
                        <div className="text-[11px] text-[#767168] yra-num">{formatNum(baseM2, 1)} ㎡</div>
                    </div>
                    <div className="p-3 border border-[#DDD8CE] rounded-xl">
                        <div className="text-xs text-[#767168]">概估總樓地板面積</div>
                        <div className="text-lg font-black yra-num mt-1">{cfaRange} 坪</div>
                        <div className="text-[11px] text-[#767168]">地上 {floorsAbove}F{floorsBelow > 0 ? ` / 地下 B${floorsBelow}` : ''}</div>
                    </div>
                    <div className="p-3 border border-[#DDD8CE] rounded-xl">
                        <div className="text-xs text-[#767168]">概估營建造價區間</div>
                        <div className="text-lg font-black text-[#E85D2A] yra-num mt-1">{budgetRange} 萬</div>
                        <div className="text-[11px] text-[#767168]">建蔽 {inputs.coverageRatio}% / 容積 {inputs.floorRatio}%</div>
                    </div>
                </div>

                {includeSunInReport && (
                    <div className="mb-5">
                        <div className="text-sm font-black mb-2">日照陰影對比（冬至 12/21 vs 夏至 6/21）</div>
                        <div className="grid grid-cols-3 gap-3">
                            {['winter', 'summer'].map(season =>
                                [9, 12, 15].map(hr => (
                                    <div key={`pdf-${season}-${hr}`} className="border border-[#DDD8CE] rounded-xl p-2">
                                        <div className="h-28">
                                            <SunShadowMiniSvg
                                                basePoints={massingSummary?.basePoints}
                                                buildingHeight={massingSummary?.totalHeight || finalRes.buildingHeight || 15}
                                                season={season}
                                                hour={hr}
                                                northAngle={inputs.northAngle || 0}
                                            />
                                        </div>
                                        <div className="text-[11px] font-bold text-center mt-1 yra-num">
                                            {season === 'winter' ? '冬至' : '夏至'} {String(hr).padStart(2, '0')}:00
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                <div className="border-t border-[#DDD8CE] pt-3 mt-4 flex items-start justify-between text-xs">
                    <div className="max-w-[65%] text-[#767168] leading-relaxed">
                        <strong className="text-[#E85D2A]">※ 概估，非正式法規審查。</strong>
                        本報告為前期方案評估，實際允建面積、法規退縮與工程造價需依建築師正式套繪與營造報價為準。
                    </div>
                    <div className="text-right">
                        <div className="font-black">{designer?.firm || 'YRA 建築設計事務所'}</div>
                        <div className="text-[#767168]">{[designer?.name, designer?.contact].filter(Boolean).join(' · ')}</div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ExportShareModal;
