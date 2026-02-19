'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TurnAudioButtonProps {
  audioUrl?: string;
  className?: string;
}

export function TurnAudioButton({ audioUrl, className }: TurnAudioButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const playRecorded = useCallback(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onended = () => {
      audioRef.current = null;
      setIsPlaying(false);
    };
    audio.onerror = () => {
      audioRef.current = null;
      setIsPlaying(false);
    };

    void audio.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      audioRef.current = null;
      setIsPlaying(false);
    });
  }, [audioUrl]);

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
