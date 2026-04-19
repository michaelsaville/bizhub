import type { NextAuthOptions } from 'next-auth'
import AzureADProvider from 'next-auth/providers/azure-ad'
import { prisma } from '@/app/lib/prisma'
import type { BD_UserRole } from '@prisma/client'

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, profile }) {
      if (!user.email) return false
      const entraId = (profile as { oid?: string } | undefined)?.oid

      const existing = await prisma.bD_User.findUnique({
        where: { email: user.email },
      })
      if (existing) {
        if (entraId && existing.entraId !== entraId) {
          await prisma.bD_User.update({
            where: { id: existing.id },
            data: { entraId },
          })
        }
        return existing.isActive
      }

      // First-time sign-in: auto-provision as VIEWER. Admin promotes later.
      // Refuse entries with no Entra oid — those are usually misconfigured
      // providers, not real users.
      if (!entraId) return false
      await prisma.bD_User.create({
        data: {
          entraId,
          email: user.email,
          name: user.name ?? user.email,
          role: 'VIEWER',
        },
      })
      return true
    },
    async jwt({ token, user }) {
      // Refresh id + role from DB every request so admin promotions /
      // deactivations take effect without forcing a sign-out.
      const email = token.email ?? user?.email
      if (email) {
        const row = await prisma.bD_User.findUnique({
          where: { email },
          select: { id: true, role: true, isActive: true },
        })
        if (row) {
          token.id = row.id
          token.role = row.role
          if (!row.isActive) token.role = null
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as { id?: string }).id = token.id as string | undefined
        ;(session.user as { role?: BD_UserRole | null }).role =
          (token.role as BD_UserRole | null) ?? null
      }
      return session
    },
  },
}

const ROLE_ORDER: Record<BD_UserRole, number> = {
  VIEWER: 0,
  ANALYST: 1,
  ADMIN: 2,
}

export function hasMinRole(
  actual: BD_UserRole | null | undefined,
  min: BD_UserRole,
): boolean {
  if (!actual) return false
  return ROLE_ORDER[actual] >= ROLE_ORDER[min]
}
