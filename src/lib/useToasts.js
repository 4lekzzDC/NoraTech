import { useCallback, useEffect, useRef, useState } from 'react';

const DURATION = 5000;

// Um toast com ação (ex.: "Desfazer") fica mais tempo na tela — o usuário
// precisa de uma brecha real para clicar, não só para ler.
const DURATION_COM_ACAO = 8000;

/**
 * Fila de toasts de feedback. Cada um some sozinho após 5s (8s se tiver
 * ação), ou ao clicar em fechar.
 *
 *   const { toasts, showToast, dismissToast } = useToasts();
 *   showToast('Empresa atualizada');
 *   showToast('Falhou', 'error');
 *   showToast('Ferramenta movida.', 'success', { label: 'Desfazer', onClick: desfazer });
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

  const showToast = useCallback((message, type = 'success', action = null) => {
    if (!message) return;
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((list) => [...list, { id, message, type, action }]);
    const timer = setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, action ? DURATION_COM_ACAO : DURATION);
    timers.current.set(id, timer);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return { toasts, showToast, dismissToast };
}
