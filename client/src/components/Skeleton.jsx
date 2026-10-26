export function Skeleton({ height = 20, width = "100%", style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ height, width, borderRadius: 6, ...style }}
    />
  );
}

export function SkeletonRow({ cols = 4 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}><Skeleton height={16} /></td>
      ))}
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <Skeleton height={14} width="40%" />
      <Skeleton height={20} width="70%" />
      <Skeleton height={14} width="55%" />
    </div>
  );
}
