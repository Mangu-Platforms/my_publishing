import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { Clock, ListMusic, Mic } from 'lucide-react';
import { fetchAudiobookById } from '@/lib/data/books';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { AudioPlayer } from '@/components/players/AudioPlayer';
import { formatDurationLong } from '@/components/audio/format';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const data = await fetchAudiobookById(params.id);

  if (!data) {
    return {
      title: 'Audiobook Not Found',
      description: 'The requested audiobook could not be found on MANGU Publishers.',
    };
  }

  const authorName = data.author?.profile?.full_name || data.author?.pen_name || 'Unknown Author';

  return {
    title: `${data.title} - Audiobook`,
    description:
      data.description || `Listen to ${data.title} by ${authorName} on MANGU Publishers.`,
  };
}

export default async function AudiobookPage({ params }: { params: { id: string } }) {
  const data = await fetchAudiobookById(params.id);

  if (!data) {
    notFound();
  }

  const { audioUrl, chapters, narrator, durationSec } = data;
  const authorName = data.author?.profile?.full_name || data.author?.pen_name || 'Unknown Author';
  const durationLabel = durationSec ? formatDurationLong(durationSec) : '';

  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 grid gap-8 md:grid-cols-2">
            {data.cover_url && (
              <div className="relative aspect-[2/3]">
                <Image
                  src={data.cover_url}
                  alt={`Cover of ${data.title}`}
                  fill
                  className="rounded-lg object-cover"
                />
              </div>
            )}
            <div>
              <h1 className="mb-4 text-4xl font-bold">{data.title}</h1>
              <p className="mb-4 text-xl text-secondary">by {authorName}</p>
              {(narrator || durationLabel || chapters.length > 0) && (
                <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-secondary">
                  {narrator && (
                    <span className="flex items-center gap-1.5">
                      <Mic className="h-4 w-4" /> Narrated by {narrator}
                    </span>
                  )}
                  {durationLabel && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" /> {durationLabel}
                    </span>
                  )}
                  {chapters.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <ListMusic className="h-4 w-4" /> {chapters.length} chapters
                    </span>
                  )}
                </div>
              )}
              <p className="mb-6 text-lg">{data.description}</p>
            </div>
          </div>
          <div className="rounded-lg bg-muted p-6">
            <AudioPlayer
              src={audioUrl}
              title={data.title}
              bookId={data.id}
              author={authorName}
              narrator={narrator}
              coverUrl={data.cover_url ?? undefined}
              chapters={chapters}
              autoLoad
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}
