
import { GoogleGenAI, Type } from "@google/genai";
import { Statistics, PredictionResult } from "../types";

export const getSmartPrediction = async (stats: Statistics, recentGames: number[][]): Promise<PredictionResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Prepare a condensed summary for the AI
  const freqSorted = Object.entries(stats.frequency)
    .map(([num, count]) => ({ num: parseInt(num), count }))
    .sort((a, b) => b.count - a.count);

  const prompt = `
    Analise os seguintes dados estatísticos de sorteios passados da Lotofácil (1-25 dezenas, sorteia 15):
    - Dezenas mais frequentes: ${JSON.stringify(freqSorted.slice(0, 10))}
    - Dezenas menos frequentes: ${JSON.stringify(freqSorted.slice(-5))}
    - Média de Pares: ${stats.parity.even.toFixed(1)}
    - Média de Ímpares: ${stats.parity.odd.toFixed(1)}
    - Soma média: ${stats.sumAvg.toFixed(1)}
    - Últimos 3 jogos reais: ${JSON.stringify(recentGames.slice(-3))}

    REGRAS CRÍTICAS:
    1. Gere um palpite de EXATAMENTE 15 dezenas ÚNICAS entre 01 e 25.
    2. O palpite DEVE ser inédito (não pode ser uma repetição exata de jogos passados).
    3. Mantenha o equilíbrio estatístico (geralmente entre 7-9 ímpares e soma entre 160-220).
    4. Forneça uma justificativa técnica curta.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          numbers: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: "A lista de 15 dezenas sugeridas."
          },
          reasoning: {
            type: Type.STRING,
            description: "A justificativa técnica para a escolha."
          },
          confidence: {
            type: Type.NUMBER,
            description: "Nível de confiança estatística de 0 a 1."
          }
        },
        required: ["numbers", "reasoning", "confidence"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '{}');
    // Fix: Use a type guard (n is number) to narrow the array type to number[]
    // This resolves the arithmetic operation error in sort() and the assignment error to PredictionResult.numbers
    const uniqueNumbers = [...new Set((data.numbers || []) as any[])]
      .filter((n): n is number => typeof n === 'number' && n >= 1 && n <= 25)
      .sort((a, b) => a - b);

    return {
      numbers: uniqueNumbers,
      reasoning: data.reasoning || "Sem justificativa técnica disponível.",
      confidence: typeof data.confidence === 'number' ? data.confidence : 0
    };
  } catch (error) {
    console.error("Failed to parse Gemini response", error);
    throw new Error("Erro ao processar palpite da IA.");
  }
};
