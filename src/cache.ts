/**
 * KV-based caching layer.
 * Caches company profiles for 24 hours to reduce API calls and improve latency.
 */

import type { CompanyProfile, Env } from "./types.js";

const CACHE_TTL = 60 * 60 * 24; // 24 hours in seconds

export async function getCachedProfile(
  env: Env,
  domain: string
): Promise<CompanyProfile | null> {
  try {
    const cached = await env.CACHE.get(`profile:${domain}`, "json");
    return cached as CompanyProfile | null;
  } catch {
    return null;
  }
}

export async function cacheProfile(
  env: Env,
  domain: string,
  profile: CompanyProfile
): Promise<void> {
  try {
    await env.CACHE.put(`profile:${domain}`, JSON.stringify(profile), {
      expirationTtl: CACHE_TTL,
    });
  } catch {
    // Cache write failures are non-critical
  }
}

export async function getCachedJSON<T>(
  env: Env,
  key: string
): Promise<T | null> {
  try {
    return (await env.CACHE.get(key, "json")) as T | null;
  } catch {
    return null;
  }
}

export async function setCachedJSON(
  env: Env,
  key: string,
  value: unknown,
  ttl: number = CACHE_TTL
): Promise<void> {
  try {
    await env.CACHE.put(key, JSON.stringify(value), { expirationTtl: ttl });
  } catch {
    // Non-critical
  }
}

/**
 * Simple rate limiter using KV.
 * Tracks calls per API key per day.
 */
export async function checkRateLimit(
  env: Env,
  identifier: string,
  limit: number
): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const key = `ratelimit:${identifier}:${today}`;

  try {
    const current = await env.CACHE.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= limit) {
      // Calculate reset time (midnight UTC)
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);

      return {
        allowed: false,
        remaining: 0,
        resetAt: tomorrow.toISOString(),
      };
    }

    // Increment counter (TTL = rest of today + buffer)
    await env.CACHE.put(key, String(count + 1), {
      expirationTtl: 60 * 60 * 25, // 25 hours to cover timezone edge cases
    });

    return {
      allowed: true,
      remaining: limit - count - 1,
      resetAt: "",
    };
  } catch {
    // If rate limiting fails, allow the request
    return { allowed: true, remaining: limit, resetAt: "" };
  }
}
