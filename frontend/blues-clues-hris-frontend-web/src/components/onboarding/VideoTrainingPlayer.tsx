"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CheckCircle, Lock, Play, RotateCcw, AlertTriangle, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getMyTrainingVideos, saveVideoProgress } from "@/lib/onboardingApi";
import type { TrainingVideoWithProgress } from "@/types/onboarding.types";

const SAVE_INTERVAL_MS = 10_000; // persist bookmark every 10 s of playback

function isEmbedUrl(url: string) {
  return url.includes("youtube.com/embed") || url.includes("player.vimeo.com");
}

interface VideoPlayerProps {
  video: TrainingVideoWithProgress;
  isUnlocked: boolean;
  onComplete: (videoId: string) => void;
  onProgressSaved: (videoId: string, watchedSeconds: number, maxWatchedSeconds: number) => void;
}

function NativeVideoPlayer({ video, isUnlocked, onComplete, onProgressSaved }: Readonly<VideoPlayerProps>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxReachedRef = useRef<number>(video.progress?.max_watched_seconds ?? 0);
  const lastSavedRef = useRef<number>(video.progress?.watched_seconds ?? 0);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef<boolean>(video.progress?.is_completed ?? false);
  const [isCompleted, setIsCompleted] = useState(video.progress?.is_completed ?? false);
  const [watchPercent, setWatchPercent] = useState(0);

  const persistProgress = useCallback(
    async (watchedSecs: number, maxSecs: number, markComplete = false) => {
      if (!isUnlocked) return;
      try {
        await saveVideoProgress(video.video_id, {
          watched_seconds: watchedSecs,
          max_watched_seconds: maxSecs,
          is_completed: markComplete || completedRef.current,
        });
        lastSavedRef.current = watchedSecs;
        onProgressSaved(video.video_id, watchedSecs, maxSecs);
        if (markComplete) {
          completedRef.current = true;
          setIsCompleted(true);
          onComplete(video.video_id);
        }
      } catch {
        // silent — progress save failures shouldn't interrupt playback
      }
    },
    [video.video_id, isUnlocked, onComplete, onProgressSaved],
  );

  // Resume from bookmark on mount
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const resume = video.progress?.watched_seconds ?? 0;
    if (resume > 0) el.currentTime = resume;
  }, [video.progress?.watched_seconds]);

  // No-skip enforcement + progress tracking
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !isUnlocked) return;

    const onTimeUpdate = () => {
      const cur = el.currentTime;
      const dur = el.duration || 0;

      // Enforce anti-skip: if user tries to seek past max reached, pull them back
      if (cur > maxReachedRef.current + 1.0) {
        el.currentTime = maxReachedRef.current;
        return;
      }

      // Advance the max boundary as normal playback proceeds
      if (cur > maxReachedRef.current) {
        maxReachedRef.current = cur;
      }

      if (dur > 0) setWatchPercent(Math.round((maxReachedRef.current / dur) * 100));

      // Completion: fired once when we reach the final second
      if (!completedRef.current && dur > 0 && cur >= dur - 0.5) {
        persistProgress(cur, maxReachedRef.current, true);
      }
    };

    const onPause = () => {
      persistProgress(el.currentTime, maxReachedRef.current);
    };

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("pause", onPause);

    // Periodic auto-save during playback
    saveTimerRef.current = setInterval(() => {
      if (!el.paused) persistProgress(el.currentTime, maxReachedRef.current);
    }, SAVE_INTERVAL_MS);

    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("pause", onPause);
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  }, [isUnlocked, persistProgress]);

  // Save on page visibility change (tab switch / close)
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !isUnlocked) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistProgress(el.currentTime, maxReachedRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isUnlocked, persistProgress]);

  if (!isUnlocked) {
    return (
      <div className="aspect-video bg-slate-100 rounded-xl flex flex-col items-center justify-center gap-3 border border-slate-200">
        <Lock className="size-10 text-slate-400" />
        <p className="text-sm text-slate-500 font-medium">Complete the previous video to unlock</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          src={video.video_url}
          controls
          controlsList="nodownload"
          disablePictureInPicture
          className="w-full h-full"
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
      <div className="flex items-center gap-3">
        <Progress value={watchPercent} className="flex-1 h-2" />
        <span className="text-xs text-slate-500 whitespace-nowrap">{watchPercent}% watched</span>
        {isCompleted && (
          <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
            <CheckCircle className="size-3" />Completed
          </Badge>
        )}
      </div>
    </div>
  );
}

function EmbedVideoPlayer({ video, isUnlocked }: Readonly<Pick<VideoPlayerProps, "video" | "isUnlocked">>) {
  if (!isUnlocked) {
    return (
      <div className="aspect-video bg-slate-100 rounded-xl flex flex-col items-center justify-center gap-3 border border-slate-200">
        <Lock className="size-10 text-slate-400" />
        <p className="text-sm text-slate-500 font-medium">Complete the previous video to unlock</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={video.video_url}
          allow="autoplay; fullscreen"
          allowFullScreen
          className="w-full h-full border-0"
          title={video.title}
        />
      </div>
      {video.progress?.is_completed && (
        <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
          <CheckCircle className="size-3" />Completed
        </Badge>
      )}
      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
        <AlertTriangle className="size-3 shrink-0" />
        This video is hosted externally. Progress tracking requires watching it fully.
      </p>
    </div>
  );
}

interface VideoTrainingPlayerProps {
  onCompletionChange?: (allCompleted: boolean) => void;
}

export function VideoTrainingPlayer({ onCompletionChange }: Readonly<VideoTrainingPlayerProps> = {}) {
  const [videos, setVideos] = useState<TrainingVideoWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyTrainingVideos();
      setVideos(data);
      const firstIncomplete = data.findIndex((v) => !v.progress?.is_completed);
      setActiveIndex(firstIncomplete === -1 ? 0 : firstIncomplete);
      // Notify parent immediately on load
      onCompletionChange?.(data.length > 0 && data.every((v) => v.progress?.is_completed));
    } catch {
      setError("Failed to load training videos.");
    } finally {
      setLoading(false);
    }
  }, [onCompletionChange]);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  const handleComplete = useCallback((videoId: string) => {
    setVideos((prev) => {
      const updated = prev.map((v) =>
        v.video_id === videoId
          ? { ...v, progress: { ...(v.progress ?? {} as any), is_completed: true } }
          : v,
      );
      onCompletionChange?.(updated.length > 0 && updated.every((v) => v.progress?.is_completed));
      return updated;
    });
  }, [onCompletionChange]);

  const handleProgressSaved = useCallback((videoId: string, watchedSeconds: number, maxWatchedSeconds: number) => {
    setVideos((prev) =>
      prev.map((v) =>
        v.video_id === videoId
          ? { ...v, progress: { ...(v.progress ?? {} as any), watched_seconds: watchedSeconds, max_watched_seconds: maxWatchedSeconds } }
          : v,
      ),
    );
  }, []);

  if (loading) return <div className="p-8 text-sm text-muted-foreground animate-pulse">Loading training videos…</div>;
  if (error) return <div className="p-8 text-sm text-destructive">{error}</div>;
  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <Video className="size-12 text-slate-300" />
        <p className="text-slate-500 text-sm">No training videos have been assigned yet. Check back later.</p>
      </div>
    );
  }

  const allCompleted = videos.every((v) => v.progress?.is_completed);
  const completedCount = videos.filter((v) => v.progress?.is_completed).length;
  const active = videos[activeIndex];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold text-slate-800 text-lg">Training Videos</h3>
          <p className="text-sm text-slate-500">Watch all videos sequentially to complete this section.</p>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={Math.round((completedCount / videos.length) * 100)} className="w-32 h-2" />
          <span className="text-sm font-medium text-slate-600">{completedCount}/{videos.length} completed</span>
          {allCompleted && (
            <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 text-xs">
              <CheckCircle className="size-3" />All done
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

        {/* Player */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-slate-700 truncate">{active.title}</h4>
            <span className="text-xs text-slate-400 shrink-0">Video {activeIndex + 1} of {videos.length}</span>
          </div>
          {active.description && (
            <p className="text-sm text-slate-500">{active.description}</p>
          )}

          {isEmbedUrl(active.video_url) ? (
            <EmbedVideoPlayer
              video={active}
              isUnlocked={activeIndex === 0 || (videos[activeIndex - 1]?.progress?.is_completed ?? false)}
            />
          ) : (
            <NativeVideoPlayer
              video={active}
              isUnlocked={activeIndex === 0 || (videos[activeIndex - 1]?.progress?.is_completed ?? false)}
              onComplete={handleComplete}
              onProgressSaved={handleProgressSaved}
            />
          )}

          {/* Prev / Next navigation */}
          <div className="flex justify-between pt-1">
            <Button
              variant="outline"
              size="sm"
              disabled={activeIndex === 0}
              onClick={() => setActiveIndex((i) => i - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              disabled={!active.progress?.is_completed || activeIndex === videos.length - 1}
              onClick={() => setActiveIndex((i) => i + 1)}
            >
              Next Video
            </Button>
          </div>
        </div>

        {/* Playlist sidebar */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">Playlist</p>
          {videos.map((v, idx) => {
            const unlocked = idx === 0 || (videos[idx - 1]?.progress?.is_completed ?? false);
            const completed = v.progress?.is_completed ?? false;
            const isActive = idx === activeIndex;
            return (
              <button
                key={v.video_id}
                disabled={!unlocked}
                onClick={() => setActiveIndex(idx)}
                className={[
                  "w-full text-left rounded-xl px-3 py-2.5 border transition-all",
                  isActive
                    ? "bg-blue-50 border-blue-300 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300",
                  !unlocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  {completed ? (
                    <CheckCircle className="size-4 text-green-500 shrink-0" />
                  ) : unlocked ? (
                    <Play className="size-4 text-blue-500 shrink-0" />
                  ) : (
                    <Lock className="size-4 text-slate-400 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-slate-700 truncate">{v.title}</span>
                </div>
                {v.progress && !completed && (
                  <div className="mt-1.5 ml-6">
                    <Progress
                      value={v.progress.max_watched_seconds > 0 ? Math.min(99, Math.round((v.progress.max_watched_seconds / (v.progress.max_watched_seconds + 60)) * 100)) : 0}
                      className="h-1"
                    />
                  </div>
                )}
                {!unlocked && (
                  <p className="text-xs text-slate-400 mt-0.5 ml-6">Finish previous video first</p>
                )}
              </button>
            );
          })}
          <button
            onClick={loadVideos}
            className="w-full text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 py-1"
          >
            <RotateCcw className="size-3" /> Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
