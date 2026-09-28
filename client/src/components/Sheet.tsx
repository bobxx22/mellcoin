import { useEffect, type ReactNode } from 'react';
import { Close } from './Icons';

/**
 * Модалка снизу — как в Notcoin: подложка, скруглённые углы сверху,
 * крестик в углу. Закрывается по клику вне и по Escape.
 */
export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={onClose} aria-label="Закрыть">
          <Close />
        </button>
        {children}
      </div>
    </div>
  );
}
