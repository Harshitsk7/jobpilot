import { useEffect, useRef } from 'react';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { oneDark } from '@codemirror/theme-one-dark';

interface LaTeXCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const jpTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#0d0d0d',
      height: '100%',
    },
    '.cm-scroller': {
      overflow: 'auto',
    },
    '.cm-gutters': {
      backgroundColor: '#111111',
      border: 'none',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#1a1a1a',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'rgba(196, 240, 66, 0.15) !important',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#c4f042',
    },
  },
  { dark: true }
);

export default function LaTeXCodeEditor({
  value,
  onChange,
  className,
}: LaTeXCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        StreamLanguage.define(stex),
        oneDark,
        jpTheme,
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        bracketMatching(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount/unmount — onChange is handled via the ref pattern below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the onChange callback fresh without recreating the editor
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync external value changes into the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (value !== currentContent) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: '100%', overflow: 'hidden' }}
    />
  );
}
