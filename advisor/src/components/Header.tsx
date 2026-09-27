import { Suspense } from "react";
import { NavTabs } from "./NavTabs";
import { PeriodSwitch } from "./PeriodSwitch";
import { DemoDataPill } from "./DemoDataPill";
import { syncNow } from "@/app/(dash)/actions";

export function Header({ hasDemoData }: { hasDemoData: boolean }) {
  return (
    <header className="topbar">
      <span className="brand">Credit Compass</span>
      {hasDemoData && <DemoDataPill />}
      <Suspense><NavTabs /></Suspense>
      <span className="spacer" />
      <Suspense><PeriodSwitch /></Suspense>
      <form action={syncNow}><button className="btn ghost" type="submit">Sync now</button></form>
    </header>
  );
}
