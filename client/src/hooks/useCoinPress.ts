import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Живое нажатие на монету.
 *
 * Пока палец прижат, монета остаётся «продавленной», а наклон следует
 * за курсором в реальном времени. Отпустили — пружинисто возвращается.
 *
 * Почему всё через ref, а не через состояние React: pointermove летит
 * с частотой экрана (120+ раз в секунду). Гнать его через setState —
 * значит перерисовывать экран на каждое движение, монета начнёт дёргаться.
 * Здесь трансформация пишется прямо в style.
 *
 * requestAnimationFrame намеренно не используется: в фоновой вкладке он
 * не вызывается, и запланированный кадр повисает — после возврата монета
 * переставала реагировать. Записи в style без чтения геометрии дёшевы,
 * браузер их и так группирует, так что буферизация тут ничего не даёт.
 */

interface Options {
  /** Вызывается на каждое новое нажатие (не на движение) */
  onPress: (point: { clientX: number; clientY: number }) => void;
  /** Максимальный угол наклона у края монеты, градусы */
  maxTilt?: number;
  /** Насколько монета «утапливается» под пальцем */
  pressScale?: number;
}

interface Touch {
  x: number;
  y: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Лёгкое сглаживание: гасит дрожь, но не читается как задержка */
const FOLLOW_EASE = 'transform 70ms linear';
/** Возврат с небольшим перелётом — ощущается как отпущенная пружина */
const RELEASE_EASE = 'transform 520ms cubic-bezier(0.22, 1.35, 0.36, 1)';

export function useCoinPress({ onPress, maxTilt = 17, pressScale = 0.955 }: Options) {
  const ref = useRef<HTMLDivElement>(null);

  /** Активные касания: id -> координаты. Пальцев может быть несколько. */
  const touches = useRef(new Map<number, Touch>());
  /**
   * Геометрия монеты, снятая один раз на нажатие.
   * getBoundingClientRect на каждое движение заставлял бы браузер
   * пересчитывать layout — а монета за время нажатия никуда не едет.
   */
  const box = useRef<DOMRect | null>(null);

  /** Считает наклон по среднему всех активных касаний и пишет его в style */
  const applyTilt = useCallback(() => {
    const el = ref.current;
    const rect = box.current;
    const points = [...touches.current.values()];
    if (!el || !rect || points.length === 0) return;

    const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

    // -1..1 от центра монеты к краю
    const dx = clamp((avgX - rect.left - rect.width / 2) / (rect.width / 2), -1, 1);
    const dy = clamp((avgY - rect.top - rect.height / 2) / (rect.height / 2), -1, 1);

    // Нажали справа — монета отклоняется вправо, это rotateY по dx.
    // По вертикали знак обратный, иначе прогиб идёт «наружу».
    el.style.transform =
      `perspective(900px) rotateX(${(-dy * maxTilt).toFixed(2)}deg) ` +
      `rotateY(${(dx * maxTilt).toFixed(2)}deg) scale(${pressScale})`;

    // Блик под пальцем — его рисует .coin-press
    el.style.setProperty('--px', `${clamp(((avgX - rect.left) / rect.width) * 100, 0, 100).toFixed(1)}%`);
    el.style.setProperty('--py', `${clamp(((avgY - rect.top) / rect.height) * 100, 0, 100).toFixed(1)}%`);
  }, [maxTilt, pressScale]);

  const release = useCallback(() => {
    const el = ref.current;
    box.current = null;
    if (!el) return;
    el.classList.remove('pressed');
    el.style.transition = RELEASE_EASE;
    el.style.transform = '';
  }, []);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;

      // Захват: движение и отпускание долетят, даже если палец
      // ушёл за пределы монеты.
      // Может не получиться — указатель уже отпущен, захват занят другим
      // элементом. Это не повод терять тап: без захвата всё работает,
      // просто наклон перестаёт следовать за пальцем вне монеты.
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* продолжаем без захвата */
      }

      // Первое касание задаёт геометрию для всей серии
      if (touches.current.size === 0) box.current = el.getBoundingClientRect();

      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.classList.add('pressed');
      el.style.transition = FOLLOW_EASE;

      onPress({ clientX: e.clientX, clientY: e.clientY });
      applyTilt();
    },
    [onPress, applyTilt],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Движение без нажатия монету не трогает
      if (!touches.current.has(e.pointerId)) return;
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      applyTilt();
    },
    [applyTilt],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!touches.current.delete(e.pointerId)) return;
      // Пока держат другими пальцами — монета остаётся прижатой
      if (touches.current.size > 0) applyTilt();
      else release();
    },
    [applyTilt, release],
  );

  // Вкладку свернули с зажатой монетой — отпускания мы не увидим.
  // Без этого монета останется наклонённой навсегда.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden' && touches.current.size > 0) {
        touches.current.clear();
        release();
      }
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      touches.current.clear();
    };
  }, [release]);

  return {
    ref,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      // Браузер может отобрать захват (системный жест, свайп назад) —
      // без этого монета залипнет в наклонённом виде
      onLostPointerCapture: handlePointerUp,
      onContextMenu: (e: ReactPointerEvent<HTMLDivElement>) => e.preventDefault(),
    },
  };
}
