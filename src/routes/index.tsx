import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/AppLayout';

export const Route = createFileRoute('/')({ component: App });

function App() {
  return <AppLayout />;
}
