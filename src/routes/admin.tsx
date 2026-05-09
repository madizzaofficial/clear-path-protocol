import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Search, MoreHorizontal, TrendingUp, Users, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Lumen" },
      { name: "description", content: "Lumen admin dashboard." },
    ],
  }),
  component: AdminPage,
});

const students = [
  { name: "Léa Moreau", email: "lea.m@email.com", week: 3, progress: 72, status: "On track", stage: "Active routine", note: "Consistent, mild flare-up week 2" },
  { name: "James Carter", email: "j.carter@email.com", week: 6, progress: 88, status: "On track", stage: "Visible results", note: "Excellent adherence" },
  { name: "Aïsha Diallo", email: "aisha.d@email.com", week: 2, progress: 35, status: "At risk", stage: "Foundations", note: "Missed 4 lessons" },
  { name: "Marco Bianchi", email: "m.bianchi@email.com", week: 9, progress: 95, status: "Thriving", stage: "Maintenance", note: "Ready for graduation prep" },
  { name: "Sofia Reyes", email: "s.reyes@email.com", week: 1, progress: 12, status: "New", stage: "Onboarding", note: "Just joined Tuesday" },
  { name: "Tom Andersen", email: "tom.a@email.com", week: 4, progress: 58, status: "On track", stage: "Active routine", note: "Asked about retinoid timing" },
];

const statusStyles: Record<string, string> = {
  "On track": "bg-primary-soft text-foreground",
  "Thriving": "bg-foreground text-background",
  "At risk": "bg-destructive/10 text-destructive",
  "New": "bg-muted text-muted-foreground",
};

function AdminPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Admin</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">Coach dashboard</h1>
            <p className="mt-2 text-muted-foreground">Monitor protocols, intervene early, celebrate wins.</p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input placeholder="Search students…" className="h-10 w-72 rounded-full border border-border bg-card pl-9 pr-4 text-sm focus:border-primary focus:outline-none" />
          </div>
        </header>

        {/* Stats */}
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStat icon={Users} label="Active students" value="248" delta="+18 this month" />
          <AdminStat icon={TrendingUp} label="Avg. completion" value="64%" delta="+6% vs last cohort" />
          <AdminStat icon={CheckCircle2} label="Protocols completed" value="92" delta="this quarter" />
          <AdminStat icon={AlertCircle} label="At-risk students" value="11" delta="needs outreach" tone="warn" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Students table */}
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft lg:col-span-2">
            <header className="flex items-center justify-between border-b border-border/60 p-6">
              <h2 className="font-display text-lg font-semibold">Students</h2>
              <button className="text-sm text-muted-foreground hover:text-foreground">View all</button>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Student</th>
                    <th className="px-6 py-3 font-medium">Week</th>
                    <th className="px-6 py-3 font-medium">Progress</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {students.map((s) => (
                    <tr key={s.email} className="hover:bg-primary-soft/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-warm text-sm font-semibold">
                            {s.name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{s.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{s.stage}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm tabular-nums">W{s.week}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${s.progress}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">{s.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[s.status]}`}>{s.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
              <h3 className="font-display text-lg font-semibold">Assign recommendations</h3>
              <p className="mt-1 text-sm text-muted-foreground">Push curated products to a student.</p>
              <div className="mt-4 space-y-3">
                <select className="h-10 w-full rounded-full border border-border bg-background px-4 text-sm focus:border-primary focus:outline-none">
                  <option>Select student…</option>
                  {students.map((s) => <option key={s.email}>{s.name}</option>)}
                </select>
                <select className="h-10 w-full rounded-full border border-border bg-background px-4 text-sm focus:border-primary focus:outline-none">
                  <option>Recommend product…</option>
                  <option>Adapalene 0.1% Gel</option>
                  <option>Niacinamide 10%</option>
                  <option>Mineral SPF 50</option>
                </select>
                <textarea placeholder="Personal note for the student…" className="min-h-20 w-full resize-none rounded-2xl border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none" />
                <button className="w-full rounded-full bg-foreground py-2.5 text-sm font-medium text-background hover:opacity-90">Send recommendation</button>
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
              <h3 className="font-display text-lg font-semibold">Course analytics</h3>
              <ul className="mt-4 space-y-3">
                {[
                  { label: "Foundations", val: 91 },
                  { label: "Daily Routine", val: 76 },
                  { label: "Lifestyle", val: 54 },
                  { label: "Maintenance", val: 32 },
                ].map((c) => (
                  <li key={c.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{c.label}</span>
                      <span className="tabular-nums text-muted-foreground">{c.val}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${c.val}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function AdminStat({ icon: Icon, label, value, delta, tone }: { icon: any; label: string; value: string; delta: string; tone?: "warn" }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${tone === "warn" ? "bg-destructive/10 text-destructive" : "bg-primary-soft text-primary"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{delta}</p>
    </div>
  );
}
