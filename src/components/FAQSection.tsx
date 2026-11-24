import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import type { FAQItem } from '../data/routesData';

interface FAQSectionProps {
  faqs: FAQItem[];
}

export const FAQSection: React.FC<FAQSectionProps> = ({ faqs }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!faqs || faqs.length === 0) return null;

  return (
    <section className="w-full max-w-4xl mx-auto py-12 px-4 sm:px-6">
      <div className="text-center space-y-2 mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
          <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
          <span>Got Questions?</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Frequently Asked Questions
        </h2>
        <p className="text-sm text-slate-600 max-w-xl mx-auto">
          Fact-based answers regarding our browser inference engine, audio privacy, and separation quality.
        </p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className={`rounded-2xl border transition-all ${
                isOpen
                  ? 'bg-slate-50/80 border-indigo-200 shadow-sm ring-1 ring-indigo-500/10'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full px-6 py-4.5 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
              >
                <span className="font-semibold text-slate-900 text-sm sm:text-base">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-indigo-600 flex-shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-6 pb-5 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-200/80 animate-in fade-in duration-150">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
