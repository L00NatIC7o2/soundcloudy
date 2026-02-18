// Simple SVG cat icon
export default function Cat({ style }: { style?: React.CSSProperties }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={style}>
      <ellipse cx="20" cy="28" rx="12" ry="10" fill="#333" />
      <ellipse cx="20" cy="18" rx="10" ry="8" fill="#444" />
      <ellipse cx="14" cy="10" rx="3" ry="5" fill="#444" />
      <ellipse cx="26" cy="10" rx="3" ry="5" fill="#444" />
      <ellipse cx="17" cy="18" rx="1.2" ry="2" fill="#fff" />
      <ellipse cx="23" cy="18" rx="1.2" ry="2" fill="#fff" />
      <ellipse cx="20" cy="22" rx="2" ry="1.2" fill="#f9a825" />
    </svg>
  );
}
