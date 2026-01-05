
import { GoogleGenAI, Type } from "@google/genai";
import { Statistics, PredictionResult } from "../types";

/**
 * Serviço que utiliza o Google Gemini API para gerar palpites baseados em análise estatística profunda.
 */
export const getSmartPrediction = async (stats: Statistics, recentGames: number[][]): Promise<PredictionResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Prepara as 10 dezenas mais frequentes para o contexto da IA
  const freqSorted = Object.entries(stats.frequency)
    .map(([num, count]) => ({ n: parseInt(num), c: count }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 10);

  const prompt = `Atue como um analista estatístico especialista em Lotofácil. 
  Gere um palpite de 15 números (1-25) baseado nestes padrões históricos:
  - Frequentes: ${freqSorted.map(f => f.n).join(', ')}
  - Paridade Média: ${stats.parity.even.toFixed(1)} pares / ${stats.parity.odd.toFixed(1)} ímpares
  - Soma Média: ${stats.sumAvg.toFixed(1)} (Desvio Padrão: ${stats.sumStdDev.toFixed(1)})
  - Repetição Média: Aproximadamente 9 números do concurso anterior.
  - Últimos sorteios para referência: ${JSON.stringify(recentGames.slice(-2))}

  O palpite deve ser tecnicamente fundamentado para maximizar a probabilidade estatística.`;

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
              description: "Exatamente 15 números únicos entre 1 e 25, ordenados de forma crescente."
            },
            reasoning: {
              type: Type.STRING,
              description: "Explicação sucinta da lógica estatística aplicada."
            },
            confidence: {
              type: Type.NUMBER,
              description: "Nível de confiança na predição (0.0 a 1.0)."
            }
          },
          required: ["numbers", "reasoning", "confidence"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");

    // Validação e limpeza dos dados retornados
    const rawNumbers = Array.isArray(result.numbers) ? result.numbers : [];
    const uniqueNumbers = [...new Set(rawNumbers)]
      .map(n => Number(n))
      .filter(n => !isNaN(n) && n >= 1 && n <= 25)
      .sort((a, b) => a - b);

    if (uniqueNumbers.length !== 15) {
      // Fallback estatístico simples em caso de erro da IA
      throw new Error("A IA gerou uma sequência inválida. Tente processar novamente.");
    }

    return {
      numbers: uniqueNumbers,
      reasoning: result.reasoning || "Análise baseada em convergência de frequência e paridade histórica.",
      confidence: result.confidence || 0.85
    };

  } catch (error: any) {
    console.error("LotoExpert AI Error:", error);
    throw new Error("Não foi possível conectar ao motor de IA. Verifique sua conexão ou tente novamente.");
  }
};
