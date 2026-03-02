import { useRef } from 'react';
import type { useTimeline } from '../../hooks/useTimeline.ts';

export function useExportImport(timeline: ReturnType<typeof useTimeline>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  function handleExport() {
    const data = timelineRef.current.exportTimeline();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timeline-full.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data && typeof data.totalFrames === 'number') {
          timelineRef.current.importTimeline(data);
        }
      } catch { /* ignore invalid JSON */ }
    };
    reader.readAsText(file);
  }

  return { handleExport, handleImport, fileInputRef };
}
