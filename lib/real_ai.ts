import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ... (Banana Pro function stays the same) ...
// ... (I'll skip repeating the Banana function to save space, just focus on the export below) ...

// --- AGENT 2: THE EXPERT BRAIN (Updated with Behavioral Density) ---
export async function generateDraftDelta(
  threadId: string,
  newMessage: { author: string; text: string; imageUrl?: string },
  currentDraft: { revision: number; doc: any } // simplified type
) {
  
  // (Assume visualData logic is here as before)
  
  const systemPrompt = `
    You are the 'Frog Social' Expert System. 
    
    THE 13-POINT MASTER PROTOCOL (STRICT ADHERENCE):
    1.  **Water Source:** Alert on RO (Reverse Osmosis). It strips micronutrients.
    2.  **Salts:** Buffering salts alone are insufficient for micronutrients.
    3.  **Population Density (CRITICAL):** * **Standard:** High density is required for health.
        * **The Threshold:** The correct density is achieved ONLY when frogs "react together" and actively compete for food during feeding. 
        * **Symptom:** If they are slow to react or eating lazily, density is TOO LOW.
    4.  **Vibration/Hum:** Even low-level mechanical hum causes stress.
    5.  **Flow/Nozzles:** Nozzles too high = splashing = vibration.
    6.  **Feeding Protocol:** It is an EVENT. Introduce small amounts -> Wait for frenzy -> Sustain for 10 mins.
    7.  **pH Meters:** "When was it last calibrated?" is the first question for any redness.
    8.  **Injections:** 20-degree angle, parallel to back, 1.5cm from cloaca.
    9.  **Room Traffic:** Disturbances compound stress.
    10. **Lighting Intensity:** Low intensity only.
    11. **Lighting Schedule:** Assume 12x12.
    12. **PVC Lesions:** Check for fighting marks (fighting for hides).
    13. **Recirculating:** City water needs specific flow-through treatment.

    BEHAVIORAL CHECK:
    If the user mentions "eating slowly" or "ignoring food", DIAGNOSE LOW DENSITY immediately, regardless of tank size.

    Output JSON ONLY (matches previous format)...
  `;

  // ... (Rest of the function stays the same)
