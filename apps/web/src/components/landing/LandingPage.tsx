"use client";

import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import TrustBar from "./TrustBar";
import BenefitsSection from "./BenefitsSection";
import FeaturesDetail from "./FeaturesDetail";
import Testimonials from "./Testimonials";
import CTASection from "./CTASection";
import Footer from "./Footer";

export function LandingPage() {
  return (
    <div className="bg-[#0B0F1A] text-white min-h-screen">
      <Navbar />
      <main className="pt-[72px]">
        <HeroSection />
        <div className="section-divider" />
        <TrustBar />
        <div className="section-divider" />
        <BenefitsSection />
        <div className="section-divider" />
        <FeaturesDetail />
        <div className="section-divider" />
        <Testimonials />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
