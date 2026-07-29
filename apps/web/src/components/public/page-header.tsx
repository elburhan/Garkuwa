export function PageHeader({
  eyebrow,
  title,
  introduction,
}: Readonly<{ eyebrow: string; title: string; introduction?: string }>) {
  return (
    <header className="page-header content-narrow">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {introduction ? <p className="page-introduction">{introduction}</p> : null}
    </header>
  );
}
