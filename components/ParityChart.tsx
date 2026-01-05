
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import InfoTooltip from './InfoTooltip';

interface ParityChartProps {
  parity: { even: number; odd: number };
}

const ParityChart: React.FC<ParityChartProps> = ({ parity }) => {
  const data = [
    { name: 'Pares', valor: parseFloat(parity.even.toFixed(2)), color: '#f59e0b' },
    { name: 'Ímpares', valor: parseFloat(parity.odd.toFixed(2)), color: '#3b82f6' },
  ];

  return (
    <div className="h-64 w-full bg-gray-800/50 p-4 rounded-xl border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
        <i className="fa-solid fa-scale-balanced text-emerald-500"></i>
        Equilíbrio Par/Ímpar (Média)
        <InfoTooltip text="Frequência média de dezenas pares e ímpares por jogo no histórico." />
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis type="number" hide domain={[0, 15]} />
          <YAxis 
            dataKey="name" 
            type="category" 
            stroke="#9ca3af" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
          />
          <Tooltip 
            cursor={{ fill: '#374151', opacity: 0.4 }}
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
          />
          <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={40}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
            <LabelList dataKey="valor" position="right" fill="#fff" fontSize={12} offset={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ParityChart;
