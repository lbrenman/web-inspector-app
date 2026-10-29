export default function Card({
  title,
  count,
  actions,
  children,
  className = '',
  bodyClassName = '',
}) {
  return (
    <section className={`card ${className}`}>
      <header className="card-head">
        <h3>
          {title}
          {count !== undefined && <span className="count">{count}</span>}
        </h3>
        {actions}
      </header>
      <div className={`card-body ${bodyClassName}`}>{children}</div>
    </section>
  );
}
