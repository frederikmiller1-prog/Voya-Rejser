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
      // hos Duffel, når betalingen er bekræftet. Stripe tillader kun
      // 500 tegn pr. metadata-felt, så hver passager (med navn, pas,
      // nationalitet osv.) gemmes i sit eget felt i stedet for én stor liste.
      metadata: buildPassengerMetadata(offerId, passengers),
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kunne ikke oprette betaling." });
  }
}

function buildPassengerMetadata(offerId, passengers) {
  const metadata = { offerId, passengerCount: String(passengers.length) };
  passengers.forEach((p, i) => {
    metadata[`passenger_${i}`] = JSON.stringify(p);
  });
  return metadata;
}
