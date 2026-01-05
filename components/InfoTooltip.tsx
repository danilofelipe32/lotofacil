
import React from 'react';

interface InfoTooltipProps {
  text: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ text }) => (
  <div className="group relative inline-block ml-1.5 align-middle">
    {/* O ícone serve como o trigger do hover para o grupo */}
    <i className="fa-solid fa-circle-info text-[10px] text-gray-500 cursor-help hover:text-emerald-400 transition-all duration-200 transform hover:scale-125"></i>
    
    {/* Tooltip content: Aparece apenas sob hover do ícone (grupo) */}
    <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-52 p-2.5 bg-gray-800 text-[10px] text-gray-200 rounded-xl shadow-2xl border border-gray-600 z-[99] pointer-events-none text-center leading-relaxed normal-case font-medium transition-all duration-300 transform scale-95 group-hover:scale-100">
      <p>{text}</p>
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-800"></div>
    </div>
  </div>
);

export default InfoTooltip;
