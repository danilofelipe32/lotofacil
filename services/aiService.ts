import { Statistics, PredictionResult } from "../types";

/**
 * Motor Preditivo baseado na APIFreeLLM.
 * Realiza uma análise estatística avançada para gerar palpites da Lotofácil via Chat Completion.
 */
export const getSmartPrediction = async (stats: Statistics, recentGames: number[][]): Promise<PredictionResult> => {
  const url = 'https://apifreellm.com/api/chat';
  
  const topTen = Object.entries(stats.frequency)
    .map(([num, count]) => ({ n: parseInt(num), c: count }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 10);

  // Prompt estruturado para forçar o retorno JSON sem a necessidade de Schema nativo
  const prompt = `Atue como um analista estatístico especializado em Lotofácil. Analise os seguintes dados:
  - Dezenas com maior frequência: ${topTen.map(f => f.n).join(', ')}
  - Equilíbrio histórico: Pares (Média: ${stats.parity.even.toFixed(1)}), Ímpares (Média: ${stats.parity.odd.toFixed(1)})
  - Tendência de Soma: Média de ${stats.sumAvg.toFixed(1)}
  - Últimos sorteios: ${JSON.stringify(recentGames.slice(-2))}

  Gere um palpite de exatamente 15 números únicos (1-25).
  Retorne EXCLUSIVAMENTE um objeto JSON no formato abaixo, sem texto adicional:
  {
    "numbers": [15 números únicos],
    "reasoning": "explicação técnica breve",
    "confidence": 0.85
  }`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ message: prompt })
    });

    if (!response.ok) {
      throw new Error(`Erro na APIFreeLLM: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // A APIFreeLLM geralmente retorna o conteúdo em 'response' ou 'message'
    const rawContent = data.response || data.message || "";
    
    if (!rawContent) {
      throw new Error("Resposta vazia recebida do servidor de IA.");
    }

    // Extração robusta de JSON do corpo da resposta (limpa markdown e textos extras)
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("A IA não retornou um formato de dados válido.");
    }

    const result = JSON.parse(jsonMatch[0]);

    // --- VALIDAÇÕES ---
    
    const rawNumbers: any[] = Array.isArray(result.numbers) ? result.numbers : [];
    const processedNumbers: number[] = [...new Set(rawNumbers.map(n => Number(n)))]
      .filter((n: number) => !isNaN(n) && Number.isInteger(n) && n >= 1 && n <= 25)
      .sort((a: number, b: number) => a - b);

    if (processedNumbers.length !== 15) {
      throw new Error(`O motor gerou ${processedNumbers.length} dezenas, mas são necessárias exatamente 15.`);
    }

    if (typeof result.reasoning !== 'string' || result.reasoning.length < 5) {
      throw new Error("Justificativa técnica inválida ou ausente.");
    }

    return {
      numbers: processedNumbers,
      reasoning: result.reasoning.trim(),
      confidence: typeof result.confidence === 'number' ? Math.min(Math.max(result.confidence, 0), 1) : 0.75
    };

  } catch (error: any) {
    console.error("Erro no Processamento AI (APIFreeLLM):", error);
    throw new Error(error.message || "Falha na comunicação com o motor de inteligência.");
  }
};