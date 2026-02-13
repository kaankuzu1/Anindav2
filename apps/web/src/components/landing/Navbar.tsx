"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const navLinks = ["Features", "How It Works", "Pricing", "Resources"];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`fixed top-0 left-0 right-0 z-50 bg-[#0B0F1A]/80 backdrop-blur-md border-b border-slate-800 ${
        scrolled ? "shadow-lg shadow-black/20" : ""
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:h-[72px]">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Mindora Systems" width={28} height={28} className="w-7 h-7 rounded-full" />
          <span className="text-xl font-bold tracking-tight text-white">
            Mindora
          </span>
        </a>

        {/* Desktop Nav Links */}
        <ul className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <li key={link}>
              <a
                href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-sm font-normal text-slate-400 transition-colors duration-150 hover:text-white"
              >
                {link}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop Login Button */}
        <a
          href="/login"
          className="hidden rounded-md border border-slate-700 px-5 py-2 text-sm font-medium text-white transition-all duration-150 hover:border-indigo-500 hover:bg-indigo-500/10 md:inline-block"
        >
          Login
        </a>

        {/* Mobile Hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-md p-2 text-slate-400 hover:text-white md:hidden"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden border-t border-slate-800 bg-gray-900 md:hidden"
          >
            <div className="flex flex-col gap-1 px-6 py-4">
              {navLinks.map((link) => (
                <a
                  key={link}
                  href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-3 py-2.5 text-sm font-normal text-slate-400 transition-colors duration-150 hover:bg-slate-800 hover:text-white"
                >
                  {link}
                </a>
              ))}
              <div className="mt-2 border-t border-slate-800 pt-3">
                <a
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="inline-block rounded-md border border-slate-700 px-5 py-2 text-sm font-medium text-white transition-all duration-150 hover:border-indigo-500 hover:bg-indigo-500/10"
                >
                  Login
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
