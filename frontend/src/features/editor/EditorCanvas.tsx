// SVG 기반 SND/GAM 분할 드래그 에디터.
// status-allocation-berths/streamlit_drag_timeline/frontend/src/Timeline.tsx 를 도메인/스토어/테마에 맞춰 이식.
//
// - 드래그 중에는 로컬 draft state 만 갱신 (RAF batching) 해서 react re-render 부담 최소화.
// - 드롭 시 5분/30m snap 적용 후 editor.store.applyMove 호출.
// - berth 는 새 y mid 위치로 inferBerthFromY 로 재추론.
// - 같은 터미널 내 이동만 (Streamlit 원본 동작과 동일).

import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { TERMINAL_LAYOUT, inferBerthFromY, type Terminal } from '@/shared/domain';
import { planStatusVisual } from '@/shared/domain/statusColors';
import type { Assignment } from '@/shared/domain/types';
import { VesselDetailDialog } from '@/shared/ui/VesselDetailDialog';
import { VesselHoverCard } from '@/shared/ui/VesselHoverCard';
import { useColorBy } from '@/features/timeline/colorBy';

import { useEditorStore, type MovePatch } from './editor.store';
import { useEditorIssueIndex } from './useValidationIssues';

const TERMINAL_ORDER: Terminal[] = ['SND', 'GAM'];

const Wrap = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  userSelect: 'none',
}));

const TerminalBlock = styled.div(({ theme }) => ({
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.lg,
  padding: theme.spacing(2),
}));

const TerminalHead = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `0 ${theme.spacing(1)} ${theme.spacing(2)}`,

  '& .name': {
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
    color: theme.color.text,
    letterSpacing: theme.font.letter.tight,
  },
  '& .meta': {
    fontSize: theme.font.size.xs,
    color: theme.color.textSubtle,
    fontFamily: theme.font.mono,
    display: 'flex',
    gap: theme.spacing(2),
  },
}));

const Canvas = styled.div(({ theme }) => ({
  background: theme.color.surfaceAlt,
  borderRadius: theme.radius.md,
  overflowX: 'auto',
  overflowY: 'hidden',
}));

interface DragState {
  rowId: string;
  pointerId: number;
  terminal: Terminal;
  startClientX: number;
  startClientY: number;
  baseStartMs: number;
  baseEndMs: number;
  baseF: number;
  baseE: number;
  baseY: number;
  pointerOffsetFromMidPx: number;
}

interface DraftPatch {
  start: string;
  end: string;
  f: number;
  e: number;
  berth: number;
}

interface ComputedTarget {
  moved: boolean;
  newStartMs: number;
  newEndMs: number;
  newF: number;
  newE: number;
  newYMid: number;
  newBerth: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const snapMin = (v: number) => Math.round(v / 5) * 5;
const snapM = (v: number) => Math.round(v / 30) * 30;

interface Props {
  assignments: Assignment[];
  /** 드래그 비활성화 (감상 모드). */
  disabled?: boolean;
}

export function EditorCanvas({ assignments, disabled = false }: Props) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';
  const gridLight = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)';
  const gridDay = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.18)';
  const bandEven = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.025)';
  const bandOdd = isDark ? 'rgba(255,255,255,0.015)' : 'rgba(15,23,42,0.015)';
  const bandStroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
  const tickFill = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.7)';
  const labelFill = theme.color.text;
  const defaultBarStroke = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.5)';

  const applyMove = useEditorStore((s) => s.applyMove);
  const selectRow = useEditorStore((s) => s.selectRow);
  const selectedRowId = useEditorStore((s) => s.selectedRowId);
  const colorBy = useColorBy((s) => s.mode);
  const { invalidRowIds, messagesByRowId } = useEditorIssueIndex();

  // 드래그 중 표시할 임시 패치(터미널별×rowId 단위).
  const [drafts, setDrafts] = useState<Record<string, DraftPatch>>({});
  const dragRef = useRef<DragState | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingDraftRef = useRef<{ rowId: string; patch: DraftPatch | null } | null>(null);
  const terminalSvgRefs = useRef<Record<Terminal, SVGSVGElement | null>>({ SND: null, GAM: null });

  // 호버 카드 / 자세히 보기 다이얼로그 state.
  const [hover, setHover] = useState<{ rowId: string; x: number; y: number } | null>(null);
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const assignmentByRowId = useMemo(() => {
    const m = new Map<string, Assignment>();
    for (const a of assignments) m.set(a.rowId, a);
    return m;
  }, [assignments]);
  const hoverAssignment = hover ? (assignmentByRowId.get(hover.rowId) ?? null) : null;
  const detailAssignment = detailRowId ? (assignmentByRowId.get(detailRowId) ?? null) : null;

  // assignments 가 새로 들어오면 drafts 초기화.
  useEffect(() => {
    setDrafts({});
    dragRef.current = null;
  }, [assignments]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // 드래그 중에 보이는 row = base + draft patch
  const liveAssignments = useMemo(() => {
    if (Object.keys(drafts).length === 0) return assignments;
    return assignments.map((a) => {
      const d = drafts[a.rowId];
      return d ? { ...a, ...d } : a;
    });
  }, [assignments, drafts]);

  // 시간축 범위: 데이터 기반.
  const xRangeMs = useMemo(() => {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const a of assignments) {
      if (!a.start || !a.end) continue;
      const s = Date.parse(a.start);
      const e = Date.parse(a.end);
      if (Number.isFinite(s)) lo = Math.min(lo, s);
      if (Number.isFinite(e)) hi = Math.max(hi, e);
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
      const now = Date.now();
      return [now - 24 * 3600_000, now + 24 * 3600_000] as [number, number];
    }
    // 양 끝 패딩 6h
    const pad = 6 * 3600_000;
    return [lo - pad, hi + pad] as [number, number];
  }, [assignments]);

  const margin = { left: 56, right: 32, top: 12, bottom: 28 };
  const [x0, x1] = xRangeMs;
  const hoursRange = Math.max(1, (x1 - x0) / 3600_000);
  const innerWidth = Math.max(1200, Math.round(hoursRange * 14));
  const svgWidth = innerWidth + margin.left + margin.right;
  const pxPerMs = innerWidth / (x1 - x0);
  const pxPerMin = pxPerMs * 60_000;

  const ticks = useMemo(() => buildTicks(x0, x1), [x0, x1]);

  function scheduleDraft(rowId: string, patch: DraftPatch | null) {
    pendingDraftRef.current = { rowId, patch };
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      const pending = pendingDraftRef.current;
      pendingDraftRef.current = null;
      rafRef.current = null;
      if (!pending) return;
      setDrafts((prev) => {
        const next = { ...prev };
        if (pending.patch === null) delete next[pending.rowId];
        else next[pending.rowId] = pending.patch;
        return next;
      });
    });
  }

  function renderTerminal(terminal: Terminal) {
    const layout = TERMINAL_LAYOUT[terminal];
    const innerHeight = Math.max(280, Math.round(layout.yMax * 0.32));
    const svgHeight = innerHeight + margin.top + margin.bottom;
    const pxPerMeter = innerHeight / layout.yMax;
    const rowsForThis = liveAssignments.filter(
      (r) => r.terminal === terminal && r.start && r.end && r.f != null && r.e != null,
    );

    const toX = (ms: number) => margin.left + (ms - x0) * pxPerMs;
    const toY = (m: number) => margin.top + m * pxPerMeter;

    function computeTarget(evt: PointerEvent, st: DragState): ComputedTarget {
      const dx = evt.clientX - st.startClientX;
      const dmin = snapMin(dx / pxPerMin);

      const layoutT = TERMINAL_LAYOUT[st.terminal];
      const length = Math.abs(st.baseE - st.baseF);
      const minMid = length / 2;
      const maxMid = Math.max(minMid, layoutT.yMax - length / 2);

      const svgRect = terminalSvgRefs.current[st.terminal]?.getBoundingClientRect();
      let rawMid = st.baseY;
      if (svgRect) {
        const centerPx = evt.clientY - svgRect.top - margin.top - st.pointerOffsetFromMidPx;
        rawMid = centerPx / pxPerMeter;
      } else {
        const dyPx = evt.clientY - st.startClientY;
        rawMid = st.baseY + dyPx / pxPerMeter;
      }

      const newMid = snapM(clamp(rawMid, minMid, maxMid));
      const newF = newMid - length / 2;
      const newE = newMid + length / 2;
      const newBerth = inferBerthFromY(st.terminal, newMid) ?? 0;
      const newStartMs = st.baseStartMs + dmin * 60_000;
      const newEndMs = st.baseEndMs + dmin * 60_000;
      // 사용자가 포인터를 의미 있게 움직였는가 (3px 미만 = 클릭 의도).
      // baseY 가 30m snap 그리드와 안 맞는 막대를 클릭만 해도 snap 으로 mid 가 미세
      // 변동될 수 있어, snap 결과(newMid) 단독으로 판정하면 클릭이 이동으로 오분류됨.
      const dxPx = Math.abs(evt.clientX - st.startClientX);
      const dyPx = Math.abs(evt.clientY - st.startClientY);
      const pointerMoved = dxPx >= 3 || dyPx >= 3;
      const moved =
        pointerMoved && (dmin !== 0 || Math.abs(newMid - st.baseY) >= 1e-6);
      return { moved, newStartMs, newEndMs, newF, newE, newYMid: newMid, newBerth };
    }

    function onDragMove(evt: PointerEvent, st: DragState) {
      const t = computeTarget(evt, st);
      if (!t.moved) {
        scheduleDraft(st.rowId, null);
        return;
      }
      scheduleDraft(st.rowId, {
        start: new Date(t.newStartMs).toISOString(),
        end: new Date(t.newEndMs).toISOString(),
        f: t.newF,
        e: t.newE,
        berth: t.newBerth,
      });
    }

    function onDragEnd(evt: PointerEvent, st: DragState) {
      const t = computeTarget(evt, st);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[st.rowId];
        return next;
      });
      dragRef.current = null;
      if (!t.moved) {
        // 드래그 거리 0 — 클릭으로 간주하고 자세히 보기 다이얼로그 오픈.
        setDetailRowId(st.rowId);
        return;
      }
      const patch: MovePatch = {
        start: new Date(t.newStartMs).toISOString(),
        end: new Date(t.newEndMs).toISOString(),
        f: t.newF,
        e: t.newE,
        berth: t.newBerth,
      };
      applyMove(st.rowId, patch);
    }

    function startDrag(item: Assignment) {
      return (evt: ReactPointerEvent<SVGRectElement>) => {
        if (disabled || !item.start || !item.end || item.f == null || item.e == null) return;
        if (item.terminal !== 'SND' && item.terminal !== 'GAM') return;
        evt.stopPropagation();
        evt.preventDefault();
        try {
          (evt.target as Element).setPointerCapture?.(evt.pointerId);
        } catch {
          /* ignore */
        }

        const baseY = (item.f + item.e) / 2;
        const svgRect = terminalSvgRefs.current[terminal]?.getBoundingClientRect();
        const barCenterPx = svgRect
          ? svgRect.top + margin.top + baseY * pxPerMeter
          : evt.clientY;

        const st: DragState = {
          rowId: item.rowId,
          pointerId: evt.pointerId,
          terminal,
          startClientX: evt.clientX,
          startClientY: evt.clientY,
          baseStartMs: Date.parse(item.start),
          baseEndMs: Date.parse(item.end),
          baseF: item.f,
          baseE: item.e,
          baseY,
          pointerOffsetFromMidPx: evt.clientY - barCenterPx,
        };
        dragRef.current = st;
        selectRow(item.rowId);

        const moveListener = (e: PointerEvent) => {
          if (dragRef.current?.pointerId !== e.pointerId) return;
          onDragMove(e, st);
        };
        const upListener = (e: PointerEvent) => {
          if (dragRef.current?.pointerId !== e.pointerId) return;
          try {
            (evt.target as Element).releasePointerCapture?.(e.pointerId);
          } catch {
            /* ignore */
          }
          onDragEnd(e, st);
          window.removeEventListener('pointermove', moveListener);
          window.removeEventListener('pointerup', upListener);
          window.removeEventListener('pointercancel', upListener);
        };
        window.addEventListener('pointermove', moveListener);
        window.addEventListener('pointerup', upListener);
        window.addEventListener('pointercancel', upListener);
      };
    }

    const labels = layout.berths;

    return (
      <TerminalBlock key={terminal}>
        <TerminalHead>
          <span className="name">{terminal === 'SND' ? '신항 SND' : '감만 GAM'}</span>
          <div className="meta">
            <span>5분 · 30m snap</span>
            <span>{rowsForThis.length} vessels</span>
          </div>
        </TerminalHead>

        <Canvas>
          <svg
            ref={(node) => {
              terminalSvgRefs.current[terminal] = node;
            }}
            width={svgWidth}
            height={svgHeight}
            role="img"
            aria-label={`${terminal} 드래그 타임라인`}
          >
            {/* 시간 ticks + 그리드 */}
            {ticks.map(({ x, text }, i) => {
              const px = toX(x);
              const isDay = text.includes('/');
              return (
                <g key={`${terminal}-t-${i}`}>
                  <line
                    x1={px}
                    x2={px}
                    y1={margin.top}
                    y2={margin.top + innerHeight}
                    stroke={isDay ? gridDay : gridLight}
                    strokeWidth={isDay ? 1.2 : 0.8}
                  />
                  {i % 2 === 0 && (
                    <text
                      x={px + 2}
                      y={margin.top - 2}
                      fontSize={10}
                      fill={tickFill}
                      style={{ fontFamily: 'monospace' }}
                    >
                      {text}
                    </text>
                  )}
                </g>
              );
            })}

            {/* berth 밴드 + 라벨 */}
            {labels.map((b, idx) => {
              const yA = toY(idx * layout.step);
              const yB = toY((idx + 1) * layout.step);
              const mid = (yA + yB) / 2;
              return (
                <g key={`${terminal}-b-${b}`}>
                  <rect
                    x={margin.left}
                    y={yA}
                    width={innerWidth}
                    height={yB - yA}
                    fill={idx % 2 === 0 ? bandEven : bandOdd}
                    stroke={bandStroke}
                    strokeWidth={0.5}
                  />
                  <text
                    x={margin.left - 8}
                    y={mid}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={11}
                    fill={tickFill}
                    style={{ fontFamily: 'monospace' }}
                  >
                    B{b}
                  </text>
                </g>
              );
            })}

            {/* 선박 사각형 */}
            {rowsForThis.map((r) => {
              const startMs = Date.parse(r.start as string);
              const endMs = Date.parse(r.end as string);
              const xS = toX(startMs);
              const xE = toX(endMs);
              const w = Math.max(6, xE - xS);
              const f = r.f as number;
              const e = r.e as number;
              const yTop = toY(Math.min(f, e));
              const h = Math.max(8, Math.abs(e - f) * pxPerMeter);
              const isSel = selectedRowId === r.rowId;
              const isDragging = drafts[r.rowId] != null;
              const isInvalid = invalidRowIds.has(r.rowId);
              const issues = messagesByRowId.get(r.rowId);
              // 우선순위: invalid > 선택 > colorBy(status|voyage)
              let fill: string;
              if (isInvalid) {
                fill = 'rgba(220, 38, 38, 0.30)';
              } else if (isSel) {
                fill = 'rgba(37, 99, 235, 0.85)';
              } else if (colorBy === 'status') {
                fill = planStatusVisual(r.planStatus).fill;
              } else {
                fill = colorForVoyage(r.voyage, terminal, false);
              }
              const stroke = isSel
                ? 'rgba(37, 99, 235, 0.95)'
                : isInvalid
                  ? 'rgba(220, 38, 38, 0.95)'
                  : isDragging
                    ? 'rgba(37, 99, 235, 0.85)'
                    : colorBy === 'status' && r.planStatus
                      ? planStatusVisual(r.planStatus).stroke
                      : defaultBarStroke;
              const strokeWidth = isSel || isInvalid ? 2 : 1;
              const label = r.voyage || r.vessel || '';

              const ariaLabel = issues
                ? `${terminal}-${r.berth} ${r.voyage} (${issues.length}개 이슈)`
                : `${terminal}-${r.berth} ${r.voyage}`;

              return (
                <g key={`${terminal}-bar-${r.rowId}`}>
                  <rect
                    x={xS}
                    y={yTop}
                    width={w}
                    height={h}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isInvalid ? '4 3' : undefined}
                    rx={4}
                    ry={4}
                    cursor={disabled ? 'default' : 'grab'}
                    aria-label={ariaLabel}
                    onPointerDown={startDrag(r)}
                    onPointerEnter={(e) => {
                      if (dragRef.current) return;
                      setHover({ rowId: r.rowId, x: e.clientX, y: e.clientY });
                    }}
                    onPointerMove={(e) => {
                      if (dragRef.current) return;
                      setHover((prev) =>
                        prev && prev.rowId === r.rowId
                          ? { ...prev, x: e.clientX, y: e.clientY }
                          : { rowId: r.rowId, x: e.clientX, y: e.clientY },
                      );
                    }}
                    onPointerLeave={() => {
                      if (dragRef.current) return;
                      setHover((prev) => (prev?.rowId === r.rowId ? null : prev));
                    }}
                    style={{ touchAction: 'none' }}
                  />
                  {isInvalid && (
                    <text
                      x={xS + 4}
                      y={yTop + 12}
                      fontSize={11}
                      fontWeight={700}
                      fill="rgba(185, 28, 28, 0.95)"
                      pointerEvents="none"
                    >
                      ⚠
                    </text>
                  )}
                  <text
                    x={xS + w / 2}
                    y={yTop + h / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={11}
                    fill={labelFill}
                    pointerEvents="none"
                    style={{ fontWeight: isSel ? 700 : 500 }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>
        </Canvas>
      </TerminalBlock>
    );
  }

  return (
    <>
      <Wrap>{TERMINAL_ORDER.map((t) => renderTerminal(t))}</Wrap>
      {hover && hoverAssignment && (
        <VesselHoverCard
          assignment={hoverAssignment}
          anchorX={hover.x}
          anchorY={hover.y}
          issues={messagesByRowId.get(hover.rowId)}
        />
      )}
      <VesselDetailDialog
        open={detailRowId !== null}
        assignment={detailAssignment}
        onClose={() => setDetailRowId(null)}
        issues={detailRowId ? messagesByRowId.get(detailRowId) : undefined}
      />
    </>
  );
}

// ----- helpers -----

function buildTicks(x0: number, x1: number): { x: number; text: string }[] {
  const out: { x: number; text: string }[] = [];
  const sixH = 6 * 3600_000;
  const start = Math.floor(x0 / sixH) * sixH;
  for (let t = start; t <= x1 + sixH; t += sixH) {
    const d = new Date(t);
    const isMidnight = d.getHours() === 0;
    const text = isMidnight
      ? `${d.getMonth() + 1}/${d.getDate()}`
      : `${String(d.getHours()).padStart(2, '0')}h`;
    out.push({ x: t, text });
  }
  return out;
}

function colorForVoyage(voyage: string, terminal: Terminal, selected: boolean): string {
  if (selected) {
    return 'rgba(37, 99, 235, 0.85)';
  }
  let h = 0;
  for (let i = 0; i < voyage.length; i += 1) h = (h * 31 + voyage.charCodeAt(i)) % 360;
  const sat = terminal === 'SND' ? 70 : 60;
  const light = 78;
  return `hsl(${h}, ${sat}%, ${light}%)`;
}
