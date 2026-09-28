import { useEffect } from 'react';

export function Toast({ message, onHide }: { message: string; onHide: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onHide, 2200);
    return () => window.clearTimeout(timer);
  }, [message, onHide]);

  return <div className="toast">{message}</div>;
}
