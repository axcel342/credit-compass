import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { loadDashboardData } from "@/lib/dashboard/data";
import { currentWorkspace } from "@/lib/workspace/current";
import { Header } from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthed())) redirect("/login");
  const ws = await currentWorkspace();
  const d = await loadDashboardData(ws.caller);
  return (
    <div className="page">
      <Header hasDemoData={d.hasDemoData} orgName={ws.orgName} demo={ws.demo} />
      <main>{children}</main>
    </div>
  );
}
