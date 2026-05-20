import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

import { ColorModeProvider } from '@/app/colorMode';
import { ToastProvider } from '@/shared/ui/Toast';

/**
 * 테스트용 QueryClient. retry 비활성화로 mock failure 가 즉시 노출된다.
 */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface WrapperProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export function TestProviders({ children, queryClient }: WrapperProps) {
  const qc = queryClient ?? makeTestQueryClient();
  return (
    <QueryClientProvider client={qc}>
      <ColorModeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ColorModeProvider>
    </QueryClientProvider>
  );
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  { queryClient, ...options }: RenderWithProvidersOptions = {},
): RenderResult & { queryClient: QueryClient } {
  const qc = queryClient ?? makeTestQueryClient();
  return {
    queryClient: qc,
    ...render(ui, {
      ...options,
      wrapper: ({ children }) => <TestProviders queryClient={qc}>{children}</TestProviders>,
    }),
  };
}
