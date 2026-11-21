import { formatNum, toPing } from './geometry';

/**
 * 台灣建築法規資料庫（連接全國法規資料庫法條與本系統各檢討項目動態說明）
 * 涵蓋：《建築技術規則》建築設計施工編、《都市計畫法臺灣省施行細則》、
 * 《都市危險及老舊建築物加速重建條例》、《都市更新條例》及容積移轉辦法。
 */
export const TAIWAN_REGULATIONS = {
    base: {
        id: 'base',
        category: 'base',
        title: '基地面積與宗地界線檢討',
        lawName: '建築技術規則建築設計施工編',
        article: '第 1 條第 1 款、第 2 條',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=1',
        summary: '一宗土地供建築物本身所占之地面及其所應留設之法定空地為建築基地。基地應與建築線相連接，其連接部分最小寬度應在 2m 以上（或依各縣市畸零地使用自治條例檢討最小面寬與最小深度）。',
        formulaDesc: '基地面積 = Σ 各筆地號土地登記面積（扣除道路截角或未完成徵收之計畫道路用地）',
        getLiveCheck: (inputs, res) => {
            const area = res?.base || 0;
            const roadCount = Array.isArray(inputs?.roads) ? inputs.roads.length : 0;
            return {
                status: roadCount > 0 && area > 0 ? 'pass' : 'warn',
                statusLabel: roadCount > 0 ? '已臨接道路' : '尚未設定臨接道路',
                detail: `目前基地面積共 ${formatNum(area)} ㎡（約 ${formatNum(toPing(area))} 坪），臨接 ${roadCount} 條道路。請留意角地是否需依地方自治條例扣除道路截角面積。`
            };
        }
    },
    maxBuildingArea: {
        id: 'maxBuildingArea',
        category: 'base',
        title: '建蔽率與最大允建建築面積',
        lawName: '建築技術規則建築設計施工編',
        article: '第 1 條第 3 款、第 1 條第 4 款、第 25～29 條',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=1',
        summary: '建築面積為建築物外牆中心線或其代替柱中心線以內之最大水平投影面積。建蔽率為建築面積占基地面積之比率，須符合各縣市都市計畫土地使用分區管制要點（如住宅區常為 50%～60%、商業區 70%～80%）。',
        formulaDesc: '允建最大建築面積 = 基地面積 × 法定建蔽率 (%)',
        getLiveCheck: (inputs, res) => {
            const cov = parseFloat(inputs?.coverageRatio) || 0;
            const maxB = res?.maxBuildingArea || 0;
            return {
                status: 'pass',
                statusLabel: `建蔽率上限 ${cov}%`,
                detail: `依「${inputs?.zoneType || '住宅區'}」建蔽率 ${cov}% 檢討，單層最大水平投影建築面積上限為 ${formatNum(maxB)} ㎡（${formatNum(toPing(maxB))} 坪），法定空地比率應留設至少 ${formatNum(100 - cov)}%。`
            };
        }
    },
    statutoryFA: {
        id: 'statutoryFA',
        category: 'base',
        title: '基準容積率與法定容積樓地板面積',
        lawName: '建築技術規則建築設計施工編',
        article: '第 161 條（容積管制章）',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=161',
        summary: '本編所稱容積率，指基地內建築物之容積總樓地板面積與基地面積之比。基準容積率由各都市計畫細部計畫土地使用分區管制要點或非都市土地使用管制規則訂定。',
        formulaDesc: '法定基準容積 (FA) = 基地面積 × 法定容積率 (%)',
        getLiveCheck: (inputs, res) => {
            const far = parseFloat(inputs?.floorRatio) || 0;
            const fa = res?.statutoryFA || 0;
            return {
                status: 'pass',
                statusLabel: `容積率 ${far}%`,
                detail: `依「${inputs?.urbanPlanName || '都市計畫區'}－${inputs?.zoneType || '住宅區'}」容積率 ${far}% 計算，法定基準容積為 ${formatNum(fa)} ㎡（${formatNum(toPing(fa))} 坪）。`
            };
        }
    },
    incentiveArea: {
        id: 'incentiveArea',
        category: 'exempt',
        title: '容積獎勵（都更 / 危老 / 開放空間）',
        lawName: '都市危險及老舊建築物加速重建條例 / 都市更新條例',
        article: '危老條例第 6 條 / 都更條例第 65 條 / 建築技術規則第 161 條第 2 項',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070249&flno=6',
        summary: '危老重建獎勵容積最高不得超過基準容積 1.3 倍（或原建築容積 1.15 倍），加計時程與規模獎勵上限 1.4 倍；都市更新獎勵最高不得超過基準容積 1.5 倍。一般綜合設計開放空間獎勵則受都市計畫細部計畫上限約束。',
        formulaDesc: '獎勵容積面積 = 依核定獎勵額度百分比 × 法定基準容積',
        getLiveCheck: (inputs, res) => {
            const inc = parseFloat(inputs?.incentiveArea) || 0;
            const fa = res?.statutoryFA || 1;
            const ratio = (inc / fa) * 100;
            const isOver30 = ratio > 30.01;
            return {
                status: isOver30 ? 'warn' : 'pass',
                statusLabel: inc > 0 ? `獎勵約 ${formatNum(ratio, 1)}% FA` : '未申請獎勵',
                detail: inc > 0
                    ? `目前計入獎勵容積 ${formatNum(inc)} ㎡（約占基準容積 ${formatNum(ratio, 1)}%）。提醒：危老本體獎勵上限為基準容積 30%（加計時程/規模最高 40%）。`
                    : '目前設為 0 ㎡。若本案適用危老重建或都更條例，可於此欄輸入獎勵容積面積。'
            };
        }
    },
    transferArea: {
        id: 'transferArea',
        category: 'exempt',
        title: '容積移轉（公設保留地 / 古蹟移入）',
        lawName: '都市計畫容積移轉實施辦法',
        article: '第 6 條、第 8 條、第 9 條',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070027&flno=8',
        summary: '接受基地移入之容積，以不超過該接受基地基準容積之 30% 為原則；位於整體開發地區、實施都市更新地區、面臨永久性空地或其他都市計畫指定地區，經都委會同意得酌予增加，但最高不得超過基準容積之 40%。',
        formulaDesc: '移入容積上限 ≤ 基準容積 × 30%（都更或指定地區 ≤ 40%）',
        getLiveCheck: (inputs, res) => {
            const tr = parseFloat(inputs?.transferArea) || 0;
            const fa = res?.statutoryFA || 1;
            const ratio = (tr / fa) * 100;
            return {
                status: ratio > 40 ? 'fail' : (ratio > 30 ? 'warn' : 'pass'),
                statusLabel: tr > 0 ? `移入 ${formatNum(ratio, 1)}% FA` : '無容積移轉',
                detail: tr > 0
                    ? `目前計入移轉容積 ${formatNum(tr)} ㎡（占基準容積 ${formatNum(ratio, 1)}%）。一般接受基地上限為 30%，都更或指定地區上限為 40%。`
                    : '目前設為 0 ㎡。若有購買公設保留地或代金移入容積，可於此欄輸入。'
            };
        }
    },
    exempt15: {
        id: 'exempt15',
        category: 'exempt',
        title: '免計容積：機電設備、安全梯間與管委會空間',
        lawName: '建築技術規則建築設計施工編',
        article: '第 162 條第 1 項第 2 款',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=162',
        summary: '機電設備空間、安全梯之梯間、緊急昇降機之機道、特別安全梯與緊急昇降機之排煙室及管理委員會使用空間，其總和以不超過都市計畫法規或非都市土地使用管制規則規定該基地容積之 15% 為限。',
        formulaDesc: '免計機電及管委會空間 ≤ 法定基準容積 (FA) × 15%',
        getLiveCheck: (inputs, res, params) => {
            const rate = parseFloat(params?.exemptRate) ?? 15;
            const val = res?.exempt15 || 0;
            return {
                status: rate <= 15 ? 'pass' : 'fail',
                statusLabel: rate <= 15 ? `符合 15% 上限 (${rate}%)` : `超過 15% 法定上限 (${rate}%)`,
                detail: `目前設定免計率為 ${rate}%，試算面積為 ${formatNum(val)} ㎡（${formatNum(toPing(val))} 坪）。依建築技術規則第 162 條規定，一般住宅與商業建築上限為基準容積之 15%。`
            };
        }
    },
    exemptStair: {
        id: 'exemptStair',
        category: 'exempt',
        title: '免計容積：每層共同使用之梯廳',
        lawName: '建築技術規則建築設計施工編',
        article: '第 162 條第 1 項第 1 款',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=162',
        summary: '每層共同使用之樓梯間、昇降機間之梯廳，其淨深度不得小於 2.0m；其梯廳面積未超過該層樓地板面積 10% 部分，得不計入該層樓地板面積。實務上並應與陽台合計受該層樓地板面積 15% 上限控管。',
        formulaDesc: '單層免計梯廳 ≤ 該層樓地板面積 × 10%（本表以 FA 概估比例試算）',
        getLiveCheck: (inputs, res, params) => {
            const rate = parseFloat(params?.stairRate) ?? 5;
            const val = res?.exemptStair || 0;
            return {
                status: rate <= 10 ? 'pass' : 'warn',
                statusLabel: `梯廳試算率 ${rate}%`,
                detail: `目前以基準容積之 ${rate}% 概估免計梯廳，共 ${formatNum(val)} ㎡（${formatNum(toPing(val))} 坪）。請注意設計時梯廳淨深度須 ≥ 2.0m，且與陽台合算不超過單層面積 15%。`
            };
        }
    },
    exemptIndoor: {
        id: 'exemptIndoor',
        category: 'exempt',
        title: '室內免計容積總和檢討',
        lawName: '建築技術規則建築設計施工編',
        article: '第 162 條第 1 項第 1、2 款',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=162',
        summary: '彙整地上層機電設備空間、安全梯間、排煙室、管理委員會空間（上限 15% FA）及各層共用梯廳之免計容積室內面積，作為計算地上層允建室內總面積與公設比之重要依據。',
        formulaDesc: '室內免計合計 = 免計機電管委會空間 + 免計梯廳面積',
        getLiveCheck: (inputs, res) => {
            const val = res?.exemptIndoor || 0;
            return {
                status: 'pass',
                statusLabel: `合計 ${formatNum(toPing(val))} 坪`,
                detail: `地上層室內免計容積合計 ${formatNum(val)} ㎡（${formatNum(toPing(val))} 坪），將併入地上層允建室內面積進行樓層量體分配。`
            };
        }
    },
    balcony: {
        id: 'balcony',
        category: 'exempt',
        title: '免計容積：陽台面積上限檢討',
        lawName: '建築技術規則建築設計施工編',
        article: '第 1 條第 3 款、第 162 條第 1 項第 3 款',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=162',
        summary: '直上方有遮蓋物之平臺稱為陽臺。陽臺深度不得超過 2.0m（或依退縮規定）；每層陽臺面積之和，以不超過該層樓地板面積 10% 為原則，且與每層共同使用之梯廳面積合計不得超過該層樓地板面積之 15%（未達 8㎡ 者得為 8㎡）。',
        formulaDesc: '免計陽台面積 ≤ 該層樓地板面積 × 10%（與梯廳合計 ≤ 15%）',
        getLiveCheck: (inputs, res, params) => {
            const bRate = parseFloat(params?.balconyRate) ?? 10;
            const sRate = parseFloat(params?.stairRate) ?? 5;
            const val = res?.balcony || 0;
            const combined = bRate + sRate;
            return {
                status: bRate <= 10 && combined <= 15 ? 'pass' : 'warn',
                statusLabel: bRate <= 10 ? `陽台率 ${bRate}%` : `超過 10% 原則`,
                detail: `目前設定陽台試算率 ${bRate}%（面積 ${formatNum(val)} ㎡ / ${formatNum(toPing(val))} 坪），與梯廳（${sRate}%）合計為 ${combined}%。法規要求單層陽台 ≤ 10% 且「陽台＋梯廳」≤ 15%。`
            };
        }
    },
    permittedIndoor: {
        id: 'permittedIndoor',
        category: 'summary',
        title: '地上層允建室內總面積',
        lawName: '建築技術規則建築設計施工編',
        article: '第 161 條、第 162 條',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=161',
        summary: '計入地上各標準層實際配置之室內主建物與公設面積總和（包含法定基準容積、獎勵容積、移轉容積與室內免計容積，不含陽台、屋突與地下室）。',
        formulaDesc: '允建室內面積 = 法定容積 + 獎勵容積 + 移轉容積 + 免計室內合計',
        getLiveCheck: (inputs, res) => {
            const val = res?.permittedIndoor || 0;
            return {
                status: 'pass',
                statusLabel: `${formatNum(toPing(val))} 坪`,
                detail: `地上層可配置之室內總樓地板面積為 ${formatNum(val)} ㎡（${formatNum(toPing(val))} 坪），為推算標準層樓層數之基準分母。`
            };
        }
    },
    roofProtrusion: {
        id: 'roofProtrusion',
        category: 'summary',
        title: '屋頂突出物（屋突 R1～R3）面積與高度限制',
        lawName: '建築技術規則建築設計施工編',
        article: '第 1 條第 9 款、第 1 條第 10 款、第 162 條',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=1',
        summary: '突出於屋面之附屬建築物及雜項工作物（樓梯間、昇降機間、機械房、水塔等）：其水平投影面積之和，除高層建築物以不超過建築面積 15% 為限外，其餘以不超過建築面積 12.5%（1/8）為限（未達 25㎡ 者得建築 25㎡）。有昇降機設備通達屋頂層者高度在 9m 以內（或無昇降機 6m 以內）不計入建築物高度與層數。',
        formulaDesc: '允建屋突面積 ≈ (最大建築面積 × 1/8) × 2 層（高層建築單層可達 15%）',
        getLiveCheck: (inputs, res) => {
            const val = res?.roofProtrusion || 0;
            const singleMax = (res?.maxBuildingArea || 0) * 0.125;
            return {
                status: 'pass',
                statusLabel: `單層上限 ${formatNum( Math.max(25, singleMax) )} ㎡`,
                detail: `依建築面積 1/8（12.5%）估算兩層屋突（R1、R2），合計約 ${formatNum(val)} ㎡（${formatNum(toPing(val))} 坪）。若單層 1/8 小於 25㎡，依法仍得建築至 25㎡。`
            };
        }
    },
    totalBasementArea: {
        id: 'totalBasementArea',
        category: 'parking',
        title: '地下室開挖率與防空避難兼停車空間',
        lawName: '建築技術規則建築設計施工編 / 都市計畫土管要點',
        article: '第 140～144 條（防空避難設備）、第 162 條第 1 項第 3 款',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=162',
        summary: '地下層依法附設之防空避難設備、裝卸、停車空間、機電設備及安全梯間等得免計入容積。地下室最大開挖率須依各都市計畫土地使用分區管制要點或綠建築基地保水指標檢討（住宅區常見為 60%～80%，或商業區 80%～85%）。',
        formulaDesc: '地下室總面積 = 基地面積 × 地下室開挖率 (%) × 地下層數',
        getLiveCheck: (inputs, res) => {
            const exRatio = parseFloat(inputs?.excavationRatio) || 0;
            const below = parseInt(inputs?.floorsBelow) || 0;
            const perFloor = res?.basementAreaPerFloor || 0;
            const totalB = res?.totalBasementArea || 0;
            return {
                status: exRatio <= 85 ? 'pass' : 'warn',
                statusLabel: `開挖率 ${exRatio}% / B${below}`,
                detail: `單層地下室開挖面積 ${formatNum(perFloor)} ㎡（${formatNum(toPing(perFloor))} 坪），共規劃 B1～B${below} 合計 ${formatNum(totalB)} ㎡（${formatNum(toPing(totalB))} 坪）。`
            };
        }
    },
    totalCFA: {
        id: 'totalCFA',
        category: 'summary',
        title: '允建地上總樓地板面積 (Total CFA)',
        lawName: '建築技術規則建築設計施工編',
        article: '第 1 條第 5 款、第 161 條、第 162 條',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=1',
        summary: '建築物各層包括屋頂突出物、陽台及室內主建物與公設之樓地板面積總和（地下室另列）。本系統於 3D 量體模擬時，以 Total CFA 作為地上總量體上限控管基準。',
        formulaDesc: 'Total CFA = 允建室內面積 + 免計陽台面積 + 允建屋突面積',
        getLiveCheck: (inputs, res) => {
            const val = res?.totalCFA || 0;
            return {
                status: 'pass',
                statusLabel: `${formatNum(toPing(val))} 坪`,
                detail: `地上層總樓地板面積（含免計與屋突）共 ${formatNum(val)} ㎡（${formatNum(toPing(val))} 坪），加計地下室後總開發面積為 ${formatNum((val + (res?.totalBasementArea || 0)))} ㎡。`
            };
        }
    },
    floorsAbove: {
        id: 'floorsAbove',
        category: 'parking',
        title: '地上樓層數認定與量體估算',
        lawName: '建築技術規則建築設計施工編',
        article: '第 1 條第 7 款（層數認定）',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=1',
        summary: '地板面在基地地面以上之樓層稱為地面層。當基地因前、後、側院退縮或高度比斜率退縮導致單層可建築面積小於法定最大建蔽面積時，剩餘容積將向上疊加樓層。',
        formulaDesc: '基準推算層數 = ⌈ 允建室內總面積 ÷ 單層最大建築面積 ⌉',
        getLiveCheck: (inputs, res) => {
            const f = res?.floorsAbove || 1;
            return {
                status: 'pass',
                statusLabel: `地上 ${f} 層`,
                detail: `依允建室內面積與最大建蔽面積推算，地上標準層約為 ${f} 層（若於 3D/2D 縮小單層樓板，樓層數可隨剩餘容積動態增加）。`
            };
        }
    },
    parking: {
        id: 'parking',
        category: 'parking',
        title: '附設停車空間設置標準與車位尺寸',
        lawName: '建築技術規則建築設計施工編',
        article: '第 59 條、第 60 條、第 61 條',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=59',
        summary: '依都市計畫內建築物附設停車空間設置標準（第 59 條表列，住宅與集合住宅常以樓地板面積每 150㎡ 設置一部估算；實際應依各縣市都市計畫土管要點）。第 60 條規定標準平面大車位寬 2.5m × 長 5.5m（最多 1/5 得設小車位寬 2.25m × 長 5.5m，無障礙車位寬 3.5m × 長 6.0m），雙向車道寬度應 ≥ 5.5m。',
        formulaDesc: '法定車位數 = ⌊ (法定容積 + 獎勵 + 移轉) ÷ 150㎡ ⌋；實設預估 = ⌊ 地下室總面積 ÷ 每車位平均面積 ⌋',
        getLiveCheck: (inputs, res) => {
            const stat = res?.statutoryParking || 0;
            const poss = res?.possibleParking || 0;
            const avgArea = parseFloat(inputs?.avgCarArea) || 35;
            const isEnough = poss >= stat;
            return {
                status: isEnough ? 'pass' : 'fail',
                statusLabel: isEnough ? `符合法定 (${poss} ≥ ${stat} 部)` : `不足法定 (${poss} < ${stat} 部)`,
                detail: `法定應設至少 ${stat} 部汽車位；以每部含車道公設平均 ${avgArea} ㎡ 估算，目前地下室可容納約 ${poss} 部汽車位${isEnough ? '，滿足法規要求' : '，建議增加地下開挖層數或開挖率'}。`
            };
        }
    },
    exemptBasement: {
        id: 'exemptBasement',
        category: 'parking',
        title: '地下室停車空間免計容積上限',
        lawName: '建築技術規則建築設計施工編',
        article: '第 162 條第 1 項第 3 款',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=162',
        summary: '建築物地下層為防空避難設備、裝卸、停車空間、機電設備、安全梯之梯間等空間，得不計入總樓地板面積（免計容積）。部分都市計畫區規定增設停車空間或每部車位免計面積上限（實務常以每部車位連同車道約 40㎡ 作為免計核算基準）。',
        formulaDesc: '地下室停車免計基準面積 = 法定車位數 × 40㎡',
        getLiveCheck: (inputs, res) => {
            const val = res?.exemptBasement || 0;
            return {
                status: 'pass',
                statusLabel: `上限約 ${formatNum(val)} ㎡`,
                detail: `以法定車位 ${res?.statutoryParking || 0} 部 × 40㎡ 估算，地下層停車空間免計基準為 ${formatNum(val)} ㎡（${formatNum(toPing(val))} 坪）。`
            };
        }
    },
    setbacks: {
        id: 'setbacks',
        category: 'height',
        title: '前院、側院、後院退縮與建築線指定',
        lawName: '都市計畫法臺灣省施行細則 / 各縣市土地使用分區管制要點',
        article: '建築法第 42、48 條 / 建築技術規則第 41、42 條',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=41',
        summary: '建築基地應依都市計畫細部計畫土地使用分區管制要點留設前院、後院及側院（如中興新村或重劃區常規定前院退縮 4m～6m 作為無遮簷人行道或綠帶、後院退縮 2.5m～3m、側院 1.5m）。退縮範圍內原則上不得建築，但得計入法定空地。',
        formulaDesc: '可建築包絡面 = 基地邊界向內扣除前院、後院、側院退縮深度',
        getLiveCheck: (inputs) => {
            const f = parseFloat(inputs?.frontYardDepth) || 0;
            const s = parseFloat(inputs?.sideYardDepth) || 0;
            const b = parseFloat(inputs?.backYardDepth) || 0;
            return {
                status: 'pass',
                statusLabel: `前 ${f}m / 側 ${s}m / 後 ${b}m`,
                detail: `目前設定臨路前院退縮 ${f}m、側院退縮 ${s}m、後院退縮 ${b}m。3D 與 2D 畫面已自動標示退縮色帶與臨路人行道範圍。`
            };
        }
    },
    floorHeight: {
        id: 'floorHeight',
        category: 'height',
        title: '住宅與集合住宅各層樓層高度限制',
        lawName: '建築技術規則建築設計施工編',
        article: '第 164 條之 1',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=164-1',
        summary: '住宅、集合住宅等類似用途建築物樓板挑空設計者，挑空部分之位置、面積及高度應符合規定；地面一層樓高度不得超過 4.2m，其餘各樓層之樓層高度均不得超過 3.6m。',
        formulaDesc: '地面一層 (1F) ≤ 4.2m；二層以上標準層 (Other) ≤ 3.6m',
        getLiveCheck: (inputs) => {
            const h1 = parseFloat(inputs?.floorHeight1F) || 0;
            const ho = parseFloat(inputs?.floorHeightOther) || 0;
            const ok1 = h1 <= 4.201;
            const oko = ho <= 3.601;
            return {
                status: (ok1 && oko) ? 'pass' : 'fail',
                statusLabel: (ok1 && oko) ? `合規 (1F:${h1}m / 標準:${ho}m)` : `超限 (上限 4.2m / 3.6m)`,
                detail: `目前設定 1F 樓高 ${h1}m（法定上限 4.2m）、標準層樓高 ${ho}m（法定上限 3.6m）。${(!ok1 || !oko) ? '⚠️ 注意：住宅用途超過此樓高上限將無法通過建照審查（除非一樓申請非住宅用途或挑空檢討）。' : '符合建築技術規則第 164-1 條規定。'}`
            };
        }
    },
    buildingHeight: {
        id: 'buildingHeight',
        category: 'height',
        title: '建築物高度計算與高層建築物判定',
        lawName: '建築技術規則建築設計施工編',
        article: '第 1 條第 9 款、第 227 條（高層建築物專章）',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=227',
        summary: '建築物高度自基地地面計量至建築物最高部分之垂直高度（屋突高度在 6m 或有昇降機 9m 以內且面積未逾 1/8 者免計入）。高度在 50m 以上或樓層在 16 層以上之建築物屬「高層建築物」，應依第十二章高層建築物專章檢討防災、結構與落物曲線。',
        formulaDesc: '建築物高度 = 1F樓高 + 標準層樓高 × (地上層數 - 1)（高層判定：H ≥ 50m 或 ≥ 16F）',
        getLiveCheck: (inputs, res) => {
            const h = res?.buildingHeight || 0;
            const f = res?.floorsAbove || 1;
            const isHighRiseCode = h >= 50 || f >= 16;
            const isFire24 = h > 24;
            return {
                status: isHighRiseCode ? 'warn' : 'pass',
                statusLabel: isHighRiseCode ? `高層建築 (${formatNum(h, 1)}m / ${f}F)` : `一般建築 (${formatNum(h, 1)}m / ${f}F)`,
                detail: `目前總高約 ${formatNum(h, 1)}m（地上 ${f} 層）。${isHighRiseCode ? '已達高層建築物標準（≥50m 或 ≥16層），須啟動 50m 落物曲線退縮與高層專章檢討。' : (isFire24 ? '高度超過 24m，請注意雙安全梯（第 95 條）與緊急昇降機（第 106 條，超過 10 層）設置規定。' : '未達高層建築物門檻。')}`
            };
        }
    },
    heightRatio: {
        id: 'heightRatio',
        category: 'checkline',
        title: '面前道路建築物高度比檢討線',
        lawName: '建築技術規則建築設計施工編',
        article: '第 14 條（舊法 1:3.6）、第 164 條（容積管制 1:1.5 陰影面積）',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=164',
        summary: '建築物以面前道路對側境界線起算高度限制：依第 164 條規定，建築物在地面以上各層投影於面前道路之陰影面積不得超過面前道路面積乘以 1.5（等效高度比 H / (Sw + L) ≤ 1.5，或高層漸退）；部分地區或舊法規、特定都市計畫區則採面前道路寬度加退縮深度之 3.6 倍檢討（H ≤ 3.6 × (Sw + 前院)）。',
        formulaDesc: '高度比 = 建築物高度 H ÷ (主要面前道路寬度 Sw + 前院退縮深度 L)',
        getLiveCheck: (inputs, res) => {
            const hr = res?.heightRatio || 0;
            const mainRoad = (inputs?.roads || []).find(r => r.type === 'primary') || (inputs?.roads || [])[0];
            const rw = mainRoad ? (parseFloat(mainRoad.width) || 0) : 0;
            const fy = parseFloat(inputs?.frontYardDepth) || 0;
            const h = res?.buildingHeight || 0;
            const limit36 = 3.6 * (rw + fy);
            const limit15 = 1.5 * (rw + fy);
            return {
                status: hr <= 1.5 ? 'pass' : (hr <= 3.6 ? 'warn' : 'fail'),
                statusLabel: `高度比 ${formatNum(hr, 2)}`,
                detail: `面前主路寬 ${rw}m + 前院 ${fy}m = 水平距離 ${formatNum(rw + fy, 1)}m。以 1:1.5 基準可直上高度為 ${formatNum(limit15, 1)}m；以 3D 檢討面 1:3.6 斜率基準，在退縮線處高度上限為 ${formatNum(limit36, 1)}m（目前建築高度 ${formatNum(h, 1)}m），超過部分由 3D 高度比斜面自動退縮裁切。`
            };
        }
    },
    backyardDepthRatio: {
        id: 'backyardDepthRatio',
        category: 'checkline',
        title: '後院深度比與背側採光退縮檢討線',
        lawName: '建築技術規則建築設計施工編',
        article: '第 41 條、第 42 條、第 165 條',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=41',
        summary: '住宅區建築物或特定都市計畫區規定應留設後院深度比（即建築物各部分高度與自該部分至基地後側境界線水平距離之比，如 1:2 或 1:3.6），以確保鄰地日照、採光及通風。當設定最小後院深度比 > 0 時，3D 綠線將標示後院斜率包絡線。',
        formulaDesc: '後院深度比 = 建築物高度 H ÷ 後院退縮深度 D_back',
        getLiveCheck: (inputs, res) => {
            const by = parseFloat(inputs?.backYardDepth) || 0;
            const minRatio = parseFloat(inputs?.minBackyardDepthRatio) || 0;
            const actualRatio = res?.backyardDepthRatio || 0;
            const isViolated = minRatio > 0 && actualRatio > minRatio;
            return {
                status: isViolated ? 'warn' : 'pass',
                statusLabel: minRatio > 0 ? `設定比 1:${minRatio} (實際 1:${formatNum(actualRatio, 2)})` : `固定後院 ${by}m`,
                detail: minRatio > 0
                    ? `已啟用最小後院深度比 1:${minRatio} 檢討，高樓層若超過斜率線（H > ${minRatio} × 後院距離）將自動向基地內側退縮。`
                    : `目前採固定後院深度 ${by}m 檢討（未啟用後院斜率比限制；若土管要點有後院深度比規定，可輸入比率數值）。`
            };
        }
    },
    weiLaoRatio: {
        id: 'weiLaoRatio',
        category: 'checkline',
        title: '危老重建放寬高度比檢討線 (路心 1:5)',
        lawName: '都市危險及老舊建築物加速重建條例暨地方自治法規',
        article: '危老條例第 7 條 / 各縣市危老重建放寬高度比規定',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070249&flno=7',
        summary: '依危老條例重建之建築物，為協助小基地順利用足危老獎勵容積，多數縣市放寬高度比檢討改以「自面前道路中心線起算 1:5 斜率」控制（即 H ≤ 5 × (0.5 × 面前道路寬度 + 臨路退縮深度)）。',
        formulaDesc: '危老容許高度 H_wl ≤ 5 × (0.5 × 主路寬 Sw + 前院退縮 L)',
        getLiveCheck: (inputs, res) => {
            const mainRoad = (inputs?.roads || []).find(r => r.type === 'primary') || (inputs?.roads || [])[0];
            const rw = mainRoad ? (parseFloat(mainRoad.width) || 0) : 0;
            const fy = parseFloat(inputs?.frontYardDepth) || 0;
            const maxH = 5 * (0.5 * rw + fy);
            const curH = res?.buildingHeight || 0;
            return {
                status: curH <= maxH ? 'pass' : 'warn',
                statusLabel: `路心 1:5 上限 ${formatNum(maxH, 1)}m`,
                detail: `自路心起算水平距離為 0.5 × ${rw}m + ${fy}m = ${formatNum(0.5 * rw + fy, 1)}m，乘以 5 倍得危老退縮線處容許高度為 ${formatNum(maxH, 1)}m（目前建築高度 ${formatNum(curH, 1)}m）。`
            };
        }
    },
    arcadeDepth: {
        id: 'arcadeDepth',
        category: 'height',
        title: '法定騎樓與無遮簷人行道設置標準',
        lawName: '建築技術規則建築設計施工編',
        article: '第 28 條、第 57 條',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=57',
        summary: '商業區之法定騎樓或無遮簷人行道所占面積，得依第 28 條規定於計算建蔽率時予以扣除。依第 57 條規定，凡經指定在道路兩旁留設之騎樓或無遮簷人行道，其寬度一概以 3.5m 為原則（或依都市計畫規定 3.64m～4.0m），騎樓自道路境界線至建築物地面層外牆面，淨高不得小於 3.0m，構造上並應留設至少 2.5m 淨寬之行人通道。',
        formulaDesc: '騎樓標準深度 ≥ 3.5m（自道路境界線至 1F 外牆面，二樓以上可外挑對齊道路境界線）',
        getLiveCheck: (inputs) => {
            const fy = parseFloat(inputs?.frontYardDepth) || 0;
            const arc = parseFloat(inputs?.arcadeDepth) || 0;
            return {
                status: (fy === 0 && arc > 0 && arc < 3.5) ? 'warn' : 'pass',
                statusLabel: fy === 0 ? `騎樓深度 ${arc}m` : `已設前院 ${fy}m`,
                detail: fy === 0
                    ? `目前前院設為 0m，1F 騎樓深度設為 ${arc}m（2F 以上量體對齊建築線）。提醒：法定騎樓寬度原則上應 ≥ 3.5m（或 3.64m）。`
                    : `目前已留設前院深度 ${fy}m；若為商業區無前院退縮而改設 1F 騎樓，可將前院設為 0m 即可調整騎樓深度。`
            };
        }
    },
    fallingCurve50m: {
        id: 'fallingCurve50m',
        category: 'checkline',
        title: '高層建築物 50m 落物曲線退縮檢討',
        lawName: '建築技術規則建築設計施工編',
        article: '第 229 條（高層建築物落物防範）',
        mojUrl: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=229',
        summary: '高層建築物（高度 ≥ 50m 或 ≥ 16層）應自建築物各部分高度 50m 以上部分，為防止物體墜落傷害，自外牆中心線向內退縮建築，退縮距離 D 應符合 D ≥ √H / 2（H 為建築物各該部分之高度），或於低樓層設置緩衝挑臺。',
        formulaDesc: '50m 以上外牆最小退縮距離 D = √H ÷ 2 (m)',
        getLiveCheck: (inputs, res) => {
            const h = res?.buildingHeight || 0;
            const required = h > 50;
            const dVal = required ? Math.sqrt(h) / 2 : 0;
            return {
                status: required ? 'warn' : 'pass',
                statusLabel: required ? `已觸發 (需退縮 ${formatNum(dVal, 2)}m)` : '未達 50m 免檢討',
                detail: required
                    ? `目前建築物高度達 ${formatNum(h, 1)}m（超過 50m），依法於 50m 以上樓層須滿足落物曲線退縮 D ≥ √${formatNum(h, 1)} / 2 = ${formatNum(dVal, 2)}m，系統已在 3D 橘色檢討線自動標示。`
                    : `目前建築高度 ${formatNum(h, 1)}m 未超過 50m，尚無須檢討第 229 條 50m 落物曲線。`
            };
        }
    }
};

/**
 * 依據詳細計算表列 ID 對應至法規項目 Key
 */
export const ROW_TO_REGULATION_KEY = {
    base: 'base',
    maxBuildingArea: 'maxBuildingArea',
    statutoryFA: 'statutoryFA',
    incentiveArea: 'incentiveArea',
    transferArea: 'transferArea',
    exempt15: 'exempt15',
    exemptStair: 'exemptStair',
    exemptIndoor: 'exemptIndoor',
    balcony: 'balcony',
    permittedIndoor: 'permittedIndoor',
    roofProtrusion: 'roofProtrusion',
    totalBasementArea: 'totalBasementArea',
    totalCFA: 'totalCFA',
    floorsAbove: 'floorsAbove',
    parking: 'parking',
    exemptBasement: 'exemptBasement',
    setbacks: 'setbacks',
    floorHeight: 'floorHeight',
    buildingHeight: 'buildingHeight',
    heightRatio: 'heightRatio',
    backyardDepthRatio: 'backyardDepthRatio',
    weiLaoRatio: 'weiLaoRatio',
    arcadeDepth: 'arcadeDepth',
    fallingCurve50m: 'fallingCurve50m'
};

export const REGULATION_CATEGORIES = [
    { id: 'all', label: '全部檢討項目' },
    { id: 'checkline', label: '3D 檢討線與斜率' },
    { id: 'base', label: '基地與建蔽容積' },
    { id: 'exempt', label: '免計容積與獎勵' },
    { id: 'height', label: '高度與院落退縮' },
    { id: 'parking', label: '停車與地下室' }
];
