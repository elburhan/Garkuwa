export function FeatureStatusCard({
  title,
  description,
  status,
}: Readonly<{ title: string; description: string; status: string }>) {
  return (
    <article className="feature-card">
      <span className="status-badge">{status}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}
