class PreviewMotion {
	constructor() {
		this.preference = matchMedia("(prefers-reduced-motion: reduce)");
		this.animations = new Set();
		this.preference.addEventListener("change", () => {
			if (this.preference.matches) {
				for (const animation of this.animations) animation.cancel();
			}
		});
	}

	cancel(element) {
		for (const animation of element.getAnimations()) animation.cancel();
	}

	animate(element, spatial, effects, scheme = "standard", speed = "fast") {
		this.cancel(element);
		if (this.preference.matches) return Promise.resolve();
		const tokens = getComputedStyle(document.documentElement);
		const pending = [];
		const current = [];
		for (const [kind, frames] of [
			["spatial", spatial],
			["effects", effects],
		]) {
			if (!frames) continue;
			const token = `${scheme}-${speed}-${kind}`;
			const animation = element.animate(frames, {
				duration: Number.parseFloat(
					tokens.getPropertyValue(`--duration-${token}`),
				),
				easing: tokens.getPropertyValue(`--ease-${token}`).trim(),
				fill: "both",
			});
			current.push(animation);
			this.animations.add(animation);
			pending.push(
				animation.finished
					.catch(() => {})
					.finally(() => {
						this.animations.delete(animation);
					}),
			);
		}
		return Promise.all(pending).then(() => {
			for (const animation of current) animation.cancel();
		});
	}

	enter(element, scheme = "standard", speed = "fast") {
		return this.animate(
			element,
			[
				{ transform: "translateY(12px) scale(.98)" },
				{ transform: "translateY(0) scale(1)" },
			],
			[{ opacity: 0 }, { opacity: 1 }],
			scheme,
			speed,
		);
	}

	capture(elements) {
		const positions = new Map(
			elements.map((element) => [element, element.getBoundingClientRect()]),
		);
		for (const element of elements) this.cancel(element);
		return positions;
	}

	reflow(positions) {
		if (this.preference.matches) return;
		for (const [element, before] of positions) {
			if (!element.isConnected) continue;
			const after = element.getBoundingClientRect();
			const x = before.left - after.left;
			const y = before.top - after.top;
			if (x || y)
				this.animate(
					element,
					[
						{ transform: `translate(${x}px, ${y}px)` },
						{ transform: "translate(0, 0)" },
					],
					null,
				);
		}
	}
}

class SelectionIndicator {
	constructor(container, selected) {
		this.container = container;
		this.selected = selected;
		this.indicator = document.createElement("span");
		this.indicator.className = "selection-indicator";
		this.indicator.setAttribute("aria-hidden", "true");
		container.prepend(this.indicator);
		this.observer = new ResizeObserver(() => this.update());
		this.observer.observe(container);
		this.update();
	}

	update() {
		const selected = this.container.querySelector(this.selected);
		if (!selected?.offsetWidth) return;
		this.indicator.style.width = `${selected.offsetWidth}px`;
		this.indicator.style.height = `${selected.offsetHeight}px`;
		this.indicator.style.transform = `translate(${selected.offsetLeft}px, ${selected.offsetTop}px)`;
	}
}

window.cogmMotion = { controller: new PreviewMotion(), SelectionIndicator };
