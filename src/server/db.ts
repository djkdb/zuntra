import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/server/env";

const isWorkers = (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent === "Cloudflare-Workers";

function createClient() {
  const adapter = new PrismaPg(
    { connectionString: env().DATABASE_URL },
    // On Workers the runtime tears down a request's sockets once it finishes; an idle pooled
    // connection then reports "Network connection lost". The next request opens a fresh one.
    isWorkers ? { onPoolError: () => {}, onConnectionError: () => {} } : undefined,
  );
  return new PrismaClient({ adapter });
}

type Client = ReturnType<typeof createClient>;

/**
 * Cloudflare Workers forbid reusing a socket opened by another request, so on Workers each
 * request gets its own client (keyed on OpenNext's per-request context; pair with Hyperdrive
 * for pooling). Everywhere else one client — and one pool — is shared by the process.
 */
const perRequest = new WeakMap<object, Client>();
const globalForPrisma = globalThis as unknown as { prisma?: Client };

function getClient(): Client {
  if (isWorkers) {
    const ctx = (globalThis as Record<symbol, { ctx?: object } | undefined>)[Symbol.for("__cloudflare-context__")]?.ctx;
    if (ctx) {
      let client = perRequest.get(ctx);
      if (!client) {
        client = createClient();
        perRequest.set(ctx, client);
      }
      return client;
    }
  }
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

/** Lazily resolves to the right client for the current runtime/request. */
export const db: Client = new Proxy({} as Client, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
