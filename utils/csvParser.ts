
import { LotofacilDraw } from '../types';

/**
 * Realiza o parsing de um CSV da Lotofácil de forma assíncrona utilizando Web Workers.
 * Esta abordagem evita que a thread principal do navegador seja bloqueada durante
 * o processamento de arquivos extensos.
 */
export const parseLotofacilCSV = (csvText: string): Promise<LotofacilDraw[]> => {
  return new Promise((resolve, reject) => {
    // Definimos o código do worker como uma string para garantir portabilidade completa
    const workerScript = `
      self.onmessage = function(e) {
        const csvText = e.data;
        const lines = csvText.split(/\\r?\\n/);
        const results = [];
        
        if (lines.length === 0) {
          self.postMessage([]);
          return;
        }

        // Detecta cabeçalho (Concurso ou Bola)
        const firstLine = lines[0].toLowerCase();
        const startIndex = (firstLine.includes('concurso') || firstLine.includes('bola')) ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Suporta tanto ponto-e-vírgula quanto vírgula
          const columns = line.split(/[;,]/);
          
          // Validação: Lógica assume Concurso, Data, e exatamente 15 bolas (mínimo 17 colunas)
          if (columns.length < 17) {
            console.warn(\`Linha \${i + 1} ignorada: número insuficiente de colunas (\${columns.length}/17 esperado).\`);
            continue;
          }

          const numbers = [];
          // Parse otimizado das 15 dezenas (colunas 2 a 16)
          for (let j = 2; j < 17; j++) {
            const val = parseInt(columns[j]);
            if (!isNaN(val)) {
              numbers.push(val);
            }
          }

          // Validação final da linha antes de adicionar aos resultados
          if (numbers.length === 15) {
            const concurso = parseInt(columns[0]);
            if (isNaN(concurso)) {
              console.warn(\`Linha \${i + 1} ignorada: número do concurso inválido.\`);
              continue;
            }

            results.push({
              concurso: concurso,
              data: columns[1] || '00/00/0000',
              numbers: numbers.sort((a, b) => a - b)
            });
          } else {
            console.warn(\`Linha \${i + 1} ignorada: apenas \${numbers.length} dezenas válidas encontradas.\`);
          }
        }
        
        // Ordenação final por número de concurso antes de retornar
        results.sort((a, b) => a.concurso - b.concurso);
        self.postMessage(results);
      };
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    const worker = new Worker(blobUrl);

    worker.onmessage = (event) => {
      resolve(event.data);
      cleanup();
    };

    worker.onerror = (error) => {
      reject(new Error("Erro no processamento paralelo do CSV: " + error.message));
      cleanup();
    };

    function cleanup() {
      worker.terminate();
      URL.revokeObjectURL(blobUrl);
    }

    worker.postMessage(csvText);
  });
};
