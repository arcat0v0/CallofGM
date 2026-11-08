import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { t } from "@/i18n";

const OUTPUT_BASE = 512;

type Offset = { x: number; y: number };

function coverScale(
	canvasWidth: number,
	canvasHeight: number,
	naturalWidth: number,
	naturalHeight: number,
): number {
	return Math.max(canvasWidth / naturalWidth, canvasHeight / naturalHeight);
}

export function ImageCropDialog({
	open,
	onOpenChange,
	imageUrl,
	aspect = 1,
	title,
	description,
	confirmLabel,
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	imageUrl: string | null;
	aspect?: number;
	title: string;
	description?: string;
	confirmLabel: string;
	onConfirm: (blob: Blob) => void | Promise<void>;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const imageRef = useRef<HTMLImageElement | null>(null);
	const dragRef = useRef<{
		x: number;
		y: number;
		baseX: number;
		baseY: number;
	} | null>(null);
	const [zoom, setZoom] = useState(1);
	const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
	const [loaded, setLoaded] = useState(false);
	const [failed, setFailed] = useState(false);
	const [exporting, setExporting] = useState(false);

	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		const image = imageRef.current;
		if (!canvas || !image) {
			return;
		}
		const context = canvas.getContext("2d");
		if (!context) {
			return;
		}
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		if (width === 0 || height === 0) {
			return;
		}
		const pixelScale = Math.max(1, window.devicePixelRatio || 1);
		const pixelWidth = Math.round(width * pixelScale);
		const pixelHeight = Math.round(height * pixelScale);
		if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
			canvas.width = pixelWidth;
			canvas.height = pixelHeight;
		}
		const cover = coverScale(
			canvas.width,
			canvas.height,
			image.naturalWidth,
			image.naturalHeight,
		);
		const drawWidth = image.naturalWidth * cover * zoom;
		const drawHeight = image.naturalHeight * cover * zoom;
		const maxX = Math.max(0, (drawWidth - canvas.width) / 2);
		const maxY = Math.max(0, (drawHeight - canvas.height) / 2);
		const offsetX = Math.max(-maxX, Math.min(maxX, offset.x));
		const offsetY = Math.max(-maxY, Math.min(maxY, offset.y));
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.drawImage(
			image,
			(canvas.width - drawWidth) / 2 + offsetX,
			(canvas.height - drawHeight) / 2 + offsetY,
			drawWidth,
			drawHeight,
		);
	}, [offset.x, offset.y, zoom]);

	useEffect(() => {
		if (!open || !imageUrl) {
			imageRef.current = null;
			setLoaded(false);
			setFailed(false);
			return;
		}
		setLoaded(false);
		setFailed(false);
		setZoom(1);
		setOffset({ x: 0, y: 0 });
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.onload = () => {
			imageRef.current = image;
			setLoaded(true);
		};
		image.onerror = () => {
			setFailed(true);
		};
		image.src = imageUrl;
	}, [open, imageUrl]);

	useEffect(() => {
		if (!loaded) {
			return;
		}
		draw();
		const canvas = canvasRef.current;
		if (!canvas || typeof ResizeObserver === "undefined") {
			return;
		}
		const observer = new ResizeObserver(() => draw());
		observer.observe(canvas);
		return () => observer.disconnect();
	}, [draw, loaded]);

	function clampOffset(next: Offset, zoomValue: number): Offset {
		const canvas = canvasRef.current;
		const image = imageRef.current;
		if (!canvas || !image) {
			return next;
		}
		const cover = coverScale(
			canvas.width,
			canvas.height,
			image.naturalWidth,
			image.naturalHeight,
		);
		const drawWidth = image.naturalWidth * cover * zoomValue;
		const drawHeight = image.naturalHeight * cover * zoomValue;
		const maxX = Math.max(0, (drawWidth - canvas.width) / 2);
		const maxY = Math.max(0, (drawHeight - canvas.height) / 2);
		return {
			x: Math.max(-maxX, Math.min(maxX, next.x)),
			y: Math.max(-maxY, Math.min(maxY, next.y)),
		};
	}

	function cssPixelScale(): number {
		const canvas = canvasRef.current;
		if (!canvas || canvas.clientWidth === 0) {
			return 1;
		}
		return canvas.width / canvas.clientWidth;
	}

	function updateZoom(next: number) {
		if (next === zoom) {
			return;
		}
		setOffset((current) =>
			clampOffset(
				{ x: (current.x / zoom) * next, y: (current.y / zoom) * next },
				next,
			),
		);
		setZoom(next);
	}

	function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
		if (!loaded) {
			return;
		}
		const cssScale = cssPixelScale();
		dragRef.current = {
			x: event.clientX * cssScale,
			y: event.clientY * cssScale,
			baseX: offset.x,
			baseY: offset.y,
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
		const drag = dragRef.current;
		if (!drag) {
			return;
		}
		const cssScale = cssPixelScale();
		setOffset(
			clampOffset(
				{
					x: drag.baseX + (event.clientX * cssScale - drag.x),
					y: drag.baseY + (event.clientY * cssScale - drag.y),
				},
				zoom,
			),
		);
	}

	function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
		dragRef.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	}

	async function exportCrop() {
		const canvas = canvasRef.current;
		const image = imageRef.current;
		if (!canvas || !image || exporting) {
			return;
		}
		setExporting(true);
		try {
			const outWidth = Math.round(OUTPUT_BASE * Math.max(1, aspect));
			const outHeight = Math.round(OUTPUT_BASE * Math.min(1, aspect));
			const output = document.createElement("canvas");
			output.width = outWidth;
			output.height = outHeight;
			const context = output.getContext("2d");
			if (!context) {
				return;
			}
			const ratio = outWidth / canvas.width;
			const cover = coverScale(
				canvas.width,
				canvas.height,
				image.naturalWidth,
				image.naturalHeight,
			);
			const drawWidth = image.naturalWidth * cover * zoom * ratio;
			const drawHeight = image.naturalHeight * cover * zoom * ratio;
			const maxX = Math.max(0, (drawWidth - outWidth) / 2);
			const maxY = Math.max(0, (drawHeight - outHeight) / 2);
			const offsetX = Math.max(-maxX, Math.min(maxX, offset.x * ratio));
			const offsetY = Math.max(-maxY, Math.min(maxY, offset.y * ratio));
			context.drawImage(
				image,
				(outWidth - drawWidth) / 2 + offsetX,
				(outHeight - drawHeight) / 2 + offsetY,
				drawWidth,
				drawHeight,
			);
			const blob = await new Promise<Blob | null>((resolve) =>
				output.toBlob((result) => resolve(result), "image/jpeg", 0.92),
			);
			if (!blob) {
				return;
			}
			await onConfirm(blob);
		} finally {
			setExporting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description ? (
						<DialogDescription>{description}</DialogDescription>
					) : null}
				</DialogHeader>
				<div
					className="bg-md-surface-container-high relative w-full touch-none overflow-hidden rounded-xl"
					style={{ aspectRatio: String(aspect) }}
				>
					<canvas
						ref={canvasRef}
						data-testid="crop-canvas"
						className="size-full cursor-grab active:cursor-grabbing"
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
						onPointerCancel={onPointerUp}
					/>
					{!loaded ? (
						<div className="text-foreground-tertiary absolute inset-0 flex items-center justify-center text-body-small">
							{failed ? t("crop.loadFailed") : t("common.loading")}
						</div>
					) : null}
				</div>
				<p className="text-body-small text-foreground-secondary">
					{t("crop.hint")}
				</p>
				<div className="flex items-center gap-3">
					<Slider
						aria-label={t("crop.zoom")}
						value={[zoom]}
						min={1}
						max={4}
						step={0.01}
						disabled={!loaded}
						onValueChange={(values) => updateZoom(values[0] ?? zoom)}
					/>
					<Button
						type="button"
						variant="tertiary"
						size="sm"
						disabled={!loaded}
						onClick={() => {
							setZoom(1);
							setOffset({ x: 0, y: 0 });
						}}
					>
						{t("crop.reset")}
					</Button>
				</div>
				<div className="flex items-center justify-end gap-2">
					<Button
						type="button"
						variant="ghost"
						onClick={() => onOpenChange(false)}
					>
						{t("common.cancel")}
					</Button>
					<Button
						type="button"
						variant="primary"
						disabled={!loaded || exporting}
						onClick={() => void exportCrop()}
					>
						{confirmLabel}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
