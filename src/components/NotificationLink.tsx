import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { unreadQuery } from "@/lib/dashboard";

export function NotificationLink() {
  const { data: unread = 0 } = useQuery(unreadQuery);
  return <Link to="/njoftimet" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent" activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}>
    <Bell className="h-4 w-4 shrink-0" />Njoftimet
    {unread > 0 && <span className="rounded bg-sidebar-primary px-1.5 font-mono text-xs text-sidebar-primary-foreground">{unread > 99 ? "99+" : unread}</span>}
  </Link>;
}