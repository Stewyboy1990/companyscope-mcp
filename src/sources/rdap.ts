/**
 * RDAP (Registration Data Access Protocol) — free WHOIS replacement.
 * Returns domain registration data: registrar, creation/expiry dates, nameservers, status.
 * No API key required. Uses RDAP bootstrap via rdap.org.
 */

export interface RDAPData {
  registrar: string | null;
  registrationDate: string | null;
  expirationDate: string | null;
  lastUpdated: string | null;
  nameservers: string[];
  status: string[];
  domainAge: string | null; // e.g. "12 years"
}

export async function fetchRDAPData(domain: string): Promise<RDAPData | null> {
  try {
    // Use rdap.org bootstrap which routes to the correct RDAP server
    const resp = await fetch(`https://rdap.org/domain/${domain}`, {
      headers: {
        Accept: "application/rdap+json",
        "User-Agent": "CompanyScope/1.0 (https://github.com/Stewyboy1990/companyscope-mcp)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) return null;

    const data = await resp.json() as any;

    // Extract dates from events array
    let registrationDate: string | null = null;
    let expirationDate: string | null = null;
    let lastUpdated: string | null = null;

    if (data.events) {
      for (const event of data.events) {
        if (event.eventAction === "registration") {
          registrationDate = event.eventDate?.split("T")[0] || null;
        } else if (event.eventAction === "expiration") {
          expirationDate = event.eventDate?.split("T")[0] || null;
        } else if (event.eventAction === "last changed") {
          lastUpdated = event.eventDate?.split("T")[0] || null;
        }
      }
    }

    // Extract registrar from entities
    let registrar: string | null = null;
    if (data.entities) {
      for (const entity of data.entities) {
        if (entity.roles?.includes("registrar")) {
          registrar =
            entity.vcardArray?.[1]?.find((v: any) => v[0] === "fn")?.[3] ||
            entity.handle ||
            null;
        }
      }
    }

    // Extract nameservers
    const nameservers: string[] = [];
    if (data.nameservers) {
      for (const ns of data.nameservers) {
        if (ns.ldhName) nameservers.push(ns.ldhName.toLowerCase());
      }
    }

    // Extract status
    const status: string[] = data.status || [];

    // Calculate domain age
    let domainAge: string | null = null;
    if (registrationDate) {
      const reg = new Date(registrationDate);
      const now = new Date();
      const years = Math.floor(
        (now.getTime() - reg.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      if (years >= 1) {
        domainAge = `${years} year${years === 1 ? "" : "s"}`;
      } else {
        const months = Math.floor(
          (now.getTime() - reg.getTime()) / (30.44 * 24 * 60 * 60 * 1000)
        );
        domainAge = `${months} month${months === 1 ? "" : "s"}`;
      }
    }

    return {
      registrar,
      registrationDate,
      expirationDate,
      lastUpdated,
      nameservers,
      status,
      domainAge,
    };
  } catch {
    return null;
  }
}
