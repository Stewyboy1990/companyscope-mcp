# CompanyScope MCP Server - Company Intelligence in One Call

Research any company in seconds. CompanyScope is an MCP server that aggregates **12 free public data sources** in parallel, returning a comprehensive company profile — financials, tech stack, competitors, patents, key people, job postings, domain info, social presence, and news — from a single tool call.

**No API keys required.** All core data sources are free and public. Optional enrichment available with Hunter.io and NewsAPI keys.

## Quick Start — Click "Run" on Apify

1. Enter one or more company names or domains (e.g. `stripe.com`, `Anthropic`, `openai.com`)
2. Choose which tools to run (default: profile + tech stack + key people + competitors)
3. Click **Run** — get a full intelligence report in your dataset

No MCP client required. Works like any other Apify Actor.

## Why CompanyScope?

- **11 tools, one server** — Full company intelligence: profiles, financials, competitors, patents, jobs, social media, domain intel, and more.
- **Two modes** — Click "Run" for instant batch reports, or connect via MCP for AI agent workflows.
- **12 free data sources** — Wikipedia, GitHub, SEC EDGAR, RDAP, DNS, OpenCorporates, Brave Search, Google Patents, web scraping, social media detection, and careers pages. Zero marginal cost.
- **SEC financials** — Revenue, net income, total assets, stock tickers, and recent 10-K/10-Q filings for US public companies.
- **Competitor discovery** — Find competing companies via web search with names, URLs, and descriptions.
- **Patent search** — Search US patents by company assignee via Google Patents.
- **MCP-native** — Also works with Claude Desktop, Cursor, Windsurf, Cline, and any MCP-compatible AI client.
- **Public data only** — No paid API dependencies. No Crunchbase subscription. No LinkedIn scraping.

## Connect via MCP

CompanyScope runs in **Standby mode** — always-on, persistent endpoint. Add to your MCP client:

```
https://constructive-wainscot--companyscope-mcp.apify.actor/mcp
```

Pass your Apify API token as a Bearer token in the Authorization header.

Or use `npx mcp-remote`:
```bash
npx mcp-remote https://constructive-wainscot--companyscope-mcp.apify.actor/mcp \
  --header "Authorization: Bearer YOUR_APIFY_TOKEN"
```

## Tools

| Tool | What it does | Price |
|------|-------------|-------|
| `lookup_company` | Full company profile: description, tech stack, people, financials, news, domain, registry | $0.15 |
| `get_tech_stack` | Detect 19+ frameworks, languages, hosting, analytics from website + GitHub repos | $0.05 |
| `get_key_people` | Find founders, executives, team members with titles from Wikipedia and web | $0.05 |
| `get_financials` | SEC EDGAR data: revenue, net income, assets, liabilities, stock tickers, recent filings | $0.08 |
| `get_competitors` | Find competitors and alternatives via web search | $0.05 |
| `get_patents` | Search US patents assigned to a company via Google Patents | $0.05 |
| `get_domain_intel` | DNS records, WHOIS/RDAP, hosting provider, email service detection | $0.03 |
| `get_job_postings` | Open positions from careers pages — titles, departments, locations | $0.03 |
| `get_social_presence` | Social media across 12 platforms + GitHub org stats | $0.03 |
| `get_company_news` | Recent news articles about the company | $0.03 |
| `get_corporate_registry` | Corporate registry data: incorporation, officers, jurisdiction (140+ countries) | $0.03 |

## 12 Data Sources

All sources are free public APIs and websites — no paid subscriptions required:

| Source | Data Provided |
|--------|--------------|
| **Wikipedia / Wikidata** | Company description, founding year, headquarters, employee count, industry, revenue, founders, CEO |
| **GitHub API** | Organization profile, top repositories, programming languages, stars, contributor activity |
| **SEC EDGAR** | Revenue, net income, total assets, liabilities, equity, stock tickers, exchanges, SIC code, recent SEC filings |
| **RDAP** | Domain registrar, registration date, expiration date, nameservers, domain age |
| **DNS (Cloudflare DoH)** | A, AAAA, MX, NS, TXT, CNAME records; inferred hosting provider and email service |
| **Web Scraping** | Company name, description, meta tags, tech stack detection (19+ frameworks) |
| **Social Media Detection** | Profiles across 12 platforms (LinkedIn, Twitter/X, GitHub, YouTube, Facebook, Instagram, etc.) |
| **OpenCorporates** | Incorporation date, jurisdiction, company type, registered address, officers (140+ countries) |
| **Brave Search** | Competitor discovery, patent search, company news |
| **Google Patents** | US patents by company assignee — titles, IDs, dates, links |
| **Careers Pages** | Job postings, departments, locations, ATS platform detection |
| **Glassdoor / Review Sites** | Company ratings and employer brand signals via web search |

### Optional Enrichment (pass API keys in Actor input)

- **Hunter.io** — Email patterns, key people with verified emails (free tier: 25 lookups/month)
- **NewsAPI** — Broader news coverage with full article text (free tier: 100 requests/day)

## Example Output

```json
{
  "name": "APPLE INC",
  "description": "Apple Inc. is an American multinational corporation and technology company...",
  "founded": "April 1, 1976",
  "industry": "Electronic Computers",
  "headquarters": "Cupertino, California, U.S.",
  "employees": 164000,
  "stockTickers": ["AAPL"],
  "exchanges": ["Nasdaq"],
  "financials": {
    "revenue": { "value": 391035000000, "unit": "USD", "period": "FY ending 2024-09-28" },
    "netIncome": { "value": 93736000000, "unit": "USD", "period": "FY ending 2024-09-28" },
    "totalAssets": { "value": 364980000000, "unit": "USD", "period": "FY ending 2024-09-28" }
  },
  "recentFilings": [
    { "form": "10-K", "filingDate": "2024-11-01", "description": "Annual Report" }
  ],
  "domain": {
    "registrar": "CSC Corporate Domains, Inc.",
    "registrationDate": "1987-02-19",
    "nameservers": ["a.ns.apple.com", "b.ns.apple.com"]
  },
  "techStack": ["React", "Next.js", "Swift", "Objective-C"],
  "keyPeople": [
    { "name": "Tim Cook", "title": "CEO", "source": "wikipedia" },
    { "name": "Steve Jobs", "title": "Co-founder", "source": "wikipedia" }
  ],
  "confidence": 0.86,
  "sources": ["apple.com", "github.com", "wikipedia.org", "sec.gov", "opencorporates.com", "rdap"]
}
```

## Use Cases

- **Sales prospecting & lead enrichment** — Research target companies before outreach. Get tech stack, team size, and financial health in one call.
- **Financial analysis & due diligence** — Pull revenue, net income, total assets, and recent SEC filings for any US public company.
- **Competitive intelligence** — Discover competitors, compare tech stacks, team composition, and patent portfolios.
- **Hiring intelligence** — Track which companies are hiring, in what roles, and where.
- **Market research** — Aggregate company data across an entire sector or industry.
- **AI agent workflows** — Let your AI assistant autonomously research companies, enrich CRM records, or build prospect lists.

## Also Available

- **npm**: `npx companyscope-mcp` (free, stdio transport)
- **Cloudflare Workers**: [companyscope-mcp.stewwilli.workers.dev](https://companyscope-mcp.stewwilli.workers.dev/) (free, no account needed)
- **GitHub**: [Stewyboy1990/companyscope-mcp](https://github.com/Stewyboy1990/companyscope-mcp)
- **Official MCP Registry**: `io.github.Stewyboy1990/companyscope-mcp`
- **Smithery**: `stewyboy1990/companyscope-mcp`
