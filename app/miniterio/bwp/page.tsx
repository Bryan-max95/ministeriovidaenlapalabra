'use client';
import { useRouter } from 'next/navigation';
import { RmsPanel } from '@/components/RmsPanel';
export default function AdminPage() {
  const router = useRouter();
  return <RmsPanel onSwitchToPublicForm={(slug) => router.push(slug ? '/registro/' + encodeURIComponent(slug) : '/')} />;
}
