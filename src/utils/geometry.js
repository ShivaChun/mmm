export const formatNum = (num, digits = 2) => {
    return new Intl.NumberFormat('zh-TW', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    }).format(num || 0);
};

export const toSqm = (ping) => ping * 3.3058;
export const toPing = (sqm) => sqm * 0.3025;
