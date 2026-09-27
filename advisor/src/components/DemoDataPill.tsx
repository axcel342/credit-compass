export const DEMO_NOTE = "Outreach emails, meetings, deals and the email-finding spend on the Sales VPs, Founders and Starter lists are simulated for this demo. Everything else comes from this org's real graph8 ledger.";

export function DemoDataPill() {
  return (
    <span className="demo-pill" tabIndex={0} aria-describedby="demo-note">
      Includes demo data
      <span role="tooltip" id="demo-note" className="demo-pop">{DEMO_NOTE}</span>
    </span>
  );
}
