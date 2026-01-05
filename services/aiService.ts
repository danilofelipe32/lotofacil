import { GoogleGenAI, Type } from "@google/genai";
import { Statistics, PredictionResult } from "../types";

/**
 * Motor Preditivo baseado no SDK oficial do Google Gemini.
 * Utiliza o modelo Gemini 3 Flash para análise estatística e geração de palpites.
 */
export const getSmartPrediction = async (stats: Statistics, recentGames: number[][]): Promise<PredictionResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const topTen = Object.entries(stats.frequency)
    .map(([num, count]) => ({ n: parseInt(num), c: count }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 10);

  const avgRepeats = stats.repeatsFromPrevious.length > 0 
    ? (stats.repeatsFromPrevious.reduce((a, b) => a + b, 0) / stats.repeatsFromPrevious.length).toFixed(1)
    : "9";

  const prompt = `Como um especialista em estatística da Lotofácil, analise estes dados e gere um palpite otimizado:
    - Dezenas frequentes: ${topTen.map(f => f.n).join(', ')}
    - Equilíbrio Par/Ímpar: ${stats.parity.even.toFixed(1)} pares / ${stats.parity.odd.toFixed(1)} ímpares.
    - Tendência de Soma: Média ${stats.sumAvg.toFixed(0)}
    - Média de repetições do concurso anterior: ${avgRepeats}
    - Últimos jogos: ${JSON.stringify(recentGames.slice(-2))}

    Gere EXATAMENTE 15 números únicos entre 1 e 25.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            numbers: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: "Array com exatamente 15 números únicos entre 1 e 25."
            },
            reasoning: {
              type: Type.STRING,
              description: "Breve explicação técnica do palpite."
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

    const result = JSON.parse(response.text || "{}");

    // Validação de segurança dos dados recebidos
    const numbers = [...new Set((result.numbers as number[] || []))].sort((a, b) => a - b);
    
    if (numbers.length !== 15 || numbers.some(n => n < 1 || n > 25)) {
      throw new Error("O motor de IA gerou um conjunto de dezenas inválido para as regras da Lotofácil.");
    }

    return {
      numbers,
      reasoning: result.reasoning || "Análise baseada em frequência e paridade histórica.",
      confidence: result.confidence || 0.8
    };

  } catch (error: any) {
    console.error("Erro no Gemini Service:", error);
    throw new Error("Falha ao processar análise inteligente. Verifique sua conexão ou tente novamente.");
  }
};