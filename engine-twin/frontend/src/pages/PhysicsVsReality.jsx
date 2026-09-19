import React from 'react';
import { useTelemetry } from '../context/TelemetryContext';

function ResidualCard({ label, actual, expected, residual, unit }) {
  if (![actual, expected, residual].every(Number.isFinite)) return (
    <div style={{ background:'#FFFFFF', border:'1px solid #E2E8F0', borderRadius:6, padding:'20px', minHeight:180 }}>
      <div style={{ fontSize:14, fontWeight:700, color:'#0F172A', textTransform:'uppercase' }}>{label}</div>
      <div style={{ marginTop:42, color:'#64748B', fontSize:13 }}>Awaiting a live physics-model calculation…</div>
    </div>
  )
  const isPositive = residual > 0;
  const absResidual = Math.abs(residual);
  
  // Use a threshold to color the residual
  // Normally we'd use specific thresholds per sensor, but this is a general UI.
  const isWarning = absResidual > (expected * 0.1); // > 10% deviation
  const color = isWarning ? '#D97706' : '#059669';

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: 6,
      padding: '20px',
      boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase' }}>
        {label}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, marginBottom: 4 }}>EXPECTED VALUE</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#475569', fontFamily: 'monospace' }}>
            {expected.toFixed(1)} <span style={{ fontSize: 12 }}>{unit}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, marginBottom: 4 }}>ACTUAL VALUE</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
            {actual.toFixed(1)} <span style={{ fontSize: 12 }}>{unit}</span>
          </div>
        </div>
      </div>

      <div style={{
        background: isWarning ? '#FFFBEB' : '#ECFDF5',
        border: `1px solid ${isWarning ? '#FDE68A' : '#A7F3D0'}`,
        borderRadius: 4,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: color }}>PHYSICS RESIDUAL</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: color, fontFamily: 'monospace' }}>
          {isPositive ? '+' : ''}{residual.toFixed(1)} {unit}
        </div>
      </div>
      
      {/* Visual Bar */}
      <div style={{ position: 'relative', height: 4, background: '#E2E8F0', borderRadius: 2, marginTop: 4 }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: isPositive ? '50%' : `calc(50% - ${Math.min(50, (absResidual/expected)*500)}%)`,
          width: `${Math.min(50, (absResidual/expected)*500)}%`,
          height: '100%',
          background: color,
          borderRadius: 2
        }} />
        <div style={{ position: 'absolute', left: '50%', top: -2, width: 2, height: 8, background: '#94A3B8' }} />
      </div>
    </div>
  );
}

export default function PhysicsVsReality() {
  const { telemetry } = useTelemetry();
  
  // Every displayed value is emitted by the backend for the same telemetry frame.
  const expected = telemetry?.expectedPhysics || {};
  const residuals = telemetry?.physicsResiduals || {};
  const actualEGT = telemetry?.egt;
  const expectedEGT = expected.egt_c;
  const residualEGT = residuals.residual_egt_c;
  const actualCHT = telemetry?.cht;
  const expectedCHT = expected.cht_c;
  const residualCHT = residuals.residual_cht_c;
  const actualOilP = telemetry?.oilPressure;
  const expectedOilP = expected.oil_pressure_kpa;
  const residualOilP = residuals.residual_oil_pressure_kpa;
  const actualFuel = telemetry?.fuelFlow;
  const expectedFuel = expected.fuel_flow_lph;
  const residualFuel = residuals.residual_fuel_flow_lph;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
          Physics vs Reality
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#475569', maxWidth: 800, lineHeight: 1.5 }}>
          The residual represents the deviation between expected engine behaviour and observed telemetry under the current operating condition. 
          The Physics Model calculates expected values dynamically based on RPM, Altitude, Throttle, and Ambient Temperature. 
          <strong> Physics Residual = Actual − Expected.</strong>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <ResidualCard 
          label="EXHAUST GAS TEMPERATURE (EGT)" 
          actual={actualEGT} 
          expected={expectedEGT} 
          residual={residualEGT} 
          unit="°C" 
        />
        <ResidualCard 
          label="CYLINDER HEAD TEMPERATURE (CHT)" 
          actual={actualCHT} 
          expected={expectedCHT} 
          residual={residualCHT} 
          unit="°C" 
        />
        <ResidualCard 
          label="OIL PRESSURE" 
          actual={actualOilP} 
          expected={expectedOilP} 
          residual={residualOilP} 
          unit="kPa" 
        />
        <ResidualCard 
          label="FUEL FLOW" 
          actual={actualFuel} 
          expected={expectedFuel} 
          residual={residualFuel} 
          unit="L/h" 
        />
      </div>
    </div>
  );
}
