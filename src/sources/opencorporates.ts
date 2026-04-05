/**
 * OpenCorporates API — free: 500 requests/month.
 * Corporate registry data: incorporation date, status, jurisdiction.
 */

export interface OpenCorpResult {
  companyName: string;
  companyNumber: string | null;
  jurisdiction: string | null;
  incorporationDate: string | null;
  companyType: string | null;
  status: string | null;
  registeredAddress: string | null;
  officers: { name: string; position: string | null }[];
}

export async function searchOpenCorporates(
  companyName: string,
  token: string | undefined
): Promise<OpenCorpResult | null> {
  try {
    const query = encodeURIComponent(companyName);
    const tokenParam = token ? `&api_token=${token}` : "";
    const resp = await fetch(
      `https://api.opencorporates.com/v0.4/companies/search?q=${query}&per_page=1${tokenParam}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      results: {
        companies: {
          company: {
            name: string;
            company_number: string;
            jurisdiction_code: string;
            incorporation_date: string | null;
            company_type: string | null;
            current_status: string | null;
            registered_address_in_full: string | null;
            officers: {
              officer: {
                name: string;
                position: string | null;
              };
            }[];
          };
        }[];
      };
    };

    const companies = data.results?.companies;
    if (!companies || companies.length === 0) return null;

    const c = companies[0].company;
    return {
      companyName: c.name,
      companyNumber: c.company_number,
      jurisdiction: c.jurisdiction_code,
      incorporationDate: c.incorporation_date,
      companyType: c.company_type,
      status: c.current_status,
      registeredAddress: c.registered_address_in_full,
      officers: (c.officers || []).slice(0, 10).map((o) => ({
        name: o.officer.name,
        position: o.officer.position,
      })),
    };
  } catch {
    return null;
  }
}
