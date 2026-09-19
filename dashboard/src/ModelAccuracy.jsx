/**
 * ModelAccuracy.jsx — Live AI Performance Dashboard
 * Shows the real model metrics from metrics.json in a crazy visual way.
 */
import { useState, useEffect } from 'react';

const METRICS = {
  classifier: {
    accuracy: 99.79,
    precision: 99.74,
    recall: 99.62,
    f1: 99.68,
    testFrames: 264600,
    trainFrames: 928800,
    classes: [
      { name: 'Abnormal Vibration',      f1: 99.62, precision: 99.33, recall: 99.92 },
      { name: 'Combustion Instability',  f1: 99.30, precision: 99.41, recall: 99.18 },
      { name: 'Injector Fault',          f1: 99.70, precision: 99.97, recall: 99.44 },
      { name: 'Lubrication Issue',       f1: 99.94, precision: 100.0, recall: 99.88 },
      { name: 'Misfire',                 f1: 99.71, precision: 99.99, recall: 99.42 },
      { name: 'Nominal (None)',          f1: 99.85, precision: 99.72, recall: 99.98 },
      { name: 'Overheating',             f1: 99.57, precision: 99.55, recall: 99.59 },
      { name: 'Sensor Drift',            f1: 99.73, precision: 99.97, recall: 99.50 },
    ],
  },
  rul: {
    description: 'Gradient Boosting Regressor',
    mae: '4.2h',
    mse: '28.1h²',
    r2: 0.962,
    features: 29,
  },
  anomaly: {
    description: 'Isolation Forest (unsupervised)',
    trainFrames: 427690,
    contamination: 0.05,
  },
};

function CountUp({ target, suffix = '' }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / 60;
    const id = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(id); }
      else setVal(start);
    }, 16);
    return () => clearInterval(id);
  }, [target]);
  return <>{val.toFixed(val < 10 ? 1 : 0)}{suffix}</>;
}

export default function ModelAccuracy() {
  const [activeClass, setActiveClass] = useState(null);

  return (
    <div style={{ padding: '0 0 40px', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
      
      {/* Hero header */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '32px 36px',
        marginBottom: 20,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Big number watermark */}
        <div style={{
          position: 'absolute', right: 30, top: '50%', transform: 'translateY(-50%)',
          fontSize: 180, fontWeight: 900, color: 'var(--border-mid)',
          fontFamily: "'JetBrains Mono', monospace", lineHeight: 1,
          pointerEvents: 'none',
        }}>99.79</div>

        <div style={{ fontSize: 11, color: 'var(--saffron)', letterSpacing: 3, fontWeight: 600, marginBottom: 12 }}>
          DRDO SIH 2026 · ML SUBSYSTEM PERFORMANCE REPORT
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 900, color: 'var(--text-1)', lineHeight: 1, marginBottom: 8 }}>
          <CountUp target={99.79} suffix="%" /> Accuracy
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-3)', maxWidth: 520 }}>
          Fault Classifier evaluated on <strong style={{ color: 'var(--text-2)' }}>264,600 unseen telemetry frames</strong> across 42 held-out missions. Zero data leakage — train/test split by mission ID.
        </p>

        <div style={{ display: 'flex', gap: 32, marginTop: 24 }}>
          {[
            { label: 'Test Frames', value: '264,600', color: '#FF9933' },
            { label: 'Train Frames', value: '928,800', color: '#138808' },
            { label: 'Fault Classes', value: '8', color: '#00d4ff' },
            { label: 'Training Missions', value: '166', color: '#7c3aed' },
            { label: 'Test Missions', value: '42', color: '#f59e0b' },
          ].map(stat => (
            <div key={stat.label}>
              <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, fontFamily: 'JetBrains Mono' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 10, color: '#475569', letterSpacing: 1, marginTop: 2 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Big 4 metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Accuracy',  value: 99.79, color: '#FF9933',  desc: 'Overall correct classifications' },
          { label: 'Precision', value: 99.74, color: '#138808',  desc: 'Positive predictive value (macro)' },
          { label: 'Recall',    value: 99.62, color: '#00d4ff',  desc: 'True positive rate (macro)' },
          { label: 'F1 Score',  value: 99.68, color: '#7c3aed',  desc: 'Harmonic mean of P & R (macro)' },
        ].map(m => (
          <div key={m.label} style={{
            background: 'var(--bg-card-2)',
            border: `1px solid ${m.color}22`,
            borderTop: `3px solid ${m.color}`,
            borderRadius: 16,
            padding: '20px 22px',
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 8 }}>
              {m.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 40, fontWeight: 900, color: m.color, fontFamily: 'JetBrains Mono', lineHeight: 1 }}>
              <CountUp target={m.value} suffix="%" />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 6 }}>{m.desc}</div>
            {/* Mini bar */}
            <div style={{ marginTop: 12, height: 3, background: 'var(--border)', borderRadius: 2 }}>
              <div style={{
                height: '100%', width: `${m.value}%`, borderRadius: 2,
                background: `linear-gradient(90deg, ${m.color}88, ${m.color})`,
              }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Per-class breakdown */}
        <div style={{
          background: 'var(--bg-card-2)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '22px 24px',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: 2, fontWeight: 600, marginBottom: 18 }}>
            PER-CLASS PERFORMANCE
          </div>
          {METRICS.classifier.classes.map((cls, i) => {
            const isActive = activeClass === i;
            return (
              <div
                key={cls.name}
                onClick={() => setActiveClass(isActive ? null : i)}
                style={{
                  cursor: 'pointer',
                  padding: '10px 0',
                  borderBottom: i < METRICS.classifier.classes.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', flex: 1, fontWeight: 500 }}>{cls.name}</div>
                  <div style={{
                    fontSize: 13, fontWeight: 800,
                    color: cls.f1 >= 99.9 ? 'var(--india-green)' : cls.f1 >= 99.5 ? 'var(--saffron)' : 'var(--amber)',
                    fontFamily: 'JetBrains Mono', minWidth: 56, textAlign: 'right',
                  }}>{cls.f1.toFixed(2)}%</div>
                </div>
                {/* F1 bar */}
                <div style={{ marginTop: 5, height: isActive ? 6 : 3, background: 'var(--border)', borderRadius: 3, transition: 'height 0.2s' }}>
                  <div style={{
                    height: '100%',
                    width: `${cls.f1}%`,
                    borderRadius: 3,
                    background: cls.f1 >= 99.9
                      ? 'linear-gradient(90deg, var(--india-green), #22c55e)'
                      : 'linear-gradient(90deg, var(--saffron), var(--amber))',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                {isActive && (
                  <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
                    {[['Precision', cls.precision], ['Recall', cls.recall], ['F1', cls.f1]].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: 1 }}>{k}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cyan)', fontFamily: 'JetBrains Mono' }}>{v.toFixed(2)}%</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right column — other models + explainability */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* RUL Model */}
          <div style={{
            background: 'var(--bg-card-2)',
            border: '1px solid var(--purple)',
            borderLeft: '3px solid var(--purple)',
            borderRadius: 16,
            padding: '18px 20px',
          }}>
            <div style={{ fontSize: 10, color: 'var(--purple)', letterSpacing: 2, fontWeight: 700, marginBottom: 10 }}>
              RUL ESTIMATOR
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
              {METRICS.rul.description}
            </div>
            {[
              ['R² Score', `${(METRICS.rul.r2 * 100).toFixed(1)}%`, 'var(--india-green)'],
              ['Mean Abs Error', METRICS.rul.mae, 'var(--amber)'],
              ['Input Features', `${METRICS.rul.features} vars`, 'var(--cyan)'],
            ].map(([k, v, c]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: c, fontFamily: 'JetBrains Mono' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Anomaly Model */}
          <div style={{
            background: 'var(--bg-card-2)',
            border: '1px solid var(--cyan)',
            borderLeft: '3px solid var(--cyan)',
            borderRadius: 16,
            padding: '18px 20px',
          }}>
            <div style={{ fontSize: 10, color: 'var(--cyan)', letterSpacing: 2, fontWeight: 700, marginBottom: 10 }}>
              ANOMALY DETECTOR
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
              {METRICS.anomaly.description}
            </div>
            {[
              ['Trained On', '427,690 frames', 'var(--india-green)'],
              ['Fault Type', 'Unsupervised', 'var(--saffron)'],
              ['Strategy', 'Clean-only train', 'var(--cyan)'],
            ].map(([k, v, c]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: c }}>{v}</span>
              </div>
            ))}
          </div>

          {/* XAI badge */}
          <div style={{
            background: 'var(--saffron-dim)',
            border: '1px solid var(--saffron-glow)',
            borderRadius: 16,
            padding: '18px 20px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 32 }}>🧠</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--saffron)', marginTop: 8 }}>Explainable AI</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.5 }}>
              SHAP-inspired residual attribution generates human-readable maintenance prose from raw physics deltas.
            </div>
            <div style={{
              marginTop: 12, padding: '8px 12px',
              background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)',
              fontSize: 11, color: 'var(--text-2)', fontStyle: 'italic', lineHeight: 1.4,
            }}>
              "CHT elevated by 47°C above thermodynamic baseline indicating combustion thermal runaway"
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
