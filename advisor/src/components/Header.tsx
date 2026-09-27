import { Suspense } from "react";
import { NavTabs } from "./NavTabs";
import { PeriodSwitch } from "./PeriodSwitch";
import { DemoDataPill } from "./DemoDataPill";
import { syncNow } from "@/app/(dash)/actions";
import { disconnect } from "@/app/(dash)/workspace-actions";

export function Header({ hasDemoData, orgName, demo }: { hasDemoData: boolean; orgName: string; demo: boolean }) {
  return (
    <header className="topbar">
      <span className="brand">Credit Compass</span>
      {!demo && <span className="small">{orgName}</span>}
      {hasDemoData && <DemoDataPill />}
      <Suspense><NavTabs /></Suspense>
      <span className="spacer" />
      <Suspense><PeriodSwitch /></Suspense>
      <form action={syncNow}><button className="btn ghost" type="submit">Sync now</button></form>
      {!demo && <form action={disconnect}><button className="btn ghost" type="submit" title="Removes your key and webhook from Credit Compass. Your data stays in your graph8 org.">Disconnect</button></form>}
    </header>
  );
}
