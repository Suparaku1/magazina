import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DashboardSummary = {
  statuses: Record<string, number>;
  unread: number;
  teachers?: number;
  classes?: number;
  curricula?: number;
  unconfiguredClasses?: number;
  pendingSuggestions?: number;
  stockItems?: number;
  zeroStock?: number;
};

export const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("dashboard_summary");
    if (error) throw error;
    return data as unknown as DashboardSummary;
  },
});

export const recentRequestsQuery = queryOptions({
  queryKey: ["dashboard-requests"],
  queryFn: async () => {
    const { data, error } = await supabase.from("requests")
      .select("id,numer,statusi,updated_at,teachers(emer,mbiemer),departments(emer)")
      .order("updated_at", { ascending: false }).limit(8);
    if (error) throw error;
    return data ?? [];
  },
});

export const notificationsQuery = queryOptions({
  queryKey: ["notifications"],
  queryFn: async () => {
    const { data, error } = await supabase.from("notifications")
      .select("id,request_id,titulli,mesazhi,created_at,read_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data ?? [];
  },
  refetchInterval: 60000,
});

export const unreadQuery = queryOptions({
  queryKey: ["notifications-unread"],
  queryFn: async () => {
    const { count, error } = await supabase.from("notifications")
      .select("id", { count: "exact", head: true }).is("read_at", null);
    if (error) throw error;
    return count ?? 0;
  },
  refetchInterval: 60000,
});