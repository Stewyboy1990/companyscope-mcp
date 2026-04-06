/**
 * Domain intelligence — DNS records, SSL info, IP geolocation, MX records.
 * Uses DNS-over-HTTPS (Cloudflare 1.1.1.1) and existing RDAP data.
 * No API keys required.
 */

import { fetchRDAPData, type RDAPData } from "./rdap.js";

export interface DNSRecord {
  type: string;
  value: string;
}

export interface SSLInfo {
  issuer: string | null;
  validFrom: string | null;
  validTo: string | null;
  protocol: string | null;
}

export interface DomainIntel {
  domain: string;
  // DNS records
  aRecords: string[];
  aaaaRecords: string[];
  mxRecords: { host: string; priority: number }[];
  nsRecords: string[];
  txtRecords: string[];
  cnameRecords: string[];
  // RDAP/WHOIS
  registrar: string | null;
  registrationDate: string | null;
  expirationDate: string | null;
  domainAge: string | null;
  nameservers: string[];
  status: string[];
  // SSL
  ssl: SSLInfo | null;
  // Inferred hosting
  inferredHosting: string | null;
  inferredEmailProvider: string | null;
}

export async function fetchDomainIntel(
  domain: string
): Promise<DomainIntel> {
  // Run all lookups in parallel
  const [
    aRecords,
    aaaaRecords,
    mxRecords,
    nsRecords,
    txtRecords,
    cnameRecords,
    rdapData,
  ] = await Promise.allSettled([
    dnsLookup(domain, "A"),
    dnsLookup(domain, "AAAA"),
    dnsLookupMX(domain),
    dnsLookup(domain, "NS"),
    dnsLookup(domain, "TXT"),
    dnsLookup(domain, "CNAME"),
    fetchRDAPData(domain),
  ]);

  const aRecs = aRecords.status === "fulfilled" ? aRecords.value : [];
  const aaaaRecs = aaaaRecords.status === "fulfilled" ? aaaaRecords.value : [];
  const mxRecs = mxRecords.status === "fulfilled" ? mxRecords.value : [];
  const nsRecs = nsRecords.status === "fulfilled" ? nsRecords.value : [];
  const txtRecs = txtRecords.status === "fulfilled" ? txtRecords.value : [];
  const cnameRecs = cnameRecords.status === "fulfilled" ? cnameRecords.value : [];
  const rdap: RDAPData | null =
    rdapData.status === "fulfilled" ? rdapData.value : null;

  // Infer hosting provider from nameservers and CNAME
  const inferredHosting = inferHosting(nsRecs, cnameRecs, aRecs);
  const inferredEmailProvider = inferEmailProvider(mxRecs);

  return {
    domain,
    aRecords: aRecs,
    aaaaRecords: aaaaRecs,
    mxRecords: mxRecs,
    nsRecords: nsRecs,
    txtRecords: txtRecs.slice(0, 20), // TXT can be noisy
    cnameRecords: cnameRecs,
    registrar: rdap?.registrar || null,
    registrationDate: rdap?.registrationDate || null,
    expirationDate: rdap?.expirationDate || null,
    domainAge: rdap?.domainAge || null,
    nameservers: rdap?.nameservers || nsRecs,
    status: rdap?.status || [],
    ssl: null, // Can't do TLS handshake from Workers, RDAP/DNS is enough
    inferredHosting,
    inferredEmailProvider,
  };
}

async function dnsLookup(domain: string, type: string): Promise<string[]> {
  try {
    const resp = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`,
      {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      Answer?: { data: string; type: number }[];
    };
    return (data.Answer || []).map((a) => a.data.replace(/^"|"$/g, ""));
  } catch {
    return [];
  }
}

async function dnsLookupMX(
  domain: string
): Promise<{ host: string; priority: number }[]> {
  try {
    const resp = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      Answer?: { data: string; type: number }[];
    };
    return (data.Answer || []).map((a) => {
      const parts = a.data.split(" ");
      return {
        priority: parseInt(parts[0]) || 0,
        host: (parts[1] || "").replace(/\.$/, "").toLowerCase(),
      };
    });
  } catch {
    return [];
  }
}

function inferHosting(
  nsRecords: string[],
  cnameRecords: string[],
  aRecords: string[]
): string | null {
  const all = [...nsRecords, ...cnameRecords].join(" ").toLowerCase();

  if (all.includes("cloudflare")) return "Cloudflare";
  if (all.includes("awsdns") || all.includes("amazonaws")) return "AWS";
  if (all.includes("azure") || all.includes("microsoft")) return "Microsoft Azure";
  if (all.includes("googledomains") || all.includes("google")) return "Google Cloud";
  if (all.includes("vercel")) return "Vercel";
  if (all.includes("netlify")) return "Netlify";
  if (all.includes("digitalocean")) return "DigitalOcean";
  if (all.includes("hetzner")) return "Hetzner";
  if (all.includes("fastly")) return "Fastly";
  if (all.includes("akamai")) return "Akamai";
  if (all.includes("godaddy")) return "GoDaddy";
  if (all.includes("namecheap")) return "Namecheap";

  return null;
}

function inferEmailProvider(
  mxRecords: { host: string; priority: number }[]
): string | null {
  const hosts = mxRecords.map((m) => m.host).join(" ").toLowerCase();

  if (hosts.includes("google") || hosts.includes("gmail")) return "Google Workspace";
  if (hosts.includes("outlook") || hosts.includes("microsoft")) return "Microsoft 365";
  if (hosts.includes("protonmail") || hosts.includes("proton")) return "Proton Mail";
  if (hosts.includes("zoho")) return "Zoho Mail";
  if (hosts.includes("mimecast")) return "Mimecast";
  if (hosts.includes("barracuda")) return "Barracuda";
  if (hosts.includes("pphosted") || hosts.includes("proofpoint")) return "Proofpoint";
  if (hosts.includes("mailgun")) return "Mailgun";
  if (hosts.includes("sendgrid")) return "SendGrid";
  if (hosts.includes("fastmail")) return "Fastmail";

  return null;
}
