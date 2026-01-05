
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

const App: React.FC = () => {
  const [draws, setDraws] = useState<LotofacilDraw[]>([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [savedPredictions, setSavedPredictions] = useState<SavedPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregamento inicial seguro
  useEffect(() => {
    try {
      const storedPredictions = localStorage.getItem(STORAGE_KEY_PREDICTIONS);
      const storedDraws = localStorage.getItem(STORAGE_KEY_DRAWS);
      if (storedPredictions) setSavedPredictions(JSON.parse(storedPredictions));
      if (storedDraws) setDraws(JSON.parse(storedDraws));
    } catch (e) {
      console.error("Erro ao carregar cache local", e);
    }
  }, []);

  // Persistência
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PREDICTIONS, JSON.stringify(savedPredictions));
  }, [savedPredictions]);

  useEffect(() => {
    if (draws.length > 0) localStorage.setItem(STORAGE_KEY_DRAWS, JSON.stringify(draws));
  }, [draws]);

  const stats = useMemo(() => {
    if (draws.length === 0 && savedPredictions.length === 0) return null;
    const combined: LotofacilDraw[] = [...draws];
    savedPredictions.forEach((p, i) => combined.push({ concurso: -(i+1), data: 'IA', numbers: p.numbers }));
    return calculateStatistics(combined);
  }, [draws, savedPredictions]);

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
        if (parsed.length === 0) throw new Error("O CSV não contém dados válidos.");
        setDraws(parsed);
      } catch (err: any) {
        setError(err.message || "Erro ao processar arquivo.");
      } finally { setLoading(false); }
    };
    reader.readAsText(file);
  };

  const triggerPrediction = async () => {
    if (!stats) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getSmartPrediction(stats, draws.slice(-5).map(d => d.numbers));
      setPrediction({ ...result, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() } as any);
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const filteredSaved = useMemo(() => {
    if (!searchQuery) return savedPredictions;
    const q = searchQuery.split(/[\s,]+/).map(n => parseInt(n)).filter(n => !isNaN(n));
    return savedPredictions.filter(p => q.every(qn => p.numbers.includes(qn)));
  }, [savedPredictions, searchQuery]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      {/* Header Estilo App */}
      <header className="bg-slate-900/50 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <i className="fa-solid fa-clover text-white"></i>
            </div>
            <h1 className="text-lg font-black tracking-tight">LotoExpert <span className="text-emerald-400">AI</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" ref={fileInputRef} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-bold bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg border border-slate-700 transition-colors flex items-center gap-2"
            >
              <i className="fa-solid fa-file-import text-emerald-400"></i>
              Importar Dados
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3">
            <i className="fa-solid fa-circle-exclamation"></i>
            {error}
          </div>
        )}

        {draws.length === 0 && savedPredictions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-slate-800 rounded-3xl text-center">
            <i className="fa-solid fa-chart-line text-4xl text-slate-700 mb-4"></i>
            <h2 className="text-xl font-bold text-white mb-2">Aguardando Base de Dados</h2>
            <p className="text-slate-500 text-sm max-w-xs">Importe o histórico de sorteios para ativar os algoritmos de análise preditiva.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Dashboard Principal */}
            <div className="lg:col-span-8 space-y-8">
              {/* Grid de Cards de Estatísticas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Jogos na Base', value: draws.length + savedPredictions.length, icon: 'fa-database', color: 'text-blue-400' },
                  { label: 'Média de Soma', value: stats?.sumAvg.toFixed(0), icon: 'fa-plus', color: 'text-emerald-400' },
                  { label: 'Paridade (E)', value: stats?.parity.even.toFixed(1), icon: 'fa-equals', color: 'text-amber-400' },
                  { label: 'Paridade (I)', value: stats?.parity.odd.toFixed(1), icon: 'fa-not-equal', color: 'text-indigo-400' }
                ].map((stat, i) => (
                  <div key={i} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <i className={`fa-solid ${stat.icon} ${stat.color} text-xs`}></i>
                      <InfoTooltip text="Métrica calculada dinamicamente com base nos dados carregados." />
                    </div>
                    <div className="text-xl font-black text-white">{stat.value}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {stats && <FrequencyChart data={stats.frequency} />}
                {stats && <ParityChart parity={stats.parity} />}
              </div>

              {/* Lista de Jogos Arquivados */}
              <section>
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-bookmark text-indigo-400"></i>
                    Palpites Arquivados
                  </h3>
                  <input 
                    type="text" 
                    placeholder="Filtrar dezenas..."
                    className="bg-slate-800 border-none rounded-lg px-3 py-1 text-xs text-white focus:ring-1 focus:ring-indigo-500 w-40"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  {filteredSaved.map(p => (
                    <div key={p.id} className="bg-slate-800/30 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap gap-1">
                        {p.numbers.map(n => (
                          <span key={n} className="w-7 h-7 flex items-center justify-center rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                            {n.toString().padStart(2, '0')}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-[9px] font-bold text-slate-500">{new Date(p.timestamp).toLocaleDateString()}</div>
                          <div className="text-[10px] font-black text-emerald-400">CONF: {(p.confidence * 100).toFixed(0)}%</div>
                        </div>
                        <button 
                          onClick={() => setSavedPredictions(prev => prev.filter(x => x.id !== p.id))}
                          className="text-slate-600 hover:text-red-400 transition-colors"
                        >
                          <i className="fa-solid fa-trash-can text-sm"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredSaved.length === 0 && (
                    <p className="text-center py-10 text-slate-600 text-xs italic">Nenhum palpite encontrado.</p>
                  )}
                </div>
              </section>
            </div>

            {/* Coluna do Gerador IA */}
            <div className="lg:col-span-4">
              <div className="sticky top-24 bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/50 p-6 rounded-[2rem] shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Módulo de Predição</h3>
                </div>

                <button 
                  onClick={triggerPrediction}
                  disabled={loading}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {loading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-bolt-lightning"></i>}
                  {loading ? 'PROCESSANDO...' : 'GERAR PALPITE'}
                </button>

                {prediction && (
                  <div className="mt-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-5 gap-2">
                      {prediction.numbers.map(n => <NumberBall key={n} number={n} highlighted size="sm" />)}
                    </div>

                    <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                      <div className="text-[9px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                        <i className="fa-solid fa-comment-dots text-emerald-400"></i>
                        Justificativa da IA
                      </div>
                      <p className="text-[11px] text-slate-400 italic leading-relaxed">"{prediction.reasoning}"</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                        <div className="text-[8px] font-bold text-slate-500 uppercase mb-1">Probabilidade</div>
                        <div className="text-xs font-black text-white">1 : 3.268.760</div>
                      </div>
                      <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                        <div className="text-[8px] font-bold text-slate-500 uppercase mb-1">Confiança</div>
                        <div className="text-xs font-black text-emerald-400">{(prediction.confidence * 100).toFixed(0)}%</div>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        if (!savedPredictions.find(x => x.id === (prediction as any).id)) {
                          setSavedPredictions(prev => [prediction as any, ...prev]);
                        }
                      }}
                      disabled={savedPredictions.some(x => x.id === (prediction as any).id)}
                      className="w-full py-3 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 text-[10px] font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-download"></i>
                      {savedPredictions.some(x => x.id === (prediction as any).id) ? 'JÁ ARQUIVADO' : 'ARQUIVAR PARA DEPOIS'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-12 border-t border-slate-800 text-center text-slate-600 text-[10px] uppercase font-bold tracking-[0.2em]">
        LotoExpert AI &copy; 2025 • Analytics Modular System
      </footer>
    </div>
  );
};

export default App;
