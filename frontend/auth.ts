import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const expressUrl =
  process.env.EXPRESS_INTERNAL_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile) {
        const email = String(profile.email ?? "");
        const googleId = String(account.providerAccountId ?? "");
        const res = await fetch(`${expressUrl}/internal/auth/upsert-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.AUTH_SECRET ?? ""}`,
          },
          body: JSON.stringify({
            email,
            name: profile.name ?? null,
            image:
              "picture" in profile
                ? String((profile as { picture?: string }).picture ?? "")
                : null,
            googleId,
          }),
        });
        if (!res.ok) {
          console.error("[AUTH] upsert-user failed", await res.text());
          return token;
        }
        const data = (await res.json()) as {
          userId?: string;
          agentId?: string;
        };
        token.userId = data.userId;
        token.defaultAgentId = data.agentId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? "");
        session.user.defaultAgentId = String(token.defaultAgentId ?? "");
      }
      return session;
    },
  },
});
