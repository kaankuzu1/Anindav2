interface BadgeProps {
  children: React.ReactNode;
  highlight?: string;
  className?: string;
}

export default function Badge({
  children,
  highlight,
  className = "",
}: BadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-1.5 ${className}`}
    >
      {highlight && (
        <span className="rounded-full bg-indigo-500 px-2.5 py-0.5 text-xs font-semibold text-white">
          {highlight}
        </span>
      )}
      <span className="text-xs font-medium tracking-widest text-slate-400 uppercase">
        {children}
      </span>
    </div>
  );
}
