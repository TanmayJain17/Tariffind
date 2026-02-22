import { useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ShoppingCart, Upload, ImageIcon, AlertTriangle,
  ShieldCheck, ArrowRightLeft, ExternalLink, Globe, Package,
  TrendingDown, X, Share2, ChevronDown, ChevronUp, Sparkles
} from "lucide-react";
import { analyzeCart } from "@/lib/api";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import type { CartAnalysisResponse, CartAnalyzedItem, CartSwapSuggestion } from "@/types/tariff";

// ── Helpers ──

const COUNTRY_FLAGS: Record<string, string> = {
  CN: "🇨🇳", US: "🇺🇸", MX: "🇲🇽", VN: "🇻🇳", BD: "🇧🇩", IN: "🇮🇳",
  DE: "🇩🇪", JP: "🇯🇵", KR: "🇰🇷", TW: "🇹🇼", TH: "🇹🇭", ID: "🇮🇩",
  MY: "🇲🇾", IT: "🇮🇹", GB: "🇬🇧", FR: "🇫🇷", CA: "🇨🇦", BR: "🇧🇷",
};

function getTariffColor(rate: number): string {
  if (rate < 0.1) return "#10b981";
  if (rate < 0.25) return "#f59e0b";
  if (rate < 0.45) return "#f97316";
  return "#ef4444";
}

function getTariffBadge(rate: number) {
  if (rate < 0.1) return { label: "Low", bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" };
  if (rate < 0.25) return { label: "Moderate", bg: "bg-amber-500/15 text-amber-400 border-amber-500/25" };
  if (rate < 0.45) return { label: "High", bg: "bg-orange-500/15 text-orange-400 border-orange-500/25" };
  return { label: "Extreme", bg: "bg-red-500/15 text-red-400 border-red-500/25" };
}

// ── Upload Zone ──

function UploadZone({
  onUpload,
  isLoading,
}: {
  onUpload: (data: string, mediaType: string) => void;
  isLoading: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPreview(dataUrl);
        const base64 = dataUrl.split(",")[1];
        onUpload(base64, file.type);
      };
      reader.readAsDataURL(file);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="max-w-2xl mx-auto"
    >
      {/* Preview */}
      {preview && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 relative rounded-2xl overflow-hidden border border-white/[0.10] bg-white/[0.03]"
        >
          <img
            src={preview}
            alt="Cart screenshot"
            className="w-full max-h-[400px] object-contain bg-black/30"
          />
          {isLoading && (
            <div className="absolute inset-0 bg-[#09090f]/85 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-12 h-12 rounded-full border-2 border-orange-500/20 border-t-orange-500 mx-auto mb-4"
                />
                <div className="space-y-2 text-sm text-white/55">
                  <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}>
                    Extracting items with Claude Vision...
                  </motion.p>
                  <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay: 0.7 }}>
                    Classifying products against 29,796 HTS codes...
                  </motion.p>
                  <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay: 1.4 }}>
                    Calculating tariff layers per item...
                  </motion.p>
                </div>
              </div>
            </div>
          )}
          {!isLoading && (
            <button
              onClick={() => { setPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      )}

      {/* Drop zone */}
      {!preview && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative group cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-500 p-12 md:p-16 text-center ${
            isDragging
              ? "border-orange-500/60 bg-orange-500/[0.08] shadow-[0_0_60px_rgba(255,107,53,0.12)]"
              : "border-white/[0.12] bg-white/[0.03] hover:border-orange-500/35 hover:bg-white/[0.05]"
          }`}
        >
          <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br from-orange-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${isDragging ? "opacity-100" : ""}`} />

          <div className="relative z-10">
            <motion.div
              animate={isDragging ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500/15 to-amber-500/15 border border-orange-500/25 flex items-center justify-center mx-auto mb-6"
            >
              {isDragging ? (
                <Upload className="w-8 h-8 text-orange-400" />
              ) : (
                <ShoppingCart className="w-8 h-8 text-orange-400/80" />
              )}
            </motion.div>

            <h3 className="text-xl font-bold text-white mb-2">
              {isDragging ? "Drop your screenshot" : "Upload your shopping cart"}
            </h3>
            <p className="text-sm text-white/50 mb-6 max-w-md mx-auto leading-relaxed">
              Screenshot your Amazon, Walmart, Target, or Best Buy cart.
              We'll extract every item and reveal the hidden tariff tax.
            </p>

            <div className="flex items-center justify-center gap-4 text-xs text-white/40">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> PNG, JPG, WebP
              </span>
              <span className="text-white/20">|</span>
              <span>Drag & drop or click to browse</span>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />
    </motion.div>
  );
}

// ── Tariff Gauge (mini donut for each item) ──

function MiniGauge({ rate, size = 48 }: { rate: number; size?: number }) {
  const pct = rate * 100;
  const color = getTariffColor(rate);
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(pct, 100) / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - filled }}
          transition={{ duration: 1, ease: "easeOut" }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-mono font-bold" style={{ color }}>
          {pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// ── Item Card ──

function ItemCard({ item, index }: { item: CartAnalyzedItem; index: number }) {
  const hasError = !!item.error;
  const flag = item.country_code ? (COUNTRY_FLAGS[item.country_code] || "🌍") : "🌍";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06 }}
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
        hasError
          ? "border-white/[0.06] bg-white/[0.02] opacity-60"
          : "border-white/[0.10] bg-white/[0.03] hover:bg-white/[0.06]"
      }`}
    >
      {/* Gauge or error */}
      {hasError ? (
        <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4 text-white/35" />
        </div>
      ) : (
        <MiniGauge rate={item.tariff_rate || 0} />
      )}

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90 leading-snug line-clamp-1">{item.product_name}</p>
        {hasError ? (
          <p className="text-xs text-white/40 mt-0.5">{item.error}</p>
        ) : (
          <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
            <span>{flag} {item.country_of_origin}</span>
            {item.category && <span className="text-white/25">·</span>}
            {item.category && <span>{item.category}</span>}
          </div>
        )}
      </div>

      {/* Price + tariff */}
      <div className="text-right shrink-0">
        <p className="text-sm font-mono font-semibold text-white/90">${item.line_total.toFixed(2)}</p>
        {!hasError && item.tariff_you_pay != null && item.tariff_you_pay > 0 && (
          <p className="text-xs font-mono mt-0.5" style={{ color: getTariffColor(item.tariff_rate || 0) }}>
            +${item.tariff_you_pay.toFixed(2)} tariff
          </p>
        )}
        {item.quantity > 1 && (
          <p className="text-xs text-white/30 mt-0.5">qty: {item.quantity}</p>
        )}
      </div>
    </motion.div>
  );
}

// ── Swap Suggestion Card ──

function SwapCard({ swap, index }: { swap: CartSwapSuggestion; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const orig = swap.original_item;
  const color = getTariffColor(orig.tariff_rate);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.12 }}
      className="rounded-2xl border border-white/[0.10] bg-white/[0.03] overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center gap-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
             style={{ background: `${color}18`, border: `1px solid ${color}35` }}>
          <ArrowRightLeft className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/90 line-clamp-1">{orig.product_name}</p>
          <p className="text-xs text-white/50 mt-0.5">
            ${orig.price.toFixed(2)} · {orig.tariff_pct} tariff · ${orig.tariff_you_pay.toFixed(2)} tariff cost
          </p>
        </div>
        {swap.potential_savings > 0 && (
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/25 shrink-0">
            Save ${swap.potential_savings.toFixed(2)}
          </span>
        )}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-white/35 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/35 shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3">
              <p className="text-xs text-white/45 italic">{swap.swap_verdict}</p>

              {swap.alternatives.length === 0 ? (
                <p className="text-sm text-white/40 py-3 text-center">No better alternatives found</p>
              ) : (
                swap.alternatives.map((alt, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04]"
                  >
                    {alt.thumbnail && (
                      <img
                        src={alt.thumbnail}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover bg-white/[0.05] shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/90 line-clamp-2">{alt.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <span className="font-mono text-white/70">${alt.price?.toFixed(2)}</span>
                        {alt.country_of_origin && (
                          <span className="text-white/45">{alt.country_of_origin}</span>
                        )}
                        {alt.tariff_pct && (
                          <span className="text-white/45">Tariff: {alt.tariff_pct}</span>
                        )}
                      </div>
                      {alt.tariff_advantage && (
                        <p className="text-xs text-emerald-400/90 mt-1">{alt.tariff_advantage}</p>
                      )}
                      {(alt.product_link || alt.link) && (
                        <a
                          href={alt.product_link || alt.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors mt-2"
                        >
                          View Deal <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Breakdown Bar Chart ──

function BreakdownBars({
  data,
  totalValue,
  colorFn,
}: {
  data: { label: string; value: number; sub?: string }[];
  totalValue: number;
  colorFn: (index: number) => string;
}) {
  return (
    <div className="space-y-3">
      {data.map((item, i) => {
        const pct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
        return (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-white/70">{item.label}</span>
              <span className="text-sm font-mono text-white/90">${item.value.toFixed(2)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                className="h-full rounded-full"
                style={{ backgroundColor: colorFn(i) }}
              />
            </div>
            {item.sub && <p className="text-xs text-white/40 mt-0.5">{item.sub}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ── Results Display ──

function CartResults({ data, onReset }: { data: CartAnalysisResponse; onReset: () => void }) {
  const { summary, analyzed_items, swap_suggestions } = data;

  const tariffPctNum = parseFloat(summary.tariff_as_pct_of_cart) || 0;
  const mainColor = getTariffColor(tariffPctNum / 100);

  const sortedItems = [...analyzed_items].sort(
    (a, b) => (b.tariff_you_pay || 0) - (a.tariff_you_pay || 0)
  );

  const categoryData = Object.entries(summary.category_breakdown || {}).map(([label, val]) => ({
    label,
    value: val.tariff_cost,
    sub: `${val.items} item${val.items > 1 ? "s" : ""} · $${val.spend.toFixed(2)} spend`,
  }));

  const countryData = Object.entries(summary.country_breakdown || {}).map(([label, val]) => ({
    label,
    value: val.tariff_cost,
    sub: `${val.avg_tariff_rate} avg tariff · $${val.spend.toFixed(2)} spend`,
  }));

  const catColors = ["#f97316", "#f59e0b", "#ef4444", "#a78bfa", "#06b6d4", "#10b981"];
  const countryColors = ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4", "#a78bfa"];

  const circumference = 2 * Math.PI * 72;
  const filled = (Math.min(tariffPctNum, 100) / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* ── Headline Hero ── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-white/[0.10] bg-gradient-to-br from-white/[0.04] to-transparent p-8 md:p-12 mb-8 relative overflow-hidden"
      >
        <div
          className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-[0.08] pointer-events-none"
          style={{ background: mainColor }}
        />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.10] text-white/60">
                <ShoppingCart className="w-3 h-3 inline -mt-0.5 mr-1" />
                {summary.store} Cart · {summary.total_items} items
              </span>
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${getTariffBadge(tariffPctNum / 100).bg}`}>
                {getTariffBadge(tariffPctNum / 100).label} Exposure
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-6">
              {summary.headline}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <p className="text-xs text-white/45 mb-1">Cart Total</p>
                <p className="text-xl font-bold font-mono text-white">
                  $<AnimatedNumber value={summary.total_cart_price} decimals={2} />
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <p className="text-xs text-white/45 mb-1">Hidden Tariff Tax</p>
                <p className="text-xl font-bold font-mono" style={{ color: mainColor }}>
                  $<AnimatedNumber value={summary.total_tariff_you_pay} decimals={2} />
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <p className="text-xs text-white/45 mb-1">Without Tariffs</p>
                <p className="text-xl font-bold font-mono text-emerald-400">
                  $<AnimatedNumber value={summary.price_without_tariffs} decimals={2} />
                </p>
              </div>
            </div>

            {summary.potential_savings > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/25"
              >
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-300">
                  We found <span className="font-bold">${summary.potential_savings.toFixed(2)}</span> in potential savings with {summary.swap_count} smart swaps
                </p>
              </motion.div>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="shrink-0"
          >
            <div className="relative" style={{ width: 192, height: 192 }}>
              <svg width={192} height={192} viewBox="0 0 192 192">
                <circle cx="96" cy="96" r="72" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
                <motion.circle
                  cx="96" cy="96" r="72" fill="none" stroke={mainColor} strokeWidth="16" strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: circumference - filled }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                  transform="rotate(-90 96 96)"
                  style={{ filter: `drop-shadow(0 0 12px ${mainColor}40)` }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold font-mono" style={{ color: mainColor }}>
                  <AnimatedNumber value={tariffPctNum} suffix="%" decimals={1} />
                </span>
                <span className="text-xs uppercase tracking-widest text-white/45 mt-1">tariff share</span>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Per-item breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-6 md:p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-white/45 mb-1">Per-Item Breakdown</p>
                <p className="text-lg font-bold text-white">
                  {analyzed_items.length} items analyzed
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/45">Highest tariff</p>
                <p className="text-sm font-mono font-bold text-orange-400">{summary.highest_tariff_rate}</p>
              </div>
            </div>

            <div className="space-y-2">
              {sortedItems.map((item, i) => (
                <ItemCard key={i} item={item} index={i} />
              ))}
            </div>
          </motion.div>

          {/* Smart Swap Suggestions */}
          {swap_suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-6 md:p-8"
            >
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Smart Swap Suggestions</h3>
              </div>
              <p className="text-xs text-white/45 mb-6">
                Lower-tariff alternatives for your highest-cost items
              </p>

              <div className="space-y-3">
                {swap_suggestions.map((swap, i) => (
                  <SwapCard key={i} swap={swap} index={i} />
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {categoryData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-6"
            >
              <p className="text-xs uppercase tracking-[0.15em] text-white/45 mb-1">Tariff by Category</p>
              <p className="text-sm font-semibold text-white mb-5">Where the tariff tax hits hardest</p>
              <BreakdownBars
                data={categoryData}
                totalValue={summary.total_tariff_you_pay}
                colorFn={(i) => catColors[i % catColors.length]}
              />
            </motion.div>
          )}

          {countryData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-6"
            >
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-white/45" />
                <p className="text-xs uppercase tracking-[0.15em] text-white/45">By Country of Origin</p>
              </div>
              <p className="text-sm font-semibold text-white mb-5">Tariff cost by where it's made</p>
              <BreakdownBars
                data={countryData}
                totalValue={summary.total_tariff_you_pay}
                colorFn={(i) => countryColors[i % countryColors.length]}
              />
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-2xl border border-orange-500/15 bg-gradient-to-br from-orange-500/[0.06] to-transparent p-6"
          >
            <h4 className="font-bold text-white mb-1 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-orange-400" /> Share Your Cart Tariff
            </h4>
            <p className="text-xs text-white/45 mb-4">Let others see the hidden cost</p>
            <button
              onClick={() => {
                const text = `${summary.headline} #TariffShield`;
                if (navigator.share) {
                  navigator.share({ text });
                } else {
                  navigator.clipboard.writeText(text);
                }
              }}
              className="w-full py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-[0_0_20px_rgba(255,107,53,0.2)] transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" /> Copy & Share
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
          >
            <button
              onClick={onReset}
              className="w-full py-3.5 rounded-xl font-semibold text-sm border border-white/[0.10] bg-white/[0.03] hover:bg-white/[0.07] text-white/70 hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" /> Analyze Another Cart
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-3"
          >
            <p className="text-xs uppercase tracking-[0.15em] text-white/40">Cart Summary</p>
            <div className="flex items-center gap-3 text-sm">
              <Package className="w-4 h-4 text-white/35 shrink-0" />
              <span className="text-white/55">
                Highest tariff: <span className="text-white/85">{summary.highest_tariff_item || "N/A"}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <TrendingDown className="w-4 h-4 text-white/35 shrink-0" />
              <span className="text-white/55">
                {summary.total_items} items from {Object.keys(summary.country_breakdown || {}).length} countries
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Globe className="w-4 h-4 text-white/35 shrink-0" />
              <span className="text-white/55">
                Confidence: <span className="text-white/85">{data.extraction.confidence}</span>
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ──

export default function CartAnalyzer() {
  const [result, setResult] = useState<CartAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async (imageData: string, mediaType: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeCart(imageData, mediaType);
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || "Cart analysis failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#09090f] text-white">
      {/* Nav */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#09090f]/80 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-white/55 hover:text-white/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to search
          </Link>
          <Link
            to="/dashboard"
            className="text-sm text-white/55 hover:text-white/80 transition-colors"
          >
            My Dashboard →
          </Link>
        </div>
      </div>

      <div className="pt-24 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          {!result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                </span>
                <span className="text-sm text-orange-300 font-medium tracking-wide">
                  Powered by Claude Vision AI
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
                <span className="text-white/95">Cart </span>
                <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                  X-Ray
                </span>
              </h1>
              <p className="text-lg text-white/55 max-w-xl mx-auto leading-relaxed">
                Upload a screenshot of your shopping cart — we'll reveal the hidden tariff tax on every single item.
              </p>
            </motion.div>
          )}

          {/* Error */}
          {error && !loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto text-center mb-8"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Analysis Failed</h2>
              <p className="text-sm text-white/55 mb-6">{error}</p>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl text-sm"
              >
                Try Again
              </button>
            </motion.div>
          )}

          {/* Upload zone */}
          {!result && <UploadZone onUpload={handleUpload} isLoading={loading} />}

          {/* Results */}
          {result && <CartResults data={result} onReset={handleReset} />}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] py-6 px-4">
        <p className="text-center text-xs text-white/35">
          TariffShield · Cart X-Ray · Built at Tech@NYU Startup Week 2026 · Powered by Claude Vision AI
        </p>
      </footer>
    </div>
  );
}