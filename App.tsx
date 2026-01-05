
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { parseLotofacilCSV } from './utils/csvParser';
import { calculateStatistics } from './utils/statistics';
import { LotofacilDraw, PredictionResult, SavedPrediction } from './types';
import { getSmartPrediction } from './services/aiService';
import NumberBall from './components/NumberBall';
import FrequencyChart from './components/FrequencyChart';
import ParityChart from './components/ParityChart';
import InfoTooltip from './components/InfoTooltip';

const STORAGE_KEY_PREDICTIONS = 'lotoexpert_v4_predictions';
const STORAGE_KEY_DRAWS = 'lotoexpert_v4_draws';

const App: React.FC = () => {
  const [draws, setDraws] = useState<LotofacilDraw[]>([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [savedPredictions, setSavedPredictions] = useState<SavedPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para busca com Debounce
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const p = localStorage.getItem(STORAGE_KEY_PREDICTIONS);
      const d = localStorage.getItem(STORAGE_KEY_DRAWS);
      if (p) setSavedPredictions(JSON.parse(p));
      if (d) setDraws(JSON.parse(d));
    } catch (e) {
      console.error("Erro ao carregar cache:", e);
    }
  }, []);

  // Efeito de Debounce: Atualiza o searchQuery 300ms após a última digitação
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(inputValue);
    }, 300);

    return () => clearTimeout(handler);
  }, [inputValue]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREDICTIONS, JSON.stringify(savedPredictions));
  }, [savedPredictions]);

  useEffect(() => {
    if (draws.length > 0) localStorage.setItem(STORAGE_KEY_DRAWS, JSON.stringify(draws));
  }, [draws]);

  const stats = useMemo(() => {
    if (draws.length === 0) return null;
    return calculateStatistics(draws);
  }, [draws]);

  const avgRepeats = useMemo(() => {
    if (!stats || stats.repeatsFromPrevious.length === 0) return 0;
    const sum = stats.repeatsFromPrevious.reduce((a, b) => a + b, 0);
    return sum / stats.repeatsFromPrevious.length;
  }, [stats]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = await parseLotofacilCSV(text);
        if (parsed.length === 0) throw new Error("CSV inválido.");
        setDraws(parsed);
      } catch (err: any) {
        setError("Falha ao ler arquivo CSV. Verifique o formato.");
      } finally { setLoading(false); }
    };
    reader.readAsText(file);
  };

  const triggerPrediction = async () => {
    if (!stats) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getSmartPrediction(stats, draws.slice(-10).map(d => d.numbers));
      setPrediction({ ...res, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() } as any);
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const parsedSearchNumbers = useMemo(() => {
    return searchQuery
      .split(/[\s,]+/)
      .map(n => parseInt(n))
      .filter(n => !isNaN(n) && n >= 1 && n <= 25);
  }, [searchQuery]);

  const filteredSaved = useMemo(() => {
    if (parsedSearchNumbers.length === 0) {
      return savedPredictions.map(p => ({ ...p, matchCount: 0 }));
    }

    return savedPredictions
      .map(p => {
        const matches = p.numbers.filter(n => parsedSearchNumbers.includes(n)).length;
        return { ...p, matchCount: matches };
      })
      .filter(p => p.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount);
  }, [savedPredictions, parsedSearchNumbers]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 pb-20">
      <header className="bg-slate-900/50 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <i className="fa-solid fa-clover text-white"></i>
            </div>
            <h1 className="text-lg font-black tracking-tighter">LotoExpert <span className="text-emerald-400 italic">AI</span></h1>
          </div>
          <div className="flex gap-2">
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" ref={fileInputRef} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] font-bold bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg border border-slate-700 transition-all uppercase tracking-wider"
            >
              Importar Dados
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-3 animate-pulse">
            <i className="fa-solid fa-circle-exclamation"></i>
            {error}
          </div>
        )}

        {draws.length === 0 && savedPredictions.length === 0 ? (
          <div className="py-32 flex flex-col items-center border-2 border-dashed border-slate-800 rounded-[2rem] bg-slate-900/20">
             <i className="fa-solid fa-database text-4xl text-slate-700 mb-4"></i>
             <h2 className="text-xl font-bold text-white">Sem Dados Analíticos</h2>
             <p className="text-slate-500 text-sm max-w-xs text-center mt-2">Carregue um arquivo CSV para começar a extrair padrões estatísticos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-9 gap-3">
                {[
                  { l: 'Base Histórica', v: draws.length, i: 'fa-history', c: 'text-blue-400' },
                  { l: 'Média Soma', v: stats?.sumAvg.toFixed(0) || 0, i: 'fa-calculator', c: 'text-emerald-400' },
                  { 
                    l: 'Mediana Soma', 
                    v: stats?.sumMedian.toFixed(0) || 0, 
                    i: 'fa-arrows-left-right-to-line', 
                    c: 'text-cyan-400',
                    t: 'O valor central que divide a metade superior e inferior das somas. Menos sensível a valores extremos.'
                  },
                  { 
                    l: 'Moda Soma', 
                    v: stats?.sumMode?.slice(0, 1).join(', ') || '-', 
                    i: 'fa-star', 
                    c: 'text-purple-400',
                    t: 'A soma que ocorre com maior frequência nos sorteios.'
                  },
                  { 
                    l: 'Desvio Padrão', 
                    v: stats?.sumStdDev.toFixed(1) || 0, 
                    i: 'fa-wave-square', 
                    c: 'text-rose-400',
                    t: 'Indica a variação das somas em relação à média. Valores baixos indicam maior estabilidade.'
                  },
                  { 
                    l: 'Probabilidade', 
                    v: '1 em 3.26M', 
                    i: 'fa-percent', 
                    c: 'text-amber-500',
                    t: 'Probabilidade teórica de acertar 15 números com uma aposta simples de 15 dezenas. Cálculo: C(25,15) = 25! / (15! * 10!) = 3.268.760 combinações únicas.'
                  },
                  { 
                    l: 'Média Repetidos', 
                    v: avgRepeats.toFixed(1), 
                    i: 'fa-rotate-right', 
                    c: 'text-orange-400',
                    t: 'Média de dezenas que se repetem de um concurso para o outro. O padrão estatístico mais comum na Lotofácil é repetir de 8 a 10 dezenas.'
                  },
                  { l: 'Pares (Avg)', v: stats?.parity.even.toFixed(1) || 0, i: 'fa-equals', c: 'text-amber-400' },
                  { l: 'Ímpares (Avg)', v: stats?.parity.odd.toFixed(1) || 0, i: 'fa-not-equal', c: 'text-indigo-400' }
                ].map((s, idx) => (
                  <div key={idx} className="bg-slate-800/40 p-3 rounded-2xl border border-slate-800 flex flex-col justify-between relative min-h-[100px]">
                    <div className="flex items-start justify-between">
                      <i className={`fa-solid ${s.i} ${s.c} text-[10px] mb-2`}></i>
                      {s.t && <InfoTooltip text={s.t} />}
                    </div>
                    <div className="text-sm font-black text-white truncate">{s.v}</div>
                    <div className="text-[7px] uppercase font-bold text-slate-500 mt-1 leading-tight">{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {stats && <FrequencyChart data={stats.frequency} />}
                {stats && <ParityChart parity={stats.parity} />}
              </div>

              {/* Saved Section */}
              <section className="bg-slate-900/30 rounded-3xl p-6 border border-slate-800/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div className="space-y-1">
                    <h3 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2">
                      <i className="fa-solid fa-folder-open text-indigo-400"></i>
                      Palpites Arquivados
                    </h3>
                    <p className="text-[9px] text-slate-600 font-bold uppercase">Priorizando por relevância na busca</p>
                  </div>
                  <div className="relative group">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] group-focus-within:text-emerald-400 transition-colors"></i>
                    <input 
                      type="text" 
                      placeholder="Pesquisar por dezenas (ex: 01 07 22)..." 
                      className="bg-slate-800 border border-slate-700/50 rounded-xl pl-9 pr-4 py-2 text-[10px] w-full sm:w-64 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-600 text-slate-200"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                    />
                    {inputValue !== searchQuery && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <i className="fa-solid fa-circle-notch animate-spin text-slate-600 text-[10px]"></i>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredSaved.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl">
                      <i className="fa-solid fa-filter-circle-xmark text-slate-700 text-2xl mb-2"></i>
                      <p className="text-slate-500 text-[10px] font-bold uppercase">Nenhum palpite contém as dezenas pesquisadas.</p>
                    </div>
                  ) : (
                    filteredSaved.map(p => (
                      <div key={p.id} className="bg-slate-800/20 border border-slate-800/50 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 transition-all hover:bg-slate-800/30">
                        <div className="flex flex-wrap gap-1.5 flex-1 min-w-[280px]">
                          {p.numbers.map(n => {
                            const isMatched = parsedSearchNumbers.includes(n);
                            return (
                              <span 
                                key={n} 
                                className={`w-7 h-7 flex items-center justify-center rounded text-[10px] font-bold transition-all
                                  ${isMatched 
                                    ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.3)] scale-110 z-10' 
                                    : 'bg-slate-700/50 text-slate-400 border border-slate-700'}`}
                              >
                                {n.toString().padStart(2, '0')}
                              </span>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-4 border-l border-slate-800 pl-4">
                          <div className="text-right flex flex-col gap-1 items-end">
                            {p.matchCount > 0 && (
                              <div className="bg-emerald-500/10 text-emerald-400 text-[8px] font-black px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase animate-in fade-in zoom-in duration-300">
                                {p.matchCount} {p.matchCount === 1 ? 'acerto' : 'acertos'}
                              </div>
                            )}
                            <div className="text-[9px] font-bold text-slate-500">{new Date(p.timestamp).toLocaleDateString()}</div>
                            <div className="text-[10px] font-black text-emerald-400 uppercase">{(p.confidence * 100).toFixed(0)}% Conf.</div>
                          </div>
                          <button onClick={() => setSavedPredictions(prev => prev.filter(x => x.id !== p.id))} className="text-slate-600 hover:text-red-400 transition-colors p-2">
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <div className="lg:col-span-4">
              <div className="sticky top-24 bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-[2.5rem] border border-slate-700 shadow-2xl">
                <div className="flex items-center gap-2 mb-8">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <h2 className="text-sm font-black text-white uppercase tracking-widest">Motor Preditivo</h2>
                </div>

                <button 
                  onClick={triggerPrediction}
                  disabled={loading || !stats}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 text-white font-black rounded-2xl shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-3 transition-all active:scale-95 mb-8 group"
                >
                  {loading ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-bolt-lightning group-hover:animate-bounce"></i>}
                  {loading ? 'ANALISANDO...' : 'PROCESSAR PALPITE'}
                </button>

                {prediction && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-5 gap-2">
                      {prediction.numbers.map(n => <NumberBall key={n} number={n} highlighted size="sm" />)}
                    </div>
                    
                    <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                       <div className="text-[9px] font-bold text-slate-500 uppercase mb-2">Insight de Análise:</div>
                       <p className="text-[11px] text-slate-400 italic leading-relaxed">"{prediction.reasoning}"</p>
                    </div>

                    <button 
                      onClick={() => {
                        if (!savedPredictions.find(x => x.id === (prediction as any).id)) {
                          setSavedPredictions(prev => [prediction as any, ...prev]);
                        }
                      }}
                      className="w-full py-3 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-[10px] font-black rounded-xl transition-all"
                    >
                      ARQUIVAR ESTA PREDIÇÃO
                    </button>
                  </div>
                )}

                {!stats && !loading && (
                   <div className="text-center p-6 border border-slate-800 rounded-2xl">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Importe os dados históricos para desbloquear a análise preditiva por IA.</p>
                   </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
