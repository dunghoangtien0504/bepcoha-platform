// Linh vật "Cốm" — hạt cốm xanh đội mũ bếp (đồng bộ "Hạt Cốm" của Mini App). Học Duolingo/Easymart (B2 K17):
// khen hết lời khi xong việc, "mắng" vui khi về mà còn việc. Vẽ bằng SVG nên nhẹ, không cần tải ảnh.
export type ComMood = 'vui' | 'tu_hao' | 'buon' | 'gian' | 'binh'

export function Com({ mood = 'vui', size = 96, className = '' }: { mood?: ComMood; size?: number; className?: string }) {
  const eyes = {
    vui: <><path d="M44 66 q5 -6 10 0" /><path d="M66 66 q5 -6 10 0" /></>,
    tu_hao: <><path d="M49 60 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1z" fill="#3f2a14" stroke="none" /><path d="M71 60 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1z" fill="#3f2a14" stroke="none" /></>,
    buon: <><circle cx="49" cy="67" r="3.5" fill="#3f2a14" stroke="none" /><circle cx="71" cy="67" r="3.5" fill="#3f2a14" stroke="none" /><path d="M43 59 l10 3" /><path d="M77 59 l-10 3" /><path d="M75 73 q2 6 0 9 q-3 -3 0 -9z" fill="#7dd3fc" stroke="#38bdf8" strokeWidth="1" /></>,
    gian: <><circle cx="49" cy="68" r="3.5" fill="#3f2a14" stroke="none" /><circle cx="71" cy="68" r="3.5" fill="#3f2a14" stroke="none" /><path d="M42 58 l12 5" /><path d="M78 58 l-12 5" /></>,
    binh: <><circle cx="49" cy="67" r="3.5" fill="#3f2a14" stroke="none" /><circle cx="71" cy="67" r="3.5" fill="#3f2a14" stroke="none" /></>,
  }[mood]
  const mouth = {
    vui: <path d="M52 80 q8 9 16 0" fill="#7f1d1d" />,
    tu_hao: <path d="M50 78 q10 14 20 0 z" fill="#7f1d1d" />,
    buon: <path d="M53 86 q7 -6 14 0" />,
    gian: <path d="M52 85 q8 -7 16 0 z" fill="#7f1d1d" />,
    binh: <path d="M54 82 h12" />,
  }[mood]
  return (
    <svg viewBox="0 0 120 124" width={size} height={size} className={className} role="img" aria-label={`Cốm đang ${mood === 'gian' ? 'dỗi' : mood === 'buon' ? 'buồn' : 'vui'}`}>
      <defs>
        <radialGradient id="com-body" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#d9f99d" />
          <stop offset="60%" stopColor="#84cc16" />
          <stop offset="100%" stopColor="#4d7c0f" />
        </radialGradient>
      </defs>
      {/* tay */}
      <g stroke="#3f6212" strokeWidth="5" strokeLinecap="round" fill="none">
        {mood === 'tu_hao' ? <><path d="M26 80 l-12 -16" /><path d="M94 80 l12 -16" /></>
          : mood === 'gian' ? <><path d="M26 84 l-10 6" /><path d="M94 84 l10 6" /></>
          : <><path d="M25 86 l-11 4" /><path d="M95 86 l11 -6" /></>}
      </g>
      {/* thân hạt cốm */}
      <path d="M60 30 C 88 30 100 58 98 80 C 96 104 80 116 60 116 C 40 116 24 104 22 80 C 20 58 32 30 60 30 Z" fill="url(#com-body)" stroke="#3f6212" strokeWidth="3" />
      <path d="M44 42 q-8 10 -10 24" stroke="#ecfccb" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".8" />
      {/* mũ bếp */}
      <g fill="#fff" stroke="#d6d3d1" strokeWidth="2">
        <rect x="42" y="22" width="36" height="12" rx="3" />
        <circle cx="46" cy="16" r="10" /><circle cx="60" cy="11" r="12" /><circle cx="74" cy="16" r="10" />
      </g>
      <rect x="43" y="27" width="34" height="6" fill="#fff" />
      {/* má */}
      <circle cx="40" cy="78" r="6" fill="#fda4af" opacity=".7" />
      <circle cx="80" cy="78" r="6" fill="#fda4af" opacity=".7" />
      <g stroke="#3f2a14" strokeWidth="3" strokeLinecap="round" fill="none">{eyes}{mouth}</g>
      {mood === 'tu_hao' && <g fill="#facc15"><path d="M14 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" /><path d="M104 34 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" /></g>}
      {mood === 'gian' && <path d="M96 30 l6 -6 m-2 10 l8 -2 m-14 -6 l2 -8" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />}
    </svg>
  )
}

/** Bong bóng thoại kèm Cốm. */
export function ComSays({ mood, line, size = 72, children }: { mood: ComMood; line: string; size?: number; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Com mood={mood} size={size} className="shrink-0 drop-shadow-sm" />
      <div className="relative min-w-0 flex-1 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-3 text-base font-medium text-lime-950">
        <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 border-b border-l border-lime-200 bg-lime-50" />
        <span className="relative">{line}</span>
        {children}
      </div>
    </div>
  )
}
