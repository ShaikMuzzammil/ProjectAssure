"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserPlus, Shield, Building2, Mail, Phone, Clock,
  Folder, Bell, Download, Eye, X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAdminStore } from "@/store/admin-store";
import { fmtINR, fmtDate, timeAgo, deptCode, cn, nextId } from "@/lib/utils";
import type { User, UserRole } from "@/lib/host/types";

const ROLE_BADGE: Record<UserRole, { label: string; cls: string }> = {
  ADMIN: { label: "ADMIN", cls: "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-300" },
  PROJECT_MANAGER: { label: "PROJECT_MANAGER", cls: "border-brand-300 text-brand-700 bg-brand-50 dark:bg-brand-500/15 dark:text-brand-300" },
  STAKEHOLDER: { label: "STAKEHOLDER", cls: "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-500/15 dark:text-blue-300" },
  VIEWER: { label: "VIEWER", cls: "border-slate-300 text-slate-700 bg-slate-50 dark:bg-slate-500/15 dark:text-slate-300" },
};

const SOURCE_BADGE = {
  DEMO: "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300",
  FRESH_USER: "border-violet-300 text-violet-700 bg-violet-50 dark:bg-violet-500/15 dark:text-violet-300",
};

export function UserManagement() {
  const { users, projects, approvals, alerts, pushUser, pushActivity, hydrate } = useAdminStore();
  const [filter, setFilter] = useState<"ALL" | "DEMO" | "FRESH_USER">("ALL");
  const [selected, setSelected] = useState<User | null>(null);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [simForm, setSimForm] = useState({ name: "", email: "", role: "PROJECT_MANAGER" as UserRole, departmentId: "dept-ipmd" });

  const filtered = useMemo(() => {
    return users.filter(u => filter === "ALL" ? true : u.source === filter);
  }, [users, filter]);

  const stats = useMemo(() => ({
    total: users.length,
    demo: users.filter(u => u.source === "DEMO").length,
    fresh: users.filter(u => u.source === "FRESH_USER").length,
    admins: users.filter(u => u.role === "ADMIN").length,
  }), [users]);

  const userProjects = useMemo(() => {
    if (!selected) return [];
    return projects.filter(p => p.projectManager === selected.name);
  }, [projects, selected]);

  const userAlerts = useMemo(() => {
    if (!selected) return [];
    return alerts.filter(a => a.recommendedOwner === selected.name).slice(0, 8);
  }, [alerts, selected]);

  const userApprovals = useMemo(() => {
    if (!selected) return [];
    return approvals.filter(a => a.requester === selected.name).slice(0, 8);
  }, [approvals, selected]);

  const simulate = async () => {
    if (!simForm.name || !simForm.email) {
      toast.error("Name and email required");
      return;
    }
    const initials = simForm.name.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
    const newUser: User = {
      id: nextId("u"),
      name: simForm.name,
      email: simForm.email,
      role: simForm.role,
      departmentId: simForm.departmentId,
      avatarInitials: initials || "FU",
      designation: "Simulated fresh-user entry",
      persona: "Fresh-user pathway (simulated)",
      personaDescription: "Created by host-control to demonstrate the demo-vs-fresh-user pathway separation.",
      isActive: true,
      source: "FRESH_USER",
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    pushUser(newUser);
    pushActivity({
      id: nextId("ev"),
      timestamp: new Date().toISOString(),
      kind: "user",
      message: `Simulated fresh-user "${newUser.name}" added (${simForm.role})`,
    });
    toast.success("Fresh user simulated", { description: `${newUser.name} added to ${deptCode(simForm.departmentId)}` });
    setSimulateOpen(false);
    setSimForm({ name: "", email: "", role: "PROJECT_MANAGER", departmentId: "dept-ipmd" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">User & Tenant Management</h2>
          <p className="text-sm text-muted-foreground">
            Users across the host domain — mirrors the prototype's seed personas (demo) and shows the pathway for fresh-user sign-ups.
          </p>
        </div>
        <Button size="sm" onClick={() => setSimulateOpen(true)} className="gap-1.5">
          <UserPlus className="size-3.5" /> Simulate Fresh User
        </Button>
      </div>

      {/* Stats + filter toggle */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          { label: "Total users", value: stats.total, icon: Users, cls: "text-brand-600 bg-brand-50 dark:bg-brand-500/10" },
          { label: "Demo personas", value: stats.demo, icon: Shield, cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" },
          { label: "Fresh users", value: stats.fresh, icon: UserPlus, cls: "text-violet-600 bg-violet-50 dark:bg-violet-500/10" },
          { label: "Admins", value: stats.admins, icon: Shield, cls: "text-rose-600 bg-rose-50 dark:bg-rose-500/10" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("rounded-lg p-2", s.cls)}><Icon className="size-4" /></div>
                <div>
                  <div className="tabular text-xl font-semibold">{s.value}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Source toggle */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Filter:</Label>
          <div className="flex gap-1">
            {(["ALL", "DEMO", "FRESH_USER"] as const).map(f => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setFilter(f)}
              >
                {f === "ALL" ? "All users" : f === "DEMO" ? "Demo only" : "Fresh only"}
              </Button>
            ))}
          </div>
          <Separator orientation="vertical" className="h-6" />
          <div className="text-xs text-muted-foreground">
            Showing {filtered.length} of {users.length} users
          </div>
        </CardContent>
      </Card>

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto custom-scrollbar max-h-[640px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background/95 backdrop-blur">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2.5 px-3 font-medium">User</th>
                  <th className="py-2.5 px-3 font-medium">Role</th>
                  <th className="py-2.5 px-3 font-medium hidden md:table-cell">Email</th>
                  <th className="py-2.5 px-3 font-medium hidden md:table-cell">Dept</th>
                  <th className="py-2.5 px-3 font-medium text-center">Projects</th>
                  <th className="py-2.5 px-3 font-medium hidden lg:table-cell">Last active</th>
                  <th className="py-2.5 px-3 font-medium text-center">Source</th>
                  <th className="py-2.5 px-3 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => {
                  const owned = projects.filter(p => p.projectManager === u.name).length;
                  const roleBadge = ROLE_BADGE[u.role];
                  return (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b last:border-0 hover:bg-accent/40 cursor-pointer"
                      onClick={() => setSelected(u)}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7"><AvatarFallback className="text-[10px] bg-primary text-primary-foreground">{u.avatarInitials}</AvatarFallback></Avatar>
                          <div>
                            <div className="font-medium leading-tight">{u.name}</div>
                            <div className="text-[10px] text-muted-foreground">{u.designation}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className={cn("text-[10px]", roleBadge.cls)}>{roleBadge.label}</Badge>
                      </td>
                      <td className="py-2.5 px-3 hidden md:table-cell text-xs text-muted-foreground">{u.email}</td>
                      <td className="py-2.5 px-3 hidden md:table-cell text-xs">{deptCode(u.departmentId)}</td>
                      <td className="py-2.5 px-3 text-center tabular">{owned}</td>
                      <td className="py-2.5 px-3 hidden lg:table-cell text-xs text-muted-foreground">{timeAgo(u.lastLoginAt)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="outline" className={cn("text-[10px]", SOURCE_BADGE[u.source])}>{u.source === "DEMO" ? "Demo" : "Fresh"}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={(e) => { e.stopPropagation(); setSelected(u); }}>
                          <Eye className="size-3.5" /> View
                        </Button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* User detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto custom-scrollbar">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Avatar className="size-8"><AvatarFallback className="text-xs bg-primary text-primary-foreground">{selected.avatarInitials}</AvatarFallback></Avatar>
                  {selected.name}
                </SheetTitle>
                <SheetDescription>
                  {selected.designation} · {selected.persona}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6 space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className={cn("text-[10px]", ROLE_BADGE[selected.role].cls)}>{ROLE_BADGE[selected.role].label}</Badge>
                  <Badge variant="outline" className={cn("text-[10px]", SOURCE_BADGE[selected.source])}>
                    {selected.source === "DEMO" ? "Demo persona" : "Fresh user"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{deptCode(selected.departmentId)}</Badge>
                </div>

                <p className="text-xs text-muted-foreground italic">"{selected.personaDescription}"</p>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2"><Mail className="size-3.5 text-muted-foreground" /> {selected.email}</div>
                  {selected.phone && <div className="flex items-center gap-2"><Phone className="size-3.5 text-muted-foreground" /> {selected.phone}</div>}
                  <div className="flex items-center gap-2"><Clock className="size-3.5 text-muted-foreground" /> Last active {timeAgo(selected.lastLoginAt)}</div>
                  <div className="flex items-center gap-2"><Building2 className="size-3.5 text-muted-foreground" /> Created {fmtDate(selected.createdAt)}</div>
                </div>

                <Separator />

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium flex items-center gap-1"><Folder className="size-3.5" /> Projects owned</div>
                    <Badge variant="secondary" className="text-[10px]">{userProjects.length}</Badge>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {userProjects.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic">No projects owned.</div>
                    ) : userProjects.map(p => (
                      <div key={p.id} className="rounded-md border p-2 text-xs">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{p.sector} · {p.state}</span>
                          <span className="tabular">{fmtINR(p.totalBudgetL, { unit: "crore" })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium flex items-center gap-1"><Bell className="size-3.5" /> Recent alerts</div>
                    <Badge variant="secondary" className="text-[10px]">{userAlerts.length}</Badge>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                    {userAlerts.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic">No alerts assigned.</div>
                    ) : userAlerts.map(a => (
                      <div key={a.id} className="rounded-md border p-2 text-xs">
                        <div className="font-medium truncate">{a.title}</div>
                        <div className="text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium flex items-center gap-1"><Download className="size-3.5" /> Approval requests</div>
                    <Badge variant="secondary" className="text-[10px]">{userApprovals.length}</Badge>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                    {userApprovals.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic">No approval requests raised.</div>
                    ) : userApprovals.map(a => (
                      <div key={a.id} className="rounded-md border p-2 text-xs">
                        <div className="font-medium truncate">{a.projectName}</div>
                        <div className="text-[10px] text-muted-foreground">{a.status} · {fmtDate(a.requestedAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Simulate fresh user dialog */}
      <Sheet open={simulateOpen} onOpenChange={setSimulateOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto custom-scrollbar">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <UserPlus className="size-4" /> Simulate Fresh User
            </SheetTitle>
            <SheetDescription>
              Create a fresh-user entry to demonstrate the demo-vs-fresh-user pathway separation.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="su-name">Full name</Label>
              <input
                id="su-name"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:border-ring focus-visible:ring-ring/50"
                value={simForm.name}
                onChange={e => setSimForm(s => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Anjali Rao"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="su-email">Email</Label>
              <input
                id="su-email"
                type="email"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:border-ring focus-visible:ring-ring/50"
                value={simForm.email}
                onChange={e => setSimForm(s => ({ ...s, email: e.target.value }))}
                placeholder="anjali.rao@mospi.gov.in"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={simForm.role} onValueChange={(v) => setSimForm(s => ({ ...s, role: v as UserRole }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                  <SelectItem value="PROJECT_MANAGER">Project Manager</SelectItem>
                  <SelectItem value="STAKEHOLDER">Stakeholder</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={simForm.departmentId} onValueChange={(v) => setSimForm(s => ({ ...s, departmentId: v }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dept-ipmd">IPMD</SelectItem>
                  <SelectItem value="dept-nat">NASD</SelectItem>
                  <SelectItem value="dept-soc">SOSD</SelectItem>
                  <SelectItem value="dept-eco">ECSD</SelectItem>
                  <SelectItem value="dept-cb">CAPB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <Button onClick={simulate} className="w-full gap-1.5">
              <UserPlus className="size-4" /> Add fresh user
            </Button>
            <div className="text-[10px] text-muted-foreground">
              Fresh-user entries appear in violet badges across the platform and never overwrite the demo persona set.
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
