// /api/webhook.js
// Modtages af Stripe, når en betaling er gennemført. Booker DERFOR den
// rigtige billet hos Duffel — det er dette skridt, der gør købet "ægte".
//
// Opsætning i Stripe Dashboard:
//   Developers → Webhooks → Add endpoint
//   URL: https://DIT-DOMÆNE.dk/api/webhook
//   Event: checkout.session.completed
//   Kopiér "Signing secret" (starter med whsec_...) ind som STRIPE_WEBHOOK_SECRET
//   i Vercels miljøvariabler.

import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe kræver den rå (uparsede) body for at kunne verificere signaturen
export const config = {
  api: { bodyParser: false },
};

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on("data", (chunk) => chunks.push(chunk));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signatur fejlede:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { offerId, fullName, email, dob, phone } = session.metadata;

    try {
      await bookWithDuffel({ offerId, fullName, email, dob, phone });
      console.log(`Billet booket hos Duffel for tilbud ${offerId}`);
    } catch (err) {
      // VIGTIGT: kunden har betalt, men billetten kunne ikke bookes.
      // Log det tydeligt, så du kan booke manuelt og evt. refundere.
      console.error("Duffel-booking fejlede efter betaling:", err);
      // Overvej her at sende dig selv en e-mail/Slack-besked (se README).
    }
  }

  res.status(200).json({ received: true });
}

async function bookWithDuffel({ offerId, fullName, email, dob, phone }) {
  const [firstName, ...rest] = fullName.trim().split(" ");
  const lastName = rest.join(" ") || firstName;

  const orderRes = await fetch("https://api.duffel.com/air/orders", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.DUFFEL_API_KEY}`,
      "Content-Type": "application/json",
      "Duffel-Version": "v2",
    },
    body: JSON.stringify({
      data: {
        type: "instant",
        selected_offers: [offerId],
        payments: [{ type: "balance", currency: "DKK", amount: "0" }],
        passengers: [
          {
            id: "pas_0",
            given_name: firstName,
            family_name: lastName,
            born_on: dob,
            email,
            phone_number: phone,
            title: "mr",
            gender: "m",
          },
        ],
      },
    }),
  });

  if (!orderRes.ok) {
    const errBody = await orderRes.text();
    throw new Error(`Duffel order fejlede: ${errBody}`);
  }

  return orderRes.json();
}
