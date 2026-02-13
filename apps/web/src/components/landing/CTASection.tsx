"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import Button from "@/components/landing/ui/Button";

export default function CTASection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="bg-gray-900 bg-crosshatch-dark py-20 md:py-28"
    >
      <div className="max-w-4xl mx-auto px-6 text-center flex flex-col items-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-white font-serif text-3xl md:text-4xl lg:text-5xl text-center"
        >
          Ready to scale your cold outreach?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-slate-400 text-base md:text-lg max-w-xl text-center mx-auto mt-6"
        >
          Join thousands of sales teams using Mindora to land more meetings and
          close more deals.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex gap-4 mt-10"
        >
          <Link href="/signup">
            <Button variant="solid" inverted>
              Start Free Trial
            </Button>
          </Link>
          <Button variant="outlined" inverted>
            Book a Demo
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
