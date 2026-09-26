type StatsCardProps = {
  label: string;
  value: string | number;
  sub?: string;
};

export function StatsCard({ label, value, sub }: StatsCardProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/10">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-navy">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
