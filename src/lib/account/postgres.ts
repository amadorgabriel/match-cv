import "server-only";

import { eq } from "drizzle-orm";

import { eraseAccountData, type EraseResult } from "@/lib/account/erase";
import { getDb } from "@/lib/db";
import { accounts, jobApplications, savedApiKeys, sessions, users, verifications } from "@/lib/db/schema";

export async function erasePostgresAccount(userId: string): Promise<EraseResult | null> {
  const db = getDb();
  if (!db) return null;
  return db.transaction(async (tx) =>
    eraseAccountData(
      {
        async findUser(id) {
          const [user] = await tx.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, id));
          return user ?? null;
        },
        async deleteVerifications(email) {
          const rows = await tx.delete(verifications).where(eq(verifications.identifier, email)).returning({ id: verifications.id });
          return rows.length;
        },
        async deleteKeys(id) {
          const rows = await tx.delete(savedApiKeys).where(eq(savedApiKeys.userId, id)).returning({ id: savedApiKeys.id });
          return rows.length;
        },
        async deleteApplications(id) {
          const rows = await tx.delete(jobApplications).where(eq(jobApplications.userId, id)).returning({ id: jobApplications.id });
          return rows.length;
        },
        async deleteSessions(id) {
          const rows = await tx.delete(sessions).where(eq(sessions.userId, id)).returning({ id: sessions.id });
          return rows.length;
        },
        async deleteAccounts(id) {
          const rows = await tx.delete(accounts).where(eq(accounts.userId, id)).returning({ id: accounts.id });
          return rows.length;
        },
        async deleteUser(id) {
          const rows = await tx.delete(users).where(eq(users.id, id)).returning({ id: users.id });
          return rows.length;
        },
      },
      userId,
    ),
  );
}
