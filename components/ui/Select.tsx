
import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, options, id, ...props }) => {
  return (
    <div>
      <label htmlFor={id} className="block mb-2 text-sm font-medium text-slate-300">
        {label}
      </label>
      <select
        id={id}
        className="bg-slate-800/60 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-2 focus:ring-teal-400 focus:border-teal-400 block w-full p-2.5 placeholder-slate-500 transition-all duration-200"
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-800 text-slate-200">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};