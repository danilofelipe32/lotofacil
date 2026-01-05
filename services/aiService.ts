import { Statistics, PredictionResult } from "../types";

/**
 * Motor Preditivo baseado na APIFreeLLM.
 * Realiza uma análise estatística avançada para gerar palpites da Lotofácil.
 */
export const getSmartPrediction = async (stats: Statistics, recentGames: number[][]): Promise<PredictionResult> => {
  const url = 'https://apifreellm.com/api/chat';
  
  const topTen = Object.entries(stats.frequency)
    .map(([num, count]) => ({ n: parseInt(num), c: count }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 10);

  // Média de repetições do histórico para o prompt
  const avgRepeats = stats.repeatsFromPrevious.length > 0 
    ? (stats.repeatsFromPrevious.reduce((a, b) => a + b, 0) / stats.repeatsFromPrevious.length).toFixed(1)
    : "9";

  // Prompt aprimorado com toda a base estatística calculada
  const prompt = `Atue como um especialista em análise estatística e probabilística da Lotofácil.
Analise os seguintes padrões históricos:
- Frequência (Top 10): ${topTen.map(f => f.n).join(', ')}
- Equilíbrio Par/Ímpar: Médias de ${stats.parity.even.toFixed(1)} pares e ${stats.parity.odd.toFixed(1)} ímpares.
- Tendência de Soma: Média ${stats.sumAvg.toFixed(1)}, Mediana ${stats.sumMedian.toFixed(1)}, Moda ${stats.sumMode.join('/')}.
- Volatilidade (Desvio Padrão): ${stats.sumStdDev.toFixed(2)}.
- Números Primos: Distribuição de ocorrências ${JSON.stringify(stats.primeCount)}.
- Ciclo de Repetição: Média de ${avgRepeats} dezenas repetidas do concurso anterior.
- Últimos sorteios: ${JSON.stringify(recentGames.slice(-2))}.

Tarefa: Gere um palpite de exatamente 15 dezenas únicas (entre 01 e 25).
Retorne EXCLUSIVAMENTE um objeto JSON no formato abaixo, sem comentários ou explicações externas:
{
  "numbers": [15 números ordenados],
  "reasoning": "breve justificativa técnica baseada nos padrões",
  "confidence": 0.90
}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({ message: prompt })
    });

    if (!response.ok) {
      if (response.status === 429) throw new Error("Limite de requisições excedido. Tente novamente em breve.");
      if (response.status === 403) throw new Error("Acesso negado pelo firewall. Verifique sua conexão ou tente mais tarde.");
      throw new Error(`Erro na API (${response.status}): Falha ao conectar com o motor de IA.`);
    }

    const data = await response.json();
    const rawContent = data.response || data.message || "";
    
    if (!rawContent) {
      throw new Error("O servidor de IA retornou uma resposta vazia.");
    }

    // Extração segura do JSON para lidar com possíveis textos extras da IA
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Não foi possível processar o formato de dados retornado pela IA.");
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validação de integridade do palpite (Regras Lotofácil)
    const rawNumbers: any[] = Array.isArray(result.numbers) ? result.numbers : [];
    const processedNumbers: number[] = [...new Set(rawNumbers.map(n => Number(n)))]
      .filter((n: number) => !isNaN(n) && Number.isInteger(n) && n >= 1 && n <= 25)
      .sort((a: number, b: number) => a - b);

    if (processedNumbers.length !== 15) {
      throw new Error(`IA gerou ${processedNumbers.length} dezenas. O palpite deve conter exatamente 15.`);
    }

    return {
      numbers: processedNumbers,
      reasoning: result.reasoning || "Análise baseada em tendências de soma e frequência histórica.",
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.85
    };

  } catch (error: any) {
    console.error("Erro no AI Service:", error);
    throw error instanceof Error ? error : new Error("Erro inesperado na geração do palpite.");
  }
};