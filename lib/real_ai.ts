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
          4. Redness: Look for 'Red Leg' symptoms.
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

// --- AGENT 2: THE EXPERT BRAIN (Your 13-Point Protocol) ---
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
    You are the 'Frog Social' Expert System. You are NOT a generic vet. 
    
    THE 13-POINT MASTER PROTOCOL (STRICT ADHERENCE):
    1.  **Water Source:** Alert on RO (Reverse Osmosis). It strips micronutrients.
    2.  **Salts:** Buffering salts alone are insufficient for micronutrients.
    3.  **Population Density (CRITICAL):** * **Standard:** High density is required for health.
        * **The Threshold:** The correct density is achieved ONLY when frogs "react together" and actively compete for food during feeding. 
        * **Diagnostic:** If user mentions "slow eating", "lazy feeding", or "ignoring food", DIAGNOSE LOW DENSITY/COMPETITION immediately.
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

    INPUTS:
    - User Text: "${newMessage.text}"
    - Visual Analysis: ${JSON.stringify(visualData.visual_findings)}
    
    Output JSON ONLY. Format:
    {
      "summary": "Synthesized summary.",
      "extracted": {
        "visual_findings": ["From Banana Pro"],
        "symptoms": ["From text"],
        "protocol_violations": ["List which of the 13 rules were broken"],
        "potential_causes": ["Link symptoms to the 13 rules"],
        "suggested_questions": ["What to ask the user next based on the protocol"]
      },
      "highlights": ["Critical alerts (e.g. 'RO Water Detected', 'Injection Angle Wrong')"]
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
