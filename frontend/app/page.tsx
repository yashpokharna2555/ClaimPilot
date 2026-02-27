import HeroSection from "@/components/landing/HeroSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import TrustSignals from "@/components/landing/TrustSignals";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import PricingSection from "@/components/landing/PricingSection";

export default function Home() {
  return (
    <>
      <HeroSection />
      <TrustSignals />
      <HowItWorksSection />
      <PricingSection />
      <TestimonialsSection />
    </>
  );
}
