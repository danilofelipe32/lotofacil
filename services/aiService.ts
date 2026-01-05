import { GoogleGenAI, Type } from "@google/genai";
import { Statistics, PredictionResult } from "../types";

/**
 * Motor Preditivo baseado no SDK oficial do Google Gemini.
 * Utiliza o modelo Gemini 3 Flash para análise estatística e geração de palpites.
 */
export const getSmartPrediction = async (stats: Statistics, recentGames: number[][]): Promise<PredictionResult> => {
  // Inicialização dentro da função para garantir o acesso correto às variáveis de ambiente no browser
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const topTen = Object.entries(stats.frequency)
    .map(([num, count]) => ({ n: parseInt(num), c: count }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 10);

  const avgRepeats = stats.repeatsFromPrevious.length > 0 
    ? (stats.repeatsFromPrevious.reduce((a, b) => a + b, 0) / stats.repeatsFromPrevious.length).toFixed(1)
    : "9";

  const prompt = `Atue como um Analista Estatístico Sênior especializado na Lotofácil.
Analise os padrões históricos fornecidos e gere um palpite estratégico:

DADOS ESTATÍSTICOS:
- Dezenas com maior frequência (Top 10): ${topTen.map(f => f.n).join(', ')}
- Distribuição de Paridade: Média de ${stats.parity.even.toFixed(1)} pares e ${stats.parity.odd.toFixed(1)} ímpares.
- Tendência de Soma: A média atual das somas é ${stats.sumAvg.toFixed(0)}.
- Ciclo de Repetição: Historicamente repetem-se ${avgRepeats} dezenas do último sorteio.
- Resultados Recentes: ${JSON.stringify(recentGames.slice(-2))}

REGRAS DO PALPITE:
1. Gere EXATAMENTE 15 números únicos.
2. Os números devem estar entre 01 e 25.
3. Priorize o equilíbrio estatístico (ex: 7-8 ou 8-7 pares/ímpares).
4. Evite sequências longas de mais de 4 números.

Retorne obrigatoriamente um JSON.`;

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
              description: "Lista de 15 dezenas únicas sugeridas."
            },
            reasoning: {
              type: Type.STRING,
              description: "Justificativa estatística do palpite."
            },
            confidence: {
              type: Type.NUMBER,
              description: "Grau de probabilidade técnica (0.0 a 1.0)."
            }
          },
          required: ["numbers", "reasoning", "confidence"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("A IA retornou uma resposta vazia.");
    
    const result = JSON.parse(text);

    // Validação rigorosa dos números retornados
    const uniqueNumbers = [...new Set((result.numbers as number[] || []))].sort((a, b) => a - b);
    
    if (uniqueNumbers.length !== 15 || uniqueNumbers.some(n => n < 1 || n > 25)) {
      console.error("Palpite inválido gerado pela IA:", uniqueNumbers);
      throw new Error("O motor de análise gerou um palpite fora das regras oficiais (15 dezenas entre 1 e 25).");
    }

    return {
      numbers: uniqueNumbers,
      reasoning: result.reasoning || "Baseado em tendências de paridade e soma média.",
      confidence: result.confidence || 0.85
    };

  } catch (error: any) {
    console.error("AI Service Error:", error);
    if (error.message?.includes("API key")) {
      throw new Error("Erro de autenticação: Chave de API não configurada corretamente.");
    }
    throw new Error("Não foi possível gerar o palpite inteligente. Verifique os dados importados.");
  }
};