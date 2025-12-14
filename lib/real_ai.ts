import OpenAI from "openai";

// Initialize OpenAI with the key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface DraftDoc {
  summary: string;
  extracted: Record<string, any>;
  highlights: string[];
}

export async function generateDraftDelta(
  threadId: string,
  newMessage: { author: string; text: string },
  currentDraft: { revision: number; doc: DraftDoc }
) {
  // 1. "Husbandry First" Philosophy Prompt
  const systemPrompt = `
    You are an expert herpetologist and veterinary AI assistant for 'Frog Social'.
    
    YOUR PRIME DIRECTIVE:
    1.  **Environment First:** You MUST assume 90% of health issues are caused by incorrect husbandry (Temperature, Humidity, Water Quality, Diet).
    2.  **Verify Parameters:** Before suggesting medication or pathogens, you must aggressively verify the user's environmental parameters. If they are missing, list them as "MISSING DATA".
    3.  **The "Banana" Goal:** Your goal is to gather data to eventually help an image-analysis AI diagnose the frog.

    Output JSON ONLY. Format:
    {
      "summary": "Current medical summary of the situation",
      "extracted": {
        "symptoms": ["list", "of", "symptoms"],
        "parameters": {"temp": "value", "ph": "value", "ammonia": "value"},
        "species": "frog species if known",
        "potential_causes": ["List environmental causes first"]
      },
      "highlights": ["Critical alert 1", "Advice 1"]
    }
  `;

  const userContent = `
    Current Summary: ${currentDraft.doc.summary}
    New Message from ${newMessage.author}: "${newMessage.text}"
    
    Update the summary and extracted data based on this new information.
  `;

  try {
    // 2. Call OpenAI (Using gpt-3.5-turbo for reliability/speed)
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", 
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" }, 
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || "{}");

    // 3. Success: Return the new data
    return {
      draft_revision: currentDraft.revision + 1,
      ...parsed, 
    };

  } catch (error: any) {
    console.error("OpenAI Error:", error);

    // 4. DEBUG MODE: If it fails, send the error to the frontend!
    return {
      draft_revision: currentDraft.revision,
      summary: "⚠️ AI CONNECTION ERROR",
      extracted: {
        error_type: error.name || "Unknown Error",
        error_message: error.message || "No message provided",
        suggestion: "Check Render Logs or OpenAI Billing",
      },
      highlights: ["System Error", "Check OpenAI Key"],
    };
  }
}
