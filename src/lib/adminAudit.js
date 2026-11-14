import { base44 } from "@/api/base44Client";

/**
 * Write an admin action to the activity log.
 * Never throws — auditing must not break the action it records.
 */
export async function logAdminAction(action, { targetType, targetId, details, actor } = {}) {
  try {
    let who = actor;
    if (!who) {
      try { who = await base44.auth.me(); } catch { who = null; }
    }
    await base44.entities.ActivityLog.create({
      action,
      actor_id: who?.id || null,
      actor_name: who?.full_name || who?.email || "admin",
      target_type: targetType || null,
      target_id: targetId ? String(targetId) : null,
      details: typeof details === "string" ? details : details ? JSON.stringify(details) : null,
    });
  } catch {
    /* audit is best-effort */
  }
}
