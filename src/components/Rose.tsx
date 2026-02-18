// Simple SVG rose icon
export default function Rose({ style }: { style?: React.CSSProperties }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={style}>
      <ellipse cx="16" cy="24" rx="6" ry="8" fill="#2e7d32" />
      <ellipse cx="16" cy="12" rx="8" ry="10" fill="#e53935" />
      <ellipse cx="16" cy="10" rx="5" ry="6" fill="#c62828" />
    </svg>
  );
}
