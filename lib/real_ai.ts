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
  const systemPrompt = `
    You are an expert herpetologist and veterinary AI assistant for 'Frog Social'.
    Your goal is to extract structured medical data from a conversation about frogs.
    
    Output JSON ONLY. Format:
    {
      "summary": "Current medical summary of the situation",
      "extracted": {
        "symptoms": ["list", "of", "symptoms"],
        "parameters": {"temp": "value", "ph": "value", "ammonia": "value"},
        "species": "frog species if known"
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
    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" }, 
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || "{}");

    return {
      draft_revision: currentDraft.revision + 1,
      ...parsed, 
    };

  } catch (error) {
    console.error("OpenAI Error:", error);
    // Fallback if AI fails: just return old state
    return {
      draft_revision: currentDraft.revision,
      summary: currentDraft.doc.summary,
      extracted: currentDraft.doc.extracted,
      highlights: currentDraft.doc.highlights,
    };
  }
}
