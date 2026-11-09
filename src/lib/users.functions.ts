import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleEnum = z.enum(["admin", "shef_departamenti", "mesues", "magazinier"]);

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Vetëm administratori mund ta kryejë këtë veprim.");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 });
    if (error) throw new Error("Lista e përdoruesve nuk u lexua.");
    return data.users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      invited_at: u.invited_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }));
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(128).optional(),
        teacher_id: z.string().uuid().nullable(),
        roles: z.array(z.object({ role: roleEnum, department_id: z.string().uuid().nullable() })).max(10),
        redirectTo: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const email = data.email.toLowerCase();
    if (data.teacher_id) {
      const { error } = await context.supabase.from("teachers").update({ email }).eq("id", data.teacher_id);
      if (error) throw new Error(error.code === "23505" ? "Ky email është i lidhur me një mësues tjetër." : "Mësuesi nuk u përditësua.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = data.password
      ? await supabaseAdmin.auth.admin.createUser({ email, password: data.password, email_confirm: true })
      : await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: data.redirectTo });
    if (error || !inv.user) throw new Error(`Ftesa dështoi: ${error?.message ?? "gabim i panjohur"}`);
    const userId = inv.user.id;
    if (data.roles.length) {
      const { error: e2 } = await context.supabase
        .from("user_roles")
        .upsert(data.roles.map((r) => ({ user_id: userId, role: r.role, department_id: r.role === "shef_departamenti" ? r.department_id : null })), { onConflict: "user_id,role,department_id", ignoreDuplicates: true });
      if (e2) throw new Error("Ftesa u dërgua, por rolet nuk u ruajtën. Shtojini manualisht.");
    }
    return { ok: true, user_id: inv.user.id };
  });
