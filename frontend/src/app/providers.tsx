import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

import { ToastProvider } from '@/shared/ui/Toast';
import { GlobalStyle } from '@/styles/global';

import { ColorModeProvider } from './colorMode';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, err) => {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 1;
        },
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

interface Props {
  children: ReactNode;
}

export function AppProviders({ children }: Props) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ColorModeProvider>
        <GlobalStyle />
        <ToastProvider>{children}</ToastProvider>
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
      </ColorModeProvider>
    </QueryClientProvider>
  );
}
