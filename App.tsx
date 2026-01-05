
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
      try { setSavedPredictions(JSON.parse(storedPredictions)); } catch (e) { console.error(e); }
    }
    if (storedDraws) {
      try { setDraws(JSON.parse(storedDraws)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREDICTIONS, JSON.stringify(savedPredictions));
  }, [savedPredictions]);

  useEffect(() => {
    if (draws.length > 0) localStorage.setItem(STORAGE_KEY_DRAWS, JSON.stringify(draws));
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
        if (parsed.length === 0) throw new Error("CSV inválido.");
        setDraws(parsed);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar arquivo.");
      } finally { setLoading(false); }
    };
    reader.readAsText(file);
  };

  const clearHistory = () => {
    if (window.confirm("Limpar todo o histórico carregado?")) {
      setDraws([]);
      localStorage.removeItem(STORAGE_KEY_DRAWS);
    }
  };

  const generatePalpite = async (retryCount = 0) => {
    if (!stats) return;
    if (retryCount === 0) setLoading(true);
    setError(null);
    try {
      const recent = draws.length > 0 ? draws.slice(-10).map(d => d.numbers) : [];
      const result = await getSmartPrediction(stats, recent);
      const comboKey = result.numbers.sort((a, b) => a - b).join(',');
      
      if (draws.some(d => d.numbers.sort((a, b) => a - b).join(',') === comboKey) && retryCount < 2) {
        return generatePalpite(retryCount + 1);
      }

      setPrediction({ ...result, id: crypto.randomUUID(), timestamp: Date.now() } as any);
    } catch (err: any) {
      setError(err.message);
    } finally { if (retryCount === 0) setLoading(false); }
  };

  const sortedPredictions = useMemo(() => {
    let list = [...savedPredictions];
    if (searchQuery) {
      const q = searchQuery.split(/[\s,]+/).map(n => parseInt(n)).filter(n => !isNaN(n));
      list = list.filter(p => q.every(qn => p.numbers.includes(qn)));
    }
    return list.sort((a, b) => {
      if (sortBy === 'date_desc') return b.timestamp - a.timestamp;
      if (sortBy === 'confidence') return b.confidence - a.confidence;
      if (sortBy === 'sum_desc') return b.numbers.reduce((s,v)=>s+v,0) - a.numbers.reduce((s,v)=>s+v,0);
      return 0;
    });
  }, [savedPredictions, sortBy, searchQuery]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-emerald-500/30">
      {/* Header Fixo/Glass */}
      <nav className="sticky top-0 z-50 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <i className="fa-solid fa-clover text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">LotoExpert <span className="text-emerald-400">AI</span></h1>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Analytics Dashboard</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" ref={fileInputRef} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
            >
              <i className="fa-solid fa-cloud-arrow-up text-emerald-400"></i>
              Importar CSV
            </button>
            {draws.length > 0 && (
              <button onClick={clearHistory} className="p-2 text-slate-500 hover:text-red-400 transition-colors">
                <i className="fa-solid fa-trash-can"></i>
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <i className="fa-solid fa-triangle-exclamation"></i>
            {error}
          </div>
        )}

        {combinedDraws.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-slate-700">
              <i className="fa-solid fa-database text-3xl text-slate-600"></i>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Inicie sua Análise</h2>
            <p className="text-slate-500 max-w-sm">Carregue o arquivo de resultados da Lotofácil para que nossa IA identifique os melhores padrões estatísticos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Coluna Esquerda: Insights e Histórico */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Grid de Estatísticas Rápidas */}
              <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Jogos Analisados', val: combinedDraws.length, icon: 'fa-list-ol', color: 'text-blue-400' },
                  { label: 'Média de Soma', val: stats?.sumAvg.toFixed(1), icon: 'fa-plus-minus', color: 'text-emerald-400' },
                  { label: 'Pares/Ímpares', val: `${stats?.parity.even.toFixed(1)} / ${stats?.parity.odd.toFixed(1)}`, icon: 'fa-scale-unbalanced', color: 'text-amber-400' },
                  { label: 'Soma Mediana', val: stats?.sumMedian, icon: 'fa-bullseye', color: 'text-indigo-400' }
                ].map((item, i) => (
                  <div key={i} className="bg-slate-800/30 border border-slate-800 p-4 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <i className={`fa-solid ${item.icon} ${item.color} text-sm opacity-80`}></i>
                      <InfoTooltip text={`Métrica baseada no histórico de ${combinedDraws.length} sorteios.`} />
                    </div>
                    <div className="text-lg font-black text-white">{item.val}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{item.label}</div>
                  </div>
                ))}
              </section>

              {/* Gráficos em Grid */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {stats && <FrequencyChart data={stats.frequency} />}
                {stats && <ParityChart parity={stats.parity} />}
              </section>

              {/* Lista de Palpites Salvos */}
              <section className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <i className="fa-solid fa-bookmark text-indigo-400"></i>
                    Meus Jogos Salvos
                  </h3>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Filtrar números..." 
                      className="bg-slate-800 border-none rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 w-32 md:w-48 transition-all"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {sortedPredictions.map((saved) => (
                    <div key={saved.id} className="group bg-slate-800/20 hover:bg-slate-800/40 border border-slate-800 hover:border-indigo-500/30 p-4 rounded-2xl transition-all duration-300">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-wrap gap-1.5">
                          {saved.numbers.map(n => (
                            <div key={n} className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold">
                              {n.toString().padStart(2, '0')}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-700 pt-3 md:pt-0 md:pl-4">
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-500 uppercase">{new Date(saved.timestamp).toLocaleDateString()}</div>
                            <div className="text-xs font-black text-indigo-400">CONF: {(saved.confidence * 100).toFixed(0)}%</div>
                          </div>
                          <button 
                            onClick={() => setSavedPredictions(p => p.filter(x => x.id !== saved.id))}
                            className="p-2 text-slate-600 hover:text-red-400 transition-colors"
                          >
                            <i className="fa-solid fa-trash-can text-sm"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {sortedPredictions.length === 0 && (
                    <div className="py-12 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                      <p className="text-slate-600 text-sm">Nenhum palpite arquivado ainda.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Coluna Direita: Gerador e Ações Rápidas */}
            <div className="lg:col-span-4">
              <div className="sticky top-28 space-y-6">
                
                {/* Card Principal do Gerador */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-emerald-500/20 p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                    <i className="fa-solid fa-microchip text-8xl text-emerald-500"></i>
                  </div>

                  <h2 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    Gerador Inteligente
                  </h2>

                  <button 
                    onClick={() => generatePalpite()}
                    disabled={loading}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-2xl shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    {loading ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-bolt-lightning"></i>}
                    {loading ? 'ANALISANDO PADRÕES...' : 'CRIAR NOVO JOGO'}
                  </button>

                  {prediction && (
                    <div className="mt-8 space-y-6 animate-in zoom-in-95 duration-500">
                      <div className="grid grid-cols-5 gap-2 justify-items-center">
                        {prediction.numbers.map(n => <NumberBall key={n} number={n} highlighted size="sm" />)}
                      </div>

                      <div className="p-4 bg-black/30 rounded-2xl border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                            <i className="fa-solid fa-magnifying-glass-chart text-emerald-500"></i>
                            Análise da IA
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black rounded-md border border-emerald-500/20">
                            SCORE: {(prediction.confidence * 100).toFixed(0)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed italic">"{prediction.reasoning}"</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                          <span className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Matemática</span>
                          <span className="text-xs font-black text-slate-200">1 em 3.2M</span>
                          <InfoTooltip text="Probabilidade estatística de acerto das 15 dezenas." />
                        </div>
                        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                          <span className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Tendência</span>
                          <span className="text-xs font-black text-emerald-400">ALTA</span>
                          <InfoTooltip text="Nível de aderência aos padrões de soma e paridade do histórico." />
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          if (!savedPredictions.find(p => p.id === (prediction as any).id)) {
                            setSavedPredictions(prev => [prediction as any, ...prev]);
                          }
                        }}
                        disabled={savedPredictions.some(p => p.id === (prediction as any).id)}
                        className="w-full py-3 border border-slate-700 hover:border-indigo-500/50 text-slate-400 hover:text-indigo-400 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-bookmark"></i>
                        {savedPredictions.some(p => p.id === (prediction as any).id) ? 'PALPITE SALVO' : 'ARQUIVAR PALPITE'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer Lateral */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-800/10">
                  <p className="text-[10px] text-slate-500 leading-relaxed text-center">
                    Utilizando modelos de análise probabilística via <span className="text-slate-300">APIFreeLLM</span>. 
                    Jogue com responsabilidade.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Minimalista */}
      <footer className="mt-20 py-10 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">© 2024 LotoExpert AI Analytics</p>
          <div className="flex gap-6">
            <a href="#" className="text-slate-600 hover:text-slate-400 text-sm transition-colors"><i className="fa-brands fa-github"></i></a>
            <a href="#" className="text-slate-600 hover:text-slate-400 text-sm transition-colors"><i className="fa-brands fa-x-twitter"></i></a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
