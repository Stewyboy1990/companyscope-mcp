/**
 * GitHub API — free, 60 requests/hour without auth.
 * Fetches org profile and top repos.
 */

export interface GitHubProfile {
  orgName: string | null;
  description: string | null;
  publicRepos: number;
  followers: number;
  topLanguages: string[];
  topRepos: { name: string; stars: number; language: string | null }[];
  createdAt: string | null;
}

export async function fetchGitHubProfile(
  orgOrDomain: string
): Promise<GitHubProfile | null> {
  const orgName = extractOrgName(orgOrDomain);
  if (!orgName) return null;

  try {
    const orgResp = await fetch(`https://api.github.com/orgs/${orgName}`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CompanyScope/1.0",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!orgResp.ok) return null;

    const org = (await orgResp.json()) as {
      login: string;
      name: string | null;
      description: string | null;
      public_repos: number;
      followers: number;
      created_at: string;
    };

    // Fetch top repos by stars
    const reposResp = await fetch(
      `https://api.github.com/orgs/${orgName}/repos?sort=stars&per_page=10`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "CompanyScope/1.0",
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    const languages = new Set<string>();
    let topRepos: { name: string; stars: number; language: string | null }[] =
      [];

    if (reposResp.ok) {
      const repos = (await reposResp.json()) as {
        name: string;
        language: string | null;
        stargazers_count: number;
      }[];
      topRepos = repos.slice(0, 5).map((r) => ({
        name: r.name,
        stars: r.stargazers_count,
        language: r.language,
      }));
      for (const r of repos) {
        if (r.language) languages.add(r.language);
      }
    }

    return {
      orgName: org.name || org.login,
      description: org.description,
      publicRepos: org.public_repos,
      followers: org.followers,
      topLanguages: Array.from(languages).slice(0, 8),
      topRepos,
      createdAt: org.created_at,
    };
  } catch {
    return null;
  }
}

function extractOrgName(input: string): string | null {
  // GitHub URL
  const ghMatch = input.match(/github\.com\/([a-zA-Z0-9_-]+)/);
  if (ghMatch) return ghMatch[1];

  // Domain: "stripe.com" -> "stripe"
  const domainMatch = input.match(/^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+)\./);
  if (domainMatch) return domainMatch[1];

  // Plain string
  if (/^[a-zA-Z0-9_-]+$/.test(input)) return input;

  return null;
}
