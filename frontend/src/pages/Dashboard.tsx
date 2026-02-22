import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { getPurchases, clearPurchases } from "@/lib/storage";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import type { StoredPurchase } from "@/types/tariff";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import html2canvas from "html2canvas";
import { toast } from "@/hooks/use-toast";
import { Search, Trash2, Copy, Plus, Shield, ArrowLeft } from "lucide-react";

const NATIONAL_AVG = 4700;

const CATEGORY_COLORS: Record<string, string> = {
  "Electronics & Electrical Equipment": "#3B82F6",
  "Furniture & Home Furnishings": "#8B5CF6",
  "Clothing & Textiles": "#EC4899",
  "Vehicles & Auto Parts": "#F97316",
  "Steel & Aluminum Products": "#94A3B8",
  "Toys, Games & Sports Equipment": "#10B981",
  "Other Goods": "#F59E0B",
};

export default function Dashboard() {
  const [purchases, setPurchases] = useState<StoredPurchase[]>(getPurchases());
  const [showAdd, setShowAdd] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const shareRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const totalTariff = purchases.reduce((sum, p) => sum + (p.tariff_you_pay || 0), 0);
  const totalSpent = purchases.reduce((sum, p) => sum + (p.price || 0), 0);
  const annualEstimate = totalTariff * 12;

  const categoryMap: Record<string, number> = {};
  purchases.forEach((p) => {
    const cat = p.category || "Other Goods";
    categoryMap[cat] = (categoryMap[cat] || 0) + p.tariff_you_pay;
  });
  const categoryData = Object.entries(categoryMap)
    .map(([name, amount]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, fullName: name, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  const handleCopyCard = async () => {
    if (!shareRef.current) return;
    try {
      const canvas = await html2canvas(shareRef.current, { backgroundColor: "#09090f", scale: 2 });
      canvas.toBlob((blob) => {
        if (blob) {
          navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          toast({ title: "Share card copied!", description: "Paste it into your stories" });
        }
      });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleClear = () => { clearPurchases(); setPurchases([]); };

  return (
    <div className="min-h-screen bg-[#09090f] text-white">
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#09090f]/80 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-white/55 hover:text-white/80 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <span className="text-sm font-semibold text-white/75">Your Tariff Report</span>
          <div className="w-16" />
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="pt-24 pb-16 px-4">
        <div className="max-w-[680px] mx-auto space-y-8">

          {purchases.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-600/20 to-amber-600/20 flex items-center justify-center mx-auto">
                <Shield className="w-8 h-8 text-orange-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">No purchases tracked yet</h1>
                <p className="text-white/50 text-base">Analyze a product and add it to start building your tariff report.</p>
              </div>
              <Link to="/" className="inline-block px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-semibold hover:shadow-[0_0_30px_rgba(255,107,53,0.3)] transition-all">
                Analyze a Product →
              </Link>
            </motion.div>
          ) : (
            <>
              {/* ═══ HERO NUMBER ═══ */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-white/[0.10] bg-gradient-to-br from-white/[0.04] to-transparent p-10 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full blur-[100px] opacity-10 pointer-events-none bg-orange-500" />
                
                <p className="text-xs uppercase tracking-[0.2em] text-white/45 mb-6">Total Hidden Tariff Tax</p>
                <div className="text-6xl md:text-7xl font-bold font-mono mb-4">
                  <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                    <AnimatedNumber value={totalTariff} prefix="$" />
                  </span>
                </div>
                <p className="text-white/45 text-sm">on ${totalSpent.toFixed(0)} in tracked purchases</p>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                    <p className="text-xs text-white/45 mb-1">Annual estimate</p>
                    <p className="text-xl font-bold font-mono text-orange-400">${annualEstimate.toFixed(0)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                    <p className="text-xs text-white/45 mb-1">National avg (2026)</p>
                    <p className="text-xl font-bold font-mono text-white/65">${NATIONAL_AVG.toLocaleString()}</p>
                  </div>
                </div>
              </motion.div>

              {/* ═══ CATEGORY CHART ═══ */}
              {categoryData.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-6">
                  <p className="text-xs uppercase tracking-[0.15em] text-white/45 mb-5">Tariff by Category</p>
                  <ResponsiveContainer width="100%" height={Math.max(160, categoryData.length * 45)}>
                    <BarChart data={categoryData} layout="vertical" margin={{ left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "monospace" }} tickFormatter={(v: number) => `$${v}`} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} width={140} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "rgba(14,14,22,0.95)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#fff", fontSize: 13, fontFamily: "monospace" }} formatter={(value: number) => [`$${value.toFixed(2)}`, "Tariff"]} />
                      <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={20}>
                        {categoryData.map((entry, i) => (
                          <Cell key={i} fill={CATEGORY_COLORS[entry.fullName] || "#F59E0B"} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              )}

              {/* ═══ PURCHASES TABLE ═══ */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="rounded-2xl border border-white/[0.10] overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-white/[0.08]">
                  <p className="text-xs uppercase tracking-[0.15em] text-white/45">Your Purchases ({purchases.length})</p>
                  <button onClick={handleClear} className="text-xs text-white/35 hover:text-red-400 flex items-center gap-1 transition-colors"><Trash2 className="w-3 h-3" /> Clear</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-white/40 border-b border-white/[0.08]">
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium font-mono">Price</th>
                      <th className="px-4 py-3 font-medium">Origin</th>
                      <th className="px-4 py-3 font-medium font-mono text-right">Tariff</th>
                    </tr></thead>
                    <tbody>
                      {purchases.map((p, i) => (
                        <tr key={i} className="border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors">
                          <td className="px-4 py-3 text-white/80 max-w-[200px] truncate">{p.product}</td>
                          <td className="px-4 py-3 font-mono text-white/60">${p.price.toFixed(2)}</td>
                          <td className="px-4 py-3 text-white/50">{p.country}</td>
                          <td className="px-4 py-3 font-mono font-semibold text-orange-400 text-right">${p.tariff_you_pay.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>

              {/* ═══ SHARE CARD ═══ */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-4">
                <p className="text-xs uppercase tracking-[0.15em] text-white/45">Share Your Report</p>
                <div ref={shareRef} className="rounded-2xl p-10 text-center relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg, #10101a 0%, #1a1008 50%, #10101a 100%)" }}>
                  <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`, backgroundSize: "24px 24px" }} />
                  <div className="relative z-10">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                        <Shield className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs font-bold tracking-[0.2em] uppercase text-orange-400">TariffShield</span>
                    </div>
                    <p className="text-3xl font-bold text-white mb-2">
                      I paid <span className="font-mono bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">${totalTariff.toFixed(2)}</span>
                    </p>
                    <p className="text-lg text-white/60 mb-1">in hidden tariffs this month 😤</p>
                    <p className="text-xs text-white/30 mt-4">TariffShield.app · See the invisible tax</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleCopyCard}
                    className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold flex items-center justify-center gap-2 text-sm hover:shadow-[0_0_20px_rgba(255,107,53,0.2)] transition-all">
                    <Copy className="w-4 h-4" /> Copy Card
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowAdd(true)}
                    className="flex-1 py-3.5 rounded-xl border border-white/[0.10] bg-white/[0.03] text-white/80 font-semibold flex items-center justify-center gap-2 text-sm hover:bg-white/[0.06] transition-all">
                    <Plus className="w-4 h-4" /> Add More
                  </motion.button>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </motion.div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-white/[0.12] bg-[#12121c] p-6 w-full max-w-md space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white">Search for a product</h3>
            <div className="flex gap-2">
              <input type="text" value={addQuery} onChange={(e) => setAddQuery(e.target.value)}
                placeholder="Product name or Amazon URL..."
                className="flex-1 bg-white/[0.05] border border-white/[0.10] rounded-xl px-4 py-3 text-white placeholder:text-white/35 outline-none focus:border-orange-500/40 transition-colors text-sm"
                onKeyDown={(e) => e.key === "Enter" && addQuery.trim() && navigate(`/results?q=${encodeURIComponent(addQuery.trim())}`)} />
              <button onClick={() => addQuery.trim() && navigate(`/results?q=${encodeURIComponent(addQuery.trim())}`)}
                className="px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl"><Search className="w-4 h-4" /></button>
            </div>
            <button onClick={() => setShowAdd(false)} className="text-sm text-white/40 hover:text-white/60 transition-colors">Cancel</button>
          </motion.div>
        </div>
      )}
    </div>
  );
}