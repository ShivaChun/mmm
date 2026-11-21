import { toPing, formatNum } from './geometry';

/**
 * 計算友善的區間字串（所有概估值皆以區間呈現）
 */
export const formatRange = (center, spreadRatio = 0.05, roundTo = 1) => {
    if (!center || isNaN(center) || center <= 0) return '—';
    const rawLow = center * (1 - spreadRatio);
    const rawHigh = center * (1 + spreadRatio);
    const low = Math.max(roundTo, Math.floor(rawLow / roundTo) * roundTo);
    const high = Math.max(low + roundTo, Math.ceil(rawHigh / roundTo) * roundTo);
    return `${formatNum(low, 0)}–${formatNum(high, 0)}`;
};

/**
 * 建立可直接貼給業主的純文字評估摘要
 */
export const buildPlainTextSummary = ({ activeSite, inputs, finalRes, params, massingSummary }) => {
    const basePing = toPing(finalRes.base || 0);
    const totalCfaPing = toPing(finalRes.totalCFA || 0);
    const cfaRange = formatRange(totalCfaPing, 0.05, totalCfaPing >= 100 ? 5 : 2);
    const floorsAbove = massingSummary?.visualFloorsAbove || finalRes.floorsAbove || 1;
    const floorsBelow = parseInt(inputs.floorsBelow || 0, 10);
    const budgetCenter = finalRes.estimatedBudget || 0;
    const budgetRange = formatRange(budgetCenter, 0.12, budgetCenter >= 1000 ? 100 : 50);
    const priceLow = Math.max(10, Math.round((params.pricePerPing || 25) * 0.88));
    const priceHigh = Math.round((params.pricePerPing || 25) * 1.12);
    const covLimit = parseFloat(inputs.coverageRatio) || 50;
    const farLimit = parseFloat(inputs.floorRatio) || 150;

    return [
        `【${inputs.projectName || activeSite?.name || '自地自建'}｜基地快速評估摘要】`,
        `• 基地位置：${inputs.district || '未填寫'}（${inputs.zoneType || '住宅區'}）`,
        `• 基地面積：基地 ${formatNum(basePing, 2)} 坪（${formatNum(finalRes.base, 1)} ㎡）`,
        `• 概估總樓地板面積：約 ${cfaRange} 坪`,
        `• 建議量體層數：地上 ${floorsAbove}F${floorsBelow > 0 ? ` / 地下 B${floorsBelow}` : ''}`,
        `• 法定建蔽／容積：建蔽 ${covLimit}% ／ 容積 ${farLimit}%`,
        `• 概估營建造價：約 ${budgetRange} 萬（以每坪 ${priceLow}–${priceHigh} 萬估算，不含室內裝修）`,
        `※ 概估，非正式法規審查。實際數值依建築師正式套繪與營造報價為準。`
    ].join('\n');
};
