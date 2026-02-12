"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Badge from "@/components/landing/ui/Badge";
import Button from "@/components/landing/ui/Button";
import WorkflowSteps from "@/components/landing/WorkflowSteps";

const fadeInUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" as const, delay },
});

export default function HeroSection() {
  return (
    <section className="bg-crosshatch py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div {...fadeInUp(0)}>
          <Badge highlight="LAUNCH">Cold Email Platform</Badge>
        </motion.div>

        {/* Heading */}
        <motion.div {...fadeInUp(0.1)} className="mt-8">
          <h1>
            <span className="block font-serif text-5xl md:text-6xl font-normal text-white">
              Cold Outreach That
            </span>
            <span className="block font-serif text-5xl md:text-6xl font-normal gradient-text">
              Actually Gets Replies
            </span>
          </h1>
        </motion.div>

        {/* Subheading */}
        <motion.div {...fadeInUp(0.2)} className="mt-6">
          <p className="text-slate-400 text-base md:text-lg max-w-xl text-center mx-auto">
            Multi-inbox management, warm-up automation, and AI-powered campaigns.
            Send personalized cold emails at scale without landing in spam.
          </p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          {...fadeInUp(0.3)}
          className="mt-8 flex items-center justify-center gap-4"
        >
          <Link href="/signup">
            <Button variant="solid">Start Free Trial</Button>
          </Link>
          <Button variant="outlined">See How It Works</Button>
        </motion.div>

        {/* Workflow Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
          className="mt-16"
        >
          <WorkflowSteps />
        </motion.div>
      </div>
    </section>
  );
}
