export interface CompanyProfile {
  domain: string;
  name: string | null;
  description: string | null;
  founded: string | null;
  employeeCount: string | null;
  industry: string | null;
  headquarters: string | null;
  website: string | null;
  socialProfiles: {
    linkedin: string | null;
    twitter: string | null;
    github: string | null;
  };
  techStack: string[];
  recentNews: NewsItem[];
  keyPeople: Person[];
  fundingHistory: FundingRound[];
  competitors: string[];
  stockTickers: string[];
  exchanges: string[];
  financials: {
    revenue: { value: number; unit: string; period: string } | null;
    netIncome: { value: number; unit: string; period: string } | null;
    totalAssets: { value: number; unit: string; period: string } | null;
    totalLiabilities: { value: number; unit: string; period: string } | null;
    stockholdersEquity: { value: number; unit: string; period: string } | null;
    period: string | null;
  } | null;
  recentFilings: { form: string; filingDate: string; primaryDocument: string; description: string }[];
  sicCode: string | null;
  domainRegistration: {
    registrar: string | null;
    registrationDate: string | null;
    expirationDate: string | null;
    domainAge: string | null;
    nameservers: string[];
  } | null;
  confidence: number; // 0-1, how much data we found
  sources: string[];
  fetchedAt: string;
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet: string;
}

export interface Person {
  name: string;
  title: string | null;
  source: string;
}

export interface FundingRound {
  date: string | null;
  amount: string | null;
  round: string | null;
  investors: string[];
  source: string;
}

export interface Env {
  CACHE: KVNamespace;
  ENVIRONMENT: string;
  OPENCORPORATES_TOKEN?: string;
  HUNTER_API_KEY?: string;
  NEWS_API_KEY?: string;
  GITHUB_TOKEN?: string;
  BRAVE_API_KEY?: string;
}
