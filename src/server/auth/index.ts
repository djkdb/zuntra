import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { signInSchema } from "@/lib/validation/auth";
import { db } from "@/server/db";
import { clientIpFrom, loginIpLimiter, loginLimiter } from "@/server/rate-limit";
import { authConfig } from "./config";
import { verifyPassword } from "./password";

class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    // Wrong passwords are expected traffic, not server errors; keep logs free of noise and user data.
    error(error) {
      if (error.name === "CredentialsSignin") return;
      console.error(`[auth] ${error.name}`);
    },
  },
  // The adapter is only used by OAuth providers added later; credentials sessions are JWTs.
  adapter: PrismaAdapter(db),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw, request) {
        const parsed = signInSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const ip = request ? clientIpFrom(request.headers) : "unknown";
        const [byEmail, byIp] = await Promise.all([
          loginLimiter.consume(`email:${email}`),
          loginIpLimiter.consume(`ip:${ip}`),
        ]);
        if (!byEmail.ok || !byIp.ok) throw new RateLimitedSignin();

        const user = await db.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, image: true, passwordHash: true },
        });
        const valid = await verifyPassword(password, user?.passwordHash);
        if (!user || !valid) return null;

        await loginLimiter.reset(`email:${email}`);
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
});
