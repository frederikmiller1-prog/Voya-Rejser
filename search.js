// /api/search.js
// Vercel serverless function — kører KUN på serveren, aldrig i browseren.
// Her ligger din Duffel-nøgle sikkert som en miljøvariabel.
//
// Sæt DUFFEL_API_KEY i Vercel under Project Settings → Environment Variables.
// Test-nøgle starter med "duffel_test_...", live-nøgle med "duffel_live_...".

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { from, to, depart, return: returnDate, pax, type } = req.body;

  try {
    // Duffel kræver først et "offer request", derefter henter man tilbud (offers)
    const offerRequestRes = await fetch("https://api.duffel.com/air/offer_requests", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DUFFEL_API_KEY}`,
        "Content-Type": "application/json",
        "Duffel-Version": "v2",
      },
      body: JSON.stringify({
        data: {
          slices: [
            { origin: from, destination: to, departure_date: depart },
            ...(returnDate ? [{ origin: to, destination: from, departure_date: returnDate }] : []),
          ],
          passengers: Array.from({ length: parsePaxCount(pax) }, () => ({ type: "adult" })),
          cabin_class: "economy",
        },
      }),
    });

    const offerRequestData = await offerRequestRes.json();
    const offerRequestId = offerRequestData.data.id;

    const offersRes = await fetch(
      `https://api.duffel.com/air/offers?offer_request_id=${offerRequestId}&limit=10`,
      {
        headers: {
          "Authorization": `Bearer ${process.env.DUFFEL_API_KEY}`,
          "Duffel-Version": "v2",
        },
      }
    );
    const offersData = await offersRes.json();

    // Formatér til det format frontenden forventer
    const formatted = offersData.data.map((offer) => ({
      id: offer.id,
      airline: offer.owner?.name || "Ukendt",
      from,
      to,
      duration: offer.slices?.[0]?.duration || "",
      stops: offer.slices?.[0]?.segments?.length > 1 ? "1+ mellemlanding" : "Direkte",
      basePrice: Math.round(parseFloat(offer.total_amount)),
      currency: offer.total_currency,
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kunne ikke hente priser fra Duffel." });
  }
}

function parsePaxCount(paxLabel) {
  const match = String(paxLabel || "1").match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}
