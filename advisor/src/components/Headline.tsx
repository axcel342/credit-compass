export function Headline({ text, lede }: { text: string; lede?: string | null }) {
  return (<div className="head"><h1 className="headline">{text}</h1>{lede && <p className="lede">{lede}</p>}</div>);
}
