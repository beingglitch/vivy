'use client';

import { useRef, useState, useTransition, type ReactNode } from 'react';

const OPEN_DISTANCE = 92;
const OPEN_THRESHOLD = 42;

export function SwipeTask({
  label,
  children,
  onTap,
  onHold,
  onComplete,
  completeLabel = 'Complete',
  onDelete,
}: {
  label: string;
  children: ReactNode;
  onTap: () => void;
  onHold: (origin: { x: number; y: number }) => void;
  onComplete: () => Promise<unknown>;
  completeLabel?: string;
  onDelete: () => Promise<unknown>;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const gesture = useRef<{
    x: number;
    offset: number;
    currentOffset: number;
    moved: boolean;
    held: boolean;
    origin: { x: number; y: number };
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  function run(action: () => Promise<unknown>) {
    start(async () => {
      await action();
      setOffset(0);
    });
  }

  function cancelGesture() {
    if (gesture.current) clearTimeout(gesture.current.timer);
    gesture.current = null;
  }

  return (
    <div className="swipe-task">
      <div className="swipe-task__actions" aria-hidden={offset === 0}>
        <button
          type="button"
          className="swipe-task__complete"
          tabIndex={offset > 0 ? 0 : -1}
          onClick={() => run(onComplete)}
        >
          {completeLabel}
        </button>
        <button
          type="button"
          className="swipe-task__delete"
          tabIndex={offset < 0 ? 0 : -1}
          onClick={() => run(onDelete)}
        >
          Delete
        </button>
      </div>
      <div
        className={`swipe-task__content${dragging ? ' swipe-task__content--dragging' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
        role="button"
        tabIndex={0}
        aria-label={`${label}. Tap to edit, swipe right to ${completeLabel.toLowerCase()}, swipe left to delete, or press and hold for Intense Mode.`}
        aria-busy={pending}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (pending) return;
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          const item = event.currentTarget.getBoundingClientRect();
          const phone = event.currentTarget.closest('.phone')?.getBoundingClientRect();
          gesture.current = {
            x: event.clientX,
            offset,
            currentOffset: offset,
            moved: false,
            held: false,
            origin: {
              x: item.left + item.width / 2 - (phone?.left ?? 0),
              y: item.top + item.height / 2 - (phone?.top ?? 0),
            },
            timer: setTimeout(() => {
              if (!gesture.current || gesture.current.moved) return;
              gesture.current.held = true;
              navigator.vibrate?.(30);
              onHold(gesture.current.origin);
            }, 550),
          };
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          const active = gesture.current;
          if (!active || active.held) return;
          const distance = event.clientX - active.x;
          if (Math.abs(distance) > 8) {
            active.moved = true;
            clearTimeout(active.timer);
          }
          active.currentOffset = resisted(active.offset + distance);
          setOffset(active.currentOffset);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          const active = gesture.current;
          if (!active) return;
          setDragging(false);
          clearTimeout(active.timer);
          gesture.current = null;
          if (active.held || pending) return;
          if (active.moved) {
            if (active.currentOffset >= OPEN_THRESHOLD) setOffset(OPEN_DISTANCE);
            else if (active.currentOffset <= -OPEN_THRESHOLD) setOffset(-OPEN_DISTANCE);
            else setOffset(0);
            navigator.vibrate?.(12);
            return;
          }
          if (offset !== 0) setOffset(0);
          else onTap();
        }}
        onPointerCancel={() => {
          cancelGesture();
          setDragging(false);
          setOffset(0);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onTap();
        }}
      >
        {children}
      </div>
    </div>
  );
}

function resisted(distance: number): number {
  const direction = Math.sign(distance);
  const absolute = Math.abs(distance);
  if (absolute <= OPEN_DISTANCE) return distance;
  return direction * (OPEN_DISTANCE + Math.min(24, (absolute - OPEN_DISTANCE) * 0.18));
}
