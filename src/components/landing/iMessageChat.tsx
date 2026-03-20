import React, { useState, useEffect, useRef, useCallback } from 'react';

const MiniChart: React.FC = () => {
  const bars = [35, 52, 44, 68, 85, 72, 91, 78, 95, 88, 100, 93];
  return (
    <div className="bg-[#1c1c1e] rounded-xl p-3 mt-1.5">
      <style>{`
        @keyframes barGrow {
          from { height: 0%; }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-400 font-medium">Engagement Rate</span>
        <span className="text-[10px] text-green-400 font-semibold" style={{ animation: 'countUp 0.5s ease-out 0.8s both' }}>+34.2%</span>
      </div>
      <div className="flex items-end gap-[3px] h-12">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-gradient-to-t from-blue-500 to-cyan-400 opacity-80"
            style={{
              height: `${h}%`,
              animation: `barGrow 0.6s ease-out ${i * 0.07}s both`,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[8px] text-gray-500">Jan</span>
        <span className="text-[8px] text-gray-500">Jun</span>
        <span className="text-[8px] text-gray-500">Dec</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-700/50">
        <div style={{ animation: 'countUp 0.4s ease-out 1s both' }}>
          <p className="text-[8px] text-gray-500">Avg Views</p>
          <p className="text-[11px] text-white font-semibold">2.4M</p>
        </div>
        <div style={{ animation: 'countUp 0.4s ease-out 1.15s both' }}>
          <p className="text-[8px] text-gray-500">Eng. Rate</p>
          <p className="text-[11px] text-white font-semibold">8.7%</p>
        </div>
        <div style={{ animation: 'countUp 0.4s ease-out 1.3s both' }}>
          <p className="text-[8px] text-gray-500">Growth</p>
          <p className="text-[11px] text-green-400 font-semibold">+34%</p>
        </div>
      </div>
    </div>
  );
};

interface MessageData {
  id: number;
  isUser: boolean;
  showTail?: boolean;
  avatar?: string;
  content: React.ReactNode;
}

const messages: Omit<MessageData, 'id'>[] = [
  {
    isUser: true,
    avatar: '/user-pfp.jpg',
    content: <p>Hey Open Claw, analyze this video for me 👇</p>,
  },
  {
    isUser: true,
    showTail: true,
    content: (
      <div className="flex items-center gap-2.5">
        <img src="/video-thumb.jpg" alt="Video thumbnail" className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-white text-[11px] font-semibold leading-tight">i'm always the biggest person in the room</p>
          <p className="text-blue-200 text-[10px] mt-0.5">tiktok.com · 2.4M views</p>
        </div>
      </div>
    ),
  },
  {
    isUser: false,
    avatar: '/openclaw.webp',
    content: (
      <div>
        <p>Sure thing! I analyzed the account you sent. Here are the insights:</p>
        <MiniChart />
        <p className="mt-2">Would you like me to analyze their top performing video and their hooks?</p>
      </div>
    ),
  },
  {
    isUser: true,
    avatar: '/user-pfp.jpg',
    content: <p>Yes!</p>,
  },
  {
    isUser: false,
    avatar: '/openclaw.webp',
    content: (
      <div>
        <p className="font-semibold mb-1.5">🎣 Top Hooks from this creator:</p>
        <div className="space-y-1.5 text-[12px]">
          <div className="bg-[#2c2c2e] rounded-lg px-2.5 py-1.5">
            <p className="text-blue-400 font-medium text-[10px]">Hook #1 — 4.2M views</p>
            <p>"Nobody talks about this but..."</p>
          </div>
          <div className="bg-[#2c2c2e] rounded-lg px-2.5 py-1.5">
            <p className="text-blue-400 font-medium text-[10px]">Hook #2 — 2.8M views</p>
            <p>"I tested this for 30 days and the results were insane"</p>
          </div>
          <div className="bg-[#2c2c2e] rounded-lg px-2.5 py-1.5">
            <p className="text-blue-400 font-medium text-[10px]">Hook #3 — 1.9M views</p>
            <p>"Stop scrolling if you want to grow on social media"</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">Pattern: Open loops + bold claims perform 3.2x better for this creator 📈</p>
      </div>
    ),
  },
];

const DELAYS = [800, 1400, 3000, 4800, 6200];
const LOOP_PAUSE = 4000;
const TOTAL_CYCLE = DELAYS[DELAYS.length - 1] + LOOP_PAUSE;

const IMessageChat: React.FC = () => {
  const [visibleCount, setVisibleCount] = useState(0);
  const [typingIndex, setTypingIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cycleKey, setCycleKey] = useState(0);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Reset state for new cycle
    setVisibleCount(0);
    setTypingIndex(null);

    DELAYS.forEach((delay, i) => {
      // Show typing indicator
      timers.push(setTimeout(() => {
        setTypingIndex(i);
        scrollToBottom();
      }, delay - 600));

      // Show message
      timers.push(setTimeout(() => {
        setTypingIndex(null);
        setVisibleCount(i + 1);
        // scroll after render
        requestAnimationFrame(scrollToBottom);
      }, delay));
    });

    // Reset and loop
    timers.push(setTimeout(() => {
      setCycleKey(k => k + 1);
    }, TOTAL_CYCLE));

    return () => timers.forEach(clearTimeout);
  }, [cycleKey, scrollToBottom]);

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="w-full max-w-[380px] mx-auto">
        {/* Phone frame */}
        <div className="bg-[#2a2a2a] rounded-[2.5rem] p-[6px] shadow-2xl shadow-black/50 ring-1 ring-white/10">
          <div className="bg-[#1c1c1e] rounded-[2.1rem] overflow-hidden relative">
            {/* Dynamic Island */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-[22px] bg-black rounded-full z-30" />

            {/* Status bar */}
            <div className="flex items-center justify-between px-7 pt-3 pb-1 relative z-20">
              <span className="text-white text-[11px] font-semibold">9:41</span>
              <div className="flex items-center gap-1">
                <div className="flex gap-[2px] items-end">
                  <div className="w-[3px] h-[4px] bg-white rounded-[0.5px]" />
                  <div className="w-[3px] h-[6px] bg-white rounded-[0.5px]" />
                  <div className="w-[3px] h-[8px] bg-white rounded-[0.5px]" />
                  <div className="w-[3px] h-[10px] bg-white rounded-[0.5px]" />
                </div>
                <span className="text-white text-[11px] ml-1">5G</span>
                <div className="w-6 h-3 border border-white rounded-[3px] ml-1 relative">
                  <div className="absolute inset-[1.5px] right-[3px] bg-green-400 rounded-[1.5px]" />
                </div>
              </div>
            </div>

            {/* Chat header */}
            <div className="flex items-center gap-2.5 px-4 py-2 border-b border-gray-700/40">
              <svg className="w-4 h-4 text-[#007AFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <img src="/openclaw.webp" alt="Open Claw" className="w-8 h-8 rounded-full object-cover" />
              <div className="flex-1">
                <p className="text-white text-sm font-semibold leading-tight">Open Claw 🦞</p>
                <p className="text-gray-400 text-[10px]">AI Agent</p>
              </div>
              <svg className="w-5 h-5 text-[#007AFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>

            {/* Messages area */}
            <div ref={scrollRef} className="px-3 py-3 space-y-2 min-h-[420px] max-h-[420px] overflow-y-auto bg-[#000000] scroll-smooth">
              {messages.slice(0, visibleCount).map((msg, i) => (
                <div
                  key={`${cycleKey}-${i}`}
                  className={`flex items-end gap-1.5 ${msg.isUser ? 'justify-end' : 'justify-start'} animate-[fadeSlideIn_0.3s_ease-out]`}
                >
                  {!msg.isUser && msg.avatar && (
                    <img src={msg.avatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" />
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-[1.35] ${
                      msg.isUser
                        ? `bg-[#007AFF] text-white ${msg.showTail ? 'rounded-br-md' : ''}`
                        : `bg-[#3a3a3c] text-[#e5e5e7] ${msg.showTail ? 'rounded-bl-md' : ''}`
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.isUser && msg.avatar && (
                    <img src={msg.avatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" />
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {typingIndex !== null && (
                <div className={`flex items-end gap-1.5 ${messages[typingIndex].isUser ? 'justify-end' : 'justify-start'}`}>
                  {!messages[typingIndex].isUser && messages[typingIndex].avatar && (
                    <img src={messages[typingIndex].avatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-0.5" />
                  )}
                  <div className="bg-[#3a3a3c] rounded-2xl px-4 py-2.5">
                    <div className="flex gap-1 items-center">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input bar */}
            <div className="px-3 py-2 bg-[#1c1c1e] border-t border-gray-700/40">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#007AFF] flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="flex-1 bg-[#2c2c2e] rounded-full px-3.5 py-1.5">
                  <p className="text-gray-500 text-[13px]">iMessage</p>
                </div>
              </div>
            </div>

            {/* Home indicator */}
            <div className="flex justify-center pb-2 pt-1">
              <div className="w-28 h-1 bg-gray-600 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default IMessageChat;
