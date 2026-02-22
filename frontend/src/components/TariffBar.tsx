import type { TariffBreakdownItem } from "@/types/tariff";

const LAYER_COLORS: Record<string, string> = {
  mfn_base: "#6B7280",
  section_301: "#EF4444",
  section_232: "#F97316",
  ieepa_fentanyl: "#991B1B",
  section_122: "#F59E0B",
  fta_adjustment: "#3B82F6",
  other: "#8B5CF6",
};

function getColor(type: string) {
  return LAYER_COLORS[type] || LAYER_COLORS.other;
}

interface TariffBarProps {
  breakdown: TariffBreakdownItem[];
  totalRate: number;
}

export function TariffBar({ breakdown, totalRate }: TariffBarProps) {
  const activeItems = breakdown.filter((b) => b.rate_pct > 0);

  if (activeItems.length === 0) return null;

  return (
    <div>
      <div className="flex rounded-lg overflow-hidden h-6">
        {activeItems.map((item, i) => (
          <div
            key={i}
            className="relative group transition-all duration-200"
            style={{
              width: `${(item.rate_pct / totalRate) * 100}%`,
              backgroundColor: getColor(item.type),
              minWidth: "4px",
            }}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 whitespace-nowrap px-3 py-2 glass-card-static text-xs text-foreground shadow-xl">
              {item.label}: {item.rate}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        {activeItems.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: getColor(item.type) }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
