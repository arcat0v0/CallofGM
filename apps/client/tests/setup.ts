import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { cleanup } from "@testing-library/react";
import { plugin } from "bun";

plugin({
	name: "vite-worker-url",
	setup(build) {
		build.onResolve({ filter: /\?worker&url$/ }, (args) => ({
			path: args.path,
			namespace: "vite-worker-url",
		}));
		build.onLoad({ filter: /.*/, namespace: "vite-worker-url" }, (args) => ({
			contents: `export default ${JSON.stringify(args.path)};`,
			loader: "js",
		}));
	},
});
GlobalRegistrator.register({
	url: "http://localhost/",
	settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true },
});

if (!window.matchMedia) {
	window.matchMedia = ((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
		dispatchEvent: () => false,
	})) as typeof window.matchMedia;
}

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
	cleanup();
});
