"use client";
import React from "react";
import { useAdminStore } from "@/store/admin-store";
import { cn } from "@/lib/utils";
import { Landmark, ClipboardList, LineChart, Eye } from "lucide-react";
import { relTime } from "@/lib/host/format";

const ROLE_ICON: Record<string, React.ElementType> = { ADMIN: Landmark, PROJECT_MANAGER: ClipboardList, STAKEHOLDER: LineChart, VIEWER: Eye };

export function UserManagement() {
  const { users, projects } = useAdminStore();
  return (
    <div className="space-y-4">
      <div><h2 className="text-lg font-bold">User &amp; Tenant Management</h2><p className="text-xs text-slate-500">Every registered user and demo persona — role, source, project count and last-active stamp.</p></div>
      <div className="grid gap-2 md:grid-cols-2">
        {users.map(u => {
          const Icon = ROLE_ICON[u.role] ?? Eye;
          const userProjects = projects.filter(p => p.source === u.source).length;
          return (
            <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0b426e] to-[#0c93e7] text-[11px] font-bold text-white">{u.avatarInitials}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="text-sm font-bold">{u.name}</span><span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", u.source === "FRESH_USER" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}>{u.source}</span></div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500"><Icon className="h-3 w-3" />{u.role.replace("_", " ")} · {u.designation}</div>
                  <div className="mt-0.5 font-mono text-[9px] text-slate-500">{u.email}</div>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500"><span><strong className="text-slate-900">{userProjects}</strong> projects</span><span className={u.isActive ? "text-emerald-600 font-semibold" : "text-slate-400"}>{u.isActive ? "Active" : "Inactive"}</span>{u.lastLoginAt && <span>last seen {relTime(u.lastLoginAt)}</span>}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
