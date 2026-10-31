import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function SceneBackdrop({
  src,
  alt,
  className,
  imageClassName,
}: {
  src?: string;
  alt: string;
  className?: string;
  imageClassName?: string;
}) {
  const [front, setFront] = useState(src);
  const [back, setBack] = useState<string | undefined>(undefined);
  const [frontVisible, setFrontVisible] = useState(true);
  const frontRef = useRef(src);

  useEffect(() => {
    const previous = frontRef.current;
    if (src === previous) {
      setFrontVisible(true);
      return;
    }
    frontRef.current = src;
    setBack(previous);
    setFront(src);
    setFrontVisible(false);
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setFrontVisible(true));
    });
    const timer = window.setTimeout(() => setBack(undefined), 320);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [src]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden bg-stage-scrim", className)}>
      {back ? (
        <img src={back} alt="" className={cn("absolute inset-0 size-full object-cover", imageClassName)} />
      ) : null}
      {front ? (
        <img
          src={front}
          alt={alt}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-300 ease-expressive-default-effects",
            frontVisible ? "opacity-100" : "opacity-0",
            imageClassName,
          )}
        />
      ) : null}
    </div>
  );
}
