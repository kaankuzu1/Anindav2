"use client";

import { motion } from "framer-motion";

interface ButtonProps {
  children: React.ReactNode;
  variant?: "solid" | "outlined";
  inverted?: boolean;
  className?: string;
  onClick?: () => void;
}

export default function Button({
  children,
  variant = "solid",
  inverted = false,
  className = "",
  onClick,
}: ButtonProps) {
  const baseClasses =
    "px-6 py-3 rounded-md font-medium text-sm transition-all duration-150 cursor-pointer";

  const variants = {
    solid: inverted
      ? "bg-gradient-primary text-white hover:shadow-lg hover:shadow-indigo-500/25"
      : "bg-gradient-primary text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02]",
    outlined: inverted
      ? "border border-slate-600 text-slate-300 hover:border-indigo-400 hover:bg-indigo-500/10 hover:text-white"
      : "border border-slate-600 text-white hover:border-indigo-500 hover:bg-indigo-500/10",
  };

  return (
    <motion.button
      whileHover={{ scale: variant === "solid" && !inverted ? 1.02 : 1 }}
      whileTap={{ scale: 0.98 }}
      className={`${baseClasses} ${variants[variant]} ${className}`}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}
