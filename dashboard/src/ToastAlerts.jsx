import { useEffect, useState, useCallback } from 'react';

let _listeners = [];
export function fireToast(toast) {
  _listeners.forEach(fn => fn(toast));
}

export default function ToastAlerts() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now();
    setToasts(prev => [...prev.slice(-2), { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  }, []);

  useEffect(() => {
    _listeners.push(addToast);
    return () => { _listeners = _listeners.filter(fn => fn !== addToast); };
  }, [addToast]);

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none',
    }}>
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.severity || 'info'}`}>
          <div className="toast-icon">
            {toast.severity === 'critical' ? '🔴' : toast.severity === 'warning' ? '🟡' : 'ℹ️'}
          </div>
          <div className="toast-body">
            <div className="toast-title">{toast.fault_type?.toUpperCase().replace(/_/g,' ') || 'ALERT'}</div>
            <div className="toast-msg">{toast.message || toast.severity?.toUpperCase()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
