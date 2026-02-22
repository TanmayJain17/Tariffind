import { Shield, ShoppingCart } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export function Navbar() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  // On results and cart pages, the page has its own nav
  if (location.pathname === "/results" || location.pathname === "/cart") return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#09090f]/80 backdrop-blur-xl border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-[0_0_12px_rgba(255,107,53,0.3)] group-hover:shadow-[0_0_20px_rgba(255,107,53,0.4)] transition-shadow">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-base font-bold text-white tracking-tight">TariffShield</span>
        </Link>

        <div className="flex items-center gap-6">
          {isHome && (
            <a
              href="#how-it-works"
              className="text-sm text-white/50 hover:text-white/80 transition-colors duration-200 hidden sm:block"
            >
              How It Works
            </a>
          )}
          <Link
            to="/cart"
            className={`text-sm transition-colors duration-200 flex items-center gap-1.5 ${
              location.pathname === "/cart" ? "text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Cart X-Ray
          </Link>
          <Link
            to="/dashboard"
            className={`text-sm transition-colors duration-200 ${
              location.pathname === "/dashboard" ? "text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            Dashboard
          </Link>
          <Link
            to="/"
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:shadow-[0_0_20px_rgba(255,107,53,0.35)] transition-all duration-300"
          >
            Analyze →
          </Link>
        </div>
      </div>
    </nav>
  );
}