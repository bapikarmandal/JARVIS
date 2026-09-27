import React from 'react';

interface PageHeaderProps {
  title: string;
  eyebrow: string;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, eyebrow, children }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#1d4868]/40">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#6f9cb8] uppercase">
          {eyebrow}
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-[#f4f9ff] font-brand mt-0.5">
          {title}
        </h2>
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
};
