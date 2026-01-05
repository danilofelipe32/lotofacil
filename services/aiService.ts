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
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({ message: prompt })
    });

    // Tratamento detalhado de erros HTTP
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Limite de requisições excedido (Rate Limit). Por favor, aguarde alguns instantes antes de tentar novamente.");
      }
      if (response.status >= 500) {
        throw new Error("O servidor de IA está enfrentando instabilidades temporárias (Erro 5xx). Tente novamente em alguns minutos.");
      }
      if (response.status === 403 || response.status === 401) {
        throw new Error("Acesso negado pelo firewall ou autenticação. A API pode estar protegida contra bots.");
      }
      if (response.status === 404) {
        throw new Error("Serviço de IA temporariamente indisponível (Endpoint não encontrado).");
      }
      throw new Error(`Falha na comunicação com a IA: Status ${response.status} (${response.statusText})`);
    }

    const data = await response.json();
    // A APIFreeLLM geralmente retorna o conteúdo em 'response' ou 'message'
    const rawContent = data.response || data.message || "";
    
    if (!rawContent) {
      throw new Error("A IA respondeu com sucesso, mas o conteúdo do palpite veio vazio.");
    }

    // Extração robusta de JSON do corpo da resposta (limpa markdown e textos extras)
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("O motor de IA não conseguiu estruturar os dados do palpite corretamente. Tente gerar novamente.");
    }

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch (e) {
      throw new Error("Erro ao interpretar os dados gerados pela IA. Formato incompatível.");
    }

    // --- VALIDAÇÕES DE INTEGRIDADE ---
    
    const rawNumbers: any[] = Array.isArray(result.numbers) ? result.numbers : [];
    const processedNumbers: number[] = [...new Set(rawNumbers.map(n => Number(n)))]
      .filter((n: number) => !isNaN(n) && Number.isInteger(n) && n >= 1 && n <= 25)
      .sort((a: number, b: number) => a - b);

    if (processedNumbers.length !== 15) {
      throw new Error(`A análise gerou um conjunto de ${processedNumbers.length} dezenas, o que é inválido para a Lotofácil.`);
    }

    if (typeof result.reasoning !== 'string' || result.reasoning.trim().length < 5) {
      throw new Error("A IA não forneceu uma justificativa técnica válida para o palpite.");
    }

    return {
      numbers: processedNumbers,
      reasoning: result.reasoning.trim(),
      confidence: typeof result.confidence === 'number' ? Math.min(Math.max(result.confidence, 0), 1) : 0.75
    };

  } catch (error: any) {
    console.error("Erro crítico no serviço de IA:", error);
    
    // Se for um erro já tratado por nós, repassa a mensagem
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error("Ocorreu um erro inesperado ao processar o palpite inteligente.");
  }
};