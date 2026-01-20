import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AnalysisResult {
  category: string;
  color: string;
  season: string;
  description: string;
  brand_guess: string | null;
}

export async function analyzeClothingImage(base64Image: string): Promise<AnalysisResult> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a fashion expert that analyzes clothing images.
Analyze the clothing item and return a JSON object with the following fields:
- category: One of "Top", "Bottom", "Outerwear", "Shoes", "Accessory", "Other"
- color: Primary color (e.g., "Black", "White", "Navy", "Blue", "Green", "Brown", "Beige", "Gray")
- season: One of "All", "Spring", "Summer", "Autumn", "Winter"
- description: Brief description of the item in Japanese (e.g., "ボーダー柄の長袖Tシャツ")
- brand_guess: Guessed brand name if recognizable, otherwise null

Respond ONLY with valid JSON, no additional text.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          },
          {
            type: 'text',
            text: 'Analyze this clothing item.',
          },
        ],
      },
    ],
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content || '{}';

  try {
    // Remove markdown code blocks if present
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return {
      category: 'Other',
      color: 'Unknown',
      season: 'All',
      description: 'Unable to analyze',
      brand_guess: null,
    };
  }
}
