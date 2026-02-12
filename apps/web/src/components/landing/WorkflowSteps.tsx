"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";

function CountUp({ target, isInView }: { target: number; isInView: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 2000;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return <>{count}</>;
}

function ProgressRing({ percent, isInView }: { percent: number; isInView: boolean }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    if (!isInView) return;
    const timer = setTimeout(() => {
      setOffset(circumference - (percent / 100) * circumference);
    }, 300);
    return () => clearTimeout(timer);
  }, [isInView, percent, circumference]);

  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="mx-auto">
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="#374151"
        strokeWidth="6"
      />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="#818cf8"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 2s ease-out", transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
      />
      <text x="50" y="46" textAnchor="middle" className="text-lg font-bold fill-white" style={{ fontSize: "18px", fontWeight: 700 }}>
        {isInView ? `${percent}%` : "0%"}
      </text>
      <text x="50" y="62" textAnchor="middle" className="fill-slate-400" style={{ fontSize: "10px" }}>
        Reputation
      </text>
    </svg>
  );
}

const cards = [
  { step: "01", title: "Compose" },
  { step: "02", title: "Sending" },
  { step: "03", title: "Warming Up" },
  { step: "04", title: "Replies" },
];

export default function WorkflowSteps() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
      {cards.map((card, i) => (
        <motion.div
          key={card.step}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: i * 0.15, ease: "easeOut" }}
          whileHover={{ y: -4, boxShadow: "0 8px 24px rgba(99,102,241,0.15)" }}
          className="relative border border-slate-800 rounded-lg p-6 bg-gray-900 text-left"
        >
          {/* Connecting dashed line */}
          {i < 3 && (
            <div className="hidden md:block absolute top-1/2 -right-[9px] w-[18px] border-t border-dashed border-slate-700" />
          )}

          {/* Step number */}
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-600 mb-4">
            <span className="text-xs font-semibold text-slate-400">{card.step}</span>
          </div>

          <h3 className="text-sm font-semibold mb-4 text-white">{card.title}</h3>

          {/* Card-specific visual */}
          {i === 0 && (
            <div className="relative">
              <div className="space-y-2">
                <div className="h-2 w-full rounded-full bg-slate-700" />
                <div className="h-2 w-4/5 rounded-full bg-slate-700" />
                <div className="h-2 w-3/5 rounded-full bg-slate-700" />
              </div>
              <div className="mt-3 inline-block rounded border border-slate-600 px-2 py-0.5">
                <span className="text-[10px] font-mono text-slate-400">{"{{firstName}}"}</span>
              </div>
              {/* Halftone overlay */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "4px 4px" }} />
            </div>
          )}

          {i === 1 && (
            <div className="text-center">
              <div className="font-serif text-4xl font-normal text-white">
                <CountUp target={847} isInView={isInView} />
              </div>
              <p className="text-xs text-slate-500 mt-1">emails sent</p>
              <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800">
                <motion.div
                  className="h-1.5 rounded-full bg-indigo-500"
                  initial={{ width: "0%" }}
                  animate={isInView ? { width: "72%" } : { width: "0%" }}
                  transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
                />
              </div>
            </div>
          )}

          {i === 2 && (
            <ProgressRing percent={98} isInView={isInView} />
          )}

          {i === 3 && (
            <div className="flex flex-col gap-2">
              <span className="inline-flex items-center rounded-full bg-indigo-500 px-3 py-1 text-[11px] font-medium text-white w-fit">
                Interested
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-600 px-3 py-1 text-[11px] font-medium text-slate-300 w-fit">
                Question
              </span>
              <span className="inline-flex items-center rounded-full bg-violet-500 px-3 py-1 text-[11px] font-medium text-white w-fit">
                Meeting Booked
              </span>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
