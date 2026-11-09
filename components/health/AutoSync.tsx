'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { syncHealthAction } from '@/app/actions/health';

/** 最終同期から時間が経っていれば、表示時に裏で同期して画面を更新する */
export default function AutoSync({ stale }: { stale: boolean }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (!stale || done.current) return;
    done.current = true;
    syncHealthAction(2)
      .then((res) => {
        if ('ok' in res) router.refresh();
      })
      .catch(() => {});
  }, [stale, router]);
  return null;
}
