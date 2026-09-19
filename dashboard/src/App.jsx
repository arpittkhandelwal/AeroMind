import { useState, useCallback, useEffect, useRef } from 'react';
import LiveMissionView from './LiveMissionView';
import FaultAlertsPanel from './FaultAlertsPanel';
import RULPanel from './RULPanel';
import MissionReplayView from './MissionReplayView';
import StartMissionDialog from './StartMissionDialog';
import FormationView from './FormationView';
import ToastAlerts, { fireToast } from './ToastAlerts';
import TelemetryExport from './TelemetryExport';
import SimulationMode from './SimulationMode';
import FleetView from './FleetView';
import ChatCommander from './ChatCommander';
import ModelAccuracy from './ModelAccuracy';
import CommandCenter from './CommandCenter';
import { checkHealth, fetchMissions } from './api';

const NAV = [
  { section: 'OPERATIONS' },
  { id: 'command',   icon: '◈', label: 'Command Center' },
  { id: 'sim',       icon: '🚀', label: 'Simulation Mode' },
  { id: 'fleet',     icon: '🌍', label: 'Fleet Commander' },
  { id: 'live',      icon: '📡', label: 'Live Monitor' },
  { id: 'formation', icon: '🛡️', label: 'Formation View' },
  { section: 'ANALYSIS' },
  { id: 'replay',    icon: '🔄', label: 'Mission Replay' },
  { id: 'accuracy',  icon: '🧠', label: 'Model Accuracy' },
  { section: 'AI TOOLS' },
  { id: 'chat',      icon: '🤖', label: 'AI Commander' },
];

const DEFAULT_MISSION_ID = import.meta.env.VITE_MISSION_ID || 'nominal_overheating_seed42';

const PAGE_TITLES = {
  command:   'Mission Command Center',
  sim:       'Simulation Mode',
  fleet:     'Fleet Commander — Northern Sector',
  live:      'Live Mission Monitor',
  replay:    'Mission Replay & Analysis',
  accuracy:  'AI Model Performance & Metrics',
  formation: 'Multi-UAV Formation',
  chat:      'AI Engine Commander — NLP Interface',
};

export default function App() {
  const [activeTab,       setActiveTab]       = useState('command');
  const [liveAlerts,      setLiveAlerts]      = useState([]);
  const [liveTelemetry,   setLiveTelemetry]   = useState(null);
  const [liveHealth,      setLiveHealth]      = useState(100);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [missionId,       setMissionId]       = useState(DEFAULT_MISSION_ID);
  const [apiOnline,       setApiOnline]       = useState(null);
  const [clock,           setClock]           = useState('');
  const prevFaultRef = useRef(null);

  // Live clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-IN', { hour12: false }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    checkHealth().then(() => setApiOnline(true)).catch(() => setApiOnline(false));
    const iv = setInterval(() => {
      checkHealth().then(() => setApiOnline(true)).catch(() => setApiOnline(false));
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    fetchMissions()
      .then(list => {
        if (list?.length > 0) {
          const demo = list.find(m => m.mission_id === DEFAULT_MISSION_ID);
          setMissionId(demo ? demo.mission_id : list[0].mission_id);
        }
      })
      .catch(() => {});
  }, []);

  const handleAlertsUpdate = useCallback((alerts) => {
    setLiveAlerts(alerts);
    if (alerts?.length > 0) {
      const latest = alerts[0];
      const key = `${latest.fault_type}-${latest.detected_at}`;
      if (key !== prevFaultRef.current) {
        prevFaultRef.current = key;
        fireToast(latest);
      }
    }
  }, []);

  const handleTelemetryUpdate = useCallback((telem, health) => {
    setLiveTelemetry(telem);
    setLiveHealth(health);
  }, []);

  return (
    <div className="app">
      <ToastAlerts />

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-brand">
            <img src="/drdo_logo.png" alt="DRDO" className="sidebar-logo-img" />
            <div className="sidebar-brand-text">
              <div className="sidebar-brand-name">UAV Digital Twin</div>
              <div className="sidebar-brand-sub">DRDO · PS-26054 · SIH 2026</div>
            </div>
          </div>
        </div>

        {/* India tricolor accent bar */}
        <div className="sidebar-tricolor">
          <span style={{ background: '#FF9933' }} />
          <span style={{ background: '#ffffff' }} />
          <span style={{ background: '#138808' }} />
        </div>

        {/* API status */}
        <div className="sidebar-status">
          <div className={`status-dot ${apiOnline === false ? 'offline' : ''}`} />
          <span>
            {apiOnline === null ? 'Connecting…' : apiOnline ? 'API Online' : 'API Offline'}
          </span>
        </div>

        {/* Mission ID */}
        {missionId && (
          <div className="sidebar-mission">
            <div className="sidebar-mission-label">ACTIVE MISSION</div>
            <div className="sidebar-mission-id">{missionId}</div>
          </div>
        )}

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV.map((item, i) => item.section
            ? <div key={i} className="nav-section-label">{item.section}</div>
            : (
              <button
                key={item.id}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
                {item.id === 'live' && liveAlerts.length > 0 && (
                  <span className="nav-item-badge">{liveAlerts.length}</span>
                )}
              </button>
            )
          )}
        </nav>

        {/* Bottom actions */}
        <div className="sidebar-actions">
          <button className="btn-launch" onClick={() => setShowStartDialog(true)}>
            🚀 Launch Mission
          </button>
          <TelemetryExport
            telemetry={liveTelemetry}
            healthIndex={liveHealth}
            alerts={liveAlerts}
            missionId={missionId}
            className="btn-export-sidebar"
          />
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="main-wrapper">
        {/* Topbar */}
        <header className="topbar">
          <span className="topbar-title">{PAGE_TITLES[activeTab]}</span>
          <div className="topbar-divider" />
          <span className="topbar-breadcrumb">
            {activeTab === 'live' && `Health: ${liveHealth.toFixed(0)}%`}
            {activeTab === 'formation' && '3 UAVs Active'}
            {activeTab === 'replay' && 'Historical Data'}
          </span>
          <div className="topbar-right">
            <span className="topbar-time">IST {clock}</span>
            <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
            <img src="/india_flag.png" alt="India" style={{ height: 16, borderRadius: 2, opacity: 0.8 }} />
          </div>
        </header>

        {/* Page Content */}
        {activeTab === 'sim' ? (
          <div className="page-sim-fullscreen">
            <SimulationMode />
          </div>
        ) : (
        <div className="page-content">
          {activeTab === 'live' && (
            <div className="dashboard-grid">
              <LiveMissionView
                missionId={missionId}
                onAlertsUpdate={handleAlertsUpdate}
                onTelemetryUpdate={handleTelemetryUpdate}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <RULPanel missionId={missionId} />
                <FaultAlertsPanel
                  missionId={missionId}
                  liveAlerts={liveAlerts}
                />
              </div>
            </div>
          )}
          {activeTab === 'command' && (
            <CommandCenter
              apiOnline={apiOnline}
              missionId={missionId}
              onLaunch={() => setShowStartDialog(true)}
            />
          )}
          {activeTab === 'replay' && <MissionReplayView />}
          {activeTab === 'accuracy' && (
            <div style={{ maxWidth: 1000, margin: '0 auto', paddingTop: 20 }}>
              <ModelAccuracy />
            </div>
          )}

          {activeTab === 'fleet' && (
            <div style={{ height: 'calc(100vh - 120px)' }}>
              <FleetView onSelectUAV={(uav) => {
                // If a failing UAV is clicked, we can switch to sim view
                if (uav.status !== 'nominal') setActiveTab('sim');
              }} />
            </div>
          )}

          {activeTab === 'chat' && (
            <div style={{ height: 'calc(100vh - 120px)', maxWidth: 700, margin: '0 auto' }}>
              <ChatCommander missionId={missionId} />
            </div>
          )}

          {activeTab === 'formation' && (
            <FormationView telemetry={liveTelemetry} />
          )}
        </div>
        )}
      </div>

      {showStartDialog && (
        <StartMissionDialog
          onClose={() => setShowStartDialog(false)}
          onStarted={(id) => {
            setMissionId(id);
            setActiveTab('live');
            setShowStartDialog(false);
          }}
        />
      )}
    </div>
  );
}
