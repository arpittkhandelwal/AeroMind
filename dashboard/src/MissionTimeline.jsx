import { useState, useEffect, useRef } from 'react';

export default function MissionTimeline({ frames, currentIndex, onScrub, faultEvents }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const trackRef = useRef();
  const playRef  = useRef();

  const total = Math.max(frames?.length || 1, 1);
  const pct   = ((currentIndex || 0) / (total - 1)) * 100;

  // Playback ticker
  useEffect(() => {
    if (!isPlaying) { clearInterval(playRef.current); return; }
    playRef.current = setInterval(() => {
      onScrub(prev => {
        const next = (prev || 0) + 1;
        if (next >= total - 1) { setIsPlaying(false); return total - 1; }
        return next;
      });
    }, 100);
    return () => clearInterval(playRef.current);
  }, [isPlaying, total, onScrub]);

  const handleTrackClick = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onScrub(Math.round(ratio * (total - 1)));
  };

  const currentFrame = frames?.[currentIndex];
  const elapsed = currentFrame
    ? `T+${currentIndex}s`
    : '—';

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <button
          className="timeline-play-btn"
          onClick={() => setIsPlaying(p => !p)}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <span className="timeline-label">Mission Timeline</span>
        <span className="timeline-elapsed">{elapsed}</span>
        <span className="timeline-total">{total} frames</span>
      </div>

      <div
        ref={trackRef}
        className="timeline-track"
        onClick={handleTrackClick}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseMove={(e) => isDragging && handleTrackClick(e)}
      >
        {/* Fault event markers */}
        {(faultEvents || []).map((fe, i) => (
          <div
            key={i}
            className="timeline-fault-marker"
            style={{ left: `${(fe.index / (total - 1)) * 100}%` }}
            title={fe.fault_type}
          />
        ))}

        {/* Progress fill */}
        <div className="timeline-fill" style={{ width: `${pct}%` }} />

        {/* Scrub handle */}
        <div className="timeline-handle" style={{ left: `${pct}%` }} />
      </div>

      {/* Current frame telemetry summary */}
      {currentFrame && (
        <div className="timeline-frame-info">
          <span>RPM: {currentFrame.rpm?.toFixed(0)}</span>
          <span>CHT: {currentFrame.cht_c?.toFixed(1)}°C</span>
          <span>Alt: {currentFrame.altitude_m?.toFixed(0)}m</span>
          {currentFrame.fault_label && currentFrame.fault_label !== 'none' && (
            <span className="timeline-fault-tag">⚠ {currentFrame.fault_label}</span>
          )}
        </div>
      )}
    </div>
  );
}
