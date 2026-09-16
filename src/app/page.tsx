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
import { FeaturedSection } from "@/components/landing/featured-section";
import { OrderForm } from "@/components/landing/order-form";
import { FAQ } from "@/components/landing/faq";
import { FinalCTA, Footer } from "@/components/landing/footer";
import { StickyCTA } from "@/components/landing/sticky-cta";
import { WhatsAppFloat } from "@/components/landing/whatsapp-float";
import { FacebookPixel } from "@/components/landing/facebook-pixel";
import { GtmLoader } from "@/components/landing/gtm";
import { getDeliveryConfig } from "@/lib/delivery";
import { getProductConfig } from "@/lib/product";
import { getSiteImages } from "@/lib/site-config";
import {
  ensureCatalogSeeded,
  getActiveCatalogItems,
  getFeaturedItems,
  getMainProduct,
} from "@/lib/catalog";
import { getLocationEnabled } from "@/lib/site-settings";
import { getPixelConfig } from "@/lib/pixel-config";
import { getGtmConfig } from "@/lib/gtm-config";
import { allVariantSkus, priceForQty } from "@/lib/product-shared";
import { flattenCatalog, type CatalogItem } from "@/lib/catalog-shared";

// Static with 60s revalidation (ISR): Vercel serves cached HTML so traffic
// spikes never hammer Neon — admin price/setting changes appear within a minute.
export const revalidate = 60;

export default async function Home() {
  const [
    deliveryConfig,
    pixelConfig,
    productConfig,
    locationEnabled,
    gtmConfig,
    siteImages,
    catalogItems,
  ] = await Promise.all([
    getDeliveryConfig(),
    getPixelConfig(),
    getProductConfig(),
    getLocationEnabled(),
    getGtmConfig(),
    getSiteImages(),
    (async () => {
      try {
        await ensureCatalogSeeded();
        const [all, featured, main] = await Promise.all([
          getActiveCatalogItems(),
          getFeaturedItems(),
          getMainProduct(),
        ]);
        return { all, featured, main };
      } catch {
        return {
          all: [] as CatalogItem[],
          featured: [] as CatalogItem[],
          main: null,
        };
      }
    })(),
  ]);
  const singlePrice = priceForQty(productConfig, 1).total;
  const featuredLines = flattenCatalog(catalogItems.featured);

  return (
    <main className="min-h-screen overflow-x-clip">
      {gtmConfig.enabled && gtmConfig.containerId ? (
        <GtmLoader containerId={gtmConfig.containerId} />
      ) : null}
      {pixelConfig.enabled && pixelConfig.pixelId ? (
        <FacebookPixel
          pixelId={pixelConfig.pixelId}
          events={pixelConfig.events}
          contentName="ঘুমপাড়া বেবি সোয়াডেল"
          contentValue={singlePrice}
          contentIds={allVariantSkus(productConfig)}
        />
      ) : null}
      <Header />
      {/* Emotional journey: Info → Fear → Relief → Proof → Offer → Action */}
      <Hero deliveryConfig={deliveryConfig} productConfig={productConfig} heroImage={siteImages.hero} />
      <MoroExplain />
      <StatsSection />
      <SymptomCheck />
      <Solution deliveryConfig={deliveryConfig} productConfig={productConfig} solutionImage={siteImages.solution} />
      <Showcase productConfig={productConfig} mainProduct={catalogItems.main} />
      <HowToUse howToUseImage={siteImages.howToUse} />
      <Testimonials />
      <Pricing deliveryConfig={deliveryConfig} productConfig={productConfig} />
      <FeaturedSection items={featuredLines} fromPrice={priceForQty(productConfig, 1).perPiece} />
      <OrderForm
        deliveryConfig={deliveryConfig}
        productConfig={productConfig}
        locationEnabled={locationEnabled}
        catalogItems={catalogItems.all}
      />
      <FAQ deliveryConfig={deliveryConfig} />
      <FinalCTA deliveryConfig={deliveryConfig} />
      <Footer />
      <StickyCTA deliveryConfig={deliveryConfig} productConfig={productConfig} />
      <WhatsAppFloat />
    </main>
  );
}
