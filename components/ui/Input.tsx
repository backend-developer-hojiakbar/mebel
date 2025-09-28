
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

export const Input: React.FC<InputProps> = ({ label, id, ...props }) => {
  return (
    <div>
      <label htmlFor={id} className="block mb-2 text-sm font-medium text-slate-300">
        {label}
      </label>
      <input
        id={id}
        className="bg-slate-800/60 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-2 focus:ring-teal-400 focus:border-teal-400 block w-full p-2.5 placeholder-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-800"
        {...props}
      />
    </div>
  );
};