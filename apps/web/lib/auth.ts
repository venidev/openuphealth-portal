import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
    };
  }

  interface User {
    role: string;
  }
}

declare module "next-auth" {
  interface JWT {
    id: string;
    role: string;
    lastActivity?: number;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
    // HIPAA session hardening (PRODUCT_SCOPE T4): short absolute lifetime and
    // sliding idle window instead of the 30-day NextAuth default. PHI-accessing
    // roles must re-authenticate frequently.
    maxAge: 12 * 60 * 60, // 12h absolute maximum
    updateAge: 15 * 60, // refresh the token at most every 15 min of activity
  },
  jwt: {
    maxAge: 12 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const now = Math.floor(Date.now() / 1000);
      const IDLE_TIMEOUT = 15 * 60; // 15 min of inactivity forces re-auth

      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.lastActivity = now;
        return token;
      }

      // Enforce idle timeout: null token signs the user out.
      const lastActivity = (token.lastActivity as number | undefined) ?? now;
      if (now - lastActivity > IDLE_TIMEOUT) {
        return null;
      }
      token.lastActivity = now;
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const publicPaths = ["/", "/login", "/signup", "/api/auth"];
      const isPublic = publicPaths.some(
        (p) => pathname === p || pathname.startsWith(p + "/")
      );

      if (isPublic) return true;
      return isLoggedIn;
    },
  },
});
