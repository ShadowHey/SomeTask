"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

interface AskAIProps {
  recordingId: string;
}

export function AskAI({ recordingId }: AskAIProps) {
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([
    { role: 'ai', text: 'Hi! I am the local AI assistant for this recording. What would you like to know?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setInput('');
    setIsTyping(true);
    
    try {
      const response = await api.recordings.askQuestion(recordingId, userMessage);
      setMessages(prev => [...prev, { role: 'ai', text: response.answer }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I encountered an error while trying to answer your question." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col flex-1 min-h-0">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <SparklesIcon className="w-5 h-5 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Ask AI</h3>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto space-y-4 text-sm" ref={scrollRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <span className="text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider ml-1 mr-1">
              {msg.role === 'user' ? 'You' : 'AI Agent'}
            </span>
            <div className={`px-4 py-2.5 rounded-2xl max-w-[90%] ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-sm' 
                : 'bg-gray-100 text-gray-800 rounded-tl-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider ml-1">AI Agent</span>
            <div className="px-4 py-3 rounded-2xl bg-gray-100 rounded-tl-sm flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" style={{ animationName: 'bounce', animationDuration: '1s', animationIterationCount: 'infinite', animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" style={{ animationName: 'bounce', animationDuration: '1s', animationIterationCount: 'infinite', animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" style={{ animationName: 'bounce', animationDuration: '1s', animationIterationCount: 'infinite', animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>
      
      <div className="p-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this recording..."
            className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-white"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isTyping}
            className="bg-indigo-600 text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0 shadow-sm"
          >
            <svg className="w-4 h-4 translate-x-[1px] translate-y-[1px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
