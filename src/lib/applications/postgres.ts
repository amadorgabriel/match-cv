import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { parseStatus, prepareCreate, prepareUpdate, type ApplicationRepository } from "@/lib/applications/store";
import { ApplicationMaterialsSchema, ApplicationStoreError, type JobApplication } from "@/lib/applications/types";
import type { Database } from "@/lib/db";
import { jobApplications } from "@/lib/db/schema";

function mapRow(row: typeof jobApplications.$inferSelect): JobApplication {
  const materials = ApplicationMaterialsSchema.safeParse(row.materials);
  return {
    id: row.id,
    userId: row.userId,
    company: row.company,
    role: row.role,
    appliedAt: row.appliedAt.toISOString(),
    status: parseStatus(row.status),
    notes: row.notes,
    materials: materials.success ? materials.data : {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createPostgresApplicationRepository(db: Database): ApplicationRepository {
  return {
    async list(userId) {
      if (!userId) return [];
      const rows = await db.select().from(jobApplications).where(eq(jobApplications.userId, userId)).orderBy(desc(jobApplications.appliedAt));
      return rows.map(mapRow);
    },
    async get(userId, id) {
      if (!userId) return null;
      const [row] = await db
        .select()
        .from(jobApplications)
        .where(and(eq(jobApplications.userId, userId), eq(jobApplications.id, id)));
      return row ? mapRow(row) : null;
    },
    async create(userId, input) {
      if (!userId) throw new ApplicationStoreError("Entre na conta para salvar no servidor.");
      const record = prepareCreate(userId, input);
      await db.insert(jobApplications).values({
        id: record.id,
        userId,
        company: record.company,
        role: record.role,
        appliedAt: new Date(record.appliedAt),
        status: record.status,
        notes: record.notes,
        materials: record.materials as Record<string, unknown>,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      });
      return record;
    },
    async update(userId, id, patch) {
      const current = await this.get(userId, id);
      if (!current) throw new ApplicationStoreError("Candidatura não encontrada.", "not_found");
      const next = prepareUpdate(current, patch);
      await db
        .update(jobApplications)
        .set({
          company: next.company,
          role: next.role,
          status: next.status,
          notes: next.notes,
          materials: next.materials,
          updatedAt: new Date(next.updatedAt),
        })
        .where(and(eq(jobApplications.userId, userId ?? ""), eq(jobApplications.id, id)));
      return next;
    },
    async delete(userId, id) {
      if (!userId) return false;
      const rows = await db
        .delete(jobApplications)
        .where(and(eq(jobApplications.userId, userId), eq(jobApplications.id, id)))
        .returning({ id: jobApplications.id });
      return rows.length > 0;
    },
    async deleteAll(userId) {
      if (!userId) return 0;
      const rows = await db.delete(jobApplications).where(eq(jobApplications.userId, userId)).returning({ id: jobApplications.id });
      return rows.length;
    },
  };
}
