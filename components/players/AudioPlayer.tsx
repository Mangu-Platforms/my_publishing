'use client';

/**
 * AudioPlayer — full-featured audiobook player.
 *
 * Backward compatible: <AudioPlayer src="…" title="…" /> keeps working
 * everywhere (book/comic/paper sample embeds included). New optional props
 * unlock the launch-tier experience: speed, ±15s skip, sleep timer, keyboard
 * shortcuts, progress persistence + resume prompt, chapter list, buffered /
 * download indicators.
 *
 * Engine: uses the shared global engine from AudioContext when a provider is
 * mounted (keeps playing across navigation, mini-player mirrors it); otherwise
 * falls back to a private engine so the player always works standalone.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Gauge,
  ListMusic,
  Loader2,
  Moon,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { useAudio } from '@/components/audio/AudioContext';
import { PLAYBACK_RATES, useAudioEngine } from '@/components/audio/use-audio-engine';
import { formatTime } from '@/components/audio/format';
import type { AudioChapter, AudioTrackInfo } from '@/components/audio/types';

export interface AudioPlayerProps {
  src: string;
  title?: string;
  className?: string;
  /** Book UUID — enables signed-in progress sync. */
  bookId?: string;
  author?: string;
  narrator?: string;
  coverUrl?: string;
  chapters?: AudioChapter[];
  /**
   * Register this track with the shared engine on mount (paused) so the
   * mini-player reflects the page's book. Only meaningful with a provider.
   */
  autoLoad?: boolean;
  /** Document-level keyboard shortcuts (Space/←/→/↑/↓). Default true. */
  enableKeyboard?: boolean;
  /** Show the chapter list under the controls. Default true. */
  showChapters?: boolean;
}

const SKIP_STEP_SEC = 15;
/** Seek-bar keyboard steps (ARIA slider pattern): arrows nudge, PageUp/Down jump. */
const SEEK_KEY_STEP_SEC = 5;
const SEEK_KEY_PAGE_SEC = 60;

export function AudioPlayer({
  src,
  title,
  className,
  bookId,
  author,
  narrator,
  coverUrl,
  chapters,
  autoLoad = false,
  enableKeyboard = true,
  showChapters = true,
}: AudioPlayerProps) {
  const shared = useAudio();
  const local = useAudioEngine();
  const usingShared = shared !== null;
  const engine = shared ?? local;

  const trackInfo: AudioTrackInfo = useMemo(
    () => ({ src, title, author, narrator, coverUrl, bookId, chapters }),
    [src, title, author, narrator, coverUrl, bookId, chapters]
  );

  const isActiveTrack = engine.track?.src === src;
  const interactedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  const sleepMenuRef = useRef<HTMLDivElement>(null);

  // Register the track on mount (paused). Standalone engines are exclusively
  // owned by this player, so always register; shared engines only when asked —
  // and never yank an actively-playing track on a passive page view.
  const { loadTrack } = engine;
  useEffect(() => {
    if (!usingShared || autoLoad) {
      if (usingShared && engine.track && engine.track.src !== src && engine.isPlaying) {
        return;
      }
      loadTrack(trackInfo, { autoplay: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usingShared, autoLoad, loadTrack, src]);

  // Close the sleep menu on outside click / Escape.
  useEffect(() => {
    if (!sleepMenuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (sleepMenuRef.current && !sleepMenuRef.current.contains(event.target as Node)) {
        setSleepMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSleepMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [sleepMenuOpen]);

  // Keyboard shortcuts. Armed only after the listener interacts with this
  // player, so page scroll/keys are never hijacked passively.
  useEffect(() => {
    if (!enableKeyboard) return;

    // WHY: this listener is on `document`, so it must never consume a key the
    // focused control needs — Space and Enter activate buttons and links,
    // arrows drive sliders, selects, tabs and menus. Before this guard, one
    // interaction with the player left Space calling preventDefault() on every
    // button on the site (A11Y-005), including the player's own sleep-timer
    // trigger and, now, its seek bar.
    const controlOwnsItsKeys = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      return (
        target.closest(
          'a[href], button, input, textarea, select, summary, [contenteditable=""], ' +
            '[contenteditable="true"], [tabindex]:not([tabindex="-1"]), [role="button"], ' +
            '[role="link"], [role="checkbox"], [role="radio"], [role="switch"], ' +
            '[role="slider"], [role="spinbutton"], [role="tab"], [role="menuitem"], ' +
            '[role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], ' +
            '[role="textbox"], [role="combobox"]'
        ) !== null
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!interactedRef.current) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (controlOwnsItsKeys(event.target)) return;
      // With a shared engine, only drive the active track.
      if (usingShared && !isActiveTrack) return;
      if (!engine.track) return;

      switch (event.key) {
        case ' ':
        case 'k':
          event.preventDefault();
          engine.toggle();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          engine.seekBy(-SKIP_STEP_SEC);
          break;
        case 'ArrowRight':
          event.preventDefault();
          engine.seekBy(SKIP_STEP_SEC);
          break;
        case 'ArrowUp':
          event.preventDefault();
          engine.setVolume(engine.volume + 0.1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          engine.setVolume(engine.volume - 0.1);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enableKeyboard, engine, usingShared, isActiveTrack]);

  const handlePrimaryAction = () => {
    interactedRef.current = true;
    if (isActiveTrack) {
      engine.toggle();
    } else {
      engine.playTrack(trackInfo);
    }
  };

  const cycleRate = () => {
    const rates = PLAYBACK_RATES as readonly number[];
    const idx = rates.indexOf(engine.playbackRate);
    const next = rates[(idx + 1) % rates.length] ?? 1;
    engine.setPlaybackRate(next);
  };

  // ── Display state (live for the active track; static otherwise) ────────────
  const shownTime = isActiveTrack ? engine.currentTime : 0;
  const shownDuration = isActiveTrack ? engine.duration : 0;
  const playedFraction = shownDuration > 0 ? shownTime / shownDuration : 0;
  const bufferedFraction = isActiveTrack ? engine.bufferedFraction : 0;
  const isPlaying = isActiveTrack && engine.isPlaying;
  const isBuffering = isActiveTrack && engine.isBuffering;
  const chapterList = isActiveTrack ? engine.chapters : (chapters ?? []);
  const activeChapterIndex = isActiveTrack ? engine.activeChapterIndex : -1;
  const sleep = isActiveTrack ? engine.sleepTimer : null;
  const resumePosition = isActiveTrack ? engine.resumePosition : null;

  // Keyboard operation of the seek bar (A11Y-003). The element already claimed
  // role="slider" to assistive tech while being unfocusable and inert, which is
  // worse than not claiming it. Mouse/touch seeking is unchanged below.
  const onSeekBarKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isActiveTrack || shownDuration <= 0) return;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        engine.seekBy(-SEEK_KEY_STEP_SEC);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        engine.seekBy(SEEK_KEY_STEP_SEC);
        break;
      case 'PageDown':
        engine.seekBy(-SEEK_KEY_PAGE_SEC);
        break;
      case 'PageUp':
        engine.seekBy(SEEK_KEY_PAGE_SEC);
        break;
      case 'Home':
        engine.seekTo(0);
        break;
      case 'End':
        engine.seekTo(shownDuration);
        break;
      default:
        // Everything else — Tab, Escape, browser shortcuts — is left alone.
        return;
    }
    event.preventDefault();
  };

  const onSeekBarPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isActiveTrack || shownDuration <= 0) return;
    const bar = event.currentTarget;
    const apply = (clientX: number) => {
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      engine.seekTo(ratio * shownDuration);
    };
    apply(event.clientX);
    bar.setPointerCapture(event.pointerId);
    const onMove = (move: PointerEvent) => apply(move.clientX);
    const onUp = () => {
      bar.removeEventListener('pointermove', onMove);
      bar.removeEventListener('pointerup', onUp);
    };
    bar.addEventListener('pointermove', onMove);
    bar.addEventListener('pointerup', onUp);
  };

  return (
    <div
      ref={rootRef}
      className={cn('w-full', className)}
      onPointerDown={() => {
        interactedRef.current = true;
      }}
      data-testid="audio-player"
    >
      {/* Standalone mode renders its own element; shared mode uses the provider's. */}
      {!usingShared && <audio ref={local.audioRef} preload="metadata" />}

      {title && <h3 className="mb-4 font-semibold">{title}</h3>}

      {/* Resume prompt */}
      {resumePosition !== null && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-primary/40 bg-primary/10 px-4 py-3">
          <span className="text-sm">Pick up where you left off — {formatTime(resumePosition)}</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => engine.applyResume(true)}>
              Resume
            </Button>
            <Button size="sm" variant="ghost" onClick={() => engine.dismissResume()}>
              Start over
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Progress bar: buffered layer under played layer */}
        <div>
          <div
            className={cn(
              'group relative h-2 w-full rounded-full bg-muted',
              isActiveTrack && shownDuration > 0 ? 'cursor-pointer' : 'opacity-70'
            )}
            role="slider"
            aria-label="Seek"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={Math.round(shownDuration)}
            aria-valuenow={Math.round(shownTime)}
            aria-valuetext={`${formatTime(shownTime)} of ${formatTime(shownDuration)}`}
            // Always in the tab order: a slider that drops out when its track is
            // not loaded is a focus stop that appears and disappears under the
            // user. The handler no-ops until there is something to seek. The
            // focus ring is the global :focus-visible rule in app/globals.css.
            tabIndex={0}
            onKeyDown={onSeekBarKeyDown}
            onPointerDown={onSeekBarPointer}
          >
            {/* Download progress (buffered) */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-foreground/20"
              style={{ width: `${bufferedFraction * 100}%` }}
            />
            {/* Played */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-150"
              style={{ width: `${playedFraction * 100}%` }}
            />
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow transition-opacity group-hover:opacity-100"
              style={{ left: `${playedFraction * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-secondary">
            <span>{formatTime(shownTime)}</span>
            <span className="flex items-center gap-2">
              {isBuffering && (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buffering…
                </span>
              )}
              {isActiveTrack && bufferedFraction > 0 && bufferedFraction < 0.999 && (
                <span title="Downloaded">{Math.round(bufferedFraction * 100)}% buffered</span>
              )}
              <span>{shownDuration > 0 ? formatTime(shownDuration) : '--:--'}</span>
            </span>
          </div>
        </div>

        {/* Transport controls */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              interactedRef.current = true;
              if (isActiveTrack) engine.seekBy(-SKIP_STEP_SEC);
            }}
            disabled={!isActiveTrack}
            aria-label={`Back ${SKIP_STEP_SEC} seconds`}
            className="relative"
          >
            <RotateCcw className="h-5 w-5" />
            <span className="absolute text-[9px] font-bold">15</span>
          </Button>

          <Button
            onClick={handlePrimaryAction}
            variant="default"
            size="icon"
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
            className="h-14 w-14 rounded-full"
          >
            {isBuffering ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-6 w-6 fill-current" />
            ) : (
              <Play className="ml-0.5 h-6 w-6 fill-current" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              interactedRef.current = true;
              if (isActiveTrack) engine.seekBy(SKIP_STEP_SEC);
            }}
            disabled={!isActiveTrack}
            aria-label={`Forward ${SKIP_STEP_SEC} seconds`}
            className="relative"
          >
            <RotateCw className="h-5 w-5" />
            <span className="absolute text-[9px] font-bold">15</span>
          </Button>
        </div>

        {/* Secondary controls: speed / sleep / volume */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              interactedRef.current = true;
              cycleRate();
            }}
            aria-label={`Playback speed ${engine.playbackRate}x. Activate to change.`}
            className="gap-1.5"
          >
            <Gauge className="h-4 w-4" />
            {engine.playbackRate}×
          </Button>

          {/* Sleep timer */}
          <div className="relative" ref={sleepMenuRef}>
            <Button
              variant={sleep ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSleepMenuOpen((open) => !open)}
              aria-label="Sleep timer"
              aria-expanded={sleepMenuOpen}
              className="gap-1.5"
            >
              <Moon className="h-4 w-4" />
              {sleep?.mode === 'minutes' && sleep.remainingSec !== null
                ? formatTime(sleep.remainingSec)
                : sleep?.mode === 'chapter'
                  ? 'End of chapter'
                  : 'Sleep'}
            </Button>
            {sleepMenuOpen && (
              <div className="absolute bottom-full left-1/2 z-50 mb-2 w-44 -translate-x-1/2 rounded-md border border-border bg-popover p-1 shadow-lg">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      engine.setSleepTimerMinutes(mins);
                      setSleepMenuOpen(false);
                    }}
                  >
                    {mins} minutes
                  </button>
                ))}
                <button
                  type="button"
                  className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                  disabled={chapterList.length === 0}
                  title={chapterList.length === 0 ? 'No chapters available' : undefined}
                  onClick={() => {
                    engine.setSleepTimerEndOfChapter();
                    setSleepMenuOpen(false);
                  }}
                >
                  End of chapter
                </button>
                {sleep && (
                  <button
                    type="button"
                    className="block w-full rounded px-3 py-2 text-left text-sm text-red-400 hover:bg-muted"
                    onClick={() => {
                      engine.cancelSleepTimer();
                      setSleepMenuOpen(false);
                    }}
                  >
                    Turn off
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Volume */}
          <div className="hidden items-center gap-1 sm:flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => engine.toggleMute()}
              aria-label={engine.isMuted ? 'Unmute' : 'Mute'}
              className="h-9 w-9"
            >
              {engine.isMuted || engine.volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={engine.isMuted ? 0 : engine.volume}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                engine.setVolume(Number(event.target.value))
              }
              aria-label="Volume"
              className="h-1 w-24 cursor-pointer accent-primary"
            />
          </div>
        </div>

        {/* Chapter list */}
        {showChapters && chapterList.length > 0 && (
          <div className="rounded-md border border-border">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-sm font-medium text-secondary">
              <ListMusic className="h-4 w-4" />
              Chapters
            </div>
            <ul className="max-h-64 overflow-y-auto">
              {chapterList.map((chapter, index) => {
                const isCurrent = index === activeChapterIndex;
                return (
                  <li key={chapter.id}>
                    <button
                      type="button"
                      disabled={!isActiveTrack}
                      onClick={() => {
                        interactedRef.current = true;
                        engine.seekTo(chapter.start);
                        engine.play();
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                        isCurrent ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                        !isActiveTrack && 'cursor-default opacity-70'
                      )}
                    >
                      <span className="w-6 shrink-0 text-xs text-secondary">{index + 1}</span>
                      <span className="flex-1 truncate">{chapter.title}</span>
                      {isCurrent && isPlaying ? (
                        <Pause className="h-3.5 w-3.5 shrink-0 fill-current" />
                      ) : (
                        <Play className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      )}
                      <span className="shrink-0 text-xs text-secondary">
                        {formatTime(chapter.start)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {enableKeyboard && (
          <p className="text-center text-xs text-muted-foreground">
            Space play/pause · ← → ±{SKIP_STEP_SEC}s · ↑ ↓ volume
          </p>
        )}
      </div>
    </div>
  );
}
