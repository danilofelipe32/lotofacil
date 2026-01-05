
import { Statistics, PredictionResult } from "../types";

/**
 * Serviço que utiliza a APIFreeLLM para gerar palpites baseados em análise estatística profunda.
 * A API requer headers específicos e o corpo da mensagem em formato JSON.
 */
export const getSmartPrediction = async (stats: Statistics, recentGames: number[][]): Promise<PredictionResult> => {
  // Prepara as 10 dezenas mais frequentes para o prompt
  const freqSorted = Object.entries(stats.frequency)
    .map(([num, count]) => ({ n: parseInt(num), c: count }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 10);

  // Constrói um prompt rico em dados estatísticos
  const prompt = `Atue como um analista estatístico especialista em Lotofácil.
DADOS DO HISTÓRICO:
- Dezenas mais frequentes: ${freqSorted.map(f => f.n).join(', ')}
- Equilíbrio Par/Ímpar (Média): ${stats.parity.even.toFixed(1)} pares / ${stats.parity.odd.toFixed(1)} ímpares
- Soma Média dos jogos: ${stats.sumAvg.toFixed(1)}
- Desvio Padrão das somas: ${stats.sumStdDev.toFixed(1)}
- Últimos 2 jogos realizados: ${JSON.stringify(recentGames.slice(-2))}

OBJETIVO:
Gere um palpite de 15 números (1 a 25) que respeite a tendência de soma média e o equilíbrio de paridade encontrado no histórico.

REGRAS DE RESPOSTA:
1. Retorne EXCLUSIVAMENTE um objeto JSON.
2. Formato do JSON: {"numbers": [15 números únicos ordenados], "reasoning": "Breve explicação técnica", "confidence": 0.0 a 1.0}
3. Não use blocos de código markdown na resposta final se possível, mas se usar, garanta que seja um JSON válido.`;

  try {
    const response = await fetch('https://apifreellm.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        message: prompt
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Muitas requisições. Aguarde 5 a 10 segundos antes de tentar novamente.");
      }
      throw new Error(`Erro na conexão com o servidor de IA (${response.status}).`);
    }

    const data = await response.json();

    if (data.status === 'error') {
      throw new Error(data.error || "Falha na resposta da API.");
    }

    if (!data.response) {
      throw new Error("A IA não retornou um palpite válido.");
    }

    // Limpeza da resposta para garantir extração do JSON
    let cleanText = data.response.trim();
    
    // Remove blocos de código Markdown se existirem
    if (cleanText.includes('```')) {
      cleanText = cleanText.replace(/```json|```/g, '').trim();
    }
    
    // Localiza o início e fim do objeto JSON
    const startIdx = cleanText.indexOf('{');
    const endIdx = cleanText.lastIndexOf('}');
    
    if (startIdx === -1 || endIdx === -1) {
      console.error("Texto recebido da IA:", cleanText);
      throw new Error("O motor de IA retornou um formato ilegível. Tente novamente.");
    }

    const jsonStr = cleanText.substring(startIdx, endIdx + 1);
    const result = JSON.parse(jsonStr);

    // Validação das dezenas geradas
    const rawNumbers = Array.isArray(result.numbers) ? result.numbers : [];
    const uniqueNumbers = [...new Set(rawNumbers)]
      .map(n => Number(n))
      .filter(n => !isNaN(n) && n >= 1 && n <= 25)
      .sort((a, b) => a - b);

    if (uniqueNumbers.length !== 15) {
      throw new Error("A IA gerou uma quantidade inválida de dezenas. Por favor, tente processar novamente.");
    }

    return {
      numbers: uniqueNumbers,
      reasoning: result.reasoning || "Análise baseada em convergência estatística e tendências de paridade.",
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.85
    };

  } catch (error: any) {
    console.error("LotoExpert AI Error:", error);
    if (error instanceof SyntaxError) {
      throw new Error("Erro de processamento: A IA retornou dados malformados. Tente novamente.");
    }
    throw error;
  }
};
