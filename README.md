# CompanyScope MCP Server

Company intelligence in one tool call. Get comprehensive company profiles, tech stacks, key people, news, and corporate data from any domain or company name.

**Live endpoint:** `https://companyscope-mcp.stewwilli.workers.dev/mcp`

## Tools

| Tool | Description |
|------|-------------|
| `lookup_company` | Full company profile — founding info, description, tech stack, key people, news, corporate data |
| `get_tech_stack` | Detect frameworks, languages, hosting, and analytics a company uses |
| `get_key_people` | Find founders, executives, and team members with titles |
| `get_company_news` | Recent news articles about a company |
| `get_funding_history` | Corporate registry data — incorporation, jurisdiction, officers |

## Quick Start

### Use the hosted server (recommended)

Connect directly to the remote MCP endpoint — no installation required:

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "companyscope": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://companyscope-mcp.stewwilli.workers.dev/mcp"
      ]
    }
  }
}
```

**Claude Code:**
```bash
claude mcp add companyscope --transport http https://companyscope-mcp.stewwilli.workers.dev/mcp
```

**Cursor / any MCP client:**
```
Endpoint: https://companyscope-mcp.stewwilli.workers.dev/mcp
Transport: Streamable HTTP
```

### Self-host on Cloudflare Workers

```bash
git clone https://github.com/Stewyboy1990/companyscope-mcp.git
cd companyscope-mcp
npm install
# Create KV namespace
wrangler kv namespace create CACHE
# Update wrangler.toml with your KV namespace ID
npm run deploy
```

## Data Sources

All data is aggregated from **free public APIs** — no paid API keys required for core functionality:

| Source | Data Provided |
|--------|--------------|
| Website scraping | Company name, description, tech stack, social links |
| GitHub API | Programming languages, top repos, org info |
| Wikipedia | Company summary, founding year, HQ, employees, industry, revenue, founders, CEO |
| OpenCorporates | Incorporation date, jurisdiction, registered officers |
| Hunter.io (optional) | Email patterns, key contacts |
| NewsAPI (optional) | Recent news articles |

## Example Output

```
> lookup_company("anthropic.com")
```

Returns a structured profile with:
- Company name, description, industry
- Founded date, headquarters, employee count
- Tech stack (from website + GitHub)
- Key people (from corporate registry, website, Wikipedia)
- Recent news
- Social profiles
- Confidence score (0-1 based on data sources that returned data)

## Rate Limits

| Tier | Calls/Day | Price |
|------|-----------|-------|
| Free | 25 | $0 |
| Pro | Unlimited | Coming soon |

## Architecture

- **Runtime:** Cloudflare Workers (edge, ~50ms cold start)
- **Transport:** MCP Streamable HTTP (stateless)
- **Caching:** Cloudflare KV (24hr TTL)
- **Auth:** Rate limiting by IP or API key

## Development

```bash
npm run dev      # Local dev server
npm run deploy   # Deploy to Cloudflare
```

## License

MIT
