import OpenAI from "openai";

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
  newMessage: { author: string; text: string; imageUrl?: string }, // <--- Added imageUrl
  currentDraft: { revision: number; doc: DraftDoc }
) {
  const systemPrompt = `
    You are an expert herpetologist and veterinary AI assistant for 'Frog Social'.
    
    YOUR PRIME DIRECTIVE:
    1.  **Environment First:** Assume 90% of issues are husbandry-related (Temp, Humidity, Water).
    2.  **Visual Analysis:** If an image is provided, analyze it for physical signs: bloating (edema), redness (erythema), wounds, or abnormal posture.
    3.  **Missing Data:** Aggressively flag missing environmental parameters.

    Output JSON ONLY. Format:
    {
      "summary": "Medical summary including visual findings if any.",
      "extracted": {
        "visual_findings": ["List what you see in the photo"],
        "symptoms": ["List symptoms from text"],
        "parameters": {"temp": "value", "humidity": "value"},
        "species": "species",
        "potential_causes": ["Environmental first, then Pathogens"]
      },
      "highlights": ["Critical visual alerts", "Advice"]
    }
  `;

  // Build the message content (Text + Optional Image)
  const userMessageContent: any[] = [
    { type: "text", text: `Current Summary: ${currentDraft.doc.summary}\nNew Message from ${newMessage.author}: "${newMessage.text}"` }
  ];

  if (newMessage.imageUrl) {
    userMessageContent.push({
      type: "image_url",
      image_url: { url: newMessage.imageUrl }
    });
  }

  try {
    // Note: We use gpt-4o here because it has the best VISION. 
    // If your account is still restricted, it might fail (404), 
    // but gpt-4o is required for images. gpt-3.5 CANNOT see images.
    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessageContent },
      ],
      response_format: { type: "json_object" }, 
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || "{}");

    return {
      draft_revision: currentDraft.revision + 1,
      ...parsed, 
    };

  } catch (error: any) {
    console.error("OpenAI Error:", error);
    return {
      draft_revision: currentDraft.revision,
      summary: "⚠️ AI ERROR",
      extracted: { error: error.message, hint: "Did you use GPT-4o? GPT-3.5 cannot see images." },
      highlights: ["Check Logs"],
    };
  }
}
