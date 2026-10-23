import { PublicRegistrationForm } from '@/components/PublicRegistrationForm';
export default async function PublicFormSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicRegistrationForm formSlug={slug} />;
}
