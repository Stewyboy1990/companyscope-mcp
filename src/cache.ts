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

/**
 * Track usage analytics in KV.
 * Increments daily call count, unique user count, and per-tool counters.
 * Non-blocking — fire and forget.
 */
export async function trackUsage(
  env: Env,
  identifier: string,
  toolName: string
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const ttl = 60 * 60 * 24 * 30; // 30 days retention
  try {
    // Daily total calls
    const callsKey = `analytics:calls:${today}`;
    const calls = await env.CACHE.get(callsKey);
    await env.CACHE.put(callsKey, String((calls ? parseInt(calls, 10) : 0) + 1), { expirationTtl: ttl });

    // Daily unique users (store as comma-separated set)
    const usersKey = `analytics:users:${today}`;
    const usersRaw = await env.CACHE.get(usersKey) || "";
    const usersSet = new Set(usersRaw ? usersRaw.split(",") : []);
    usersSet.add(identifier);
    await env.CACHE.put(usersKey, [...usersSet].join(","), { expirationTtl: ttl });

    // Per-tool daily counter
    const toolKey = `analytics:tool:${toolName}:${today}`;
    const toolCalls = await env.CACHE.get(toolKey);
    await env.CACHE.put(toolKey, String((toolCalls ? parseInt(toolCalls, 10) : 0) + 1), { expirationTtl: ttl });
  } catch {
    // Analytics failures are non-critical
  }
}
