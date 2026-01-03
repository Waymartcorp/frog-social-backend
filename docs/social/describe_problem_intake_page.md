# Describe-a-Problem / New Case Intake Page

Goal: This page is the main *structured* intake into Frog Social. It captures a snapshot
of the colony, creates a new Case, and gives users a first AI-generated framing:
- Situation summary
- Husbandry focus areas
- Suggested next steps (non-diagnostic)
- When to escalate to vets

This page must feed the same data into:
- Case history
- Social stream / thread
- Future video-analysis pipeline

## Overall layout

Keep the two-column layout:

- **Left column** – user inputs (form)
- **Right column** – generated AI outputs:
  - Situation summary
  - Husbandry focus areas
  - Suggested next steps
  - When to escalate

We are *extending* the left column, not redesigning the whole page.

---

## Left Column Sections & Fields

### 1. Colony & system (keep)

- Colony / room name (optional, text)
- Institution / lab (optional, text)
- System type (select: recirculating rack, static tanks, flow-through, etc.)
- Approximate number of frogs (numeric or free text)

### 2. Water snapshot (keep, align with husbandry logic)

- Water temperature (°C)
- pH
- Conductivity / salts (µS or ppm, optional)
- Ammonia (NH3/NH4) status – select:
  - Unknown / not tested
  - Within acceptable range
  - Elevated / concerning

Include a small link: **“Water help: ROBUFFER formula & mixing guide”**.

### 3. Recent changes (keep)

- Recent changes (last 2–4 weeks) – free text textarea.

### 4. Husbandry snapshot (NEW)

Add a section **“Husbandry snapshot (how things look right now)”**.

Fields (all optional but encouraged):

- **Density in the tank**  
  `Low`, `Medium`, `High`, `Not sure`

- **Feeding vigor (last few feedings)**  
  `Low (slow, many frogs ignore food)`,  
  `Medium (most respond, some slow)`,  
  `High (rapid, competitive feeding)`,  
  `Not sure`

- **Skin condition**  
  `Shiny / smooth`, `Dull`, `Lesions / redness`, `Not sure`

- **Room vibration / noise**  
  `Quiet`, `Some hum`, `Loud / constant`, `Not sure`

- **Flow & splash from inlets**  
  `Gentle, no splash`, `Splashy / noisy`, `Not sure`

- **Room disturbance**  
  `Rare`, `Moderate`, `Constant traffic`, `Not sure`

- **pH meter calibration**  
  `Recently calibrated`, `Not calibrated recently`, `Not sure`

These should go into the intake payload as a structured “husbandry snapshot”.

### 5. Feeding behavior video (NEW)

Section title: **“Feeding behavior video (optional)”**.

#### 5.1 Video upload

- File input  
- Label: `Upload short feeding clip (30–60 seconds)`  
- Accept: `video/mp4, video/quicktime, video/webm`  

Helper text:  
`This helps compare your feeding response to internal reference videos. Start recording, add food, and keep filming until frogs either lose interest or food is gone.`

The frontend will later:
- Upload the video to storage and
- Store a `feedingVideoUrl` on the case.

#### 5.2 Video metadata

Three small selects:

- **Time since last feeding**  
  `12–24 hours`, `24–48 hours`, `>48 hours`, `Not sure`

- **Density in this tank (for the video)**  
  `Low`, `Medium`, `High`, `Not sure`

- **Camera position**  
  `Top`, `Side`, `Angled`, `Not sure`

---

## Right Column (AI outputs)

Keep existing sections:

1. Situation summary  
2. Husbandry focus areas  
3. Suggested next steps  
4. When to escalate  

But make sure the prompt uses:

- Colony & water data  
- **Husbandry snapshot** fields  
- **Feeding video metadata** (and eventually the `feedingVideoUrl` flag)

Behavior:

- Non-diagnostic, **husbandry-first**.
- Explicitly grounded in the “13 points” from `docs/husbandry/husbandry_master_key.md`.
- Example:  
  “Given low density and low feeding vigor, consider temporarily increasing density in a test tank and observing appetite over several feedings.”
