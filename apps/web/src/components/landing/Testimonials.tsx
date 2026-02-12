"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import SectionLabel from "@/components/landing/ui/SectionLabel";

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  initials: string;
}

const testimonials: Testimonial[] = [
  {
    quote:
      "Aninda transformed our outbound process. We went from 2% reply rates to 12% in the first month, and inbox warm-up means we never worry about deliverability.",
    author: "James Mitchell",
    role: "Head of Sales, GrowthStack",
    initials: "JM",
  },
  {
    quote:
      "The AI reply classification saves my team hours every day. We instantly know which leads are interested and can prioritize follow-ups accordingly.",
    author: "Priya Sharma",
    role: "VP of Business Development, Nextera",
    initials: "PS",
  },
  {
    quote:
      "Managing 15 inboxes used to be a nightmare. Aninda's rotation and warm-up features made it effortless. Our deliverability has never been better.",
    author: "David Kim",
    role: "Outbound Lead, CloudReach",
    initials: "DK",
  },
];

export default function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const headingVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        delay: 0.15 * i,
        ease: "easeOut" as const,
      },
    }),
  };

  return (
    <section id="resources" ref={sectionRef} className="py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={headingVariants}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <SectionLabel>Testimonials</SectionLabel>
        </motion.div>

        <motion.h2
          className="mb-12 font-serif text-3xl md:mb-16 md:text-4xl"
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={headingVariants}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        >
          What our customers{" "}
          <span className="gradient-text">say</span>
        </motion.h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={testimonial.author}
              className="rounded-lg border border-slate-800 bg-gray-900 p-8 transition-colors hover:border-slate-700"
              custom={i}
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
              variants={cardVariants}
              whileHover={{ y: -2 }}
            >
              <div className="mb-4 font-serif text-5xl leading-none text-slate-800">
                &ldquo;
              </div>
              <p className="font-serif text-base italic leading-relaxed text-slate-400">
                {testimonial.quote}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-800">
                  <span className="text-xs font-medium text-slate-400">
                    {testimonial.initials}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{testimonial.author}</p>
                  <p className="text-sm text-slate-500">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
