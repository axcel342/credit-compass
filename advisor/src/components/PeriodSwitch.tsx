"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [["8w", "8 weeks"], ["30d", "30 days"]] as const;

export function PeriodSwitch() {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const current = sp.get("period") === "30d" ? "30d" : "8w";
  const choose = (p: string) => {
    const q = new URLSearchParams(sp.toString());
    if (p === "8w") q.delete("period"); else q.set("period", p);
    const s = q.toString();
    router.push(s ? `${path}?${s}` : path);
  };
  return (
    <div className="seg" role="group" aria-label="Period">
      {OPTIONS.map(([p, label]) => (
        <button key={p} type="button" aria-pressed={current === p} className={current === p ? "on" : undefined} onClick={() => choose(p)}>{label}</button>
      ))}
    </div>
  );
}
