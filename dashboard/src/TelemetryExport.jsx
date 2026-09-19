import { fetchMissionReport } from './api';

export default function TelemetryExport({ telemetry, healthIndex, alerts, missionId }) {
  const handleExport = async () => {
    let report = null;
    try { report = await fetchMissionReport(missionId); } catch { /* latest snapshot remains a useful fallback */ }
    // Build HTML content that looks like a classified PDF report
    const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const reportAlerts = report?.alerts || alerts || [];
    const faultList = reportAlerts.map(a =>
      `<tr>
        <td>${a.fault_type?.replace(/_/g,' ')}</td>
        <td style="color:${a.severity==='critical'?'#dc2626':'#d97706'}">${a.severity?.toUpperCase()}</td>
        <td>${a.message || '—'}</td>
        <td>${a.recommended_action || '—'}</td>
       </tr>`
    ).join('') || '<tr><td colspan="4">No faults detected</td></tr>';
    const clean = (value) => String(value ?? '—').replace(/[&<>]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[char]));
    const factors = report?.local_explanation || [];
    const actions = report?.override_events || [];
    const ranges = report?.sensor_ranges || {};
    const trend = report?.health?.trend || 'stable';
    const verdict = reportAlerts.some(a => a.severity === 'critical') ? 'MISSION RISK — IMMEDIATE ACTION REQUIRED' : trend === 'degrading' ? 'DEGRADATION DETECTED — CONTROLLED RECOVERY ADVISED' : 'NOMINAL — CONTINUE WITH MONITORING';
    const verdictClass = reportAlerts.some(a => a.severity === 'critical') ? 'critical' : trend === 'degrading' ? 'caution' : 'nominal';
    const evidenceList = factors.length ? factors.map((factor, index) => `<div class="evidence"><b>${String(index + 1).padStart(2, '0')}</b><span>${clean(factor)}</span></div>`).join('') : '<div class="evidence"><b>01</b><span>No significant physics or ML evidence was active at export time.</span></div>';
    const rangeRows = Object.entries(ranges).map(([key, range]) => `<tr><td>${clean(key.replace(/_/g, ' '))}</td><td>${clean(range.min)}</td><td>${clean(range.max)}</td><td><b>${clean(range.latest)}</b></td></tr>`).join('') || '<tr><td colspan="4">Historical range data unavailable</td></tr>';
    const actionRows = actions.length ? actions.map(action => `<div class="timeline-row"><i></i><div><b>${clean(action.action?.replace(/_/g, ' '))}</b><small>${clean(action.timestamp)} · ${clean(action.operator_id)}</small></div><em>COMMAND EXECUTED</em></div>`).join('') : '<div class="timeline-row"><i class="muted"></i><div><b>No operator intervention recorded</b><small>The engine remained under autonomous monitoring.</small></div><em>OBSERVE</em></div>';
    const chartValues = (report?.rul_history || []).map(point => Number(point.rul_hours)).filter(Number.isFinite);
    const sparkline = (() => {
      if (chartValues.length < 2) return '<div class="no-chart">Historical RUL trend will appear as telemetry accumulates.</div>';
      const min = Math.min(...chartValues), max = Math.max(...chartValues), spread = Math.max(max - min, 0.1);
      const points = chartValues.map((value, index) => `${(index / (chartValues.length - 1) * 620).toFixed(1)},${(148 - ((value - min) / spread * 112)).toFixed(1)}`).join(' ');
      return `<svg class="trend-chart" viewBox="0 0 620 160" preserveAspectRatio="none"><defs><linearGradient id="reportFill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#e65100" stop-opacity=".35"/><stop offset="1" stop-color="#e65100" stop-opacity="0"/></linearGradient></defs><path d="M ${points} L 620,160 L 0,160 Z" fill="url(#reportFill)"/><polyline points="${points}" fill="none" stroke="#e65100" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>`;
    })();

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>DRDO UAV Mission Report — ${missionId}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Inter:wght@400;600&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', sans-serif; background: #fff; color: #111; padding: 40px; }
    .watermark {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-45deg);
      font-size: 80px; color: rgba(220,38,38,0.07); font-weight: 900; white-space: nowrap;
      pointer-events: none; z-index: 0; font-family: 'Courier Prime', monospace;
    }
    .header { text-align: center; border-bottom: 3px double #111; padding-bottom: 20px; margin-bottom: 24px; }
    .header .title { font-size: 22px; font-weight: 700; letter-spacing: 2px; }
    .header .sub { font-size: 11px; color: #555; margin-top: 4px; letter-spacing: 1px; }
    .classified { background: #dc2626; color: #fff; padding: 4px 14px; display: inline-block;
      font-size: 11px; font-weight: 700; letter-spacing: 3px; margin-bottom: 8px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 13px; letter-spacing: 2px; text-transform: uppercase;
      border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 12px; color: #444; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .kv { display: flex; justify-content: space-between; padding: 4px 0;
      border-bottom: 1px dotted #eee; font-size: 13px; }
    .kv .k { color: #666; }
    .kv .v { font-weight: 600; }
    .health-bar { height: 16px; background: #f0f0f0; border-radius: 4px; overflow: hidden; margin: 8px 0; }
    .health-fill { height: 100%; background: ${(healthIndex||50)>75?'#16a34a':(healthIndex||50)>50?'#d97706':'#dc2626'}; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #1e293b; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; letter-spacing: 1px; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #f8f8f8; }
    .footer { margin-top: 40px; font-size: 10px; color: #888; text-align: center;
      border-top: 1px solid #ddd; padding-top: 12px; font-family: 'Courier Prime', monospace; }
    .verdict { border-left: 6px solid #16a34a; background:#f0fdf4; padding:16px 18px; margin-bottom:24px; }.verdict.critical { border-color:#dc2626; background:#fef2f2; }.verdict.caution { border-color:#d97706; background:#fffbeb; }.verdict b { display:block; font-size:16px; letter-spacing:.5px; }.verdict p { margin-top:5px; color:#555; font-size:12px; line-height:1.5; }
    .report-grid { display:grid; grid-template-columns:1.15fr .85fr; gap:18px; }.panel { border:1px solid #dbe1e7; border-radius:7px; padding:14px; }.panel h3 { font-size:11px; letter-spacing:1.3px; text-transform:uppercase; color:#475569; margin-bottom:10px; }.evidence { display:flex; gap:10px; padding:8px 0; border-bottom:1px solid #edf0f2; font-size:12px; line-height:1.45; }.evidence:last-child { border:0; }.evidence b { color:#e65100; font-family:'Courier Prime', monospace; }.trend-chart { width:100%; height:160px; border-bottom:1px solid #dbe1e7; background:linear-gradient(#fff,#fff8f2); }.chart-caption { display:flex; justify-content:space-between; color:#64748b; font-size:10px; margin-top:6px; }.no-chart { height:160px; display:grid; place-items:center; color:#64748b; font-size:11px; text-align:center; }.timeline-row { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid #edf0f2; }.timeline-row i { width:10px; height:10px; border-radius:50%; background:#16a34a; }.timeline-row i.muted { background:#94a3b8; }.timeline-row div { flex:1; }.timeline-row b { display:block; text-transform:uppercase; font-size:11px; }.timeline-row small { display:block; color:#64748b; font-size:10px; margin-top:2px; }.timeline-row em { color:#16a34a; font-size:9px; font-style:normal; font-weight:700; }.why-failed { background:#0f172a; color:#f8fafc; padding:18px; border-radius:7px; }.why-failed h2 { color:#fff; border-color:#334155; }.why-failed p { color:#cbd5e1; font-size:12px; line-height:1.65; }
  </style>
</head>
<body>
  <div class="watermark">DRDO CONFIDENTIAL</div>
  <div class="header">
    <div class="classified">CLASSIFIED · RESTRICTED DISTRIBUTION</div>
    <div class="title">UAV ENGINE DIGITAL TWIN — MISSION REPORT</div>
    <div class="sub">DEFENCE RESEARCH & DEVELOPMENT ORGANISATION · MINISTRY OF DEFENCE · GOVT OF INDIA</div>
    <div class="sub">Reference: DRDO/SIH2026/PS-26054 | Generated: ${ts} IST</div>
  </div>

  <div class="verdict ${verdictClass}">
    <b>${verdict}</b>
    <p>The twin evaluated live sensor behavior against its thermodynamic baseline and predictive model. This report preserves the evidence, recommendation and any operator intervention for post-flight review.</p>
  </div>

  <div class="section">
    <h2>Mission Identification</h2>
    <div class="grid-2">
      <div>
        <div class="kv"><span class="k">Mission ID</span><span class="v">${missionId || '—'}</span></div>
        <div class="kv"><span class="k">Profile</span><span class="v">${report?.profile?.replace(/_/g, ' ') || '—'}</span></div>
        <div class="kv"><span class="k">Report Time</span><span class="v">${ts}</span></div>
      </div>
      <div>
        <div class="kv"><span class="k">Health Index</span><span class="v">${(healthIndex||0).toFixed(1)} / 100</span></div>
        <div class="kv"><span class="k">Fault Events</span><span class="v">${reportAlerts.length}</span></div>
        <div class="kv"><span class="k">Estimated Efficiency</span><span class="v">${report?.health?.efficiency_pct ?? '—'}%</span></div>
      </div>
    </div>
    <div class="health-bar"><div class="health-fill" style="width:${healthIndex||0}%"></div></div>
  </div>

  <div class="section report-grid">
    <div class="panel"><h3>Remaining Useful Life Trend</h3>${sparkline}<div class="chart-caption"><span>MISSION START</span><span>RUL NOW: ${clean(report?.health?.rul_hours)} h</span><span>EXPORT TIME</span></div></div>
    <div class="panel"><h3>Operator Action Audit</h3>${actionRows}</div>
  </div>

  <div class="section why-failed">
    <h2>Why the Twin Raised This Assessment</h2>
    <p>${reportAlerts.length ? `The leading classified condition is <b>${clean(reportAlerts[0].fault_type?.replace(/_/g, ' ').toUpperCase())}</b>. The evidence below combines local AI attribution with deviation from the thermodynamic baseline; it is not a simple threshold alarm.` : 'No fault event was active at export time. The evidence below records the latest state of the physics-informed monitoring pipeline.'}</p>
    <div style="margin-top:12px">${evidenceList}</div>
  </div>

  <div class="section">
    <h2>Predictive Maintenance Assessment</h2>
    <div class="grid-2">
      <div><div class="kv"><span class="k">RUL estimate</span><span class="v">${report?.health?.rul_hours ?? '—'} hours</span></div><div class="kv"><span class="k">Degradation trend</span><span class="v">${report?.health?.trend?.toUpperCase() ?? '—'}</span></div></div>
      <div><div class="kv"><span class="k">Frames analysed</span><span class="v">${report?.frames_recorded ?? 'Live snapshot'}</span></div><div class="kv"><span class="k">Primary recommendation</span><span class="v">${report?.maintenance_recommendations?.[0] ?? 'Continue monitoring'}</span></div></div>
    </div>
  </div>

  <div class="section">
    <h2>Mission Sensor Envelope</h2>
    <table><thead><tr><th>Parameter</th><th>Minimum</th><th>Maximum</th><th>Latest</th></tr></thead><tbody>${rangeRows}</tbody></table>
  </div>

  <div class="section">
    <h2>Live Telemetry Snapshot</h2>
    <div class="grid-2">
      <div>
        <div class="kv"><span class="k">RPM</span><span class="v">${telemetry?.rpm?.toFixed(0)||'—'}</span></div>
        <div class="kv"><span class="k">CHT (°C)</span><span class="v">${telemetry?.cht_c?.toFixed(1)||'—'}</span></div>
        <div class="kv"><span class="k">EGT (°C)</span><span class="v">${telemetry?.egt_c?.toFixed(1)||'—'}</span></div>
        <div class="kv"><span class="k">Fuel Flow (L/h)</span><span class="v">${telemetry?.fuel_flow_lph?.toFixed(1)||'—'}</span></div>
      </div>
      <div>
        <div class="kv"><span class="k">Altitude (m)</span><span class="v">${telemetry?.altitude_m?.toFixed(0)||'—'}</span></div>
        <div class="kv"><span class="k">Oil Pressure (kPa)</span><span class="v">${telemetry?.oil_pressure_kpa?.toFixed(0)||'—'}</span></div>
        <div class="kv"><span class="k">Oil Temp (°C)</span><span class="v">${telemetry?.oil_temp_c?.toFixed(1)||'—'}</span></div>
        <div class="kv"><span class="k">Vibration (g)</span><span class="v">${telemetry?.vibration_g?.toFixed(3)||'—'}</span></div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Fault & Alert Log</h2>
    <table>
      <thead><tr><th>Fault Type</th><th>Severity</th><th>Message</th><th>Recommended Action</th></tr></thead>
      <tbody>${faultList}</tbody>
    </table>
  </div>

  <div class="footer">
    DRDO Digital Twin System · SIH 2026 · PS-26054 · MALE UAV Aero Piston Engine Health Monitor<br/>
    This document contains proprietary and classified information. Unauthorised disclosure is prohibited.
  </div>
</body>
</html>`;

    // Open in new window and trigger print (saves as PDF)
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  return (
    <button onClick={handleExport} className="btn-export" title="Export classified mission report as PDF">
      📄 Export Report
    </button>
  );
}
