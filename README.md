# Voya Rejser — sådan går du live (trin for trin)

Alt kode er nu færdigbygget: søgning, prisvisning, passageroplysninger,
Stripe-betaling OG selve billet-bookingen hos Duffel efter betaling. Følg
disse trin i rækkefølge.

---

## Trin 1 — Læg koden på GitHub (10 min)
Vercel henter normalt din side fra GitHub, så ændringer senere er lette.

1. Opret en gratis konto på [github.com](https://github.com) hvis du ikke har en
2. Klik **New repository**, kald den fx `voya-rejser`, lad den være "Private"
3. Upload alle filerne fra denne mappe til repository'et ("Add file → Upload files" virker fint via browseren)

*(Alternativ uden GitHub: Vercel kan også modtage mappen direkte via deres CLI — sig til, hvis du hellere vil det, så guider jeg dig igennem det i stedet.)*

## Trin 2 — Opret konto på Vercel og importér projektet (5 min)
1. Gå til [vercel.com](https://vercel.com) → **Sign up** → vælg "Continue with GitHub"
2. Klik **Add New → Project**
3. Vælg dit `voya-rejser` repository → **Import**
4. Tryk **Deploy** (den fejler eller ser tom ud lige nu — helt normalt, vi mangler nøglerne, se trin 3)

## Trin 3 — Opret dine nøgler
Du skal bruge tre ting, før siden virker rigtigt:

### A) Duffel-nøgle
1. Log ind på [duffel.com](https://duffel.com) → **Dashboard → API keys**
2. Start med **test-nøglen** (starter med `duffel_test_...`) — så kan du teste hele flowet uden rigtige penge, før du skifter til live-nøglen

### B) Stripe-nøgle
1. Log ind på [dashboard.stripe.com](https://dashboard.stripe.com)
2. **Developers → API keys** → kopiér din **Secret key** (start med testnøglen `sk_test_...`)

### C) Stripe webhook secret
Den kommer i trin 5 — spring den over for nu.

## Trin 4 — Sæt nøglerne ind i Vercel (5 min)
I dit Vercel-projekt: **Settings → Environment Variables** → tilføj:

| Navn | Værdi |
|---|---|
| `DUFFEL_API_KEY` | din Duffel-testnøgle fra trin 3A |
| `STRIPE_SECRET_KEY` | din Stripe-testnøgle fra trin 3B |
| `SITE_URL` | din Vercel-adresse, fx `https://voya-rejser.vercel.app` |
| `STRIPE_WEBHOOK_SECRET` | sæt midlertidigt til `whsec_placeholder` — opdateres i trin 5 |

Tryk derefter **Deployments → ⋯ → Redeploy**, så de nye nøgler bliver brugt.

## Trin 5 — Kobl Stripe-webhook'en på (5 min)
Det er webhook'en, der rent faktisk booker billetten hos Duffel, efter kunden
har betalt — uden den betaler folk, men billetten booker ikke sig selv.

1. Gå til [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks) → **Add endpoint**
2. Endpoint URL: `https://DIN-VERCEL-ADRESSE.vercel.app/api/webhook`
3. Vælg event: `checkout.session.completed`
4. Gem, og kopiér **Signing secret** (starter med `whsec_...`)
5. Gå tilbage til Vercel → opdatér `STRIPE_WEBHOOK_SECRET` med denne værdi
6. Redeploy igen

## Trin 6 — Test det hele (10 min)
1. Åbn din side (`https://din-adresse.vercel.app`)
2. Søg en flyrejse, vælg et tilbud, udfyld passageroplysninger
3. Betal med et Stripe-testkort: **4242 4242 4242 4242**, vilkårlig fremtidig dato, vilkårlig CVC
4. Tjek i Stripe Dashboard at betalingen kom igennem
5. Tjek i **Vercel → dit projekt → Logs** at webhook'en kørte og forsøgte at booke hos Duffel (med testnøglen bookes en "fake" billet — helt normalt i testmode)

## Trin 7 — Skift til rigtige penge (når du er klar)
1. I Duffel: aktivér din konto til **live** og hent din `duffel_live_...` nøgle
2. I Stripe: aktivér din konto til **live betalinger** og hent din `sk_live_...` nøgle
3. Opdatér begge i Vercels miljøvariabler, og lav en ny webhook i Stripes **live**-visning (ikke testvisning) der peger på samme URL — kopiér den nye `whsec_...` ind
4. Redeploy

## Trin 8 — Køb domæne (valgfrit, ca. 80-100 kr/år)
1. Køb domænet hos fx one.com eller Simply.com
2. I Vercel: **Settings → Domains** → tilføj dit domæne, følg DNS-vejledningen
3. Opdatér `SITE_URL` i miljøvariablerne til det nye domæne, og opdatér webhook-URL'en i Stripe tilsvarende

---

## Din avance
I `js/script.js` øverst:
```js
const YOUR_MARKUP_KR = 750; // sæt mellem 500-1000 kr
```
Læg oveni Duffels pris automatisk — både i det kunden ser og betaler.

## Vigtigt at vide
- **Test alt med testnøgler først.** Skift kun til live-nøgler, når hele flowet (søg → betal → book) virker fejlfrit i test.
- **Overvåg Vercel-loggen de første uger.** Hvis Duffel-bookingen fejler efter en betaling (fx pga. udsolgt sæde), skal du booke manuelt og kontakte kunden — det logges tydeligt som fejl i konsollen.
- **Passagerens titel/køn** er lige nu sat statisk i `api/webhook.js` (`title: "mr"`, `gender: "m"`) — det bør udvides med rigtige felter i formularen, så det passer til alle kunder. Sig til, så tilføjer jeg det.

## Filoversigt
```
index.html          → siden selv
success.html         → siden kunden lander på efter betaling
css/styles.css        → design og animationer
css/modal.css         → passageroplysnings-formular
js/script.js          → søgning, prisvisning, passager-formular, checkout
api/search.js         → henter live priser fra Duffel
api/checkout.js        → opretter Stripe-betaling inkl. din avance
api/webhook.js         → booker den rigtige billet hos Duffel efter betaling
package.json           → nødvendige afhængigheder (Stripe)
```
