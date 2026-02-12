"use client";

import { motion } from "framer-motion";

interface HalftoneShapeProps {
  shape: "cube" | "hexagon" | "cross" | "arc" | "envelope" | "inbox" | "shield" | "network";
  className?: string;
}

export default function HalftoneShape({
  shape,
  className = "",
}: HalftoneShapeProps) {
  const shapes: Record<string, React.ReactNode> = {
    cube: (
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <defs>
          <pattern id="halftone-cube" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1.2" fill="white" />
          </pattern>
        </defs>
        <polygon points="100,20 180,60 180,140 100,180 20,140 20,60" fill="url(#halftone-cube)" />
        <polygon points="100,20 180,60 100,100 20,60" fill="white" opacity="0.8" />
        <polygon points="100,100 180,60 180,140 100,180" fill="white" opacity="0.4" />
        <polygon points="100,100 20,60 20,140 100,180" fill="white" opacity="0.6" />
        <polygon points="100,20 180,60 180,140 100,180 20,140 20,60" fill="url(#halftone-cube)" opacity="0.5" />
      </svg>
    ),
    hexagon: (
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <defs>
          <pattern id="halftone-hex" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="2.5" r="1" fill="white" />
          </pattern>
        </defs>
        <polygon points="100,15 170,50 170,120 100,155 30,120 30,50" fill="white" opacity="0.7" />
        <polygon points="100,45 140,65 140,115 100,135 60,115 60,65" fill="url(#halftone-hex)" />
        <polygon points="100,60 125,75 125,105 100,120 75,105 75,75" fill="white" opacity="0.5" />
        <line x1="100" y1="155" x2="100" y2="185" stroke="white" strokeWidth="2" opacity="0.3" />
        <line x1="170" y1="120" x2="185" y2="135" stroke="white" strokeWidth="2" opacity="0.3" />
        <line x1="30" y1="120" x2="15" y2="135" stroke="white" strokeWidth="2" opacity="0.3" />
      </svg>
    ),
    cross: (
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <defs>
          <pattern id="halftone-cross" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="2.5" r="1.1" fill="white" />
          </pattern>
        </defs>
        <rect x="75" y="20" width="50" height="160" rx="4" fill="white" opacity="0.6" />
        <rect x="20" y="75" width="160" height="50" rx="4" fill="white" opacity="0.6" />
        <rect x="75" y="20" width="50" height="160" rx="4" fill="url(#halftone-cross)" opacity="0.6" />
        <rect x="20" y="75" width="160" height="50" rx="4" fill="url(#halftone-cross)" opacity="0.6" />
        <rect x="75" y="75" width="50" height="50" rx="2" fill="white" opacity="0.85" />
        <rect x="80" y="25" width="50" height="160" rx="4" fill="white" opacity="0.15" />
      </svg>
    ),
    arc: (
      <svg viewBox="0 0 1200 400" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="halftone-arc" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1.5" fill="white" />
          </pattern>
          <clipPath id="arc-clip">
            <path d="M0,400 Q300,0 600,50 T1200,400 Z" />
          </clipPath>
        </defs>
        <rect width="1200" height="400" clipPath="url(#arc-clip)" fill="white" opacity="0.85" />
        <rect width="1200" height="400" clipPath="url(#arc-clip)" fill="url(#halftone-arc)" opacity="0.4" />
      </svg>
    ),
    envelope: (
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <defs>
          <pattern id="halftone-envelope" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="2.5" r="1" fill="white" />
          </pattern>
        </defs>
        {/* Envelope body */}
        <rect x="25" y="60" width="150" height="100" rx="4" fill="url(#halftone-envelope)" />
        <rect x="25" y="60" width="150" height="100" rx="4" fill="white" opacity="0.3" />
        {/* Flap open */}
        <polygon points="25,60 100,20 175,60" fill="white" opacity="0.7" />
        <polygon points="30,65 100,28 170,65" fill="url(#halftone-envelope)" opacity="0.8" />
        {/* V fold line */}
        <line x1="25" y1="60" x2="100" y2="120" stroke="white" strokeWidth="1.5" opacity="0.4" />
        <line x1="175" y1="60" x2="100" y2="120" stroke="white" strokeWidth="1.5" opacity="0.4" />
        {/* Content lines */}
        <line x1="55" y1="100" x2="145" y2="100" stroke="white" strokeWidth="2" opacity="0.3" />
        <line x1="65" y1="115" x2="135" y2="115" stroke="white" strokeWidth="2" opacity="0.3" />
        <line x1="75" y1="130" x2="125" y2="130" stroke="white" strokeWidth="2" opacity="0.3" />
      </svg>
    ),
    inbox: (
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <defs>
          <pattern id="halftone-inbox" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="2.5" r="1" fill="white" />
          </pattern>
        </defs>
        {/* Back inbox */}
        <rect x="40" y="35" width="120" height="80" rx="4" fill="white" opacity="0.2" />
        <rect x="40" y="35" width="120" height="80" rx="4" fill="url(#halftone-inbox)" opacity="0.3" />
        {/* Middle inbox */}
        <rect x="30" y="55" width="140" height="80" rx="4" fill="white" opacity="0.4" />
        <rect x="30" y="55" width="140" height="80" rx="4" fill="url(#halftone-inbox)" opacity="0.5" />
        {/* Front inbox */}
        <rect x="20" y="75" width="160" height="80" rx="4" fill="white" opacity="0.7" />
        <rect x="20" y="75" width="160" height="80" rx="4" fill="url(#halftone-inbox)" opacity="0.6" />
        {/* Content lines on front */}
        <line x1="40" y1="100" x2="130" y2="100" stroke="white" strokeWidth="2" opacity="0.4" />
        <line x1="40" y1="115" x2="110" y2="115" stroke="white" strokeWidth="2" opacity="0.3" />
        <line x1="40" y1="130" x2="90" y2="130" stroke="white" strokeWidth="2" opacity="0.2" />
        {/* Badge/count */}
        <circle cx="160" cy="85" r="12" fill="white" opacity="0.9" />
        <text x="160" y="89" textAnchor="middle" fill="black" style={{ fontSize: "10px", fontWeight: 700 }}>3</text>
      </svg>
    ),
    shield: (
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <defs>
          <pattern id="halftone-shield" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="2.5" r="1.1" fill="white" />
          </pattern>
        </defs>
        {/* Shield shape */}
        <path d="M100,20 L170,50 L170,110 Q170,160 100,185 Q30,160 30,110 L30,50 Z" fill="url(#halftone-shield)" />
        <path d="M100,20 L170,50 L170,110 Q170,160 100,185 Q30,160 30,110 L30,50 Z" fill="white" opacity="0.5" />
        {/* Inner shield */}
        <path d="M100,40 L155,62 L155,108 Q155,148 100,168 Q45,148 45,108 L45,62 Z" fill="url(#halftone-shield)" opacity="0.7" />
        {/* Checkmark */}
        <polyline points="72,100 92,120 130,75" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      </svg>
    ),
    network: (
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <defs>
          <pattern id="halftone-network" x="0" y="0" width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="2.5" r="1" fill="white" />
          </pattern>
        </defs>
        {/* Connection lines */}
        <line x1="100" y1="50" x2="50" y2="100" stroke="white" strokeWidth="2" opacity="0.3" />
        <line x1="100" y1="50" x2="150" y2="100" stroke="white" strokeWidth="2" opacity="0.3" />
        <line x1="50" y1="100" x2="75" y2="160" stroke="white" strokeWidth="2" opacity="0.3" />
        <line x1="150" y1="100" x2="125" y2="160" stroke="white" strokeWidth="2" opacity="0.3" />
        <line x1="50" y1="100" x2="150" y2="100" stroke="white" strokeWidth="2" opacity="0.2" />
        <line x1="75" y1="160" x2="125" y2="160" stroke="white" strokeWidth="2" opacity="0.2" />
        {/* Nodes */}
        <circle cx="100" cy="50" r="18" fill="white" opacity="0.8" />
        <circle cx="100" cy="50" r="18" fill="url(#halftone-network)" opacity="0.5" />
        <circle cx="50" cy="100" r="14" fill="white" opacity="0.6" />
        <circle cx="50" cy="100" r="14" fill="url(#halftone-network)" opacity="0.5" />
        <circle cx="150" cy="100" r="14" fill="white" opacity="0.6" />
        <circle cx="150" cy="100" r="14" fill="url(#halftone-network)" opacity="0.5" />
        <circle cx="75" cy="160" r="12" fill="white" opacity="0.4" />
        <circle cx="75" cy="160" r="12" fill="url(#halftone-network)" opacity="0.5" />
        <circle cx="125" cy="160" r="12" fill="white" opacity="0.4" />
        <circle cx="125" cy="160" r="12" fill="url(#halftone-network)" opacity="0.5" />
      </svg>
    ),
  };

  return (
    <motion.div
      className={className}
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      {shapes[shape]}
    </motion.div>
  );
}
