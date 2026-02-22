import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, ExternalLink, Info, ShieldCheck, Plus,
  TrendingDown, AlertTriangle, Globe, Package
} from "lucide-react";
import { analyzeProduct } from "@/lib/api";
import { addPurchase } from "@/lib/storage";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import type { FullPipelineResponse } from "@/types/tariff";
import { toast } from "@/hooks/use-toast";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine
} from "recharts";

const COUNTRY_FLAGS: Record<string, string> = {
  CN: "🇨🇳", US: "🇺🇸", MX: "🇲🇽", VN: "🇻🇳", BD: "🇧🇩", IN: "🇮🇳",
  DE: "🇩🇪", JP: "🇯🇵", KR: "🇰🇷", TW: "🇹🇼", TH: "🇹🇭", ID: "🇮🇩",
  MY: "🇲🇾", IT: "🇮🇹", GB: "🇬🇧", FR: "🇫🇷", CA: "🇨🇦", BR: "🇧🇷",
};

function getTariffSeverity(rate: number) {
  if (rate < 10) return { color: "#10b981", label: "Low", bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" };
  if (rate < 25) return { color: "#f59e0b", label: "Moderate", bg: "bg-amber-500/15 text-amber-400 border-amber-500/25" };
  if (rate < 45) return { color: "#f97316", label: "High", bg: "bg-orange-500/15 text-orange-400 border-orange-500/25" };
  return { color: "#ef4444", label: "Extreme", bg: "bg-red-500/15 text-red-400 border-red-500/25" };
}

function TariffDonut({ rate, size = 180 }: { rate: number; size?: number }) {
  const severity = getTariffSeverity(rate);
  const circumference = 2 * Math.PI * 68;
  const filled = (rate / 100) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 180 180">
        <circle cx="90" cy="90" r="68" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
        <motion.circle
          cx="90" cy="90" r="68" fill="none" stroke={severity.color} strokeWidth="16" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - filled }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
          transform="rotate(-90 90 90)"
          style={{ filter: `drop-shadow(0 0 12px ${severity.color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold font-mono" style={{ color: severity.color }}>
          <AnimatedNumber value={rate} suffix="%" decimals={1} />
        </span>
        <span className="text-xs uppercase tracking-widest text-white/45 mt-1">total tariff</span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#09090f] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-16 h-16 rounded-full border-2 border-orange-500/20 border-t-orange-500 mx-auto mb-8" />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h2 className="text-2xl font-bold text-white mb-3">Analyzing tariff exposure</h2>
          <div className="space-y-2 text-sm text-white/50">
            <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}>Searching Google Shopping for real prices...</motion.p>
            <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}>Classifying against 29,796 HTS codes...</motion.p>
            <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay: 1 }}>Calculating 5 tariff layers...</motion.p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

const LAYER_TYPE_MAP: Record<string, string> = { "MFN": "mfn_base", "301": "section_301", "232": "section_232", "IEEPA": "ieepa_fentanyl", "122": "section_122" };
const LAYER_COLORS: Record<string, { color: string; label: string }> = {
  mfn_base: { color: "#94A3B8", label: "MFN Base Rate" },
  section_301: { color: "#EF4444", label: "Section 301 (China)" },
  section_232: { color: "#F97316", label: "Section 232 (Steel/Aluminum)" },
  ieepa_fentanyl: { color: "#DC2626", label: "IEEPA Fentanyl" },
  section_122: { color: "#F59E0B", label: "Section 122 (Blanket 10%)" },
  other: { color: "#A78BFA", label: "Other" },
};

export default function Results() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [data, setData] = useState<FullPipelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addedToReport, setAddedToReport] = useState(false);

  useEffect(() => {
    if (!query) return;
    setLoading(true); setError(null);
    analyzeProduct(query).then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [query]);

  const handleAddPurchase = () => {
    if (!data?.tariff || !data.price_impact) return;
    addPurchase({
      product: data.selected_product.title, price: data.selected_product.price || 0,
      tariff_rate: parseFloat(String(data.tariff.total_pct)),
      tariff_you_pay: data.price_impact.estimated_tariff_you_pay,
      country: data.classification.country_name, category: data.tariff.category_label, timestamp: Date.now(),
    });
    setAddedToReport(true);
    toast({ title: "Added to your Tariff Report", description: data.selected_product.title });
  };

  if (loading) return <LoadingState />;
  if (error) {
    return (
      <div className="min-h-screen bg-[#09090f] flex items-center justify-center px-4 pt-20">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-6"><AlertTriangle className="w-8 h-8 text-red-400" /></div>
          <h2 className="text-2xl font-bold text-white mb-3">{error.includes("fetch") || error.includes("Failed") ? "Backend not connected" : "Something went wrong"}</h2>
          <p className="text-white/55 mb-6 text-sm">{error}</p>
          <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl text-sm"><ArrowLeft className="w-4 h-4" /> Try another search</Link>
        </motion.div>
      </div>
    );
  }
  if (!data) return null;

  const { selected_product, classification, tariff, price_impact, alternatives, price_history } = data;
  const totalPct = typeof tariff.total_pct === "string" ? parseFloat(tariff.total_pct) : tariff.total_pct;
  const severity = getTariffSeverity(totalPct);
  const flag = COUNTRY_FLAGS[classification.country_of_origin] || "🌍";

  const structuredBreakdown = (Array.isArray(tariff.breakdown) ? tariff.breakdown : [])
    .filter((item: any) => !(typeof item === "string" ? item : "").includes("═══"))
    .map((item: any) => {
      const s = typeof item === "string" ? item : item?.label || "";
      const pctMatch = s.match(/([\d.]+)%/);
      const pct = pctMatch ? parseFloat(pctMatch[1]) : 0;
      let type = "other";
      for (const [key, val] of Object.entries(LAYER_TYPE_MAP)) { if (s.includes(key)) { type = val; break; } }
      return { label: LAYER_COLORS[type]?.label || s.split(":")[0].trim(), rate: pctMatch ? `${pct}%` : "Free", rate_pct: pct, type, note: s };
    });

  const chartData = price_history?.timeline?.map((t) => ({ date: t.date, price: t.estimated_price, event: t.event })) || [];

  return (
    <div className="min-h-screen bg-[#09090f] text-white">
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#09090f]/80 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-white/55 hover:text-white/80 transition-colors"><ArrowLeft className="w-4 h-4" /> Back to search</Link>
          <div className="flex items-center gap-5">
            <Link to="/cart" className="text-sm text-white/55 hover:text-white/80 transition-colors">Cart X-Ray</Link>
            <Link to="/dashboard" className="text-sm text-white/55 hover:text-white/80 transition-colors">My Dashboard →</Link>
          </div>
        </div>
      </div>

      <div className="pt-24 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          {/* HERO — Product + Donut */}
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
            <div className="rounded-3xl border border-white/[0.10] bg-gradient-to-br from-white/[0.04] to-transparent p-8 md:p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-10 pointer-events-none" style={{ background: severity.color }} />
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${severity.bg}`}>{severity.label} Tariff</span>
                    <span className="text-xs text-white/40 font-mono">{tariff.hts_code}</span>
                  </div>
                  <div className="flex items-start gap-5 mb-6">
                    {selected_product.thumbnail && <img src={selected_product.thumbnail} alt="" className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover bg-white/[0.05] border border-white/[0.10] shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.15em] text-white/45 mb-1">{tariff.category_label}</p>
                      <h1 className="text-xl md:text-2xl font-bold text-white leading-snug mb-2 line-clamp-2">{selected_product.title}</h1>
                      {selected_product.price != null && <p className="text-3xl font-bold font-mono text-white">${selected_product.price.toFixed(2)}</p>}
                      <p className="text-sm text-white/50 mt-1">{flag} {classification.country_name} · {selected_product.source}</p>
                    </div>
                  </div>
                  {price_impact && (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                      <div>
                        <p className="text-sm text-white/55">You're paying an extra</p>
                        <p className="text-2xl font-bold font-mono" style={{ color: severity.color }}><AnimatedNumber value={price_impact.estimated_tariff_you_pay} prefix="$" /></p>
                        <p className="text-xs text-white/40">in hidden tariff tax on this product</p>
                      </div>
                      <div className="hidden md:block h-12 w-px bg-white/[0.10]" />
                      <div className="hidden md:block">
                        <p className="text-xs text-white/45">Pre-tariff price</p>
                        <p className="text-lg font-mono text-white/65 line-through">${price_impact.estimated_pre_tariff_price.toFixed(2)}</p>
                      </div>
                    </motion.div>
                  )}
                </div>
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.6 }} className="shrink-0">
                  <TariffDonut rate={totalPct} />
                </motion.div>
              </div>
            </div>
          </motion.section>

          {/* MAIN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Tariff Layers */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-6 md:p-8">
                <p className="text-xs uppercase tracking-[0.15em] text-white/45 mb-4">Tariff Layers</p>
                <div className="flex rounded-xl overflow-hidden h-10 mb-6">
                  {structuredBreakdown.filter(b => b.rate_pct > 0).map((item, i) => (
                    <motion.div key={i} initial={{ width: 0 }} animate={{ width: `${(item.rate_pct / totalPct) * 100}%` }} transition={{ duration: 0.8, delay: 0.4 + i * 0.1 }}
                      className="relative group cursor-pointer" style={{ backgroundColor: LAYER_COLORS[item.type]?.color || "#A78BFA", minWidth: "8px" }}>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block z-20">
                        <div className="px-3 py-2 rounded-lg bg-[#14141e] border border-white/[0.12] text-xs whitespace-nowrap shadow-2xl">
                          <p className="font-semibold text-white">{item.label}</p><p className="text-white/60 font-mono">{item.rate}</p>
                        </div>
                      </div>
                      {item.rate_pct >= 8 && <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold text-white/90">{item.rate}</span>}
                    </motion.div>
                  ))}
                </div>
                <div className="space-y-1">
                  {structuredBreakdown.map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.08 }}
                      className="flex items-center justify-between py-3 border-b border-white/[0.06] last:border-0 group">
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: LAYER_COLORS[item.type]?.color || "#A78BFA" }} />
                        <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">{item.label}</span>
                      </div>
                      <span className="font-mono text-sm font-semibold text-white/90">{item.rate}</span>
                    </motion.div>
                  ))}
                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/[0.12]">
                    <span className="text-sm font-semibold text-white">Total Effective Rate</span>
                    <span className="font-mono text-lg font-bold" style={{ color: severity.color }}>{totalPct.toFixed(1)}%</span>
                  </div>
                </div>
                {price_impact && (
                  <p className="text-xs text-white/40 mt-4 flex items-center gap-1">
                    <Info className="w-3 h-3" /> ~{Math.round((tariff.consumer_passthrough_rate || 0.72) * 100)}% of tariff costs are typically passed to consumers for this category.
                  </p>
                )}
              </motion.div>

              {/* Price History */}
              {chartData.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                  className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-6 md:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-white/45 mb-1">Price Timeline</p>
                      <p className="text-lg font-bold text-white">How tariffs changed this price</p>
                    </div>
                    {price_history && (
                      <div className="text-right">
                        <p className="text-xs text-white/45">Estimated markup</p>
                        <p className="text-lg font-mono font-bold text-orange-400">+${price_history.total_tariff_markup?.toFixed(0) || "?"}</p>
                      </div>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={severity.color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={severity.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                      <Tooltip contentStyle={{ background: "rgba(14,14,22,0.95)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#fff", fontSize: 13, fontFamily: "monospace", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }} formatter={(value: number) => [`$${value.toFixed(2)}`, "Est. Price"]} />
                      <ReferenceLine x="2025-04" stroke="rgba(239,68,68,0.5)" strokeDasharray="4 4" label={{ value: "Liberation Day", fill: "rgba(239,68,68,0.6)", fontSize: 11 }} />
                      <ReferenceLine x="2026-02" stroke="rgba(16,185,129,0.5)" strokeDasharray="4 4" label={{ value: "SCOTUS", fill: "rgba(16,185,129,0.6)", fontSize: 11 }} />
                      <Area type="monotone" dataKey="price" stroke={severity.color} strokeWidth={2.5} fill="url(#priceGradient)" dot={{ fill: severity.color, r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  {price_history?.disclaimer && <p className="text-xs text-white/35 mt-3 italic">{price_history.disclaimer}</p>}
                </motion.div>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-6">
                <div className="flex items-center gap-2 mb-1"><ShieldCheck className="w-5 h-5 text-emerald-400" /><h3 className="text-lg font-bold text-white">Beat the Tariff</h3></div>
                <p className="text-xs text-white/45 mb-5">Lower tariff exposure alternatives</p>
                {alternatives.length === 0 ? <p className="text-sm text-white/40 italic py-4 text-center">No alternatives found</p> : (
                  <div className="space-y-3">
                    {alternatives.slice(0, 5).map((alt, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.1 }}
                        className="group rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-emerald-500/25 p-4 transition-all duration-300">
                        <div className="flex gap-3">
                          {alt.thumbnail && <img src={alt.thumbnail} alt="" className="w-14 h-14 rounded-lg object-cover bg-white/[0.05] shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white/90 leading-snug line-clamp-2 group-hover:text-white transition-colors">{alt.title}</p>
                            <p className="font-mono text-sm text-white/70 mt-1">{alt.price_str || (alt.price ? `$${alt.price.toFixed(2)}` : "")}</p>
                            <p className="text-xs text-white/40">{alt.source}</p>
                          </div>
                        </div>
                        {(alt.product_link || alt.link) && (
                          <a href={alt.product_link || alt.link} target="_blank" rel="noopener noreferrer"
                            className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                            View Deal <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                className="rounded-2xl border border-orange-500/15 bg-gradient-to-br from-orange-500/[0.06] to-transparent p-6">
                <h4 className="font-bold text-white mb-1 flex items-center gap-2">📊 Track your Tariff Tax</h4>
                <p className="text-xs text-white/45 mb-4">Add this to your personal tariff report</p>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleAddPurchase}
                  disabled={!price_impact || addedToReport}
                  className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 ${addedToReport ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-[0_0_20px_rgba(255,107,53,0.2)]"} disabled:opacity-30`}>
                  {addedToReport ? <><ShieldCheck className="w-4 h-4" /> Added to Report</> : <><Plus className="w-4 h-4" /> Add to My Report</>}
                </motion.button>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-3">
                <p className="text-xs uppercase tracking-[0.15em] text-white/40">Quick Facts</p>
                <div className="flex items-center gap-3 text-sm"><Globe className="w-4 h-4 text-white/35 shrink-0" /><span className="text-white/55">Origin: <span className="text-white/85">{flag} {classification.country_name}</span></span></div>
                <div className="flex items-center gap-3 text-sm"><Package className="w-4 h-4 text-white/35 shrink-0" /><span className="text-white/55">HTS Code: <span className="text-white/85 font-mono">{tariff.hts_code}</span></span></div>
                <div className="flex items-center gap-3 text-sm"><TrendingDown className="w-4 h-4 text-white/35 shrink-0" /><span className="text-white/55">Pass-through: <span className="text-white/85">~{Math.round((tariff.consumer_passthrough_rate || 0.72) * 100)}%</span></span></div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-white/[0.08] py-6 px-4">
        <p className="text-center text-xs text-white/35">TariffShield · Built at Tech@NYU Startup Week 2026 · Powered by Claude AI · Data from USITC 2026 Rev.3</p>
      </footer>
    </div>
  );
}