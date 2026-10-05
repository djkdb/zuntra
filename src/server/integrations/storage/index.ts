import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { db } from "@/server/db";
import { env } from "@/server/env";

/**
 * Object storage behind one interface: the local filesystem for development/tests, Supabase
 * Storage (or any S3-compatible service with the same REST shape) or the app's own Postgres
 * (`database`, for Postgres-only hosting such as Neon) in production. Objects are
 * private; the app streams them through an authorised route, never via public URLs.
 */
export interface StorageProvider {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  remove(keys: string[]): Promise<void>;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_-]{0,200}\.(webp|jpg|png)$/;

function assertKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("Invalid storage key");
}

function localStorage(dir: string): StorageProvider {
  const root = resolve(dir);
  const pathFor = (key: string) => {
    assertKey(key);
    const full = resolve(join(root, key));
    if (!full.startsWith(root)) throw new Error("Invalid storage key");
    return full;
  };
  const types: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", png: "image/png" };
  return {
    async put(key, body) {
      const path = pathFor(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
    },
    async get(key) {
      try {
        const body = await readFile(pathFor(key));
        return { body: new Uint8Array(body), contentType: types[key.split(".").pop()!] ?? "application/octet-stream" };
      } catch {
        return null;
      }
    },
    async remove(keys) {
      await Promise.all(keys.map((k) => rm(pathFor(k), { force: true })));
    },
  };
}

function supabaseStorage(url: string, serviceKey: string, bucket: string): StorageProvider {
  const base = `${url.replace(/\/$/, "")}/storage/v1/object`;
  const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
  return {
    async put(key, body, contentType) {
      assertKey(key);
      const res = await fetch(`${base}/${bucket}/${key}`, {
        method: "POST",
        headers: { ...headers, "content-type": contentType, "x-upsert": "true", "cache-control": "max-age=31536000" },
        body: Buffer.from(body),
      });
      if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
    },
    async get(key) {
      assertKey(key);
      const res = await fetch(`${base}/authenticated/${bucket}/${key}`, { headers });
      if (!res.ok) return null;
      return { body: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "image/webp" };
    },
    async remove(keys) {
      if (keys.length === 0) return;
      keys.forEach(assertKey);
      await fetch(`${base}/${bucket}`, {
        method: "DELETE",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ prefixes: keys }),
      });
    },
  };
}

export function databaseStorage(): StorageProvider {
  return {
    async put(key, body, contentType) {
      assertKey(key);
      const bytes = new Uint8Array(body); // own ArrayBuffer copy, as Prisma's Bytes type expects
      await db.storedObject.upsert({ where: { key }, create: { key, contentType, body: bytes }, update: { contentType, body: bytes } });
    },
    async get(key) {
      assertKey(key);
      const row = await db.storedObject.findUnique({ where: { key } });
      return row ? { body: new Uint8Array(row.body), contentType: row.contentType } : null;
    },
    async remove(keys) {
      if (keys.length === 0) return;
      keys.forEach(assertKey);
      await db.storedObject.deleteMany({ where: { key: { in: keys } } });
    },
  };
}

export function getStorage(): StorageProvider {
  const e = env();
  if (e.STORAGE_PROVIDER === "database") return databaseStorage();
  if (e.STORAGE_PROVIDER === "supabase") {
    if (!e.SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase storage is not configured");
    return supabaseStorage(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, e.SUPABASE_STORAGE_BUCKET);
  }
  return localStorage(e.STORAGE_LOCAL_DIR);
}

/** Sniffs the real image type from magic bytes (never trust the client's content-type). */
export function detectImageType(bytes: Uint8Array): "webp" | "jpg" | "png" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "webp";
  return null;
}
