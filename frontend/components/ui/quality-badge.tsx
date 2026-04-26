import { cn } from "@/lib/utils";

type QualityType = "REMUX" | "ATMOS" | "4K" | "HDR" | "DV" | "IMAX" | "WEB-DL";

const config: Record<QualityType, { label: string; cls: string }> = {
  REMUX:    { label: "REMUX",   cls: "badge-remux"  },
  ATMOS:    { label: "ATMOS",   cls: "badge-atmos"  },
  "4K":     { label: "4K",      cls: "badge-4k"     },
  HDR:      { label: "HDR",     cls: "badge-hdr"    },
  DV:       { label: "VISION",  cls: "badge-dv"     },
  IMAX:     { label: "IMAX",    cls: "badge-imax"   },
  "WEB-DL": { label: "WEB-DL", cls: "badge-webdl"  },
};

interface QualityBadgeProps {
  type: QualityType;
  className?: string;
}

export function QualityBadge({ type, className }: QualityBadgeProps) {
  const { label, cls } = config[type] || config["WEB-DL"];
  return (
    <span
      className={cn(cls, className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        border: '1px solid',
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: '0.6rem',
        fontWeight: 600,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        borderRadius: 2,
        lineHeight: 1.5,
      }}
    >
      {label}
    </span>
  );
}