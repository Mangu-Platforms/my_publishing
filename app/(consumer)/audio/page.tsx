import type { Metadata } from 'next';
import { Headphones } from 'lucide-react';
import { listAudiobooks } from '@/lib/data/books';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { AudioCatalogCard } from '@/components/audio/AudioCatalogCard';

export const metadata: Metadata = {
  title: 'Audiobooks',
  description: 'Listen to audiobooks and audio editions from MANGU Publishers authors.',
};

export default async function AudioPage() {
  const books = await listAudiobooks();

  return (
    <Section>
      <Container>
        <div className="mb-8 flex items-center gap-3">
          <Headphones className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">Audiobooks</h1>
            <p className="mt-1 text-secondary">
              Press play instantly — your place is saved automatically.
            </p>
          </div>
        </div>
        {books.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-secondary">No audiobooks available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {books.map((book) => (
              <AudioCatalogCard
                key={book.id}
                id={book.id}
                title={book.title}
                author={book.author}
                coverUrl={book.coverUrl}
                audioUrl={book.audioUrl}
                narrator={book.narrator}
                durationSec={book.durationSec}
              />
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
