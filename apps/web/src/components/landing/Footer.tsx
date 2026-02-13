"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { Github, Twitter, Linkedin } from "lucide-react";

const productLinks = ["Multi-Inbox", "Warm-Up", "Campaigns", "AI Replies"];
const companyLinks = ["About", "Blog", "Careers", "Contact"];
const resourceLinks = ["Documentation", "API Reference", "Status", "Support"];

const columnVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: "easeOut" as const,
    },
  }),
};

function FooterLinkColumn({
  heading,
  links,
}: {
  heading: string;
  links: string[];
}) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
        {heading}
      </h3>
      <ul className="flex flex-col gap-3">
        {links.map((link) => (
          <li key={link}>
            <a
              href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-sm text-slate-500 transition-all duration-200 hover:translate-x-0.5 hover:text-white"
            >
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <footer ref={ref} className="bg-[#060810]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12 lg:grid-cols-4">
          {/* Col 1 - Brand */}
          <motion.div
            custom={0}
            variants={columnVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            <a href="/" className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="Mindora Systems" width={28} height={28} className="w-7 h-7 rounded-full" />
              <span className="text-lg font-bold text-white">Mindora</span>
            </a>
            <p className="mt-4 max-w-xs text-sm text-slate-400">
              Intelligent outreach platform for professional business development.
            </p>
            <div className="mt-6 flex gap-4">
              <a
                href="#github"
                aria-label="Github"
                className="text-slate-500 transition-colors hover:text-white"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="#twitter"
                aria-label="Twitter"
                className="text-slate-500 transition-colors hover:text-white"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="#linkedin"
                aria-label="LinkedIn"
                className="text-slate-500 transition-colors hover:text-white"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </motion.div>

          {/* Col 2 - Product */}
          <motion.div
            custom={1}
            variants={columnVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            <FooterLinkColumn heading="Product" links={productLinks} />
          </motion.div>

          {/* Col 3 - Company */}
          <motion.div
            custom={2}
            variants={columnVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            <FooterLinkColumn heading="Company" links={companyLinks} />
          </motion.div>

          {/* Col 4 - Resources */}
          <motion.div
            custom={3}
            variants={columnVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            <FooterLinkColumn heading="Resources" links={resourceLinks} />
          </motion.div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-slate-800 pt-6 pb-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-slate-600">
              &copy; 2026 Mindora Systems. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link
                href="/privacy"
                className="text-sm text-slate-600 transition-colors hover:text-white"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-slate-600 transition-colors hover:text-white"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
