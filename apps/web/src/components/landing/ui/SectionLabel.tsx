import { Play } from "lucide-react";

interface SectionLabelProps {
  children: React.ReactNode;
}

export default function SectionLabel({ children }: SectionLabelProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-5 w-5 items-center justify-center bg-indigo-500">
        <Play className="h-2.5 w-2.5 fill-white text-white" />
      </div>
      <span className="text-xs font-semibold tracking-widest uppercase text-white">
        {children}
      </span>
    </div>
  );
}
