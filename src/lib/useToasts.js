import { useCallback, useEffect, useRef, useState } from 'react';

const DURATION = 5000;

/**
 * Fila de toasts de feedback. Cada um some sozinho após 5s (ou ao clicar em fechar).
 *
 *   const { toasts, showToast, dismissToast } = useToasts();
 *   showToast('Empresa atualizada');
 *   showToast('Falhou', 'error');
 *   <ToastHost toasts={toasts} onDismiss={dismissToast} />
 */
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    if (!message) return;
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((list) => [...list, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, DURATION);
    timers.current.set(id, timer);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return { toasts, showToast, dismissToast };
}
