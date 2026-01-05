
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { parseLotofacilCSV } from './utils/csvParser';
import { calculateStatistics } from './utils/statistics';
import { LotofacilDraw, Statistics, PredictionResult, SavedPrediction } from './types';
import { getSmartPrediction } from './services/aiService';
import NumberBall from './components/NumberBall';
import FrequencyChart from './components/FrequencyChart';
import ParityChart from './components/ParityChart';
import InfoTooltip from './components/InfoTooltip';

const STORAGE_KEY_PREDICTIONS = 'lotoexpert_saved_predictions';
const STORAGE_KEY_DRAWS = 'lotoexpert_draws_history';

type SortCriterion = 'date_desc' | 'date_asc' | 'confidence' | 'sum_desc' | 'sum_asc';

const App: React.FC = () => {
  const [draws, setDraws] = useState<LotofacilDraw[]>([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [savedPredictions, setSavedPredictions] = useState<SavedPrediction[]>([]);
  const [recentHistory, setRecentHistory] = useState<SavedPrediction[]>([]);
  const [sessionExclusionList, setSessionExclusionList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortCriterion>('date_desc');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedPredictions = localStorage.getItem(STORAGE_KEY_PREDICTIONS);
    const storedDraws = localStorage.getItem(STORAGE_KEY_DRAWS);

    if (storedPredictions) {
      try {
        setSavedPredictions(JSON.parse(storedPredictions));
      } catch (e) {
        console.error("Erro ao carregar palpites do localStorage", e);
      }
    }

    if (storedDraws) {
      try {
        setDraws(JSON.parse(storedDraws));
      } catch (e) {
        console.error("Erro ao carregar histórico de jogos do localStorage", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREDICTIONS, JSON.stringify(savedPredictions));
  }, [savedPredictions]);

  useEffect(() => {
    if (draws.length > 0) {
      localStorage.setItem(STORAGE_KEY_DRAWS, JSON.stringify(draws));
    }
  }, [draws]);

  const combinedDraws = useMemo(() => {
    const savedAsDraws: LotofacilDraw[] = savedPredictions.map((p, idx) => ({
      concurso: -(idx + 1), 
      data: 'Palpite',
      numbers: p.numbers
    }));
    return [...draws, ...savedAsDraws];
  }, [draws, savedPredictions]);

  const stats = useMemo(() => {
    if (combinedDraws.length === 0) return null;
    return calculateStatistics(combinedDraws);
  }, [combinedDraws]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      setLoading(true);
      try {
        const text = e.target?.result as string;
        const parsed = await parseLotofacilCSV(text);
        if (parsed.length === 0) {
          throw new Error("Nenhum dado válido encontrado no CSV. Verifique o formato.");
        }
        setDraws(parsed);
        setSessionExclusionList([]);
        setRecentHistory([]);
      } catch (err: any) {
        setError(err.message || "Erro ao ler arquivo.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const clearHistory = () => {
    if (window.confirm("Tem certeza que deseja limpar o histórico de jogos carregado?")) {
      setDraws([]);
      localStorage.removeItem(STORAGE_KEY_DRAWS);
    }
  };

  const isGameRepeated = (numbers: number[]): boolean => {
    const comboKey = [...numbers].sort((a, b) => a - b).join(',');
    const existsInHistory = draws.some(d => d.numbers.sort((a, b) => a - b).join(',') === comboKey);
    if (existsInHistory) return true;
    const existsInSession = sessionExclusionList.includes(comboKey);
    if (existsInSession) return true;
    return false;
  };

  const generatePalpite = async (retryCount = 0) => {
    if (!stats) return;
    if (retryCount === 0) setLoading(true);
    setError(null);

    try {
      const recent = draws.length > 0 ? draws.slice(-10).map(d => d.numbers) : [];
      const result = await getSmartPrediction(stats, recent);

      if (isGameRepeated(result.numbers)) {
        if (retryCount < 2) {
          return generatePalpite(retryCount + 1);
        } else {
          throw new Error("A IA gerou um jogo já existente. Tente novamente.");
        }
      }

      const comboKey = result.numbers.sort((a, b) => a - b).join(',');
      setSessionExclusionList(prev => [...prev, comboKey]);
      
      const newPrediction: SavedPrediction = {
        ...result,
        id: crypto.randomUUID(),
        timestamp: Date.now()
      };

      setPrediction(newPrediction);
      setRecentHistory(prev => [newPrediction, ...prev].slice(0, 5));
    } catch (err: any) {
      setError(err.message || "Falha ao gerar palpite.");
    } finally {
      if (retryCount === 0) setLoading(false);
    }
  };

  const savePrediction = (pred: SavedPrediction) => {
    if (savedPredictions.find(p => p.id === pred.id)) return;
    setSavedPredictions(prev => [pred, ...prev]);
  };

  const deleteSavedPrediction = (id: string) => {
    setSavedPredictions(prev => prev.filter(p => p.id !== id));
  };

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(ts);
  };

  const calculateSum = (numbers: number[]) => numbers.reduce((acc, curr) => acc + curr, 0);
  const getParity = (numbers: number[]) => {
    const even = numbers.filter(n => n % 2 === 0).length;
    return { even, odd: 15 - even };
  };

  const convergenceScore = useMemo(() => {
    if (!prediction || !draws.length) return 0;
    const pSum = calculateSum(prediction.numbers);
    const pParity = getParity(prediction.numbers);

    const matchingProfile = draws.filter(d => {
      const dSum = calculateSum(d.numbers);
      const dParity = getParity(d.numbers);
      const sumMatch = Math.abs(dSum - pSum) <= 15;
      const parityMatch = dParity.even === pParity.even;
      return sumMatch && parityMatch;
    });

    return (matchingProfile.length / (draws.length || 1)) * 100;
  }, [prediction, draws]);

  const sortedAndFilteredPredictions = useMemo(() => {
    let list = [...savedPredictions];

    if (searchQuery.trim()) {
      const queryNumbers = searchQuery
        .split(/[\s,]+/)
        .map(n => parseInt(n.trim()))
        .filter(n => !isNaN(n));
      
      if (queryNumbers.length > 0) {
        list = list.filter(p => 
          queryNumbers.every(qn => p.numbers.includes(qn))
        );
      }
    }

    switch (sortBy) {
      case 'date_desc': return list.sort((a, b) => b.timestamp - a.timestamp);
      case 'date_asc': return list.sort((a, b) => a.timestamp - b.timestamp);
      case 'confidence': return list.sort((a, b) => b.confidence - a.confidence);
      case 'sum_desc': return list.sort((a, b) => calculateSum(b.numbers) - calculateSum(a.numbers));
      case 'sum_asc': return list.sort((a, b) => calculateSum(a.numbers) - calculateSum(b.numbers));
      default: return list;
    }
  }, [savedPredictions, sortBy, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-24">
      <header className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12 border-b border-gray-800 pb-8">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-500 p-3 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <i className="fa-solid fa-clover text-3xl text-white"></i>
          </div>
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              LotoExpert AI
            </h1>
            <p className="text-gray-400 text-sm">Análise Estatística & API Free LLM</p>
          </div>
        </div>

        <div className="flex gap-4">
          <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" ref={fileInputRef} />
          {draws.length > 0 && (
            <button onClick={clearHistory} className="flex items-center gap-2 px-4 py-3 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-xl transition-all border border-red-500/30 text-sm font-bold">
              <i className="fa-solid fa-trash-can"></i>
              Limpar Dados
            </button>
          )}
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-all border border-gray-700 font-bold">
            <i className="fa-solid fa-file-csv text-emerald-400"></i>
            {draws.length > 0 ? 'Atualizar CSV' : 'Carregar Histórico CSV'}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-8 p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 flex items-center gap-3">
          <i className="fa-solid fa-circle-exclamation text-red-400"></i>
          {error}
        </div>
      )}

      {draws.length === 0 && savedPredictions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
          <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center animate-pulse">
            <i className="fa-solid fa-arrow-up text-4xl text-gray-600"></i>
          </div>
          <div className="max-w-md">
            <h2 className="text-2xl font-bold mb-2">Pronto para começar?</h2>
            <p className="text-gray-400">O histórico será salvo localmente. Carregue um CSV da Lotofácil para análise e geração de jogos inéditos.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-800/50 p-5 rounded-2xl border border-gray-700">
                <span className="text-gray-400 text-xs uppercase tracking-wider font-bold">
                  Total Analisado
                  <InfoTooltip text="Total de concursos processados (CSV) somados aos palpites salvos por você." />
                </span>
                <div className="text-2xl font-black mt-1">
                  {combinedDraws.length} <span className="text-xs font-normal text-gray-500">jogos</span>
                </div>
              </div>
              <div className="bg-gray-800/50 p-5 rounded-2xl border border-gray-700">
                <span className="text-gray-400 text-xs uppercase tracking-wider font-bold">
                  Média de Soma
                  <InfoTooltip text="Média aritmética da soma das dezenas de cada sorteio. Historicamente, a maioria dos jogos gira entre 170 e 220." />
                </span>
                <div className="text-2xl font-black mt-1 text-emerald-400">{stats?.sumAvg.toFixed(1)}</div>
              </div>
              <div className="bg-gray-800/50 p-5 rounded-2xl border border-gray-700">
                <span className="text-gray-400 text-xs uppercase tracking-wider font-bold">
                  Pares / Ímpares
                  <InfoTooltip text="Distribuição média de dezenas pares e ímpares. O equilíbrio ideal costuma ser de 7 ou 8 números de cada categoria." />
                </span>
                <div className="text-2xl font-black mt-1">
                  <span className="text-amber-400">{stats?.parity.even.toFixed(1)}</span>
                  <span className="text-gray-600 mx-1">/</span>
                  <span className="text-blue-500">{stats?.parity.odd.toFixed(1)}</span>
                </div>
              </div>
              <div className={`p-5 rounded-2xl border ${stats?.duplicates.length ? 'bg-red-900/20 border-red-500/50' : 'bg-gray-800/50 border-gray-700'}`}>
                <span className="text-gray-400 text-xs uppercase tracking-wider font-bold">
                  Planilha: Repetidos
                  <InfoTooltip text="Indica se existem combinações de 15 dezenas idênticas nos dados. Repetições na Lotofácil são extremamente raras." />
                </span>
                <div className={`text-2xl font-black mt-1 ${stats?.duplicates.length ? 'text-red-400' : 'text-emerald-400'}`}>
                  {stats?.duplicates.length || 0}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800/50 p-5 rounded-2xl border border-gray-700">
                <span className="text-gray-400 text-xs uppercase tracking-wider font-bold">
                  Desvio Padrão
                  <InfoTooltip text="Mede a dispersão das somas em relação à média. Um desvio alto indica que as somas variam muito entre sorteios." />
                </span>
                <div className="text-2xl font-black mt-1 text-cyan-400">{stats?.sumStdDev.toFixed(2)}</div>
              </div>
              <div className="bg-gray-800/50 p-5 rounded-2xl border border-gray-700">
                <span className="text-gray-400 text-xs uppercase tracking-wider font-bold">
                  Mediana (Soma)
                  <InfoTooltip text="O valor central das somas quando listadas em ordem. Serve para validar a tendência central sem influência de valores extremos." />
                </span>
                <div className="text-2xl font-black mt-1 text-indigo-400">{stats?.sumMedian}</div>
              </div>
              <div className="bg-gray-800/50 p-5 rounded-2xl border border-gray-700">
                <span className="text-gray-400 text-xs uppercase tracking-wider font-bold">
                  Moda (Soma)
                  <InfoTooltip text="A soma que ocorreu mais vezes nos resultados analisados." />
                </span>
                <div className="text-2xl font-black mt-1 text-amber-400">
                  {stats?.sumMode.join(', ')}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {stats && <FrequencyChart data={stats.frequency} />}
              {stats && <ParityChart parity={stats.parity} />}
            </div>

            {savedPredictions.length > 0 && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
                  <h3 className="font-black text-xl flex items-center gap-2 text-gray-200">
                    <i className="fa-solid fa-bookmark text-indigo-400"></i>
                    Palpites Salvos
                    <InfoTooltip text="Jogos gerados que você decidiu arquivar." />
                  </h3>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="relative w-full sm:w-48">
                      <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
                      <input 
                        type="text" 
                        placeholder="Filtrar dezenas..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg pl-9 pr-3 py-2 outline-none hover:border-indigo-500 focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <select 
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortCriterion)}
                      className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-2 outline-none hover:border-indigo-500 transition-colors cursor-pointer"
                    >
                      <option value="date_desc">Mais Recentes</option>
                      <option value="confidence">Maior Confiança</option>
                      <option value="sum_desc">Maior Soma</option>
                      <option value="sum_asc">Menor Soma</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {sortedAndFilteredPredictions.map((saved) => (
                    <div key={saved.id} className="bg-indigo-900/10 p-5 rounded-2xl border border-indigo-500/30 group hover:border-indigo-400 hover:bg-indigo-900/20 transition-all duration-300">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20 uppercase tracking-tighter">
                              {formatDate(saved.timestamp)}
                            </span>
                            <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded border border-amber-500/20 font-bold">
                              SOMA: {calculateSum(saved.numbers)}
                            </span>
                            <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2.5 py-1 rounded border border-cyan-500/20 font-bold">
                              CONF.: {(saved.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          
                          <button 
                            onClick={() => deleteSavedPrediction(saved.id)} 
                            className="text-gray-500 hover:text-red-400 transition-colors p-1"
                            title="Remover"
                          >
                            <i className="fa-solid fa-trash-can text-sm"></i>
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                          {saved.numbers.map(n => (
                            <div key={`${saved.id}-${n}`} className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 flex items-center justify-center text-xs font-bold">
                              {n.toString().padStart(2, '0')}
                            </div>
                          ))}
                        </div>

                        {saved.reasoning && (
                           <p className="text-[11px] text-gray-400 italic border-t border-indigo-500/10 pt-2 leading-relaxed">
                             "{saved.reasoning}"
                           </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-3xl border border-emerald-500/30 shadow-2xl sticky top-8">
              <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-gray-100">
                <i className="fa-solid fa-wand-magic-sparkles text-emerald-400"></i>
                Gerador AI
                <InfoTooltip text="Algoritmo que utiliza a API Free LLM para analisar o histórico e sugerir dezenas inéditas." />
              </h2>
              
              <button 
                onClick={() => generatePalpite()} 
                disabled={loading || (draws.length === 0 && savedPredictions.length === 0)} 
                className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${loading ? 'bg-gray-700 cursor-not-allowed opacity-50' : 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] text-white disabled:opacity-30 disabled:cursor-not-allowed'}`}
              >
                {loading ? <><i className="fa-solid fa-spinner animate-spin"></i> Analisando...</> : <><i className="fa-solid fa-bolt"></i> Gerar Novo Palpite</>}
              </button>
              
              {prediction && (
                <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20 uppercase">
                      <i className="fa-solid fa-shield-check"></i>
                      Sugestão Inédita
                    </div>
                    <div className="flex flex-wrap justify-center gap-1.5 p-4 bg-black/40 rounded-3xl border border-gray-700/50">
                      {prediction.numbers.map(n => <NumberBall key={n} number={n} highlighted size="sm" />)}
                    </div>
                  </div>

                  <div className="bg-gray-900/50 p-5 rounded-2xl border border-gray-700 space-y-4">
                    <h4 className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-2">
                      <i className="fa-solid fa-bullseye text-cyan-400"></i>
                      Indicadores Técnicos
                      <InfoTooltip text="Métricas calculadas para avaliar a qualidade probabilística do jogo sugerido." />
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-black/20 p-3 rounded-xl">
                        <span className="text-[9px] text-gray-500 block uppercase font-bold">
                          Matemática
                          <InfoTooltip text="Probabilidade estatística fixa de acerto das 15 dezenas (1 em 3.268.760)." />
                        </span>
                        <span className="text-xs font-bold text-gray-300">1 em 3.2M</span>
                      </div>
                      <div className="bg-black/20 p-3 rounded-xl">
                        <span className="text-[9px] text-gray-500 block uppercase font-bold">
                          Convergência
                          <InfoTooltip text="O quanto este palpite se alinha aos padrões estatísticos recorrentes (Soma e Paridade) identificados no histórico." />
                        </span>
                        <span className={`text-xs font-bold ${convergenceScore > 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {convergenceScore.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => savePrediction(prediction as SavedPrediction)} 
                    disabled={savedPredictions.some(p => p.id === (prediction as SavedPrediction).id)}
                    className="w-full py-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-600 rounded-2xl text-sm font-black text-gray-200 flex items-center justify-center gap-2 transition-all"
                  >
                    <i className="fa-solid fa-floppy-disk text-emerald-400"></i>
                    {savedPredictions.some(p => p.id === (prediction as SavedPrediction).id) ? 'Palpite já Arquivado' : 'Salvar no Histórico'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <footer className="mt-20 border-t border-gray-800 pt-10 text-center text-gray-600 text-xs">
        <p className="max-w-md mx-auto leading-relaxed">
          LotoExpert AI - Utilizando API Free LLM para análise probabilística. 
          Resultados passados não garantem ganhos. Jogue com responsabilidade.
        </p>
      </footer>
    </div>
  );
};

export default App;
