import { useLayoutEffect, useRef, useState } from "react";

type IndicatorPosition = {
	left: number;
	top: number;
	right: number;
	bottom: number;
	animated: boolean;
	axis: "horizontal" | "vertical";
};

function SelectionIndicator({
	selector,
	axis = "horizontal",
}: {
	selector: string;
	axis?: "horizontal" | "vertical" | "auto";
}) {
	const ref = useRef<HTMLSpanElement>(null);
	const previous = useRef<IndicatorPosition | null>(null);
	const [position, setPosition] = useState<IndicatorPosition | null>(null);

	useLayoutEffect(() => {
		const parent = ref.current?.parentElement;
		if (!parent) return;
		const measure = (animate: boolean) => {
			const resolvedAxis =
				axis === "auto"
					? parent.dataset.orientation === "vertical"
						? "vertical"
						: "horizontal"
					: axis;
			const target = parent.querySelector<HTMLElement>(selector);
			if (!target) {
				previous.current = null;
				setPosition(null);
				return;
			}
			const container = parent.getBoundingClientRect();
			const box = target.getBoundingClientRect();
			if (!container.width || !container.height) return;
			const scaleX = container.width / parent.offsetWidth;
			const scaleY = container.height / parent.offsetHeight;
			const left =
				(box.left - container.left) / scaleX -
				parent.clientLeft +
				parent.scrollLeft;
			const top =
				(box.top - container.top) / scaleY -
				parent.clientTop +
				parent.scrollTop;
			const right = parent.clientWidth - left - box.width / scaleX;
			const bottom = parent.clientHeight - top - box.height / scaleY;
			const last = previous.current;
			if (
				last &&
				[
					left - last.left,
					top - last.top,
					right - last.right,
					bottom - last.bottom,
				].every((delta) => Math.abs(delta) < 0.1)
			)
				return;
			const next = {
				left,
				top,
				right,
				bottom,
				animated: animate && last !== null,
				axis: resolvedAxis,
			};
			previous.current = next;
			setPosition(next);
		};
		const resize = new ResizeObserver(() => measure(false));
		const observeItems = () => {
			resize.disconnect();
			resize.observe(parent);
			for (const child of parent.children) {
				if (child !== ref.current) resize.observe(child);
			}
		};
		const observer = new MutationObserver((records) => {
			if (records.some((record) => record.type === "childList")) observeItems();
			measure(true);
		});
		observer.observe(parent, {
			attributes: true,
			attributeFilter: ["data-state", "aria-current", "data-orientation"],
			childList: true,
			subtree: true,
		});
		observeItems();
		measure(false);
		return () => {
			resize.disconnect();
			observer.disconnect();
			previous.current = null;
		};
	}, [selector, axis]);

	return (
		<span
			ref={ref}
			data-slot="selection-indicator"
			data-axis={position?.axis ?? axis}
			data-animated={position?.animated}
			aria-hidden="true"
			style={
				position
					? {
							left: position.left,
							top: position.top,
							right: position.right,
							bottom: position.bottom,
						}
					: { visibility: "hidden" }
			}
		>
			<span
				key={
					position
						? `${position.left}:${position.top}:${position.right}:${position.bottom}`
						: "initial"
				}
				data-slot="selection-indicator-surface"
			/>
		</span>
	);
}

export { SelectionIndicator };
