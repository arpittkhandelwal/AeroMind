/**
 * MissionReplay.jsx
 * =================
 * Loads historical telemetry from the backend REST API and plays it back
 * as a scrubable animation.
 *
 * TODO (Front): add a proper time-range picker (date + time).
 * TODO (Front): sync the playhead with the alert list to highlight
 *   which alerts were active at each replay timestamp.
 * TODO (Front): add playback speed control (0.5×, 1×, 2×, 4×).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

import { API_URL } from '../lib/config'

export default function MissionReplay() {
  const [loading, setLoading]   = useState(false)
  const [data, setData]         = useState([])
  const [playhead, setPlayhead] = useState(0)
  const [playing, setPlaying]   = useState(false)
  const [error, setError]       = useState(null)

  // Simple default: last 30 minutes
  const [fromTs, setFromTs] = useState(() => {
    const d = new Date(); d.setMinutes(d.getMinutes() - 30); return d.toISOString().slice(0, 16)
  })
  const [toTs, setToTs] = useState(() => new Date().toISOString().slice(0, 16))

  const timerRef = useRef(null)

  const loadMission = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `${API_URL}/api/telemetry/history?from=${encodeURIComponent(fromTs)}&to=${encodeURIComponent(toTs)}`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const rows = await res.json()
      setData(rows.map((r) => ({ ...r, time: new Date(r.timestamp).toLocaleTimeString() })))
      setPlayhead(0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [fromTs, toTs])

  // Auto-play animation
  useEffect(() => {
    if (playing && data.length > 0) {
      timerRef.current = setInterval(() => {
        setPlayhead((p) => {
          if (p >= data.length - 1) { setPlaying(false); return p }
          return p + 1
        })
      }, 200)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [playing, data.length])

  const current = data[playhead] ?? null

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-3">Mission Replay</h2>

      {/* Time range picker */}
      <div className="flex flex-wrap gap-2 mb-3 items-end">
        <label className="flex flex-col text-xs text-slate-400 gap-1">
          From
          <input
            id="replay-from"
            type="datetime-local"
            value={fromTs}
            onChange={(e) => setFromTs(e.target.value)}
            className="rounded px-2 py-1 text-slate-200 text-xs"
            style={{ background: '#1f2937', border: '1px solid #374151' }}
          />
        </label>
        <label className="flex flex-col text-xs text-slate-400 gap-1">
          To
          <input
            id="replay-to"
            type="datetime-local"
            value={toTs}
            onChange={(e) => setToTs(e.target.value)}
            className="rounded px-2 py-1 text-slate-200 text-xs"
            style={{ background: '#1f2937', border: '1px solid #374151' }}
          />
        </label>
        <button
          id="replay-load-btn"
          onClick={loadMission}
          disabled={loading}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
          style={{ background: '#3b82f6', color: '#fff' }}
        >
          {loading ? 'Loading…' : 'Load'}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs mb-2">Error: {error}</p>}

      {/* Chart */}
      {data.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={data.slice(0, playhead + 1)} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8 }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Line type="monotone" dataKey="egt" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="EGT" />
              <Line type="monotone" dataKey="rpm" stroke="#3b82f6" dot={false} strokeWidth={1.5} name="RPM" />
            </LineChart>
          </ResponsiveContainer>

          {/* Scrubber */}
          <input
            id="replay-scrubber"
            type="range"
            min={0}
            max={data.length - 1}
            value={playhead}
            onChange={(e) => { setPlaying(false); setPlayhead(Number(e.target.value)) }}
            className="w-full mt-2 accent-blue-500"
          />

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-500">
              {current?.time ?? '—'} | fault: <b className="text-slate-300">{current?.fault_label ?? 'normal'}</b>
            </span>
            <button
              id="replay-play-btn"
              onClick={() => setPlaying((p) => !p)}
              className="px-3 py-1 rounded text-xs font-semibold"
              style={{ background: playing ? '#374151' : '#3b82f6', color: '#fff' }}
            >
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
          </div>
        </>
      ) : (
        <p className="text-slate-500 text-sm mt-6 text-center">
          Select a time range and click <b>Load</b> to replay a mission.
        </p>
      )}
    </div>
  )
}
