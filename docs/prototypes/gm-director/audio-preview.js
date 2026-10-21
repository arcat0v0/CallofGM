class AudioPreview {
	constructor(root) {
		this.root = root;
		this.seek = root.querySelector("#audio-seek");
		this.elapsed = root.querySelector("#audio-elapsed");
		this.toggle = root.querySelector("#audio-toggle");
		this.volume = root.querySelector("#volume");
		this.mute = root.querySelector("#audio-mute");
		this.playing = true;
		this.position = Number(this.seek.value);
		this.duration = Number(this.seek.max);
		this.lastVolume = Number(this.volume.value);
		this.lastTick = performance.now();
		this.scrubbing = false;
		this.toggle.addEventListener("click", () => this.setPlaying(!this.playing));
		this.seek.addEventListener("pointerdown", () => {
			this.advance();
			this.scrubbing = true;
			this.render();
		});
		for (const event of ["pointerup", "pointercancel", "blur"]) {
			window.addEventListener(event, () => this.endScrub());
		}
		this.seek.addEventListener("change", () => this.endScrub());
		this.seek.addEventListener("input", () => {
			this.position = Number(this.seek.value);
			this.lastTick = performance.now();
			this.render();
		});
		for (const button of root.querySelectorAll("[data-seek]")) {
			button.addEventListener("click", () => {
				this.advance();
				this.position = Math.max(
					0,
					Math.min(this.duration, this.position + Number(button.dataset.seek)),
				);
				this.render();
			});
		}
		this.volume.addEventListener("input", () => this.renderVolume());
		this.mute.addEventListener("click", () => {
			if (Number(this.volume.value)) {
				this.lastVolume = Number(this.volume.value);
				this.volume.value = "0";
			} else this.volume.value = String(this.lastVolume || 64);
			this.renderVolume();
		});
		document.addEventListener("visibilitychange", () => {
			clearTimeout(this.timer);
			this.lastTick = performance.now();
			this.root.classList.toggle("page-inactive", document.hidden);
			if (!document.hidden) this.tick();
		});
		this.renderVolume();
		this.tick();
	}

	formatTime(seconds) {
		const value = Math.floor(seconds);
		return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
	}

	advance() {
		const now = performance.now();
		if (this.playing && !this.scrubbing && !document.hidden) {
			this.position =
				(this.position + (now - this.lastTick) / 1000) % this.duration;
		}
		this.lastTick = now;
	}

	tick() {
		this.advance();
		this.render();
		if (this.playing && !document.hidden)
			this.timer = setTimeout(() => this.tick(), 100);
	}

	setPlaying(playing) {
		clearTimeout(this.timer);
		this.advance();
		this.playing = playing;
		this.tick();
	}

	endScrub() {
		if (!this.scrubbing) return;
		this.scrubbing = false;
		this.lastTick = performance.now();
		this.render();
	}

	render() {
		this.root.classList.toggle("is-paused", !this.playing);
		this.root.classList.toggle("is-scrubbing", this.scrubbing);
		this.seek.value = String(this.position);
		this.root
			.querySelector(".seek-slider")
			.style.setProperty(
				"--progress",
				`${(this.position / this.duration) * 100}%`,
			);
		this.elapsed.textContent = this.formatTime(this.position);
		this.seek.setAttribute(
			"aria-valuetext",
			`${this.formatTime(this.position)}，共 ${this.formatTime(this.duration)}`,
		);
		this.toggle.setAttribute("aria-pressed", String(this.playing));
		this.toggle.setAttribute(
			"aria-label",
			this.playing ? "暂停进度演示" : "播放进度演示",
		);
		this.root.querySelector("#audio-status").textContent = this.playing
			? "循环播放演示 · 无音频"
			: "已暂停演示 · 无音频";
	}

	renderVolume() {
		const value = Number(this.volume.value);
		this.root
			.querySelector(".volume-slider")
			.style.setProperty("--progress", `${value}%`);
		this.root.querySelector("#volume-value").value = `${value}%`;
		this.volume.setAttribute("aria-valuetext", `${value}%`);
		this.mute.setAttribute("aria-pressed", String(value === 0));
		this.mute.setAttribute("aria-label", value ? "静音演示" : "恢复音量演示");
	}
}

new AudioPreview(document.querySelector(".audio-section"));
