'use client';

import React from 'react';

type ProfileProgressProps = {
  items: {
    account: boolean;
    email: boolean;
    contact: boolean;
    vehicle: boolean;
  };
  percent: number;
};

export function ProfileProgress({ items, percent }: ProfileProgressProps) {
  const steps = [
    { key: 'account', label: 'Account created' },
    { key: 'email', label: 'Email verified' },
    { key: 'contact', label: 'Phone number & Address' },
    { key: 'vehicle', label: 'Vehicle' },
  ] as const;

  let firstNotDoneFound = false;

  return (
    <div className="w-full max-w-[32rem] rounded-xl border bg-card p-6 shadow-sm mx-auto mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Profile completion</h2>
        <span className="text-sm font-bold text-brand">{percent}%</span>
      </div>

      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-6">
        <div 
          className="h-full bg-brand transition-all duration-500 ease-in-out" 
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="relative flex justify-between">
        <div className="absolute left-0 top-3 h-[2px] w-full -translate-y-1/2 bg-muted -z-10" />
        
        {steps.map((step, index) => {
          const isDone = items[step.key];
          let isActive = false;
          
          if (!isDone && !firstNotDoneFound) {
            isActive = true;
            firstNotDoneFound = true;
          }

          // Line to next circle
          const isNextLineDone = isDone;

          return (
            <div key={step.key} className="flex flex-col items-center flex-1 relative z-10">
              {index < steps.length - 1 && (
                <div 
                  className={`absolute left-1/2 top-3 h-[2px] w-full -translate-y-1/2 -z-10 transition-colors duration-300 ${
                    isNextLineDone ? 'bg-green-500' : 'bg-muted'
                  }`} 
                />
              )}
              
              <div 
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold border-2 bg-background transition-colors duration-300 ${
                  isDone 
                    ? 'border-green-500 bg-green-500 text-white' 
                    : isActive 
                      ? 'border-brand text-brand' 
                      : 'border-muted-foreground/30 text-muted-foreground/50'
                }`}
              >
                {index + 1}
              </div>
              <span className={`mt-2 text-[9px] text-center max-w-[4rem] leading-tight sm:text-[10px] sm:max-w-full ${
                isDone || isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
