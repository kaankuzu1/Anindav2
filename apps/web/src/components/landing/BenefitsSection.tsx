"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import SectionLabel from "@/components/landing/ui/SectionLabel";
import HalftoneShape from "@/components/landing/ui/HalftoneShape";

const cards = [
  {
    tag: "MULTI-INBOX MANAGEMENT",
    shape: "envelope" as const,
    title: "Manage all your inboxes in one place",
    description:
      "Connect Gmail, Outlook, and SMTP accounts. Rotate sending across inboxes to maximize deliverability and scale.",
  },
  {
    tag: "WARM-UP AUTOMATION",
    shape: "shield" as const,
    title: "Automated inbox warm-up",
    description:
      "Build sender reputation automatically with peer-to-peer and network warm-up modes. Monitor health scores in real time.",
  },
  {
    tag: "AI-POWERED REPLIES",
    shape: "network" as const,
    title: "Smart reply classification",
    description:
      "AI classifies incoming replies by intent — interested, question, meeting booked — so you focus on what matters.",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export default function BenefitsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  return (
    <section id="features" ref={sectionRef} className="py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-4"
        >
          <SectionLabel>Benefits</SectionLabel>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mb-12 font-serif text-3xl md:mb-16 md:text-4xl lg:text-[42px] lg:leading-tight"
        >
          <span className="text-white">Scale your outreach </span>
          <span className="gradient-text">with confidence</span>
          <br />
          <span className="text-white">and precision </span>
          <span className="gradient-text">at every step</span>
        </motion.h2>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8"
        >
          {cards.map((card) => (
            <motion.div
              key={card.tag}
              variants={itemVariants}
              whileHover={{
                y: -4,
                boxShadow: "0 8px 24px rgba(99, 102, 241, 0.15)",
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="cursor-default"
            >
              <span className="inline-block rounded-sm border border-slate-700 px-2 py-0.5 text-xs uppercase tracking-wider text-slate-400">
                {card.tag}
              </span>

              <HalftoneShape shape={card.shape} className="h-48 w-full" />

              <h3 className="mt-4 text-lg font-semibold text-white">{card.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{card.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
