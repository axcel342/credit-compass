import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { loadDashboardData } from "@/lib/dashboard/data";
import { currentCaller } from "@/lib/workspace/current";
import { Header } from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthed())) redirect("/login");
  const d = await loadDashboardData(await currentCaller());
  return (
    <div className="page">
      <Header hasDemoData={d.hasDemoData} />
      <main>{children}</main>
    </div>
  );
}
