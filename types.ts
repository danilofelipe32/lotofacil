
export interface LotofacilDraw {
  concurso: number;
  data: string;
  numbers: number[];
}

export interface DuplicateEntry {
  numbers: number[];
  concursos: number[];
}

export interface Statistics {
  frequency: Record<number, number>;
  parity: { even: number; odd: number };
  sumAvg: number;
  sumStdDev: number;
  sumMedian: number;
  sumMode: number[];
  primeCount: Record<number, number>;
  repeatsFromPrevious: number[];
  duplicates: DuplicateEntry[];
}

export interface PredictionResult {
  numbers: number[];
  reasoning: string;
  confidence: number;
}

export interface SavedPrediction extends PredictionResult {
  id: string;
  timestamp: number;
}
