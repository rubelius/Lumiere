import { Badge } from "./badge";
import { Disc, Tv, MonitorPlay, Sun, Eye, Maximize, FileVideo } from "lucide-react";

type QualityType = "REMUX" | "ATMOS" | "4K" | "HDR" | "VISION" | "IMAX" | "WEB-DL";

interface QualityBadgeProps {
  type: QualityType;
  compact?: boolean;
}

export function QualityBadge({ type, compact = false }: QualityBadgeProps) {
  const config = {
    REMUX: { color: "bg-[#10B981]/20 text-[#10B981] border-[#10B981]/30", icon: Disc, label: "REMUX" },
    ATMOS: { color: "bg-[#8B5CF6]/20 text-[#8B5CF6] border-[#8B5CF6]/30", icon: Tv, label: "ATMOS" },
    "4K": { color: "bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30", icon: MonitorPlay, label: "4K" },
    HDR: { color: "bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/30", icon: Sun, label: "HDR" },
    VISION: { color: "bg-[#38BDF8]/20 text-[#38BDF8] border-[#38BDF8]/30", icon: Eye, label: "VISION" },
    IMAX: { color: "bg-[#06B6D4]/20 text-[#06B6D4] border-[#06B6D4]/30", icon: Maximize, label: "IMAX" },
    "WEB-DL": { color: "bg-[#A8A29E]/20 text-[#A8A29E] border-[#A8A29E]/30", icon: FileVideo, label: "WEB-DL" },
  };

  const { color, icon: Icon, label } = config[type];

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-bold uppercase tracking-wider backdrop-blur-md ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {!compact && <span>{label}</span>}
    </div>
  );
}
