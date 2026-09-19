/**
 * Replay.jsx — Mission replay viewer  (route: /replay and /replay/:id)
 * =====================================================================
 * Loads the list of missions from the backend and lets the user pick
 * one to replay with scrubable animation.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { PlayCircle, Pause, RotateCcw, ChevronRight } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import { API_URL, apiHeaders } from '../lib/config'

function MissionPill({ mission, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 14px',
        border: `1px solid ${selected ? '#D97706' : '#E2E8F0'}`,
        background: selected ? '#FFFBEB' : '#FFFFFF',
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'border 0.1s, background 0.1s',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
        {mission.mission_id.slice(0, 20)}...
      </div>
      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
        {mission.profile} · {new Date(mission.started_at).toLocaleString()}
      </div>
    </div>
  )
}

export default function Replay() {
  const { id } = useParams()

  const [missions, setMissions] = useState([])
  const [selectedId, setSelectedId] = useState(id || null)
  const [frames, setFrames] = useState([])
  const [playhead, setPlayhead] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [speed, setSpeed] = useState(200)

  const timerRef = useRef(null)

  // Load mission list
  useEffect(() => {
    fetch(`${API_URL}/missions`, { headers: apiHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : data.missions || []
        setMissions(list)
        if (!selectedId && list.length > 0) setSelectedId(list[0].mission_id)
      })
      .catch(() => {})
  }, [])

  // Load frames for selected mission
  const loadMission = useCallback(async () => {
    if (!selectedId) return
    setLoading(true)
    setPlaying(false)
    setPlayhead(0)
    setFrames([])
    try {
      const res = await fetch(`${API_URL}/missions/${selectedId}/replay`, { headers: apiHeaders() })
      if (res.ok) {
        const data = await res.json()
        const frameList = Array.isArray(data) ? data : data.frames || []
        setFrames(frameList.map(f => ({
          ...f,
          time: new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          egt: f.egt_c,
          cht: f.cht_c,
          rpm: f.rpm,
          oil_p: f.oil_pressure_kpa,
        })))
      }
    } catch (e) {
      console.error('Replay load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => { if (selectedId) loadMission() }, [selectedId])

  // Playback loop
  useEffect(() => {
    if (playing && frames.length > 0) {
      timerRef.current = setInterval(() => {
        setPlayhead(p => {
          if (p >= frames.length - 1) { setPlaying(false); return p }
          return p + 1
        })
      }, speed)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [playing, frames.length, speed])

  const current = frames[playhead] ?? null
  const sliced = frames.slice(0, playhead + 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        icon={PlayCircle}
        title="Mission Replay"
        subtitle="Historical telemetry playback — scrub the timeline to inspect any moment"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Mission selector */}
        <Panel>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Missions ({missions.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
            {missions.length === 0 ? (
              <div style={{ fontSize: 13, color: '#94A3B8' }}>No missions found. Start a simulation first.</div>
            ) : missions.map(m => (
              <MissionPill
                key={m.mission_id}
                mission={m}
                selected={m.mission_id === selectedId}
                onClick={() => setSelectedId(m.mission_id)}
              />
            ))}
          </div>
        </Panel>

        {/* Playback panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Chart */}
          <Panel>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
              Telemetry Replay — {frames.length} frames
            </div>

            {loading ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                Loading...
              </div>
            ) : frames.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={sliced} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="time" tick={{ fill: '#94A3B8', fontSize: 9 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="egt" stroke="#D97706" dot={false} strokeWidth={2} name="EGT (°C)" />
                    <Line type="monotone" dataKey="cht" stroke="#DC2626" dot={false} strokeWidth={1.5} name="CHT (°C)" />
                    <Line type="monotone" dataKey="rpm" stroke="#0284C7" dot={false} strokeWidth={1.5} name="RPM" yAxisId="right" />
                  </LineChart>
                </ResponsiveContainer>

                {/* Scrubber */}
                <input
                  id="replay-scrubber"
                  type="range" min={0} max={frames.length - 1} value={playhead}
                  onChange={e => { setPlaying(false); setPlayhead(Number(e.target.value)) }}
                  style={{ width: '100%', marginTop: 12, accentColor: '#D97706' }}
                />
              </>
            ) : (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                Select a mission to begin replay
              </div>
            )}
          </Panel>

          {/* Controls + current frame */}
          {frames.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Controls */}
              <Panel>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Controls</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <button
                    id="replay-play-btn"
                    onClick={() => setPlaying(p => !p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', background: playing ? '#0F172A' : '#D97706',
                      color: '#FFFFFF', border: 'none', borderRadius: 6,
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {playing ? <><Pause size={14}/> Pause</> : <><PlayCircle size={14}/> Play</>}
                  </button>
                  <button
                    id="replay-reset-btn"
                    onClick={() => { setPlaying(false); setPlayhead(0) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', background: '#F1F5F9',
                      color: '#475569', border: '1px solid #E2E8F0', borderRadius: 6,
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={14}/> Reset
                  </button>
                </div>

                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>Playback speed</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ label: '0.5×', ms: 400 }, { label: '1×', ms: 200 }, { label: '2×', ms: 100 }, { label: '4×', ms: 50 }].map(s => (
                    <button
                      key={s.ms}
                      onClick={() => setSpeed(s.ms)}
                      style={{
                        padding: '4px 10px', borderRadius: 4,
                        background: speed === s.ms ? '#0F172A' : '#F1F5F9',
                        color: speed === s.ms ? '#FFFFFF' : '#475569',
                        border: '1px solid #E2E8F0', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </Panel>

              {/* Current frame */}
              <Panel>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                  Frame {playhead + 1} / {frames.length}
                </div>
                {current && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'EGT', value: current.egt_c?.toFixed(1), unit: '°C' },
                      { label: 'CHT', value: current.cht_c?.toFixed(1), unit: '°C' },
                      { label: 'RPM', value: current.rpm?.toFixed(0), unit: '' },
                      { label: 'OIL P', value: current.oil_pressure_kpa?.toFixed(1), unit: 'kPa' },
                      { label: 'FUEL', value: current.fuel_flow_lph?.toFixed(1), unit: 'L/h' },
                      { label: 'VIB', value: current.vibration_g?.toFixed(2), unit: 'g' },
                    ].map(item => (
                      <div key={item.label} style={{ background: '#F8FAFC', borderRadius: 4, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>{item.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                          {item.value ?? '—'}<span style={{ fontSize: 10, color: '#64748B' }}> {item.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {current?.fault_label && current.fault_label !== 'none' && current.fault_label !== 'null' && (
                  <div style={{ marginTop: 10, padding: '6px 10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, fontSize: 12, fontWeight: 700, color: '#DC2626' }}>
                    FAULT: {current.fault_label.replace(/_/g, ' ').toUpperCase()}
                  </div>
                )}
              </Panel>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
