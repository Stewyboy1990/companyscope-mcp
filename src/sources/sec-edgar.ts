/**
 * SEC EDGAR data source — free, no API key needed.
 * Provides: CIK, SIC code, industry, state, fiscal year end, recent filings,
 * and key financial facts (revenue, net income, total assets) for US public companies.
 */

const USER_AGENT = "CompanyScope contact@companyscope.dev";

export interface SECCompanyData {
    cik: string;
    entityName: string;
    sic: string | null;
    sicDescription: string | null;
    stateOfIncorporation: string | null;
    fiscalYearEnd: string | null;
    tickers: string[];
    exchanges: string[];
    recentFilings: SECFiling[];
    financials: SECFinancials | null;
    secUrl: string;
}

export interface SECFiling {
    form: string;
    filingDate: string;
    primaryDocument: string;
    description: string;
}

export interface SECFinancials {
    revenue: FinancialFact | null;
    netIncome: FinancialFact | null;
    totalAssets: FinancialFact | null;
    totalLiabilities: FinancialFact | null;
    stockholdersEquity: FinancialFact | null;
    period: string | null;
}

interface FinancialFact {
    value: number;
    unit: string;
    period: string;
}

// In-memory ticker lookup cache (loaded once)
let tickerCache: Map<string, { cik: string; ticker: string; name: string }> | null = null;

async function loadTickerMap(): Promise<Map<string, { cik: string; ticker: string; name: string }>> {
    if (tickerCache) return tickerCache;

    const resp = await fetch("https://www.sec.gov/files/company_tickers.json", {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
        tickerCache = new Map();
        return tickerCache;
    }

    const data = (await resp.json()) as Record<string, { cik_str: number; ticker: string; title: string }>;
    tickerCache = new Map();

    for (const entry of Object.values(data)) {
        const nameLower = entry.title.toLowerCase();
        const tickerLower = entry.ticker.toLowerCase();
        const cikPadded = String(entry.cik_str).padStart(10, "0");
        const record = { cik: cikPadded, ticker: entry.ticker, name: entry.title };

        tickerCache.set(nameLower, record);
        tickerCache.set(tickerLower, record);
    }

    return tickerCache;
}

function findCIK(companyName: string, tickers: Map<string, { cik: string; ticker: string; name: string }>): { cik: string; ticker: string; name: string } | null {
    const lower = companyName.toLowerCase().trim();
    // Strip domain suffix if passed
    const cleaned = lower.replace(/\.(com|io|org|net|co|ai)$/i, "");

    // Exact match on cleaned or original
    if (tickers.has(cleaned)) return tickers.get(cleaned)!;
    if (tickers.has(lower)) return tickers.get(lower)!;

    // Partial match — require key to be substantial (>3 chars) to avoid
    // matching short tickers like "t" (AT&T) against unrelated queries
    let bestMatch: { cik: string; ticker: string; name: string } | null = null;
    let bestScore = 0;

    for (const [key, val] of tickers) {
        // Skip very short keys for substring matching — too many false positives
        if (key.length <= 3) continue;

        if (key.includes(cleaned) || cleaned.includes(key)) {
            // Prefer exact prefix matches and longer keys
            const score = key === cleaned ? 100
                : key.startsWith(cleaned) ? 90
                : cleaned.startsWith(key) ? 70 + key.length
                : 50;
            if (score > bestScore) {
                bestScore = score;
                bestMatch = val;
            }
        }
    }

    return bestMatch;
}

export async function fetchSECData(companyName: string): Promise<SECCompanyData | null> {
    try {
        const tickers = await loadTickerMap();
        const match = findCIK(companyName, tickers);
        if (!match) return null;

        const { cik } = match;

        // Fetch submissions (metadata + filings) and company facts in parallel
        const [submResp, factsResp] = await Promise.allSettled([
            fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
                headers: { "User-Agent": USER_AGENT },
                signal: AbortSignal.timeout(8000),
            }),
            fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
                headers: { "User-Agent": USER_AGENT },
                signal: AbortSignal.timeout(8000),
            }),
        ]);

        const result: SECCompanyData = {
            cik,
            entityName: match.name,
            sic: null,
            sicDescription: null,
            stateOfIncorporation: null,
            fiscalYearEnd: null,
            tickers: [match.ticker],
            exchanges: [],
            recentFilings: [],
            financials: null,
            secUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`,
        };

        // Parse submissions data
        if (submResp.status === "fulfilled" && submResp.value.ok) {
            const subm = (await submResp.value.json()) as {
                name: string;
                sic: string;
                sicDescription: string;
                stateOfIncorporation: string;
                fiscalYearEnd: string;
                tickers: string[];
                exchanges: string[];
                filings: {
                    recent: {
                        form: string[];
                        filingDate: string[];
                        primaryDocument: string[];
                        primaryDocDescription: string[];
                    };
                };
            };

            result.entityName = subm.name || result.entityName;
            result.sic = subm.sic || null;
            result.sicDescription = subm.sicDescription || null;
            result.stateOfIncorporation = subm.stateOfIncorporation || null;
            result.fiscalYearEnd = subm.fiscalYearEnd || null;
            result.tickers = subm.tickers?.length ? subm.tickers : result.tickers;
            result.exchanges = subm.exchanges || [];

            // Get recent important filings (10-K, 10-Q, 8-K)
            const filings = subm.filings?.recent;
            if (filings?.form) {
                const importantForms = new Set(["10-K", "10-Q", "8-K", "S-1", "DEF 14A"]);
                let count = 0;
                for (let i = 0; i < filings.form.length && count < 5; i++) {
                    if (importantForms.has(filings.form[i])) {
                        result.recentFilings.push({
                            form: filings.form[i],
                            filingDate: filings.filingDate[i],
                            primaryDocument: filings.primaryDocument[i],
                            description: filings.primaryDocDescription[i] || filings.form[i],
                        });
                        count++;
                    }
                }
            }
        }

        // Parse financial facts
        if (factsResp.status === "fulfilled" && factsResp.value.ok) {
            const facts = (await factsResp.value.json()) as {
                facts: {
                    "us-gaap"?: Record<string, {
                        units: Record<string, Array<{
                            val: number;
                            end: string;
                            fp: string;
                            frame?: string;
                            form: string;
                        }>>;
                    }>;
                };
            };

            const gaap = facts.facts?.["us-gaap"];
            if (gaap) {
                result.financials = {
                    revenue: getLatestAnnualFact(gaap, ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax"]),
                    netIncome: getLatestAnnualFact(gaap, ["NetIncomeLoss", "ProfitLoss"]),
                    totalAssets: getLatestAnnualFact(gaap, ["Assets"]),
                    totalLiabilities: getLatestAnnualFact(gaap, ["Liabilities", "LiabilitiesAndStockholdersEquity"]),
                    stockholdersEquity: getLatestAnnualFact(gaap, ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"]),
                    period: null,
                };

                // Set the period from whatever fact we found
                const anyFact = result.financials.revenue || result.financials.netIncome || result.financials.totalAssets;
                if (anyFact) {
                    result.financials.period = anyFact.period;
                }
            }
        }

        return result;
    } catch {
        return null;
    }
}

function getLatestAnnualFact(
    gaap: Record<string, { units: Record<string, Array<{ val: number; end: string; fp: string; frame?: string; form: string }>> }>,
    conceptNames: string[]
): FinancialFact | null {
    for (const concept of conceptNames) {
        const item = gaap[concept];
        if (!item) continue;

        const usdEntries = item.units?.USD;
        if (!usdEntries || usdEntries.length === 0) continue;

        // Find the latest annual (FY) entry from 10-K filings
        const annuals = usdEntries.filter(e => e.fp === "FY" || e.form === "10-K");
        if (annuals.length === 0) continue;

        // Sort by end date descending
        annuals.sort((a, b) => b.end.localeCompare(a.end));
        const latest = annuals[0];

        return {
            value: latest.val,
            unit: "USD",
            period: `FY ending ${latest.end}`,
        };
    }
    return null;
}
