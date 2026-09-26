export function Tag({ simulated }: { simulated: boolean }) {
  return <span className={`tag ${simulated ? "sim" : "real"}`}>{simulated ? "SIM" : "REAL"}</span>;
}
