
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { COLORS } from '../constants';
import InfoTooltip from './InfoTooltip';

interface FrequencyChartProps {
  data: Record<number, number>;
}

const FrequencyChart: React.FC<FrequencyChartProps> = ({ data }) => {
  const chartData = Object.entries(data).map(([num, count]) => ({
    name: num,
    frequencia: count as number
  })).sort((a, b) => parseInt(a.name) - parseInt(b.name));

  const maxFreq = chartData.length > 0 ? Math.max(...chartData.map(d => d.frequencia)) : 0;

  return (
    <div className="h-64 w-full bg-gray-800/50 p-4 rounded-xl border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
        <i className="fa-solid fa-chart-column text-emerald-500"></i>
        Frequência das Dezenas
        <InfoTooltip text="Total de vezes que cada dezena apareceu nos sorteios processados." />
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} />
          <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip 
            cursor={{ fill: '#374151' }}
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
          />
          <Bar dataKey="frequencia" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.frequencia > maxFreq * 0.8 ? COLORS.PRIMARY : entry.frequencia < maxFreq * 0.4 ? '#4b5563' : '#6b7280'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FrequencyChart;
