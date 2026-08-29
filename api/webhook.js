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
    const { offerId, passengerCount } = session.metadata;
    const passengers = [];
    for (let i = 0; i < parseInt(passengerCount, 10); i++) {
      passengers.push(JSON.parse(session.metadata[`passenger_${i}`]));
    }

    try {
      await bookWithDuffel({ offerId, passengers });
      console.log(`Billetter booket hos Duffel for tilbud ${offerId}`);
    } catch (err) {
      // VIGTIGT: kunden har betalt, men billetten kunne ikke bookes.
      // Log det tydeligt, så du kan booke manuelt og evt. refundere.
      console.error("Duffel-booking fejlede efter betaling:", err);
      // Overvej her at sende dig selv en e-mail/Slack-besked (se README).
    }
  }

  res.status(200).json({ received: true });
}

/* ------------------------------------------------------------
   bookWithDuffel()
   1. Henter det oprindelige tilbud igen fra Duffel for at få de
      rigtige passager-id'er (og hvilken type Duffel har givet
      hver af dem: adult / child / infant_without_seat).
   2. Matcher dem, i samme rækkefølge, med de oplysninger kunden
      indtastede (se collectPassengers() i js/script.js — voksne
      først, så børn, så spædbørn).
   3. Knytter hvert spædbarn til en ansvarlig voksen, som Duffel
      kræver (infant_passenger_id).
------------------------------------------------------------ */
async function bookWithDuffel({ offerId, passengers }) {
  const offerRes = await fetch(`https://api.duffel.com/air/offers/${offerId}`, {
    headers: {
      "Authorization": `Bearer ${process.env.DUFFEL_API_KEY}`,
      "Duffel-Version": "v2",
    },
  });
  if (!offerRes.ok) throw new Error(`Kunne ikke hente tilbud: ${await offerRes.text()}`);
  const offerData = await offerRes.json();
  const duffelPassengers = offerData.data.passengers; // samme rækkefølge som ved offer_request

  const orderPassengers = duffelPassengers.map((dp, i) => {
    const info = passengers[i] || {};
    const [firstName, ...rest] = (info.name || "Ukendt Navn").trim().split(" ");
    const p = {
      id: dp.id,
      type: dp.type,
      given_name: firstName,
      family_name: rest.join(" ") || firstName,
      born_on: info.dob,
      title: info.title || "mr",
      gender: info.gender || "m",
    };
    if (info.email) p.email = info.email;
    if (info.phone) p.phone_number = info.phone;

    // Pasoplysninger — påkrævet af flyselskaberne på internationale ruter
    if (info.passport && info.passportExpiry && info.nationality) {
      p.identity_documents = [{
        type: "passport",
        unique_identifier: info.passport,
        expires_on: info.passportExpiry,
        issuing_country_code: info.nationality,
      }];
    }
    return p;
  });

  // Knyt hvert spædbarn til en voksen (Duffel kræver infant_passenger_id på den voksne)
  const adults = orderPassengers.filter(p => p.type === "adult");
  const infants = orderPassengers.filter(p => p.type === "infant_without_seat");
  infants.forEach((infant, i) => {
    const responsibleAdult = adults[i] || adults[0];
    if (responsibleAdult) responsibleAdult.infant_passenger_id = infant.id;
  });

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
        passengers: orderPassengers,
      },
    }),
  });

  if (!orderRes.ok) {
    const errBody = await orderRes.text();
    throw new Error(`Duffel order fejlede: ${errBody}`);
  }

  return orderRes.json();
}
