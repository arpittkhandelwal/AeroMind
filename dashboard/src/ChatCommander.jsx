/**
 * ChatCommander — AI Chatbot panel for live natural language Q&A.
 * Operator types questions, gets contextual AI answers about the engine.
 */
import { useState, useRef, useEffect } from 'react';
import { sendChat } from './api';

const SUGGESTIONS = [
  'What is the engine status?',
  'Why is health dropping?',
  'What should I do now?',
  'How much life is remaining?',
  'Explain the current fault.',
];

export default function ChatCommander({ missionId }) {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: 'Namaste, Commander. AI Engine Monitor online. Ask me anything about the engine status, faults, or what actions to take.',
    },
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (question) => {
    const q = question || input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await sendChat(q, missionId);
      setMessages(m => [...m, { role: 'ai', text: res.response }]);
    } catch {
      setMessages(m => [...m, { role: 'ai', text: '⚠ Communication error. Backend may be offline.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-card-2)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--bg-surface)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--saffron), var(--india-green))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>🤖</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>AI Engine Commander</div>
          <div style={{ fontSize: 10, color: 'var(--india-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--india-green)', display: 'inline-block', animation: 'blink 2s ease-in-out infinite' }} />
            ONLINE — DRDO Neural Interface
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 12,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              background: msg.role === 'user'
                ? 'var(--saffron-dim)'
                : 'var(--bg-card)',
              border: msg.role === 'user'
                ? '1px solid var(--saffron-glow)'
                : '1px solid var(--border)',
              fontSize: 12,
              lineHeight: 1.5,
              color: 'var(--text-1)',
            }}>
              {msg.role === 'ai' && (
                <div style={{ fontSize: 9, color: 'var(--india-blue)', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
                  AI COMMANDER
                </div>
              )}
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '8px 14px',
              borderRadius: '12px 12px 12px 4px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              fontSize: 12, color: 'var(--text-3)',
            }}>
              ● ● ●
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div style={{
        display: 'flex', gap: 4, flexWrap: 'wrap',
        padding: '6px 12px',
        borderTop: '1px solid var(--border)',
      }}>
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => send(s)}
            style={{
              fontSize: 9, padding: '3px 8px', borderRadius: 10,
              background: 'var(--cyan-dim)',
              border: '1px solid var(--cyan-dim)',
              color: 'var(--text-3)', cursor: 'pointer',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', gap: 8, padding: '8px 12px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-surface)',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask the AI about engine status…"
          style={{
            flex: 1, background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 12px',
            color: 'var(--text-1)', fontSize: 12, outline: 'none',
          }}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{
            background: 'var(--saffron)',
            border: 'none', borderRadius: 8, padding: '8px 16px',
            color: '#fff', fontWeight: 700, fontSize: 12,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
