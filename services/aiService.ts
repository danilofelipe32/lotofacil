
import { Statistics, PredictionResult } from "../types";

/**
 * Serviço que utiliza a APIFreeLLM para gerar palpites baseados em análise estatística.
 * Nota: A API tem um rate limit de 1 requisição a cada 5 segundos.
 */
export const getSmartPrediction = async (stats: Statistics, recentGames: number[][]): Promise<PredictionResult> => {
  const freqSorted = Object.entries(stats.frequency)
    .map(([num, count]) => ({ n: parseInt(num), c: count }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 10);

  const prompt = `Analise estatisticamente a Lotofácil:
- Dezenas Top 10: ${freqSorted.map(f => f.n).join(',')}
- Média Par/Ímpar: ${stats.parity.even.toFixed(1)}/${stats.parity.odd.toFixed(1)}
- Soma Média: ${stats.sumAvg.toFixed(1)}
- Últimos Jogos: ${JSON.stringify(recentGames.slice(-2))}

REGRAS OBRIGATÓRIAS:
1. Gere 15 números ÚNICOS (1-25).
2. Retorne APENAS um objeto JSON válido.
3. Formato: {"numbers": [15 números], "reasoning": "texto curto", "confidence": 0.85}
4. Não inclua Markdown ou textos fora do JSON.`;

  try {
    const response = await fetch('https://apifreellm.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // User-Agent realista para evitar bloqueio 403 do Cloudflare conforme documentação
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        message: prompt
      })
    });

    const data = await response.json();

    if (data.status === 'error') {
      if (data.error?.includes('Rate limit')) {
        throw new Error("Limite de requisições atingido. Aguarde 5 segundos antes de tentar novamente.");
      }
      throw new Error(data.error || "Erro desconhecido na API Free LLM.");
    }

    if (!data.response) {
      throw new Error("A IA retornou uma resposta vazia.");
    }

    let cleanText = data.response.trim();
    if (cleanText.includes('```')) {
      cleanText = cleanText.replace(/```json|```/g, '').trim();
    }
    
    const startIdx = cleanText.indexOf('{');
    const endIdx = cleanText.lastIndexOf('}');
    
    if (startIdx === -1 || endIdx === -1) {
      throw new Error("A resposta da IA não contém um formato de dados válido.");
    }

    const jsonStr = cleanText.substring(startIdx, endIdx + 1);
    const result = JSON.parse(jsonStr);

    const rawNumbers = Array.isArray(result.numbers) ? result.numbers : [];
    const uniqueNumbers = [...new Set(rawNumbers)]
      .map(n => Number(n))
      .filter(n => !isNaN(n) && n >= 1 && n <= 25)
      .sort((a, b) => a - b);

    if (uniqueNumbers.length !== 15) {
      throw new Error("A IA gerou uma combinação inválida (quantidade incorreta de números).");
    }

    return {
      numbers: uniqueNumbers,
      reasoning: result.reasoning || "Palpite equilibrado baseado em tendências históricas.",
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.8
    };
  } catch (error: any) {
    console.error("Erro no serviço de IA:", error);
    if (error instanceof SyntaxError) {
      throw new Error("Erro de processamento: A IA não respondeu no formato esperado. Tente novamente.");
    }
    throw error;
  }
};
