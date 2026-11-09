import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "shef_departamenti" | "mesues" | "magazinier";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  shef_departamenti: "Shef departamenti",
  mesues: "Mësues",
  magazinier: "Magazinier",
};

export type MyContext = {
  userId: string;
  email: string | null;
  roles: { role: AppRole; department_id: string | null; department: string | null }[];
  teacher: { id: string; emer: string; mbiemer: string | null } | null;
};

export const myContextQuery = queryOptions({
  queryKey: ["my-context"],
  queryFn: async (): Promise<MyContext | null> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [{ data: roles, error: e1 }, { data: teacher }] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role, department_id, departments(emer)")
        .eq("user_id", u.user.id),
      supabase.from("teachers").select("id, emer, mbiemer").eq("user_id", u.user.id).maybeSingle(),
    ]);
    if (e1) throw e1;
    return {
      userId: u.user.id,
      email: u.user.email ?? null,
      roles: (roles ?? []).map((r) => ({
        role: r.role as AppRole,
        department_id: r.department_id,
        department: (r.departments as { emer: string } | null)?.emer ?? null,
      })),
      teacher: teacher ?? null,
    };
  },
});

export function useMyContext() {
  return useQuery(myContextQuery);
}

export function hasRole(ctx: MyContext | null | undefined, role: AppRole) {
  return !!ctx?.roles.some((r) => r.role === role);
}
