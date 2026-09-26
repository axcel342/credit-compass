import { redirect } from "next/navigation";
import Link from "next/link";
import { isAuthed } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function DashLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthed())) redirect("/login");
  return (
    <div className="page">
      <nav className="nav" aria-label="Screens"><ul>
        <li><Link href="/">Overview</Link></li><li><Link href="/charges">Charges</Link></li>
        <li><Link href="/recovery">Recovery</Link></li><li><Link href="/prespend">Before you spend</Link></li>
      </ul></nav>
      {children}
    </div>
  );
}
