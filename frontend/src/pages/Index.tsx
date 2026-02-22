import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowRight, Shield, TrendingUp, Eye, Zap, ChevronDown, ShoppingCart } from "lucide-react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";

const QUICK_EXAMPLES = [
  { emoji: "📺", label: "Samsung 65\" QLED TV", sub: "~59% tariff from China" },
  { emoji: "👟", label: "Nike Air Max 90", sub: "~20% tariff from Vietnam" },
  { emoji: "💻", label: "MacBook Pro M4", sub: "~55% tariff from China" },
  { emoji: "🪑", label: "IKEA MARKUS Chair", sub: "~55% tariff from China" },
];

const STATS = [
  { value: "$4,700", label: "avg. household tariff burden in 2026" },
  { value: "58.9%", label: "effective tariff on Chinese electronics" },
  { value: "29,796", label: "HTS codes in our tariff database" },
  { value: "Feb 20", label: "SCOTUS struck down IEEPA tariffs" },
];

// Animated gradient orb
function GradientOrb({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute rounded-full blur-[120px] opacity-20 pointer-events-none ${className}`} />
  );
}

// Floating particles
function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-orange-500/30"
          initial={{
            x: `${Math.random() * 100}%`,
            y: `${Math.random() * 100}%`,
            scale: Math.random() * 0.5 + 0.5,
          }}
          animate={{
            y: [null, `${Math.random() * 100}%`],
            x: [null, `${Math.random() * 100}%`],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: Math.random() * 15 + 10,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

// Animated counter
function Counter({ target, suffix = "" }: { target: string; suffix?: string }) {
  const [display, setDisplay] = useState("0");
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (hasAnimated) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasAnimated(true);
          const num = parseFloat(target.replace(/[^0-9.]/g, ""));
          const prefix = target.replace(/[0-9.,]/g, "").charAt(0) === "$" ? "$" : "";
          const isDecimal = target.includes(".");
          let start = 0;
          const duration = 1500;
          const startTime = performance.now();

          function animate(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = start + (num - start) * eased;
            if (isDecimal) {
              setDisplay(`${prefix}${current.toFixed(1)}${suffix}`);
            } else {
              setDisplay(`${prefix}${Math.round(current).toLocaleString()}${suffix}`);
            }
            if (progress < 1) requestAnimationFrame(animate);
            else setDisplay(target);
          }
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, suffix, hasAnimated]);

  return <span ref={ref}>{display}</span>;
}

export default function Index() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/results?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleChip = (label: string) => {
    navigate(`/results?q=${encodeURIComponent(label)}`);
  };

  return (
    <div className="min-h-screen bg-[#09090f] text-white overflow-hidden">
      {/* ═══ HERO ═══ */}
      <motion.section
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex flex-col items-center justify-center px-4"
      >
        {/* Background effects */}
        <GradientOrb className="w-[600px] h-[600px] bg-orange-600 -top-40 -right-40" />
        <GradientOrb className="w-[500px] h-[500px] bg-amber-500 -bottom-20 -left-40" />
        <GradientOrb className="w-[300px] h-[300px] bg-red-600 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <Particles />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative z-10 mb-8"
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-orange-500/25 bg-orange-500/[0.08] backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
            </span>
            <span className="text-sm text-orange-300 font-medium tracking-wide">
              Live — Updated for SCOTUS ruling Feb 20, 2026
            </span>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative z-10 text-center max-w-5xl mx-auto mb-6"
        >
          <h1 className="text-[clamp(2.8rem,8vw,6.5rem)] font-extrabold leading-[0.95] tracking-[-0.04em]">
            <span className="block text-white/95">The price tag</span>
            <span className="block">
              <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                is lying
              </span>
              <span className="text-white/95"> to you.</span>
            </span>
          </h1>
        </motion.div>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="relative z-10 text-lg md:text-xl text-white/55 max-w-2xl mx-auto text-center mb-12 leading-relaxed font-light"
        >
          Every product carries a hidden tariff tax — up to 59% on Chinese goods.
          <br className="hidden md:block" />
          Paste any product. See what you're{" "}
          <span className="text-white/80 font-medium">really</span> paying.
        </motion.p>

        {/* Search bar */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.65 }}
          onSubmit={handleSubmit}
          className="relative z-10 w-full max-w-2xl mx-auto mb-8"
        >
          <div
            className={`relative flex items-center rounded-2xl transition-all duration-500 ${
              isFocused
                ? "bg-white/[0.08] border-orange-500/50 shadow-[0_0_40px_rgba(255,107,53,0.15)]"
                : "bg-white/[0.05] border-white/[0.10]"
            } border backdrop-blur-xl`}
          >
            <Search className={`ml-5 w-5 h-5 transition-colors duration-300 ${isFocused ? "text-orange-400" : "text-white/35"}`} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Paste an Amazon URL or search any product..."
              className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/35 py-5 px-4 text-base font-light"
            />
            <button
              type="submit"
              className="mr-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-[0_0_24px_rgba(255,107,53,0.4)] flex items-center gap-2 text-sm shrink-0"
            >
              Reveal <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.form>

        {/* Quick examples */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.85 }}
          className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto"
        >
          {QUICK_EXAMPLES.map((ex, i) => (
            <motion.button
              key={ex.label}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleChip(ex.label)}
              className="group flex flex-col items-start gap-1 px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] hover:border-orange-500/25 transition-all duration-300 text-left"
            >
              <span className="text-sm text-white/80 group-hover:text-white transition-colors">
                {ex.emoji} {ex.label}
              </span>
              <span className="text-xs text-white/35 font-mono">{ex.sub}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* Cart X-Ray CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.0 }}
          className="relative z-10 mt-6"
        >
          <button
            onClick={() => navigate("/cart")}
            className="group flex items-center gap-3 px-5 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] hover:border-orange-500/25 transition-all duration-300 mx-auto"
          >
            <ShoppingCart className="w-4 h-4 text-orange-400/80 group-hover:text-orange-400 transition-colors" />
            <span className="text-sm text-white/60 group-hover:text-white/90 transition-colors">
              Or upload your entire cart screenshot →
            </span>
          </button>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 z-10"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <ChevronDown className="w-5 h-5 text-white/25" />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ═══ STATS BAR ═══ */}
      <section className="relative border-y border-white/[0.08] bg-white/[0.02]">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4">
          {STATS.map((stat, i) => (
            <div
              key={i}
              className={`py-8 px-6 text-center ${i < 3 ? "border-r border-white/[0.08]" : ""}`}
            >
              <p className="text-2xl md:text-3xl font-bold font-mono text-orange-400 mb-1">
                <Counter target={stat.value} />
              </p>
              <p className="text-xs text-white/45 uppercase tracking-widest">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how-it-works" className="relative py-32 px-4">
        <GradientOrb className="w-[400px] h-[400px] bg-orange-600 top-20 right-0" />

        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <p className="text-sm uppercase tracking-[0.2em] text-orange-400/80 font-medium mb-4">How It Works</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              From product to{" "}
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                truth
              </span>{" "}
              in seconds
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Search,
                step: "01",
                title: "Search or paste",
                desc: "Drop an Amazon URL or search any product. Our AI identifies it instantly.",
                color: "from-orange-500 to-red-500",
              },
              {
                icon: Eye,
                title: "See the truth",
                step: "02",
                desc: "We classify it against 29,796 HTS codes and calculate every tariff layer — Section 301, 232, IEEPA, and the new Section 122.",
                color: "from-amber-500 to-orange-500",
              },
              {
                icon: Shield,
                step: "03",
                title: "Beat the tariff",
                desc: "Find alternatives from lower-tariff countries with real prices and buy links. Save hundreds.",
                color: "from-emerald-500 to-teal-500",
              },
              {
                icon: ShoppingCart,
                step: "04",
                title: "Cart X-Ray",
                desc: "Upload your entire shopping cart screenshot — we analyze every item and show total tariff exposure with smart swap suggestions.",
                color: "from-violet-500 to-purple-500",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                whileHover={{ y: -6 }}
                className="group relative"
              >
                <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 h-full overflow-hidden">
                  {/* Hover glow */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${item.color} blur-[80px]`} style={{ opacity: 0 }} />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500 bg-gradient-to-br from-white to-transparent" />

                  <div className="relative z-10">
                    <span className="text-xs font-mono text-white/30 uppercase tracking-widest">{item.step}</span>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mt-3 mb-5 shadow-lg`}>
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="relative py-32 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-6xl mb-6">🛡️</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Stop overpaying.
              <br />
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                Start seeing.
              </span>
            </h2>
            <p className="text-lg text-white/50 mb-10">
              The average American household pays $4,700 in tariff taxes this year.
              <br />
              How much of that is you?
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="px-10 py-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold rounded-2xl text-lg shadow-[0_0_40px_rgba(255,107,53,0.3)] hover:shadow-[0_0_60px_rgba(255,107,53,0.4)] transition-all duration-300"
            >
              Analyze Your First Product →
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/[0.08] py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold text-white/70">TariffShield</span>
          </div>
          <p className="text-xs text-white/35">
            Built at Tech@NYU Startup Week 2026 · Powered by Claude AI · 29,796 real HTS tariff codes
          </p>
        </div>
      </footer>
    </div>
  );
}