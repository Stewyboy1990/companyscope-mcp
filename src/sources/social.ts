/**
 * Social presence aggregator.
 * GitHub org stats + social links scraped from website.
 * No API keys required (GitHub: 60 req/hr unauthenticated).
 */

import { fetchGitHubProfile } from "./github.js";

interface SocialLinks {
  [key: string]: string | null;
  linkedin: string | null;
  twitter: string | null;
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  tiktok: string | null;
  reddit: string | null;
  discord: string | null;
  slack: string | null;
  mastodon: string | null;
  bluesky: string | null;
  crunchbase: string | null;
}

export interface SocialPresence {
  domain: string;
  github: {
    org: string | null;
    publicRepos: number;
    followers: number;
    topRepos: { name: string; stars: number; language: string | null }[];
    totalStars: number;
    topLanguages: string[];
    createdAt: string | null;
  } | null;
  socialLinks: SocialLinks;
  sources: string[];
}

export async function fetchSocialPresence(
  domain: string,
  githubToken?: string
): Promise<SocialPresence> {
  const [ghData, socialLinks] = await Promise.allSettled([
    fetchGitHubProfile(domain, githubToken),
    scrapeSocialLinks(domain),
  ]);

  const gh = ghData.status === "fulfilled" ? ghData.value : null;
  const links =
    socialLinks.status === "fulfilled"
      ? socialLinks.value
      : getEmptyLinks();

  const sources: string[] = [];
  if (gh) sources.push("github.com");
  sources.push(`https://${domain}`);

  return {
    domain,
    github: gh
      ? {
          org: gh.orgName,
          publicRepos: gh.publicRepos,
          followers: gh.followers,
          topRepos: gh.topRepos,
          totalStars: gh.topRepos.reduce((sum, r) => sum + r.stars, 0),
          topLanguages: gh.topLanguages,
          createdAt: gh.createdAt,
        }
      : null,
    socialLinks: links,
    sources,
  };
}

function getEmptyLinks(): SocialLinks {
  return {
    linkedin: null,
    twitter: null,
    facebook: null,
    instagram: null,
    youtube: null,
    tiktok: null,
    reddit: null,
    discord: null,
    slack: null,
    mastodon: null,
    bluesky: null,
    crunchbase: null,
  };
}

async function scrapeSocialLinks(
  domain: string
): Promise<SocialLinks> {
  const links = getEmptyLinks();

  try {
    const resp = await fetch(`https://${domain}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CompanyScope/1.0; +https://companyscope.dev)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) return links;

    const html = await resp.text();

    // Extract all URLs from href attributes
    const hrefPattern = /href="([^"]+)"/gi;
    let match;
    while ((match = hrefPattern.exec(html)) !== null) {
      const href = match[1];
      if (href.includes("linkedin.com/company"))
        links.linkedin = links.linkedin || href;
      if (href.includes("twitter.com/") || href.includes("x.com/"))
        links.twitter = links.twitter || href;
      if (href.includes("facebook.com/"))
        links.facebook = links.facebook || href;
      if (href.includes("instagram.com/"))
        links.instagram = links.instagram || href;
      if (href.includes("youtube.com/"))
        links.youtube = links.youtube || href;
      if (href.includes("tiktok.com/"))
        links.tiktok = links.tiktok || href;
      if (href.includes("reddit.com/r/"))
        links.reddit = links.reddit || href;
      if (href.includes("discord.gg/") || href.includes("discord.com/invite"))
        links.discord = links.discord || href;
      if (href.includes("slack.com"))
        links.slack = links.slack || href;
      if (href.includes("crunchbase.com/"))
        links.crunchbase = links.crunchbase || href;
      if (href.includes("bsky.app/"))
        links.bluesky = links.bluesky || href;
      // Mastodon instances vary, look for common pattern
      if (/mastodon\.\w+|mstdn\.\w+/.test(href))
        links.mastodon = links.mastodon || href;
    }
  } catch {
    // Website unreachable
  }

  return links;
}
