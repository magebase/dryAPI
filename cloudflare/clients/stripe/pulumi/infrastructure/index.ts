import * as pulumi from "@pulumi/pulumi";
import * as stripe from "pulumi-stripe";

const config = new pulumi.Config("stripe");
const apiKey = config.requireSecret("apiKey");

const provider = new stripe.Provider("stripe-provider", {
  apiKey: apiKey,
});

// Configuration for SaaS Plans
const plans = [
  {
    slug: "starter",
    name: "Starter",
    monthlyAmount: 4900, // $49.00
    annualAmount: 49980, // $499.80 (Example: 15% off)
    tokens: 100000,
  },
  {
    slug: "growth",
    name: "Growth",
    monthlyAmount: 19900, // $199.00
    annualAmount: 214920, // $2149.20 (Example: 10% off)
    tokens: 500000,
  },
  {
    slug: "scale",
    name: "Scale",
    monthlyAmount: 79900, // $799.00
    annualAmount: 910860, // $9108.60 (Example: 5% off)
    tokens: 2000000,
  },
];

const stripeProducts: stripe.Product[] = [];
const stripePrices: stripe.Price[] = [];

for (const plan of plans) {
  // Create Product
  const product = new stripe.Product(
    `plan-${plan.slug}`,
    {
      name: plan.name,
      active: true,
      metadata: {
        plan_slug: plan.slug,
        kind: "saas_credit_discount",
        monthly_tokens: plan.tokens.toString(),
      },
    },
    { provider },
  );
  stripeProducts.push(product);

  // Create Monthly Price
  const monthlyPrice = new stripe.Price(
    `price-${plan.slug}-monthly`,
    {
      product: product.id,
      unitAmount: plan.monthlyAmount,
      currency: "usd",
      recurring: {
        interval: "month",
        intervalCount: 1,
      },
      nickname: `${plan.name} Monthly`,
    },
    { provider },
  );
  stripePrices.push(monthlyPrice);

  // Create Annual Price
  const annualPrice = new stripe.Price(
    `price-${plan.slug}-annual`,
    {
      product: product.id,
      unitAmount: plan.annualAmount,
      currency: "usd",
      recurring: {
        interval: "year",
        intervalCount: 1,
      },
      nickname: `${plan.name} Annual`,
    },
    { provider },
  );
  stripePrices.push(annualPrice);
}

// Export IDs for convenience (though Pulumi state manages them)
export const productIds = stripeProducts.map((p) => p.id);
export const priceIds = stripePrices.map((p) => p.id);

// Billing Portal Configuration
const portalConfig = new stripe.PortalConfiguration(
  "default-portal",
  {
    businessProfile: {
      headline: "GenFix Consultancy Plans",
      privacyPolicyUrl: "https://dryapi.dev/privacy-policy",
      termsOfServiceUrl: "https://dryapi.dev/terms",
    },
    features: {
      customerUpdate: {
        enabled: true,
        allowedUpdates: ["email", "address", "tax_id"],
      },
      invoiceHistory: {
        enabled: true,
      },
      paymentMethodUpdate: {
        enabled: true,
      },
      subscriptionCancel: {
        enabled: true,
        mode: "at_period_end",
        cancellationReason: {
          enabled: true,
          options: [
            "too_expensive",
            "missing_features",
            "switched_service",
            "unused",
            "other",
          ],
        },
      },
      subscriptionUpdates: [
        {
          enabled: true,
          defaultAllowedUpdates: ["price", "promotion_code"],
          prorationBehavior: "create_prorations",
          products: stripeProducts.map((p, i) => {
            return {
              product: p.id,
              prices: [
                stripePrices[2 * i].id, // Monthly
                stripePrices[2 * i + 1].id, // Annual
              ],
            };
          }),
        },
      ],
    },
  },
  { provider },
);

export const portalConfigId = portalConfig.id;
