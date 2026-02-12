"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import SectionLabel from "@/components/landing/ui/SectionLabel";

interface Feature {
  tag: string;
  title: string;
  description: string;
  reversed: boolean;
}

const features: Feature[] = [
  {
    tag: "CAMPAIGN BUILDER",
    title: "Multi-step campaign sequences",
    description:
      "Build automated email sequences with follow-ups, conditional logic, and smart scheduling. Personalize every touchpoint with spintax and dynamic variables.",
    reversed: false,
  },
  {
    tag: "LEAD IMPORT",
    title: "Import and manage leads effortlessly",
    description:
      "Upload CSV files with AI-powered column mapping. Organize leads into lists, track status from pending to meeting booked, and edit inline.",
    reversed: true,
  },
  {
    tag: "DELIVERABILITY",
    title: "Land in the inbox, not spam",
    description:
      "Automatic bounce detection, spam rate monitoring, and health scoring. Inbox rotation and warm-up work together to protect your sender reputation.",
    reversed: false,
  },
];

function SequenceMockup() {
  return (
    <div className="halftone h-[300px] w-full rounded-lg border border-slate-800 p-6 md:h-[350px]">
      <div className="flex flex-col gap-0">
        {/* Step 1 */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="h-4 w-4 rounded-full bg-indigo-500" />
            <div className="h-12 w-px border-l border-dashed border-slate-700" />
          </div>
          <div className="flex-1">
            <div className="rounded-md border border-slate-700 bg-gray-900 p-3">
              <div className="text-xs font-semibold text-slate-400 mb-1">Initial Email</div>
              <div className="h-2 w-4/5 rounded-full bg-slate-700" />
              <div className="h-2 w-3/5 rounded-full bg-slate-700 mt-1.5" />
            </div>
          </div>
        </div>
        {/* Step 2 */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="h-4 w-4 rounded-full bg-slate-500" />
            <div className="h-12 w-px border-l border-dashed border-slate-700" />
          </div>
          <div className="flex-1">
            <div className="rounded-md border border-slate-700 bg-gray-900 p-3">
              <div className="text-xs font-semibold text-slate-400 mb-1">Follow-up 1 <span className="text-slate-600 font-normal">&mdash; 3 days</span></div>
              <div className="h-2 w-3/4 rounded-full bg-slate-700" />
              <div className="h-2 w-1/2 rounded-full bg-slate-700 mt-1.5" />
            </div>
          </div>
        </div>
        {/* Step 3 */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="h-4 w-4 rounded-full bg-slate-600" />
          </div>
          <div className="flex-1">
            <div className="rounded-md border border-slate-700 bg-gray-900 p-3">
              <div className="text-xs font-semibold text-slate-400 mb-1">Follow-up 2 <span className="text-slate-600 font-normal">&mdash; 5 days</span></div>
              <div className="h-2 w-2/3 rounded-full bg-slate-700" />
              <div className="h-2 w-2/5 rounded-full bg-slate-700 mt-1.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadTableMockup() {
  const rows = [
    { name: true, status: "contacted" },
    { name: true, status: "replied" },
    { name: true, status: "interested" },
    { name: true, status: "meeting" },
  ];

  const statusColors: Record<string, string> = {
    contacted: "bg-slate-800 text-slate-400",
    replied: "bg-slate-700 text-slate-300",
    interested: "bg-indigo-500 text-white",
    meeting: "bg-indigo-500 text-white",
  };

  return (
    <div className="halftone h-[300px] w-full rounded-lg border border-slate-800 p-4 md:h-[350px]">
      {/* Header */}
      <div className="grid grid-cols-4 gap-2 border-b border-slate-800 pb-2 mb-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Name</div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Email</div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Company</div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</div>
      </div>
      {/* Rows */}
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-4 gap-2 py-2.5 border-b border-slate-800 items-center">
          <div className="h-2 w-4/5 rounded-full bg-slate-700" />
          <div className="h-2 w-full rounded-full bg-slate-700" />
          <div className="h-2 w-3/5 rounded-full bg-slate-700" />
          <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-medium w-fit ${statusColors[row.status]}`}>
            {row.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function DeliverabilityMockup() {
  return (
    <div className="halftone h-[300px] w-full rounded-lg border border-slate-800 p-6 md:h-[350px]">
      <div className="flex flex-col items-center">
        {/* Health score gauge */}
        <div className="relative mb-6">
          <svg width="120" height="70" viewBox="0 0 120 70">
            <path d="M10,65 A50,50 0 0,1 110,65" fill="none" stroke="#374151" strokeWidth="8" strokeLinecap="round" />
            <path d="M10,65 A50,50 0 0,1 100,25" fill="none" stroke="#818cf8" strokeWidth="8" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-end justify-center pb-1">
            <div className="text-center">
              <span className="text-2xl font-bold text-white">92</span>
              <span className="text-xs text-slate-500 block">Health</span>
            </div>
          </div>
        </div>
        {/* Bar chart */}
        <div className="w-full space-y-3">
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-slate-400">Bounce Rate</span>
              <span className="font-semibold">1.2%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800">
              <div className="h-2 rounded-full bg-slate-600" style={{ width: "12%" }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-slate-400">Spam Rate</span>
              <span className="font-semibold">0.3%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800">
              <div className="h-2 rounded-full bg-slate-700" style={{ width: "3%" }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-slate-400">Open Rate</span>
              <span className="font-semibold">48.5%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800">
              <div className="h-2 rounded-full bg-indigo-500" style={{ width: "48.5%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureBlock({ feature, index }: { feature: Feature; index: number }) {
  const blockRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(blockRef, { once: true, amount: 0.3 });

  const imageSlideX = feature.reversed ? 30 : -30;
  const textSlideX = feature.reversed ? -30 : 30;

  const mockups = [<SequenceMockup key="sequence" />, <LeadTableMockup key="leads" />, <DeliverabilityMockup key="deliverability" />];

  const imageContent = (
    <motion.div
      initial={{ opacity: 0, x: imageSlideX }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: imageSlideX }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {mockups[index]}
    </motion.div>
  );

  const textContent = (
    <motion.div
      initial={{ opacity: 0, x: textSlideX }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: textSlideX }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <span className="inline-block rounded-sm border border-slate-700 px-2 py-0.5 text-xs uppercase tracking-wider text-slate-400">
        {feature.tag}
      </span>
      <h3 className="mt-4 text-2xl font-semibold text-white">{feature.title}</h3>
      <p className="mt-3 text-base text-slate-400">{feature.description}</p>
      <a href="#" className="mt-4 inline-block text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:underline">
        Learn more &rarr;
      </a>
    </motion.div>
  );

  return (
    <div ref={blockRef} className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
      {feature.reversed ? (
        <>
          <div className="order-2 md:order-1">{textContent}</div>
          <div className="order-1 md:order-2">{imageContent}</div>
        </>
      ) : (
        <>
          <div>{imageContent}</div>
          <div>{textContent}</div>
        </>
      )}
    </div>
  );
}

export default function FeaturesDetail() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.1 });

  return (
    <section id="how-it-works" ref={sectionRef} className="py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-4"
        >
          <SectionLabel>Features</SectionLabel>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mb-16 font-serif text-3xl md:text-4xl"
        >
          <span className="text-white">Powerful tools for </span>
          <span className="gradient-text">every campaign</span>
        </motion.h2>

        {features.map((feature, index) => (
          <div key={feature.tag}>
            {index > 0 && (
              <div className="my-12 border-t border-dashed border-slate-800 md:my-16" />
            )}
            <FeatureBlock feature={feature} index={index} />
          </div>
        ))}
      </div>
    </section>
  );
}
