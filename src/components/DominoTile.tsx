type DominoTileProps = {
  a: number;
  b: number;
  size?: 'sm' | 'md' | 'lg';
  orientation?: 'vertical' | 'horizontal';
  highlight?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  className?: string;
};

const SIZES = {
  sm: { w: 32, h: 58 },
  md: { w: 44, h: 78 },
  lg: { w: 56, h: 98 },
};

function Pip({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return <circle cx={cx} cy={cy} r={r} fill="#1a1a2e" />;
}

function HalfPips({ value, cx, cy, pr }: { value: number; cx: number; cy: number; pr: number }) {
  const positions: [number, number][] = [];
  const off = pr * 2.2;

  switch (value) {
    case 0: break;
    case 1: positions.push([cx, cy]); break;
    case 2: positions.push([cx - off, cy - off], [cx + off, cy + off]); break;
    case 3: positions.push([cx - off, cy - off], [cx, cy], [cx + off, cy + off]); break;
    case 4: positions.push([cx - off, cy - off], [cx + off, cy - off], [cx - off, cy + off], [cx + off, cy + off]); break;
    case 5: positions.push([cx - off, cy - off], [cx + off, cy - off], [cx, cy], [cx - off, cy + off], [cx + off, cy + off]); break;
    case 6: positions.push([cx - off, cy - off], [cx + off, cy - off], [cx - off, cy], [cx + off, cy], [cx - off, cy + off], [cx + off, cy + off]); break;
  }

  return (
    <>
      {positions.map(([px, py], i) => (
        <Pip key={i} cx={px} cy={py} r={pr} />
      ))}
    </>
  );
}

export default function DominoTile({
  a,
  b,
  size = 'md',
  orientation = 'vertical',
  highlight = false,
  dimmed = false,
  onClick,
  className = '',
}: DominoTileProps) {
  const dims = SIZES[size];
  const isV = orientation === 'vertical';
  const w = isV ? dims.w : dims.h;
  const h = isV ? dims.h : dims.w;
  const midY = isV ? h / 2 : w / 2;
  const pr = Math.min(w, h) * 0.075;
  const topVal = isV ? a : a;
  const botVal = isV ? b : b;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`relative transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
      } ${highlight ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-emerald-900 scale-105' : ''} ${
        dimmed ? 'opacity-40 grayscale' : ''
      } ${className}`}
      style={{ width: w, height: h }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="drop-shadow-md">
        <rect
          x={1}
          y={1}
          width={w - 2}
          height={h - 2}
          rx={5}
          fill={highlight ? '#fef9c3' : '#f8f5e8'}
          stroke={highlight ? '#f59e0b' : '#d4cfa0'}
          strokeWidth={1.5}
        />
        {isV ? (
          <>
            <HalfPips value={topVal} cx={w / 2} cy={h * 0.25} pr={pr} />
            <line x1={4} y1={midY} x2={w - 4} y2={midY} stroke="#c4bf90" strokeWidth={1.5} />
            <HalfPips value={botVal} cx={w / 2} cy={h * 0.75} pr={pr} />
          </>
        ) : (
          <>
            <HalfPips value={topVal} cx={w * 0.25} cy={h / 2} pr={pr} />
            <line x1={midY} y1={4} x2={midY} y2={h - 4} stroke="#c4bf90" strokeWidth={1.5} />
            <HalfPips value={botVal} cx={w * 0.75} cy={h / 2} pr={pr} />
          </>
        )}
      </svg>
    </button>
  );
}
