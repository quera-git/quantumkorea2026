// vitest-axe 기반 a11y 스모크 테스트.
// 모든 컴포넌트를 다 테스트하지 않고, 자주 쓰이는 프리미티브 + 한 페이지 통합 정도만 커버.
// 새 컴포넌트 추가될 때마다 axe 가 잡는 명백한 위반(라벨 누락/대비 부족 등)을 미리 잡는 것이 목적.

import { useToast } from '@/shared/ui/Toast';
import { axe } from 'vitest-axe';
import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Anchor } from 'lucide-react';

import { renderWithProviders, TestProviders } from '@/test/renderWithProviders';

import { Button } from './Button';
import { Card, CardSubtitle, CardTitle } from './Card';
import { EmptyState } from './EmptyState';
import { SectionHeader } from './SectionHeader';
import { Skeleton } from './Skeleton';
import { StatusBadge } from './StatusBadge';

describe('a11y: ui primitives', () => {
  it('Button 은 a11y 위반 없음', async () => {
    const { container } = renderWithProviders(<Button>OK</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Card + SectionHeader 조합', async () => {
    const { container } = renderWithProviders(
      <Card>
        <SectionHeader
          icon={Anchor}
          number="01"
          title="제목"
          description="부가 설명"
        />
        <CardSubtitle>본문</CardSubtitle>
      </Card>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('EmptyState', async () => {
    const { container } = renderWithProviders(
      <EmptyState icon={Anchor} title="비어있음" description="설명" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Skeleton', async () => {
    const { container } = renderWithProviders(<Skeleton width={120} height={20} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each(['pending', 'running', 'succeeded', 'failed'] as const)(
    'StatusBadge status=%s',
    async (status) => {
      const { container } = renderWithProviders(<StatusBadge status={status} />);
      expect(await axe(container)).toHaveNoViolations();
    },
  );

  it('CardTitle 만 단독 사용', async () => {
    const { container } = renderWithProviders(<CardTitle>제목</CardTitle>);
    expect(await axe(container)).toHaveNoViolations();
  });
});

function ToastEmitter() {
  const t = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        t.notify({ tone: 'success', title: '완료', description: '저장됨', durationMs: 0 })
      }
    >
      Notify
    </button>
  );
}

describe('a11y: Toast 시스템', () => {
  it('알림이 떠 있을 때 region 이 a11y 위반 없음', async () => {
    // TestProviders 가 이미 ToastProvider 를 포함하므로 추가 wrap 금지.
    const { container, getByText } = render(
      <TestProviders>
        <ToastEmitter />
      </TestProviders>,
    );
    fireEvent.click(getByText('Notify'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
