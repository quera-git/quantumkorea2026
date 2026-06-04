import styled from '@emotion/styled';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Ship,
  Undo2,
  Redo2,
  RotateCcw,
} from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { useToast } from '@/shared/ui/Toast';

import { useEditorStore } from './editor.store';

const Card = styled.div(({ theme }) => ({
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  // 좌측 사이드바 (~224px) 안에 들어가므로 padding 을 작게.
  padding: theme.spacing(3),
  background: theme.color.surface,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
  minWidth: 0,
}));

const Header = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  '& .title': {
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
    color: theme.color.text,
    letterSpacing: theme.font.letter.tight,
  },
  '& .small': {
    fontSize: theme.font.size.xs,
    fontFamily: theme.font.mono,
    color: theme.color.textSubtle,
    marginLeft: 'auto',
  },
}));

const Grid = styled.dl(({ theme }) => ({
  margin: 0,
  display: 'grid',
  // 라벨 컬럼 92→56px 로 축소 — 좁은 사이드바에서 값 영역 확보.
  gridTemplateColumns: '56px minmax(0, 1fr)',
  rowGap: theme.spacing(1.5),
  columnGap: theme.spacing(1.5),
  fontSize: theme.font.size.sm,

  '& dt': {
    color: theme.color.textSubtle,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: theme.font.letter.wide,
    fontWeight: theme.font.weight.semibold,
    alignSelf: 'center',
  },
  '& dd': {
    margin: 0,
    fontFamily: theme.font.mono,
    fontSize: theme.font.size.xs,
    color: theme.color.text,
    wordBreak: 'break-word',
    minWidth: 0,
  },
  '& .delta': {
    color: theme.color.primary,
    fontSize: theme.font.size.xs,
    marginLeft: theme.spacing(1),
    display: 'inline-block',
  },
}));

const NudgeBlock = styled.div(({ theme }) => ({
  // 좁은 사이드바라 시간/위치 두 그룹을 세로로 stack.
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),

  '& > div': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: `${theme.spacing(1.5)} ${theme.spacing(2)}`,
    background: theme.color.surfaceAlt,
    borderRadius: theme.radius.md,
  },
  '& .label': {
    fontSize: 10,
    color: theme.color.textSubtle,
    textTransform: 'uppercase',
    fontWeight: theme.font.weight.semibold,
    letterSpacing: theme.font.letter.wide,
    whiteSpace: 'nowrap',
  },
  '& .row': { display: 'flex', gap: theme.spacing(0.5) },
}));

const ActionRow = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: theme.spacing(1),
  '& button': {
    minWidth: 0,
    width: '100%',
    padding: '6px 0',
    justifyContent: 'center',
  },
}));

const ShortcutHint = styled.div(({ theme }) => ({
  fontSize: 10,
  lineHeight: 1.5,
  color: theme.color.textSubtle,
  fontFamily: theme.font.mono,
  textAlign: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: theme.spacing(0.5),
  '& kbd': {
    padding: '0 4px',
    background: theme.color.surfaceMuted,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.sm,
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.color.text,
  },
}));

interface Props {
  /** 선택 패널이 키보드 단축키에 반응할지. 기본 true. */
  keyboardEnabled?: boolean;
}

export function SelectedVesselPanel({ keyboardEnabled = true }: Props) {
  const selected = useEditorStore((s) => s.selected());
  const original = useEditorStore((s) =>
    s.selectedRowId ? s.originalRows.find((r) => r.rowId === s.selectedRowId) : null,
  );
  const nudgeSelected = useEditorStore((s) => s.nudgeSelected);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const reset = useEditorStore((s) => s.reset);
  const canUndo = useEditorStore((s) => s.canUndo());
  const canRedo = useEditorStore((s) => s.canRedo());
  const isDirty = useEditorStore((s) => s.isDirty());
  const toast = useToast();

  // 키보드 단축키. 입력 요소(input/textarea) 안에서는 무시.
  useEffect(() => {
    if (!keyboardEnabled) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // 모달/다이얼로그 안의 키 입력은 nudge 로 가로채지 않는다.
      // (ConfirmDialog / VesselDetailDialog 등 role="dialog" 가진 portal 자식)
      if (t && t.closest('[role="dialog"]')) return;

      // Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z = redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) redo();
        } else if (canUndo) {
          undo();
        }
        return;
      }

      // arrow / WASD nudge — 선택된 행이 있어야만 동작
      if (!selected) return;
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          nudgeSelected(-5, 0);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          nudgeSelected(5, 0);
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          nudgeSelected(0, -30);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          nudgeSelected(0, 30);
          break;
        default:
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboardEnabled, selected, nudgeSelected, undo, redo, canUndo, canRedo]);

  if (!selected) {
    return (
      <Card>
        <EmptyState
          icon={Ship}
          title="선박을 선택하세요"
          description="타임라인에서 막대를 클릭하면 여기에 정보와 미세 이동 컨트롤이 표시됩니다."
        />
      </Card>
    );
  }

  const dStart =
    original?.start && selected.start
      ? Math.round((Date.parse(selected.start) - Date.parse(original.start)) / 60_000)
      : 0;
  const dY =
    original && selected.f != null && original.f != null ? selected.f - original.f : 0;

  return (
    <Card>
      <Header>
        <Ship size={16} aria-hidden="true" />
        <span className="title">{selected.voyage}</span>
        <span className="small">{selected.terminal}-{selected.berth}</span>
      </Header>

      <Grid>
        <dt>선박</dt>
        <dd>{selected.vessel || '-'}</dd>
        <dt>선사</dt>
        <dd>{selected.company || '-'}</dd>
        <dt>start</dt>
        <dd>
          {selected.start?.replace('T', ' ').slice(0, 16) ?? '-'}
          {dStart !== 0 && <span className="delta">Δ {dStart > 0 ? '+' : ''}{dStart}분</span>}
        </dd>
        <dt>end</dt>
        <dd>{selected.end?.replace('T', ' ').slice(0, 16) ?? '-'}</dd>
        <dt>f / e</dt>
        <dd>
          {selected.f}m / {selected.e}m
          {dY !== 0 && <span className="delta">Δy {dY > 0 ? '+' : ''}{dY}m</span>}
        </dd>
      </Grid>

      <NudgeBlock>
        <div>
          <span className="label">시간 ±5분</span>
          <div className="row">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => nudgeSelected(-5, 0)}
              aria-label="시간 -5분"
            >
              <ArrowLeft size={14} aria-hidden="true" /> 5m
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => nudgeSelected(5, 0)}
              aria-label="시간 +5분"
            >
              5m <ArrowRight size={14} aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div>
          <span className="label">위치 ±30m</span>
          <div className="row">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => nudgeSelected(0, -30)}
              aria-label="위치 -30m"
            >
              <ArrowUp size={14} aria-hidden="true" /> 30m
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => nudgeSelected(0, 30)}
              aria-label="위치 +30m"
            >
              <ArrowDown size={14} aria-hidden="true" /> 30m
            </Button>
          </div>
        </div>
      </NudgeBlock>

      <ShortcutHint>
        <span><kbd>←</kbd><kbd>→</kbd>시간</span>
        <span><kbd>↑</kbd><kbd>↓</kbd>위치</span>
        <span><kbd>⌘Z</kbd>undo</span>
      </ShortcutHint>

      <ActionRow>
        <Button
          size="sm"
          variant="secondary"
          onClick={undo}
          disabled={!canUndo}
          aria-label="실행 취소"
          title="실행 취소 (⌘Z)"
        >
          <Undo2 size={14} aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={redo}
          disabled={!canRedo}
          aria-label="다시 실행"
          title="다시 실행 (⇧⌘Z)"
        >
          <Redo2 size={14} aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (!isDirty) return;
            if (confirm('편집을 모두 되돌릴까요? (히스토리도 초기화)')) {
              reset();
              toast.notify({ tone: 'info', title: '편집 초기화 완료' });
            }
          }}
          disabled={!isDirty}
          aria-label="편집 초기화"
          title="편집 초기화"
        >
          <RotateCcw size={14} aria-hidden="true" />
        </Button>
      </ActionRow>
    </Card>
  );
}
