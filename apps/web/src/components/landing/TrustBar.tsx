"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const logoVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

function ScaleUpLogo() {
  return (
    <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-200">
      <span className="font-bold text-base text-slate-400">ScaleUp</span>
    </div>
  );
}

function OutboundLogo() {
  return (
    <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-200">
      <span className="font-mono text-base text-slate-400">Outbound.io</span>
    </div>
  );
}

function ReplyForceLogo() {
  return (
    <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-200">
      <span className="font-bold text-base text-slate-400">ReplyForce</span>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 7H12M12 7L8 3M12 7L8 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ClosrLogo() {
  return (
    <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-200">
      <span className="font-serif text-lg text-slate-400 lowercase">Closr</span>
    </div>
  );
}

function PipelineProLogo() {
  return (
    <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-200">
      <span className="font-bold text-base tracking-tight text-slate-400">PipelinePro</span>
    </div>
  );
}

function MailVelocityLogo() {
  return (
    <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-200">
      <span className="font-light tracking-wider text-base text-slate-400">
        Mail<span className="italic">Velocity</span>
      </span>
    </div>
  );
}

const logos = [
  ScaleUpLogo,
  OutboundLogo,
  ReplyForceLogo,
  ClosrLogo,
  PipelineProLogo,
  MailVelocityLogo,
];

export default function TrustBar() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <section
      ref={sectionRef}
      className="section-divider border-b border-dashed border-slate-800 py-10 md:py-12"
    >
      <p className="text-center text-slate-500 text-sm font-medium mb-8">
        Trusted by industry leaders
      </p>

      <motion.div
        className="flex items-center justify-center gap-10 md:gap-16 flex-wrap px-6"
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
      >
        {logos.map((LogoComponent, index) => (
          <motion.div key={index} variants={logoVariants}>
            <LogoComponent />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
