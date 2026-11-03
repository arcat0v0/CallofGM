export function audioDurationMs(file: File): Promise<number> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const audio = new Audio();
		audio.preload = "metadata";
		const finish = (value: number) => {
			URL.revokeObjectURL(url);
			resolve(value);
		};
		audio.onloadedmetadata = () => {
			const seconds = Number.isFinite(audio.duration) ? audio.duration : 0;
			finish(Math.max(0, Math.round(seconds * 1000)));
		};
		audio.onerror = () => finish(0);
		audio.src = url;
	});
}
