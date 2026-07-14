import type { ReactNode } from 'react';

// The brief is model-written markdown (bold section titles, bullets). Render just
// that subset — a full markdown lib is overkill for one card.

function inline(text: string, keyBase: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold)
      return (
        <strong key={`${keyBase}-${i}`} className="font-semibold text-linen">
          {bold[1]}
        </strong>
      );
    return part.split(/(\*[^*]+\*)/g).map((sub, j) => {
      const em = sub.match(/^\*([^*]+)\*$/);
      if (em)
        return (
          <em key={`${keyBase}-${i}-${j}`} className="text-linen/70">
            {em[1]}
          </em>
        );
      return sub.replace(/`/g, '');
    });
  });
}

export function BriefContent({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  let list: ReactNode[] = [];

  const flushList = (key: string) => {
    if (!list.length) return;
    blocks.push(
      <ul key={key} className="space-y-1.5">
        {list}
      </ul>,
    );
    list = [];
  };

  content.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return flushList(`ul-${i}`);

    const heading = line.match(/^(?:#{1,4}\s+)?\*\*(.+?)\*\*:?\s*$/) || line.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      flushList(`ul-${i}`);
      blocks.push(
        <p
          key={`h-${i}`}
          className="pt-3 text-xs font-medium tracking-widest text-ember uppercase first:pt-0"
        >
          {heading[1].replace(/\*/g, '')}
        </p>,
      );
      return;
    }

    const item = line.match(/^(?:[-*•]|\d+\.)\s+(.*)$/);
    if (item) {
      list.push(
        <li key={`li-${i}`} className="flex gap-2.5">
          <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ember/70" />
          <span>{inline(item[1], `li-${i}`)}</span>
        </li>,
      );
      return;
    }

    flushList(`ul-${i}`);
    blocks.push(<p key={`p-${i}`}>{inline(line, `p-${i}`)}</p>);
  });
  flushList('ul-end');

  return <div className="font-voice space-y-2 text-[15px] leading-7 text-linen/95">{blocks}</div>;
}
