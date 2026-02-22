export function StatsTicker() {
  const stats = [
    "Americans paid $1,000+ extra in tariffs in 2025",
    "Supreme Court struck down reciprocal tariffs Feb 20, 2026",
    "Trump signed new 10% global tariff same day",
    "Section 301 China tariffs remain up to 25% + 20% IEEPA",
    "Section 232 steel & aluminum tariffs: 25% globally",
  ];

  const content = stats.join(" · ");

  return (
    <div className="w-full overflow-hidden bg-surface border-t border-b border-border py-3">
      <div className="ticker-scroll whitespace-nowrap flex">
        <span className="text-sm text-muted-foreground px-4">{content}</span>
        <span className="text-sm text-muted-foreground px-4">{content}</span>
      </div>
    </div>
  );
}
