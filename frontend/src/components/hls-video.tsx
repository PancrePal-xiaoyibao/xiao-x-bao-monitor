import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface HlsVideoProps {
  src: string;
  poster?: string;
  className?: string;
  desaturated?: boolean;
}

export function HlsVideo({ src, poster, className, desaturated = false }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const handleNativeError = () => {
      if (!cancelled) {
        setHasPlaybackError(true);
      }
    };

    setHasPlaybackError(false);
    video.addEventListener("error", handleNativeError);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      void video.play().catch(() => {
        if (!cancelled) {
          setHasPlaybackError(true);
        }
      });

      return () => {
        cancelled = true;
        video.pause();
        video.removeAttribute("src");
        video.load();
        video.removeEventListener("error", handleNativeError);
      };
    }

    void import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !video) return;
      if (!Hls.isSupported()) {
        setHasPlaybackError(true);
        return;
      }

      const hls = new Hls({
        autoStartLoad: true,
        enableWorker: true,
      });

      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => {
          if (!cancelled) {
            setHasPlaybackError(true);
          }
        });
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!cancelled && data.fatal) {
          setHasPlaybackError(true);
        }
      });

      cleanup = () => {
        hls.destroy();
      };
    });

    return () => {
      cancelled = true;
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.removeEventListener("error", handleNativeError);
      cleanup?.();
    };
  }, [src]);

  return (
    <>
      {hasPlaybackError && poster ? (
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            desaturated && "saturate-0",
            className,
          )}
        />
      ) : null}
      <video
        ref={videoRef}
        poster={poster}
        autoPlay
        loop
        muted
        playsInline
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          desaturated && "saturate-0",
          hasPlaybackError && poster && "opacity-0",
          className,
        )}
      />
    </>
  );
}
