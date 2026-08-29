// /api/checkout.js
// Opretter en Stripe Checkout-session for det valgte tilbud.
// "amount" kommer allerede inkl. din avance (se script.js) — så det er
// den samlede pris kunden ser og betaler, ikke kun flybilletprisen.
//
// Sæt STRIPE_SECRET_KEY i Vercel under Environment Variables.

import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { offerId, amount, currency, passengers } = req.body;
  const contact = passengers.find(p => p.email) || {};

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: contact.email,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Rejse — tilbud ${offerId}`,
              description: `${passengers.length} rejsende · Booket via Voya Rejser`,
            },
            unit_amount: amount, // i øre/cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.SITE_URL}/success.html?offer=${offerId}`,
      cancel_url: `${process.env.SITE_URL}/#soeg`,
      // Gemmes her, så webhook'en (api/webhook.js) kan booke billetterne
      // hos Duffel, når betalingen er bekræftet. NB: Stripe metadata-værdier
      // er begrænset til 500 tegn — ved meget store rejsegrupper (7-8+
      // personer) kan det være nødvendigt at gemme passagerlisten et andet
      // sted (fx en lille database) i stedet for direkte i metadata.
      metadata: {
        offerId,
        passengers: JSON.stringify(passengers),
      },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kunne ikke oprette betaling." });
  }
}
