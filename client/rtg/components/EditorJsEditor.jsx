import React, { useEffect, useMemo, useRef, useState } from 'react';

// Minimal blocks -> Markdown converter to keep existing Markdown pipeline
function blocksToMarkdown(blocks) {
  if (!Array.isArray(blocks)) return '';
  const lines = [];
  const esc = (s) => (s ?? '').replace(/\r/g, '').replace(/\t/g, '    ');

  for (const b of blocks) {
    const { type, data } = b || {};
    if (!type) continue;
    switch (type) {
      case 'paragraph': {
        lines.push(esc(data?.text)?.replace(/<[^>]+>/g, '') || '');
        lines.push('');
        break;
      }
      case 'header': {
        const level = Math.min(Math.max(Number(data?.level) || 1, 1), 6);
        lines.push(`${'#'.repeat(level)} ${esc(data?.text)?.replace(/<[^>]+>/g, '')}`);
        lines.push('');
        break;
      }
      case 'list': {
        const style = data?.style === 'ordered' ? 'ol' : 'ul';
        const items = Array.isArray(data?.items) ? data.items : [];
        items.forEach((it, idx) => {
          if (style === 'ol') lines.push(`${idx + 1}. ${esc(it)?.replace(/<[^>]+>/g, '')}`);
          else lines.push(`- ${esc(it)?.replace(/<[^>]+>/g, '')}`);
        });
        lines.push('');
        break;
      }
      case 'checklist': {
        const items = Array.isArray(data?.items) ? data.items : [];
        items.forEach((it) => {
          const mark = it?.checked ? 'x' : ' ';
          lines.push(`- [${mark}] ${esc(it?.text)?.replace(/<[^>]+>/g, '')}`);
        });
        lines.push('');
        break;
      }
      case 'quote': {
        const txt = esc(data?.text)?.replace(/<[^>]+>/g, '') || '';
        const cap = esc(data?.caption)?.replace(/<[^>]+>/g, '');
        lines.push(`> ${txt}`);
        if (cap) lines.push(`> — ${cap}`);
        lines.push('');
        break;
      }
      case 'code': {
        lines.push('```');
        lines.push(esc(data?.code) || '');
        lines.push('```');
        lines.push('');
        break;
      }
      case 'table': {
        const content = Array.isArray(data?.content) ? data.content : [];
        if (content.length) {
          // header row + separator
          const header = content[0];
          const hdr = `| ${header.map((c) => esc(c)).join(' | ')} |`;
          const sep = `| ${header.map(() => '---').join(' | ')} |`;
          lines.push(hdr);
          lines.push(sep);
          for (let r = 1; r < content.length; r++) {
            lines.push(`| ${content[r].map((c) => esc(c)).join(' | ')} |`);
          }
          lines.push('');
        }
        break;
      }
      case 'delimiter': {
        lines.push('---');
        lines.push('');
        break;
      }
      default: {
        // Fallback: serialize JSON block
        lines.push('```json');
        lines.push(JSON.stringify(b, null, 2));
        lines.push('```');
        lines.push('');
      }
    }
  }

  // trim trailing blank lines
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

export default function EditorJsEditor({ value, onChange, minHeight = 240 }) {
  const holderRef = useRef(null);
  const editorRef = useRef(null);
  const changeTimerRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Track last emitted markdown to avoid echo loops
  const lastMarkdownRef = useRef('');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const [{ default: EditorJS }, Header, List, Table, Code, Quote, Checklist, InlineCode, Delimiter] = await Promise.all([
          import('@editorjs/editorjs'),
          import('@editorjs/header').then((m) => m.default || m),
          import('@editorjs/list').then((m) => m.default || m),
          import('@editorjs/table').then((m) => m.default || m),
          import('@editorjs/code').then((m) => m.default || m),
          import('@editorjs/quote').then((m) => m.default || m),
          import('@editorjs/checklist').then((m) => m.default || m),
          import('@editorjs/inline-code').then((m) => m.default || m),
          import('@editorjs/delimiter').then((m) => m.default || m),
        ]);

        if (cancelled) return;

        const instance = new EditorJS({
          holder: holderRef.current,
          autofocus: true,
          minHeight,
          tools: {
            header: Header,
            list: List,
            table: Table,
            code: Code,
            quote: Quote,
            checklist: Checklist,
            inlineCode: InlineCode,
            delimiter: Delimiter,
          },
          data: {
            blocks: value
              ? [
                  {
                    id: 'init-paragraph',
                    type: 'paragraph',
                    data: { text: value.replace(/\n/g, '<br/>') },
                  },
                ]
              : [],
          },
          onChange: async () => {
            try {
              if (!onChange) return;
              const output = await instance.save();
              const md = blocksToMarkdown(output.blocks);
              if (md !== lastMarkdownRef.current) {
                lastMarkdownRef.current = md;
                if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
                changeTimerRef.current = setTimeout(() => onChange(md), 180);
              }
            } catch (_) {
              // swallow
            }
          },
        });

        editorRef.current = instance;
        setReady(true);
      } catch (e) {
        // If dynamic import fails, show a minimal fallback
        console.error('[RTG] EditorJsEditor init error', e);
        setReady(false);
      }
    }

    init();
    return () => {
      cancelled = true;
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      const ed = editorRef.current;
      editorRef.current = null;
      if (ed && ed.destroy) {
        try { ed.destroy(); } catch (_) { /* no-op */ }
      }
    };
  }, [minHeight]);

  // External value changes -> if differs materially from last emitted, replace content
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    if (typeof value !== 'string') return;
    if (value === lastMarkdownRef.current) return;

    // Replace editor content with a single paragraph representing the markdown text
    try {
      ed.blocks.clear();
      if (value) {
        ed.blocks.insert('paragraph', { text: value.replace(/\n/g, '<br/>') });
      }
      lastMarkdownRef.current = value;
    } catch (_) {
      // ignore
    }
  }, [value]);

  return (
    <div>
      <div ref={holderRef} style={{ minHeight, border: '1px solid #e5e7eb', borderRadius: 6, padding: 8 }} />
      {!ready && (
        <div className="text-muted small mt-1">Loading editor...</div>
      )}
    </div>
  );
}
