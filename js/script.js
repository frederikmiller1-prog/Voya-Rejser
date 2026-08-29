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

/* ------------------------------------------------------------
   Lufthavne til autocomplete. Dette er en kort liste med de
   mest relevante lufthavne. Når Duffel-nøglen er koblet til
   (se README.md), kan denne udskiftes med et rigtigt opslag mod
   Duffels "Places" endpoint for at dække alle verdens lufthavne.
------------------------------------------------------------ */
const MOCK_RESULTS = [
  { id: "off_1", airline: "Turkish Airlines", from: "CPH", to: "IST", duration: "3t 35m", stops: "Direkte", basePrice: 2140, currency: "DKK" },
  { id: "off_2", airline: "SAS",              from: "CPH", to: "IST", duration: "5t 10m", stops: "1 mellemlanding", basePrice: 1890, currency: "DKK" },
  { id: "off_3", airline: "Pegasus",          from: "CPH", to: "IST", duration: "4t 55m", stops: "1 mellemlanding", basePrice: 1640, currency: "DKK" },
];

const AIRPORTS = [
  { code: "CPH", city: "København", country: "Danmark" },
  { code: "BLL", city: "Billund", country: "Danmark" },
  { code: "AAL", city: "Aalborg", country: "Danmark" },
  { code: "AAR", city: "Aarhus", country: "Danmark" },
  { code: "IST", city: "Istanbul", country: "Tyrkiet" },
  { code: "SAW", city: "Istanbul (Sabiha Gökçen)", country: "Tyrkiet" },
  { code: "AYT", city: "Antalya", country: "Tyrkiet" },
  { code: "DXB", city: "Dubai", country: "Forenede Arabiske Emirater" },
  { code: "JED", city: "Jeddah", country: "Saudi-Arabien" },
  { code: "MED", city: "Medina", country: "Saudi-Arabien" },
  { code: "RUH", city: "Riyadh", country: "Saudi-Arabien" },
  { code: "CAI", city: "Cairo", country: "Egypten" },
  { code: "LHR", city: "London (Heathrow)", country: "Storbritannien" },
  { code: "CDG", city: "Paris (Charles de Gaulle)", country: "Frankrig" },
  { code: "BCN", city: "Barcelona", country: "Spanien" },
  { code: "MAD", city: "Madrid", country: "Spanien" },
  { code: "FCO", city: "Rom", country: "Italien" },
  { code: "AMS", city: "Amsterdam", country: "Holland" },
  { code: "FRA", city: "Frankfurt", country: "Tyskland" },
  { code: "BER", city: "Berlin", country: "Tyskland" },
  { code: "OSL", city: "Oslo", country: "Norge" },
  { code: "ARN", city: "Stockholm", country: "Sverige" },
  { code: "BKK", city: "Bangkok", country: "Thailand" },
  { code: "DPS", city: "Bali", country: "Indonesien" },
  { code: "JFK", city: "New York", country: "USA" },
  { code: "IKA", city: "Teheran", country: "Iran" },
];

const board = document.getElementById("resultsBoard");
const resultsTitle = document.getElementById("resultsTitle");
const resultsSub = document.getElementById("resultsSub");
const form = document.getElementById("searchForm");
const tabs = document.querySelectorAll(".tab");

/* ------------------------------------------------------------
   AUTOCOMPLETE — Fra/Til
------------------------------------------------------------ */
function setupAirportAutocomplete(inputId, hiddenId, listId) {
  const input = document.getElementById(inputId);
  const hidden = document.getElementById(hiddenId);
  const list = document.getElementById(listId);

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { list.classList.remove("open"); return; }

    const matches = AIRPORTS.filter(a =>
      a.city.toLowerCase().includes(q) ||
      a.code.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q)
    ).slice(0, 6);

    if (matches.length === 0) {
      list.innerHTML = `<li class="empty">Ingen lufthavne fundet</li>`;
    } else {
      list.innerHTML = matches.map(a => `
        <li data-code="${a.code}" data-city="${a.city}">
          <span><span class="city">${a.city}</span> <span class="country">${a.country}</span></span>
          <span class="code">${a.code}</span>
        </li>
      `).join("");
    }
    list.classList.add("open");
  });

  list.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-code]");
    if (!li) return;
    input.value = `${li.dataset.city} (${li.dataset.code})`;
    hidden.value = li.dataset.code;
    list.classList.remove("open");
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !list.contains(e.target)) list.classList.remove("open");
  });
}
setupAirportAutocomplete("fromInput", "fromCode", "fromSuggestions");
setupAirportAutocomplete("toInput", "toCode", "toSuggestions");

/* ------------------------------------------------------------
   DESTINATIONSKORT — klik udfylder "Til"-feltet og søger med det samme
------------------------------------------------------------ */
document.querySelectorAll(".destination-card").forEach(card => {
  card.addEventListener("click", () => {
    const code = card.dataset.code;
    const city = card.dataset.city;
    document.getElementById("toInput").value = `${city} (${code})`;
    document.getElementById("toCode").value = code;
    document.getElementById("soeg").scrollIntoView({ behavior: "smooth", block: "start" });
    form.requestSubmit();
  });
});

/* ------------------------------------------------------------
   PASSAGER-VÆLGER — voksne / børn / spædbørn
   Aldersgrænser følger IATA/Duffels standard:
   voksen = 12 år+, barn = 2-11 år, spædbarn = 0-1 år (sidder på skød).
------------------------------------------------------------ */
const paxCounts = { adults: 4, children: 0, infants: 0 };
const paxTrigger = document.getElementById("paxTrigger");
const paxPopover = document.getElementById("paxPopover");
const paxSummary = document.getElementById("paxSummary");

paxTrigger.addEventListener("click", () => paxPopover.classList.toggle("open"));
document.getElementById("paxDone").addEventListener("click", () => paxPopover.classList.remove("open"));
document.addEventListener("click", (e) => {
  if (!paxTrigger.contains(e.target) && !paxPopover.contains(e.target)) paxPopover.classList.remove("open");
});

document.querySelectorAll(".pax-stepper").forEach(stepper => {
  const type = stepper.dataset.type;
  const valueEl = stepper.querySelector(".pax-value");
  const minusBtn = stepper.querySelector('[data-action="minus"]');
  const plusBtn = stepper.querySelector('[data-action="plus"]');

  minusBtn.addEventListener("click", () => updatePax(type, -1, valueEl));
  plusBtn.addEventListener("click", () => updatePax(type, 1, valueEl));
});

function updatePax(type, delta, valueEl) {
  const min = type === "adults" ? 1 : 0;
  const max = type === "adults" ? 9 : 6;
  let next = paxCounts[type] + delta;
  next = Math.max(min, Math.min(max, next));

  // Der kan højst være ét spædbarn pr. voksen (sidder på skødet)
  if (type === "infants" && next > paxCounts.adults) next = paxCounts.adults;

  paxCounts[type] = next;
  valueEl.textContent = next;
  document.getElementById(`${type}Count`).value = next;

  // Hvis antal voksne sættes ned, kan der ikke være flere spædbørn end voksne
  if (type === "adults" && paxCounts.infants > next) {
    paxCounts.infants = next;
    document.getElementById("infantsCount").value = next;
    document.querySelector('.pax-stepper[data-type="infants"] .pax-value').textContent = next;
  }

  updatePaxButtons();
  updatePaxSummary();
}

function updatePaxButtons() {
  document.querySelectorAll(".pax-stepper").forEach(stepper => {
    const type = stepper.dataset.type;
    const min = type === "adults" ? 1 : 0;
    const max = type === "adults" ? 9 : 6;
    stepper.querySelector('[data-action="minus"]').disabled = paxCounts[type] <= min;
    stepper.querySelector('[data-action="plus"]').disabled =
      paxCounts[type] >= max || (type === "infants" && paxCounts.infants >= paxCounts.adults);
  });
}
updatePaxButtons();

function updatePaxSummary() {
  const parts = [];
  if (paxCounts.adults) parts.push(`${paxCounts.adults} voksne`);
  if (paxCounts.children) parts.push(`${paxCounts.children} børn`);
  if (paxCounts.infants) parts.push(`${paxCounts.infants} spædbørn`);
  paxSummary.textContent = parts.join(", ") || "Vælg rejsende";
}

let activeTab = "fly";
let lastSearchPax = { adults: 4, children: 0, infants: 0 };

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
  lastSearchPax = {
    adults: parseInt(data.adults, 10) || 1,
    children: parseInt(data.children, 10) || 0,
    infants: parseInt(data.infants, 10) || 0,
  };
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
   Viser først en formular for ALLE rejsendes oplysninger (krævet
   af Duffel for at kunne booke billetten) — én sektion pr. voksen,
   barn og spædbarn, ud fra antallet valgt i søgningen. Sender
   derefter tilbud + alle passagerer til backend.
------------------------------------------------------------ */
function startCheckout(offerId, offers) {
  const offer = offers.find(o => o.id === offerId);
  openPassengerModal(offer, lastSearchPax);
}

function openPassengerModal(offer, pax) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <h3>Rejsendes oplysninger</h3>
      <p class="modal-sub">Skal bruges til at booke billetterne hos flyselskabet.</p>
      <form id="passengerForm">
        ${buildPassengerFields(pax)}
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
    const passengers = collectPassengers(new FormData(e.target), pax);
    await submitCheckout(offer, passengers);
  });
}

const NATIONALITIES = [
  { code: "DK", label: "Dansk" },
  { code: "SE", label: "Svensk" },
  { code: "NO", label: "Norsk" },
  { code: "DE", label: "Tysk" },
  { code: "GB", label: "Britisk" },
  { code: "TR", label: "Tyrkisk" },
  { code: "SA", label: "Saudisk" },
  { code: "AE", label: "Emiratisk" },
  { code: "PK", label: "Pakistansk" },
  { code: "SO", label: "Somalisk" },
  { code: "IQ", label: "Irakisk" },
  { code: "MA", label: "Marokkansk" },
];

function buildPassengerFields(pax) {
  let html = "";

  for (let i = 0; i < pax.adults; i++) {
    html += buildPassengerGroup("adult", i, `Voksen ${i + 1}${i === 0 ? " (kontaktperson)" : ""}`, i === 0);
  }
  for (let i = 0; i < pax.children; i++) {
    html += buildPassengerGroup("child", i, `Barn ${i + 1} (2-11 år)`, false);
  }
  for (let i = 0; i < pax.infants; i++) {
    html += buildPassengerGroup("infant", i, `Spædbarn ${i + 1} (0-1 år)`, false);
  }

  return html;
}

function buildPassengerGroup(type, i, title, isContact) {
  const p = `${type}_${i}`;
  return `
    <div class="passenger-group">
      <h4>${title}</h4>
      <div class="field">
        <label>Fulde navn (som på pas)</label>
        <input type="text" name="${p}_name" required placeholder="${type === "adult" ? "Anders Andersen" : "Fulde navn"}">
      </div>
      <div class="field-row">
        <div class="field">
          <label>Titel</label>
          <select name="${p}_title">
            <option value="mr">Hr.</option>
            <option value="mrs">Fru</option>
            <option value="ms">Frøken</option>
          </select>
        </div>
        <div class="field">
          <label>Køn</label>
          <select name="${p}_gender">
            <option value="m">Mand</option>
            <option value="f">Kvinde</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>Fødselsdato</label>
        <input type="date" name="${p}_dob" required>
      </div>
      <div class="field">
        <label>Nationalitet</label>
        <select name="${p}_nationality" required>
          ${NATIONALITIES.map(n => `<option value="${n.code}">${n.label}</option>`).join("")}
        </select>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Pasnummer</label>
          <input type="text" name="${p}_passport" required placeholder="fx PA1234567">
        </div>
        <div class="field">
          <label>Pas udløber</label>
          <input type="date" name="${p}_passportExpiry" required>
        </div>
      </div>
      ${isContact ? `
      <div class="field">
        <label>E-mail</label>
        <input type="email" name="contactEmail" required placeholder="dig@eksempel.dk">
      </div>
      <div class="field">
        <label>Telefon</label>
        <input type="tel" name="contactPhone" required placeholder="+45 12345678">
      </div>` : ""}
    </div>
  `;
}

/* ------------------------------------------------------------
   collectPassengers()
   Samler alle felterne til én liste i PRÆCIS samme rækkefølge
   som passengers blev bygget i api/search.js (voksne, så børn,
   så spædbørn) — det er den rækkefølge api/webhook.js senere
   matcher mod de rigtige Duffel-passager-id'er med.
------------------------------------------------------------ */
function collectPassengers(fd, pax) {
  const passengers = [];
  const readGroup = (type, i, extra) => ({
    type: extra,
    name: fd.get(`${type}_${i}_name`),
    dob: fd.get(`${type}_${i}_dob`),
    title: fd.get(`${type}_${i}_title`),
    gender: fd.get(`${type}_${i}_gender`),
    nationality: fd.get(`${type}_${i}_nationality`),
    passport: fd.get(`${type}_${i}_passport`),
    passportExpiry: fd.get(`${type}_${i}_passportExpiry`),
    email: type === "adult" && i === 0 ? fd.get("contactEmail") : undefined,
    phone: type === "adult" && i === 0 ? fd.get("contactPhone") : undefined,
  });

  for (let i = 0; i < pax.adults; i++) passengers.push(readGroup("adult", i, "adult"));
  for (let i = 0; i < pax.children; i++) passengers.push(readGroup("child", i, "child"));
  for (let i = 0; i < pax.infants; i++) passengers.push(readGroup("infant", i, "infant"));

  return passengers;
}

async function submitCheckout(offer, passengers) {
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerId: offer.id,
        amount: (offer.basePrice + YOUR_MARKUP_KR) * 100,
        currency: "dkk",
        passengers,
      }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else throw new Error("no url");
  } catch (err) {
    alert("Betaling er endnu ikke koblet til (Stripe-nøgle mangler i backend). Se README.md for opsætning.");
  }
}
