# 🎨 Design-briefing GymWave

Briefing voor een designronde om de app mooier te maken. Dit document beschrijft wat de app is, welke schermen er zijn, welke elementen er per scherm in zitten, en binnen welke technische kaders het design moet blijven.

---

## 1. Wat is GymWave?

GymWave is een persoonlijke fitness-tracker voor één gebruiker, gebouwd als **één zelfstandig HTML-bestand** (`index.html`, geen build-stap, geen frameworks). De app draait op de telefoon (mobile-first, ~360 px breed) en begeleidt twee soorten trainingen:

- **Gym-sessies**: vaste apparaten met gewichten, standen-instellingen, een audio-coach (spraak), rusttimers en een drukte-meter.
- **Thuis-workouts**: een gegenereerd programma uit ~100 oefeningen op basis van beschikbare tijd + materiaal, met een reeks-speler, demo-video's (MuscleWiki), gewicht/reps-voorstellen en een beloningssysteem met sterren.

De huidige stijl is "synthwave/neon": donkere achtergronden, felle glow-kleuren, Orbitron-koppen, emoji als iconen. Dat mag mooier, strakker en volwassener — maar de energie en het gevoel van voortgang ("gains") moeten blijven.

---

## 2. ⚠️ Technische randvoorwaarden (kritiek)

1. **Alleen styling aanpassen.** De app heeft 130+ geautomatiseerde end-to-end-tests die aan element-id's, classnamen en DOM-structuur hangen. **Verander géén id's, classnamen of HTML-structuur** — alleen CSS (en eventueel extra classes toevoegen naast bestaande).
2. **Thema-systeem.** Alle kleuren/vormen komen uit CSS custom properties, gezet per thema via een `THEMES`-object in JS en `:root[data-theme="…"]`-selectors. Per thema beschikbaar: `--bg`, `--primary`, `--accent`, `--glow`, `--text`, `--radius`, `--btn-radius`, `--field-radius`, `--border-w`, `--border-style`, `--head-font`, `--head-spacing`, cardBg, scanline-intensiteit. Er zijn 5 thema's: **Synthwave** (standaard), **Miami Vice**, **Cyber Sunset**, **Neo Tokyo**, **Pastel Wave**. Nieuwe stijlen bij voorkeur als (verbeterd) thema of als verfijning van de basis-CSS die met de bestaande variabelen werkt.
3. **Mobile-first**: ontwerp op 360 px breed, alles verticaal scrollend, duim-bediening (grote tap-targets, knoppen onderaan bereikbaar). Er is geen desktop-layout nodig.
4. **Emoji als iconen** door de hele app (🏋️ 🏠 ⭐ 🎥 enz.). Vervangen door een icon-set mag alleen als dat zonder DOM-wijziging kan (bijv. via CSS) — anders emoji laten staan en er omheen ontwerpen.
5. **Eén bestand**: alle CSS staat in de `<style>`-blokken van `index.html`. Geen externe assets/fonts (behalve de al geladen Google Fonts: Orbitron + systeemfonts), geen CDN's.
6. **Toegankelijkheid**: hoge contrasten (donkere gym-omgeving, fel buitenlicht), grote cijfers voor gewichten, states duidelijk zichtbaar (actief/af/geskipt).

---

## 3. Navigatie

**Bottom-nav** (`.bottom-nav`, altijd zichtbaar) met 8 tabs: HOME 🏠 · SESSIE 💪 · COACH 🤖 · DOELEN 🎯 · THUIS 🛋️ · STATS 📊 · TIPS 📖 · INSTEL ⚙️. Actieve tab krijgt kleur + streepje. 8 tabs op 360 px is krap — mag visueel slimmer, maar het blijven 8 knoppen.

---

## 4. De schermen

### 4.1 Onboarding (`#view-onboarding`) — eenmalig
- App-titel "GYMWAVE" + tagline
- Grote knop "🚀 Start met standaardschema" + uitlegregel
- Kaart "zelf apparaten toevoegen": naamveld, aantal instellingen (0–6, genereert extra velden), startgewicht, KG/LBS-toggle, "+ Apparaat toevoegen"
- Lijst met toegevoegde apparaten, afgesloten met "Let's Go 🚀" (disabled tot er iets is)

### 4.2 Home (`#view-home`)
- Grote datum bovenaan
- **Twee hero-knoppen**: "🏋️ De Gym In" (groot, pulserend; wordt "Verder met je sessie ▶" bij lopende sessie) en "🏠 Thuis Gymmen" (omlijnde variant; wordt "Verder met thuis-workout ▶"); daaronder soms een extra ghost-knop ("Nieuwe sessie starten")
- Regel "Laatste sessie: …" + "🏠 Laatste thuis-workout: …"
- Twee stat-pills: SESSIES TOTAAL en KG GETILD TOTAAL (gym + thuis samen)
- Herstel-tijdlijn (spierherstel na de laatste sessie), doelen-blok, "beste tijdstip"-blok, weer-widget (via postcode)
- Ghost-knoppen naar calf raises-tracker en meenemen-checklist

### 4.3 Gym-sessie (`#view-session`) — het meest gebruikte scherm
- Header: sessienaam-invoerveld, 🔊/🔇 audio-coach-knop, voortgangstag "3 / 9"
- Hartslagbalk (Garmin, optioneel) en rusttimer-banner
- **Machine-kaartenlijst** (`.machine-card`), per kaart:
  - Dichtgeklapt: naam, hint (gewicht/standen, evt. 📸-icoon), status (✓ klaar / ⏭ overgeslagen)
  - Opengeklapt: groot gewichtsdisplay + kg-slider met stepper (−/+, klikt op de echte gewichtsstapel van het apparaat), sets/reps-steppers, set-rondjes om af te tikken, 5-kleuren **gevoelsschaal** (donkerrood→donkergroen "hoe voelde het gewicht?"), standen-instellingen met voorleesknop, "✅ Do's & don'ts"-uitklapper met 🔊-voorleesknoppen, geschiedenis (datum + gewicht + gevoelsstip + 🏆 PR), foto-vraag (📸 gewichtsstapel), tempo-metronoom, knoppen: Klaar / Overslaan / Opslaan / "📈 volgende keer zwaarder"
- Drukte-meter-kaart (1–5, klapt in na invullen)
- "Sessie afronden 🏁"-knop

### 4.4 Coach (`#view-coach`) — AI-chat
- Notitie/uitleg-blok, chatberichten-lijst, chips met voorbeeldvragen
- Invoerrij: 🎥-knop (foto/video-analyse), tekstveld, verstuurknop; "Gesprek wissen"

### 4.5 Doelen (`#view-goals`)
- Lijst actieve doelen (incl. type "revalidatie" met extra tips-blok)
- "+ Nieuw doel"-knop met uitklapformulier; lijst afgeronde doelen

### 4.6 Thuis (`#view-thuis`) — het thuisgym-menu
- **🏆 Beloningen**: uitleg, keuze-chips voor de actieve beloning (met ✕ verwijderen), **10 sterren** (☆ leeg → ★ gevuld, 1 per afgeronde workout), voortgangsregel, invoerveld "+ Toevoegen", uitklaplijst "🎁 Verdiend"
- **🍿 Beweegsnacks vandaag**: minuten-stepper, 🎲 shuffle, oefeningkaarten (zie 4.7 voor kaartopbouw)
- **🦵 Calf raises-tracker**: modus-keuze (2 benen/links/rechts), teller, PR's
- **🦿 Trainen met één been**, **📸 Benchmark-foto's**, **🧰 Wat heb je thuis?** (materiaal-checkboxes)
- **📈 Voortgang thuis-workouts**: waffle-blokjes per oefening (zie 4.9)

### 4.7 Thuis-workout (`#view-homeworkout`)
- Setup-kaart: tijd-stepper (min), "🎲 Ander voorstel", samenvattingsregel, materiaal-uitklapper, **"▶️ Start workout — oefeningen achter elkaar"**
- **Oefeningkaarten** (`.snack-card`), per kaart: naam + dosering (~min), focus/materiaal-tags, 🎥 Demo-video + 🔎 Video zoeken-knoppen, uitklapper "📋 Uitvoering, do's & don'ts" (3 bullet-secties + 🔊-voorleesknoppen), **🎯 Voorstel** ("3×10 @ 16 kg") met reps/kg-steppers, invoervelden reps/sec + kg, 5-kleuren gevoelsschaal, "Vorige: …"-regel met PR, duim-knoppen (👍 Vaker / ⭐ Elke keer / 👎 Niet meer), Afvinken-knop
- Voortgang-kaart onderaan ("3 van 8 afgevinkt"), "Workout afronden 🏁", "Workout wissen"
- **Reeks-speler** (vervangt de lijst na ▶️): kop "Oefening 3 van 8" + 🔊/🔇-knop, één grote oefeningkaart (zelfde elementen, uitvoering opengeklapt, ⏱-timer met countdown bij seconden-oefeningen), knoppen "✓ Klaar — volgende" / "⏭ Overslaan" / "⏹ Stop reeks"; eindkaart "🏁 Reeks klaar!"

### 4.8 Stats (`#view-stats`)
- **🏋️ GYM / 🏠 THUIS**-schakelaar (filter-pills)
- Periode-pills: WEEK / MAAND / 3 MAANDEN / AANGEPAST (+ datum-van/tot-kaart)
- "Totale voortgang": staafgrafiek (`.wave-chart`, geanimeerde balken met waarde + datum)
- "Voortgang per apparaat/oefening": **waffle-blokjes** per apparaat/oefening (kleurintensiteit = prestatie, ★ = mijlpaal/PR, legenda-regel)

### 4.9 Tips (`#view-tips`)
- "🗓️ Jouw ideale aanpak" (op basis van profiel), tips-kaarten per apparaat met 🔊 Do's/Don'ts-voorleesknoppen, algemene trainingstips

### 4.10 Meenemen (`#view-checklist`)
- Checklist-items met vinkjes (reset dagelijks), "Vinkjes nu wissen"

### 4.11 Instellingen (`#view-settings`)
- Thema-grid (5 thema-previews), apparaten beheren (lijst + bewerken + "+ toevoegen" + standaardschema herladen), audio-coach (aan/uit, intensiteit rustig/fanatiek/beest, 1×/2× voorlezen), 📍 sportschool (postcode voor het weer), Garmin & hartslag, AI-coach-instellingen, data export/import, cloud-sync, gevarenzone (alles wissen, rode stijl)

---

## 5. Overlays & feedback

- **Samenvattingsbord** (`#summary-modal`): "🏁 Sessie afgerond!", groot resultaat (kg of aantal oefeningen), subregel (naam · oefeningen · duur), ⭐-beloningsregel, **barchart van alle sessies** met stippellijn-referenties (gemiddeld / 30 dagen / vorige) + ▲/▼-delta's, "Naar Home 🏠"
- **Bevestigingsmodal** (`#modal`): titel, tekst, Annuleren/Bevestigen
- **Toast** (`#toast`): korte melding onderaan
- **Confetti** (`#confetti`): bij afronden van een workout
- **Rust-timer-banner** en **hartslagbalk** in de sessie

---

## 6. Gedeelde componenten (de eigenlijke design-bibliotheek)

| Component | Class | Gebruikt op |
|---|---|---|
| Kaart | `.card` | overal |
| Knoppen | `.btn` (+ `.ghost`, `.small`, `.full`, `.warn`), `.hero-btn` (+ `.hero-home`) | overal |
| Stat-pill | `.pill` + `.stat-num` | Home |
| Sectiekop | `.section-title` | overal |
| Filter/keuze-pills | `.filter-pills`, `.unit-toggle`, `.chip-row` | Stats, onboarding, coach |
| Stepper | `.stepper` (−/waarde/+) | sessie, thuis-workout |
| Gewicht-slider | `.weight-slider` + `.weight-display` | sessie |
| Set-rondjes | `.set-track` + `.set-dot` | sessie |
| Gevoelsschaal | `.feel-row` + `.feel-scale` + `.feel-btn` (5 kleuren) | sessie + thuis |
| Uitklapper | `details.tip` / `.inline-tip` | overal |
| Voorleesrij | `.speak-row` | sessie, thuis, tips |
| Oefeningkaart thuis | `.snack-card` (+ `.hw-done`) | thuis-workout, Thuis-tab |
| 🎯 Voorstel | `.hw-target` | thuis-workout |
| Timer | `.hw-timer-big` | reeks-speler |
| Beloning-chips + sterren | `.inc-chip`, `.inc-stars`, `.inc-star.full` | Thuis |
| Staafgrafiek | `.wave-chart` + `.wave-bar` | Stats |
| Waffle-voortgang | `.waffle` + `.waffle-cell` + `.star` | Stats, Thuis |
| Samenvattingsbord | `.ss-kg`, `.ss-bars`, `.ss-line`, `.ss-legend`, `.ss-delta` | summary-modal |
| Machine-kaart | `.machine-card` (+ `.open`, `.done`, `.skipped`) | sessie |
| Bottom-nav | `.bottom-nav` + `.nav-item` | altijd |

---

## 7. Designwensen

1. **Consistentie**: de app is in veel rondes gegroeid; spacing, kaart-stijlen en knop-hiërarchie mogen strakker en systematischer (één ritme voor marges, één schaal voor typografie).
2. **Hiërarchie per scherm**: het belangrijkste element moet meteen opvallen (Home: de twee hero-knoppen; sessie: gewicht + Klaar-knop; thuis-workout: voorstel + afvinken; speler: de actieve oefening).
3. **Voortgang laten vieren**: sterren, PR's, delta's en het samenvattingsbord zijn de emotionele kern — maak die momenten visueel het mooist.
4. **Leesbaarheid in de sportschool**: grote cijfers, hoog contrast, states in één oogopslag (klaar/open/geskipt, ster vol/leeg, gevoelskleuren).
5. **8 nav-tabs op 360 px**: mag visueel rustiger.
6. **De 5 thema's** mogen elk een eigen karakter houden; Synthwave is de standaard en verdient de meeste aandacht.
7. **Niet doen**: structuur wijzigen, id's/classes hernoemen, functionaliteit verbergen achter extra kliks, tekstgroottes verkleinen.

---

## 8. Aanleveren

Aanpassingen als CSS-wijzigingen binnen `index.html` (de `<style>`-blokken en het `THEMES`-object). Na elke wijziging draait de eigenaar de bestaande Playwright-testsuites (130+ checks) — die moeten groen blijven.
