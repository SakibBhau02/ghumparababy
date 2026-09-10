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
import { FacebookPixel } from "@/components/landing/facebook-pixel";
import { getDeliveryConfig } from "@/lib/delivery";
import { getProductConfig } from "@/lib/product";
import { getLocationEnabled } from "@/lib/site-settings";
import { getPixelConfig } from "@/lib/pixel-config";
import type { DeliveryConfig } from "@/lib/delivery-shared";
import type { ProductConfig } from "@/lib/product-shared";
import { priceForQty } from "@/lib/product-shared";
import type { PixelConfig } from "@/lib/pixel-shared";

// Static with 60s revalidation (ISR): Vercel serves cached HTML so traffic
// spikes never hammer Neon — admin price/setting changes appear within a minute.
export const revalidate = 60;

export default async function Home() {
  const [deliveryConfig, pixelConfig, productConfig, locationEnabled]: [
    DeliveryConfig,
    PixelConfig,
    ProductConfig,
    boolean,
  ] = await Promise.all([
    getDeliveryConfig(),
    getPixelConfig(),
    getProductConfig(),
    getLocationEnabled(),
  ]);
  const singlePrice = priceForQty(productConfig, 1).total;

  return (
    <main className="min-h-screen overflow-x-clip">
      {pixelConfig.enabled && pixelConfig.pixelId ? (
        <FacebookPixel
          pixelId={pixelConfig.pixelId}
          events={pixelConfig.events}
          contentName="ঘুমপাড়া বেবি সোয়াডেল"
          contentValue={singlePrice}
        />
      ) : null}
      <Header />
      {/* Emotional journey: Info → Fear → Relief → Proof → Offer → Action */}
      <Hero deliveryConfig={deliveryConfig} productConfig={productConfig} />
      <MoroExplain />
      <StatsSection />
      <SymptomCheck />
      <Solution deliveryConfig={deliveryConfig} productConfig={productConfig} />
      <Showcase />
      <HowToUse />
      <Testimonials />
      <Pricing deliveryConfig={deliveryConfig} productConfig={productConfig} />
      <OrderForm
        deliveryConfig={deliveryConfig}
        productConfig={productConfig}
        locationEnabled={locationEnabled}
      />
      <FAQ deliveryConfig={deliveryConfig} />
      <FinalCTA deliveryConfig={deliveryConfig} />
      <Footer />
      <StickyCTA deliveryConfig={deliveryConfig} productConfig={productConfig} />
      <WhatsAppFloat />
    </main>
  );
}
