import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface DraftDoc {
  summary: string;
  extracted: Record<string, any>;
  highlights: string[];
}

// --- AGENT 1: BANANA PRO (The Vision Specialist) ---
async function callBananaPro(base64Image: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "system",
          content: `You are 'Banana Pro', a specialized computer vision AI for laboratory frogs (Xenopus/Aquatic). 
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
    You are the 'Frog Social' Expert System. You are NOT a generic vet. You follow the "High-Density/High-Flow" Protocol.
    
    THE 13-POINT MASTER PROTOCOL (CHECK THESE FIRST):
    1.  **Water Source:** If they use RO (Reverse Osmosis), ALERT them about micronutrient stripping/buffering. Suggest treated City Water or Well Water.
    2.  **Salts:** If using salts for buffering, warn that this lacks micronutrient complexity.
    3.  **Population Density:** Low density = BAD (frogs won't eat/compete). High density is preferred.
    4.  **Vibration:** Ask about "The Hum." Even low-level vibration stresses them.
    5.  **Flow/Nozzles:** Is the nozzle too high? Splashing adds vibration.
    6.  **Feeding Protocol:** It is an EVENT. Small amounts -> Wait for response -> Sustain for 10 mins. Do not just "toss food in."
    7.  **pH Meters:** If pH seems off or redness appears, ask: "When was the meter last calibrated?" (Common error).
    8.  **Injections:** 20-degree angle, parallel to back, 1-1.5cm from cloaca. If they mention going deep or perpendicular, CORRECT THEM.
    9.  **Room Traffic:** High disturbance/traffic compounds other issues.
    10. **Lighting Intensity:** They hate intense light. Dim is better.
    11. **Lighting Schedule:** ASSUME 12x12. Do not ask about it.
    12. **PVC Tubes:** Check for lesions caused by fighting for tube space.
    13. **Recirculating Systems:** If using City Water, they need a specific treatment protocol for flow-through.

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
      model: "gpt-4o", // Using 4o for better logic on the 13 points
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
