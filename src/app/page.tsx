import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { MoroExplain } from "@/components/landing/moro-explain";
import { StatsSection } from "@/components/landing/stats-section";
import { SymptomCheck } from "@/components/landing/symptom-check";
import { Solution } from "@/components/landing/solution";
import { Showcase } from "@/components/landing/showcase";
import { HowToUse } from "@/components/landing/how-to-use";
import { Testimonials } from "@/components/landing/testimonials";
import { Pricing } from "@/components/landing/pricing";
import { OrderForm } from "@/components/landing/order-form";
import { FAQ } from "@/components/landing/faq";
import { FinalCTA, Footer } from "@/components/landing/footer";
import { StickyCTA } from "@/components/landing/sticky-cta";
import { WhatsAppFloat } from "@/components/landing/whatsapp-float";

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-clip">
      <Header />
      {/* Emotional journey: Info → Fear → Relief → Proof → Offer → Action */}
      <Hero />
      <MoroExplain />
      <StatsSection />
      <SymptomCheck />
      <Solution />
      <Showcase />
      <HowToUse />
      <Testimonials />
      <Pricing />
      <OrderForm />
      <FAQ />
      <FinalCTA />
      <Footer />
      <StickyCTA />
      <WhatsAppFloat />
    </main>
  );
}
