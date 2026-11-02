// Storage: Upstash Redis when its env vars exist (Vercel), otherwise memory + server/data.json (local).
import { Redis } from '@upstash/redis';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
export const usingRedis = !!redis;

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data.json');
let mem = {};
if (!redis) { try { mem = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* fresh */ } }
const flush = () => { if (!process.env.VERCEL) { try { fs.writeFileSync(FILE, JSON.stringify(mem)); } catch { /* ignore */ } } };

export async function get(key, fallback) {
  if (redis) { const v = await redis.get(key); return v ?? fallback; }
  return mem[key] ?? fallback;
}
export async function set(key, value, ttlSeconds) {
  if (redis) { return ttlSeconds ? redis.set(key, value, { ex: ttlSeconds }) : redis.set(key, value); }
  mem[key] = value; flush();
}
export async function del(key) { if (redis) return redis.del(key); delete mem[key]; flush(); }
