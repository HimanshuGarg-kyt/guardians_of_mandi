export default function Avatar({ name, color = "#7bd389", size = 40, className = "" }) {
  const initial = String(name || "?").trim().slice(0, 1).toUpperCase() || "?";
  return (
    <span
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.round(size * 0.42),
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
