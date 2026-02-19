'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TurnAudioButtonProps {
  audioUrl?: string;
  clipStartMs?: number;
  clipEndMs?: number;
  className?: string;
}

export function TurnAudioButton({
  audioUrl,
  clipStartMs,
  clipEndMs,
  className,
}: TurnAudioButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackTokenRef = useRef(0);

  const stopPlayback = useCallback(() => {
    playbackTokenRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const playRecorded = useCallback(() => {
    if (!audioUrl) return;

    const segmentStartSec = Math.max(0, (clipStartMs ?? 0) / 1000);
    const segmentEndSec = clipEndMs !== undefined
      ? Math.max(segmentStartSec + 0.2, clipEndMs / 1000)
      : undefined;

    const token = playbackTokenRef.current + 1;
    playbackTokenRef.current = token;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    const clear = () => {
      if (playbackTokenRef.current !== token) return;
      audioRef.current = null;
      setIsPlaying(false);
    };
    audio.onended = clear;
    audio.onerror = clear;

    const beginPlayback = async () => {
      if (playbackTokenRef.current !== token) return;
      if (segmentStartSec > 0) {
        const duration = Number.isFinite(audio.duration) ? audio.duration : undefined;
        const startAt = duration !== undefined
          ? Math.min(segmentStartSec, Math.max(0, duration - 0.05))
          : segmentStartSec;
        try {
          audio.currentTime = startAt;
        } catch {
          // best-effort seek; fallback to beginning if browser blocks seek
        }
      }

      if (segmentEndSec !== undefined) {
        audio.ontimeupdate = () => {
          if (playbackTokenRef.current !== token) return;
          if (audio.currentTime >= segmentEndSec) {
            audio.pause();
            clear();
          }
        };
      }

      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        clear();
      }
    };

    if (audio.readyState >= 1) {
      void beginPlayback();
      return;
    }

    const onLoadedMetadata = () => {
      if (playbackTokenRef.current !== token) return;
      void beginPlayback();
    };
    audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    audio.load();
  }, [audioUrl, clipStartMs, clipEndMs]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    playRecorded();
  }, [isPlaying, playRecorded, stopPlayback]);

  useEffect(() => stopPlayback, [stopPlayback]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7 shrink-0', className)}
      onClick={togglePlayback}
      disabled={!audioUrl}
      title={audioUrl ? 'Play recorded audio' : 'Recording unavailable'}
      aria-label={
        audioUrl
          ? (isPlaying ? 'Pause recorded audio' : 'Play recorded audio')
          : 'No recording available'
      }
    >
      {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
    </Button>
  );
}
