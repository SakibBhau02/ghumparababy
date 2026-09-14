/**
 * Client-side dataLayer push helper for GTM events.
 * Safe to import in any "use client" component.
 */

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

function pushToDataLayer(data: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(data);
}

/** Push view_item event with product data */
export function pushViewItem(data: {
  item_id: string;
  item_name: string;
  price: number;
  currency?: string;
}) {
  pushToDataLayer({
    event: "view_item",
    ecommerce: {
      items: [
        {
          item_id: data.item_id,
          item_name: data.item_name,
          price: data.price,
          currency: data.currency ?? "BDT",
        },
      ],
    },
  });
}

/** Push purchase event with order data */
export function pushPurchase(data: {
  transaction_id: string;
  value: number;
  currency?: string;
  items: { item_id: string; item_name: string; price: number; quantity: number }[];
}) {
  pushToDataLayer({
    event: "purchase",
    ecommerce: {
      transaction_id: data.transaction_id,
      value: data.value,
      currency: data.currency ?? "BDT",
      items: data.items,
    },
  });
}
