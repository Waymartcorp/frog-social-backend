import { ROBUFFER_RECIPE } from './protocols';
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface DraftDoc {
  summary: string;
  extracted: Record<string, any>;
  highlights: string[];
}

// --- AGENT 1: BANANA PRO (Vision) ---
async function callBananaPro(base64Image: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "system",
          content: `You are 'Banana Pro', a specialized computer vision AI for laboratory frogs (Xenopus). 
          Your ONLY job is to list physical attributes. 
          Specific checks:
          1. Population Density: Does the tank look crowded (Good) or sparse (Bad)?
          2. PVC Lesions: Look for scrapes/wounds on backs/noses from fighting for tubes.
          3. Injection Sites: If visible, does the injection look correct (1.5cm from cloaca)?
          4. Redness: Look for 'Red Leg' symptoms (erythema on legs/belly).
          Output JSON: { "visual_findings": ["list", "of", "findings"] }`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this frog environment:" },
            { type: "image_url", image_url: { url: base64Image } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });
    const content = response.choices[0].message.content;
    return JSON.parse(content || "{}");
  } catch (err) {
    console.error("Banana Pro Failed:", err);
    return { visual_findings: ["Error: Vision System Offline"] };
  }
}

// --- AGENT 2: THE EXPERT BRAIN (13-Point Protocol + ROBUFFER) ---
export async function generateDraftDelta(
  threadId: string,
  newMessage: { author: string; text: string; imageUrl?: string },
  currentDraft: { revision: number; doc: DraftDoc }
) {
  
  let visualData = { visual_findings: [] as string[] };
  if (newMessage.imageUrl) {
    visualData = await callBananaPro(newMessage.imageUrl);
  }

  const systemPrompt = `
    You are the 'Frog Social' Expert System. You act as a Senior Lab Technician—authoritative but helpful.
    
    THE 13-POINT MASTER PROTOCOL (STRICT ADHERENCE):

    1.  **Water Source (CRITICAL UPDATE):** * **Problem:** Reverse Osmosis (RO) or DI water strips micronutrients and lacks buffering.
        * **The Fix (ROBUFFER™ Protocol):** If user mentions RO/DI, you MUST prescribe this recipe per 100 Liters:
            - 5g Calcium chloride dihydrate (CaCl2·2H2O)
            - 2.5g Magnesium sulfate heptahydrate (Epsom salt)
            - 3.5g Sodium bicarbonate (Baking soda)
            - *NOTE: This is IN ADDITION to the standard salt mix.*
            - Target: GH ~4-10 dGH, KH ~3-8 dKH, pH 7.2-7.6.

    2.  **Salts:** Buffering salts alone are insufficient without the Calcium/Magnesium backbone above.
    3.  **Population Density (Behavioral Check):** * **Standard:** Density that promotes some competition is required for health.
        * **The Threshold:** Correct density is achieved ONLY when frogs "react together" and actively compete for food (Frenzy). 
        * **Diagnostic:** If "slow eating", "lazy feeding", or "ignoring food" is detected (via text or video analysis), DIAGNOSE LOW DENSITY/COMPETITION immediately.
    4.  **Vibration/Hum:** Even low-level mechanical hum causes stress (Listen for pump noise in descriptions).
    5.  **Flow/Nozzles:** Nozzles too high = splashing = vibration.
    6.  **Feeding Protocol:** It is an EVENT. Introduce small amounts -> Wait for frenzy -> Sustain for 10 mins.
    7.  **pH Meters:** "When was it last calibrated?" is the first question for any redness.
    8.  **Injections:** 20-degree angle, parallel to back, 1.5cm from cloaca.
    9.  **Room Traffic:** Disturbances compound stress.
    10. **Lighting Intensity:** Low intensity only.
    11. **Lighting Schedule:** Assume 12x12.
    12. **PVC Lesions:** Check for fighting marks (fighting for hides).
    13. **Recirculating:** City water needs specific flow-through treatment.

    INPUTS:
    - User Text: "${newMessage.text}"
    - Visual Analysis: ${JSON.stringify(visualData.visual_findings)}
    
    Output JSON ONLY. Format:
    {
      "summary": "Synthesized summary (Mention ROBUFFER if RO is detected).",
      "extracted": {
        "visual_findings": ["From Banana Pro"],
        "symptoms": ["From text"],
        "protocol_violations": ["List which of the 13 rules were broken"],
        "potential_causes": ["Link symptoms to the 13 rules"],
        "suggested_questions": ["What to ask the user next"]
      },
      "highlights": ["Critical alerts (e.g. 'RO Water Detected - Apply ROBUFFER', 'Low Feeding Response')"]
    }
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Current Draft: ${JSON.stringify(currentDraft.doc.extracted)}\nUpdate based on new inputs.` 
        },
      ],
      response_format: { type: "json_object" }, 
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || "{}");

    return {
      draft_revision: currentDraft.revision + 1,
      ...parsed, 
      extracted: { ...parsed.extracted, visual_findings: visualData.visual_findings }
    };

  } catch (error: any) {
    return {
      draft_revision: currentDraft.revision,
      summary: "⚠️ LOGIC CORE ERROR",
      extracted: { error: error.message },
      highlights: ["Check OpenAI"],
    };
  }
}
