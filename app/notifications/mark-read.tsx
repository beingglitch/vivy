'use client';

import { useEffect } from 'react';

// Opening the page counts as reading — clears the bell dot.
export function MarkRead() {
  useEffect(() => {
    fetch('/api/notifications', { method: 'PATCH' }).catch(() => {});
  }, []);
  return null;
}
