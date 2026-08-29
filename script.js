/* ============================================================
   VOYA — frontend logic
   ------------------------------------------------------------
   Dette script er klar til at blive koblet til en rigtig
   backend (se /api/search.js og README.md). Lige nu bruger
   det MOCK_RESULTS, som har præcis samme facon som det Duffel
   API'et returnerer, så du kun skal udskifte fetchOffers()
   for at gøre priserne 100% live.
   ============================================================ */

const YOUR_MARKUP_KR = 750; // din avance pr. person (mellem 500-1000 kr, sæt selv)

const MOCK_RESULTS = [
  { id: "off_1", airline: "Turkish Airlines", from: "CPH", to: "IST", duration: "3t 35m", stops: "Direkte", basePrice: 2140, currency: "DKK" },
  { id: "off_2", airline: "SAS",              from: "CPH", to: "IST", duration: "5t 10m", stops: "1 mellemlanding", basePrice: 1890, currency: "DKK" },
  { id: "off_3", airline: "Pegasus",          from: "CPH", to: "IST", duration: "4t 55m", stops: "1 mellemlanding", basePrice: 1640, currency: "DKK" },
];

const board = document.getElementById("resultsBoard");
const resultsTitle = document.getElementById("resultsTitle");
const resultsSub = document.getElementById("resultsSub");
const form = document.getElementById("searchForm");
const tabs = document.querySelectorAll(".tab");

let activeTab = "fly";

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    activeTab = tab.dataset.tab;
    document.querySelector('[data-field="to"] label').textContent =
      activeTab === "hotel" ? "Destination" : "Til";
    document.querySelector('[data-field="return"]').style.display =
      activeTab === "fly" ? "none" : "flex";
  });
});
// default: skjul retur-felt for enkeltrejse-fly-visning, vis for hotel/pakke
document.querySelector('[data-field="return"]').style.display = "none";

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  renderLoading();
  const offers = await fetchOffers(data);
  renderResults(offers, data);
});

/* ------------------------------------------------------------
   fetchOffers()
   Kalder din egen backend (/api/search), som igen kalder Duffel
   med din hemmelige API-nøgle. Falder tilbage til MOCK_RESULTS
   hvis backenden ikke findes endnu (dvs. under lokal test).
------------------------------------------------------------ */
async function fetchOffers(searchParams) {
  try {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...searchParams, type: activeTab }),
    });
    if (!res.ok) throw new Error("no backend yet");
    return await res.json();
  } catch (err) {
    // Ingen live backend forbundet endnu -> vis eksempeldata
    await new Promise(r => setTimeout(r, 650));
    return MOCK_RESULTS;
  }
}

function renderLoading() {
  resultsTitle.textContent = "Søger de bedste priser…";
  resultsSub.textContent = "Henter live tilbud gennem Duffel.";
  board.innerHTML = `<div class="flight-card" style="opacity:.5"><div>Søger…</div></div>`;
}

function renderResults(offers, params) {
  resultsTitle.textContent = `${offers.length} tilbud fundet`;
  resultsSub.textContent = `${params.from || "Afgang"} → ${params.to || "Destination"} · pris inkl. service`;

  board.innerHTML = offers.map((o, i) => {
    const finalPrice = o.basePrice + YOUR_MARKUP_KR;
    return `
      <article class="flight-card" style="animation-delay:${i * 90}ms">
        <div>
          <div class="flight-route">
            <span class="code">${o.from}</span>
            <span class="path-mini"></span>
            <span class="code">${o.to}</span>
          </div>
          <div class="flight-meta">${o.airline} · ${o.duration} · ${o.stops}</div>
        </div>
        <div class="flight-airline">${o.airline}<span>Én rejsende, tur/retur pris kan variere</span></div>
        <div class="flip-price">${renderFlip(finalPrice)}<span class="unit">DKK</span></div>
        <button class="select-btn" data-offer="${o.id}">Vælg og book →</button>
      </article>
    `;
  }).join("");

  board.querySelectorAll(".select-btn").forEach(btn => {
    btn.addEventListener("click", () => startCheckout(btn.dataset.offer, offers));
  });
}

function renderFlip(price) {
  return String(price).split("").map((d, i) =>
    `<span class="digit" style="animation-delay:${i * 60}ms">${d}</span>`
  ).join("");
}

/* ------------------------------------------------------------
   startCheckout()
   Viser først en lille formular for passageroplysninger (krævet
   af Duffel for at kunne booke billetten), og sender derefter
   tilbud + passager til backend, som opretter Stripe-betaling.
------------------------------------------------------------ */
function startCheckout(offerId, offers) {
  const offer = offers.find(o => o.id === offerId);
  openPassengerModal(offer);
}

function openPassengerModal(offer) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <h3>Dine oplysninger</h3>
      <p class="modal-sub">Skal bruges til at booke billetten hos flyselskabet.</p>
      <form id="passengerForm">
        <div class="field">
          <label>Fulde navn (som på pas)</label>
          <input type="text" name="fullName" required placeholder="Anders Andersen">
        </div>
        <div class="field">
          <label>E-mail</label>
          <input type="email" name="email" required placeholder="dig@eksempel.dk">
        </div>
        <div class="field">
          <label>Fødselsdato</label>
          <input type="date" name="dob" required>
        </div>
        <div class="field">
          <label>Telefon</label>
          <input type="tel" name="phone" required placeholder="+45 12345678">
        </div>
        <div class="modal-actions">
          <button type="button" class="modal-cancel">Annullér</button>
          <button type="submit" class="btn-search"><span>Gå til betaling</span></button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector(".modal-cancel").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector("#passengerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const passenger = Object.fromEntries(new FormData(e.target).entries());
    await submitCheckout(offer, passenger);
  });
}

async function submitCheckout(offer, passenger) {
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerId: offer.id,
        amount: (offer.basePrice + YOUR_MARKUP_KR) * 100,
        currency: "dkk",
        passenger,
      }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else throw new Error("no url");
  } catch (err) {
    alert("Betaling er endnu ikke koblet til (Stripe-nøgle mangler i backend). Se README.md for opsætning.");
  }
}
