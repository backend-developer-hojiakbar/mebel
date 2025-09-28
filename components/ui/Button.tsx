
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ children, className = '', variant = 'primary', ...props }) => {
  const baseClasses = 'font-bold py-2.5 px-5 rounded-lg transition-all duration-300 focus:outline-none focus:ring-4 inline-flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5';

  const variantClasses = {
    primary: 'bg-gradient-to-r from-teal-500 to-fuchsia-500 text-white hover:shadow-teal-400/30 focus:ring-teal-400/50',
    secondary: 'bg-slate-700/50 text-slate-200 hover:bg-slate-700 focus:ring-slate-500/50 border border-slate-600',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};