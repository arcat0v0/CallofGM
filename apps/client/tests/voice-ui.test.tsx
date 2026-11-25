import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { VoiceMember, VoiceState } from "@cogm/shared";
import {
	act,
	fireEvent,
	render,
	waitFor,
	within,
} from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { GmToolProvider } from "../src/features/gm-console/gm-tool-context";
import { GmToolDock } from "../src/features/gm-console/gm-tool-dock";
import { PlayerActionDock } from "../src/features/play/player-action-dock";
import {
	type VoiceActivityMonitorLike,
	VoiceController,
	type VoiceMicTesterLike,
	type VoiceSnapshot,
} from "../src/features/voice/voice-controller";
import { VoicePanelBody } from "../src/features/voice/voice-panel";
import type { VoicePeer } from "../src/features/voice/voice-peer";
import { usePlayStore } from "../src/stores/play-store";

const selfMember: VoiceMember = {
	id: "00000000-0000-4000-8000-000000000001",
	name: "主持人",
	role: "gm",
	canSpeak: true,
	speakGranted: true,
	muted: false,
};

const playerOne: VoiceMember = {
	id: "00000000-0000-4000-8000-000000000002",
	name: "远野 澪",
	role: "pc",
	canSpeak: true,
	speakGranted: true,
	muted: false,
};

const playerTwo: VoiceMember = {
	id: "00000000-0000-4000-8000-000000000003",
	name: "白石 拓真",
	role: "pc",
	canSpeak: true,
	speakGranted: true,
	muted: false,
};

const roomId = "00000000-0000-4000-8000-000000000010";

function createVoiceFixture(
	canManage = true,
	capture?: () => Promise<MediaStream>,
) {
	const setVolume = mock((_volume: number) => {});
	const peer = {
		setTrack: mock((_track: MediaStreamTrack | null) => {}),
		setAudible: mock((_audible: boolean) => {}),
		setVolume,
		retryPlayback: mock(() => {}),
		close: mock(() => {}),
		accept: mock(() => {}),
	};
	let emitSpeaking: ((ids: string[]) => void) | null = null;
	let emitMicSample: ((level: number, detected: boolean) => void) | null = null;
	const monitor: VoiceActivityMonitorLike = {
		setTrack: mock(() => {}),
		setAllowed: mock(() => {}),
		resume: mock(() => {}),
		clear: mock(() => {}),
		close: mock(() => {}),
	};
	const micTester: VoiceMicTesterLike = {
		start: mock(() => {}),
		setLoopback: mock(() => {}),
		stop: mock(() => {}),
	};
	const controller = new VoiceController({
		capture,
		createPeer: () => peer as unknown as VoicePeer,
		createMonitor: (onChange) => {
			emitSpeaking = onChange;
			return monitor;
		},
		createMicTester: (onSample) => {
			emitMicSample = onSample;
			return micTester;
		},
	});
	controller.connect(() => true);
	const baseState: VoiceState = {
		enabled: true,
		available: true,
		limit: 8,
		maxLimit: 16,
		selfId: null,
		members: canManage ? [playerOne, playerTwo] : [],
		memberCount: 2,
		iceServers: [],
		roomId,
		canManage,
	};
	controller.receive({
		protocolVersion: 1,
		type: "voice:state",
		payload: baseState,
	});

	function joinRoom() {
		controller.join();
		controller.receive({
			protocolVersion: 1,
			type: "voice:state",
			payload: {
				...baseState,
				selfId: selfMember.id,
				members: [selfMember, playerOne, playerTwo],
				memberCount: 3,
			},
		});
	}

	return {
		controller,
		joinRoom,
		setVolume,
		peer,
		monitor,
		emitSpeaking: (ids: string[]) => emitSpeaking?.(ids),
		emitMicSample: (level: number, detected: boolean) =>
			emitMicSample?.(level, detected),
	};
}

beforeEach(() => {
	if (!Element.prototype.hasPointerCapture) {
		Element.prototype.hasPointerCapture = () => false;
	}
	if (!Element.prototype.setPointerCapture) {
		Element.prototype.setPointerCapture = () => undefined;
	}
	if (!Element.prototype.releasePointerCapture) {
		Element.prototype.releasePointerCapture = () => undefined;
	}
	localStorage.clear();
	usePlayStore.getState().reset();
	usePlayStore.setState({
		status: "active",
		phase: "free_discussion",
		viewer: {
			isGm: false,
			seatRole: "pc",
			holderKind: "anonymous",
			holderId: "p1",
		},
	});
});

function openSettings(scope: Pick<ReturnType<typeof within>, "getByRole">) {
	// Radix tabs activate on mousedown rather than click.
	fireEvent.mouseDown(scope.getByRole("tab", { name: "设置" }), { button: 0 });
}

function renderAudioSettings(overrides: Record<string, unknown> = {}) {
	const { controller, joinRoom } = createVoiceFixture(true);
	joinRoom();
	const updateAudioSettings = mock(async (_patch: unknown) => {});
	const refreshAudioDevices = mock(async () => {});
	const setPushToTalkActive = mock((_active: boolean) => {});
	const voice = Object.create(controller) as VoiceController;
	Object.assign(voice, {
		updateAudioSettings,
		refreshAudioDevices,
		setPushToTalkActive,
		stopMicTest: mock(() => {}),
	});
	const { audioSettings: audioSettingsOverride, ...snapshotOverrides } =
		overrides;
	const snapshot = {
		...controller.getSnapshot(),
		audioSettings: {
			deviceId: "default",
			outputDeviceId: "default",
			echoCancellation: true,
			noiseSuppression: true,
			autoGainControl: false,
			deepNoiseSuppression: false,
			noiseSuppressionEngine: "deepfilter",
			noiseGate: false,
			compressor: false,
			pushToTalk: false,
			pushToTalkKey: "Space",
			...(audioSettingsOverride as Record<string, unknown> | undefined),
		},
		audioDevices: [
			{ deviceId: "usb-mic", label: "USB 麦克风" },
			{ deviceId: "unlabelled-mic", label: "" },
		],
		audioOutputDevices: [
			{ deviceId: "usb-spk", label: "USB 耳机" },
			{ deviceId: "unlabelled-spk", label: "" },
		],
		supportsOutputSelection: true,
		appliedAudioConstraints: {
			echoCancellation: true,
			noiseSuppression: true,
			autoGainControl: false,
		},
		audioProcessing: "native",
		pushToTalkActive: false,
		...snapshotOverrides,
	} as VoiceSnapshot;
	const view = render(<VoicePanelBody voice={voice} snapshot={snapshot} />);
	openSettings(view);
	return {
		view,
		section: view.getByRole("region", { name: "麦克风与音频处理" }),
		updateAudioSettings,
		refreshAudioDevices,
		setPushToTalkActive,
	};
}

describe("voice panel & speaker popup UI", () => {
	test("GM dock opens voice as a stage-glass panel like audio and keeps joined highlight", async () => {
		const { controller, joinRoom } = createVoiceFixture(true);
		const view = render(
			<GmToolProvider>
				<GmToolDock voice={controller} />
			</GmToolProvider>,
		);

		const voiceButton = view.getByRole("button", { name: "语音" });
		fireEvent.click(voiceButton);

		// Dock-anchored region panel (like 声音), not a modal dialog
		const panel = view.getByRole("region", { name: "语音" });
		expect(panel.className).toContain("stage-glass");
		expect(view.queryByRole("dialog")).toBeNull();

		// Switching to 声音 closes 语音
		fireEvent.click(view.getByRole("button", { name: "声音" }));
		expect(view.queryByRole("region", { name: "语音" })).toBeNull();
		expect(view.getByRole("region", { name: "声音" })).toBeTruthy();

		// Joined voice stays highlighted on dock even while 声音 is open
		await act(async () => joinRoom());
		expect(voiceButton.getAttribute("aria-pressed")).toBe("true");

		// Escape closes active dock panel
		fireEvent.keyDown(window, { key: "Escape" });
		expect(view.queryByRole("region", { name: "声音" })).toBeNull();

		await act(async () => controller.disconnect(false));
	});

	test("speaker popup displays current speakers and adjusts per-speaker volumes", async () => {
		const { controller, joinRoom, emitSpeaking, setVolume } =
			createVoiceFixture(true);
		const view = render(
			<GmToolProvider>
				<GmToolDock voice={controller} />
			</GmToolProvider>,
		);

		await act(async () => joinRoom());

		// Floating speaker popup appears automatically when voice panel is closed
		const popup = view.getByRole("region", { name: "当前说话人" });
		expect(popup.className).toContain("stage-glass");
		expect(within(popup).getByText("当前无人说话")).toBeTruthy();
		expect(within(popup).getByText("远野 澪")).toBeTruthy();
		expect(within(popup).getByText("白石 拓真")).toBeTruthy();

		// Active speaker indicator updates live
		await act(async () => emitSpeaking([playerOne.id]));
		expect(within(popup).getByText("当前说话")).toBeTruthy();
		expect(within(popup).queryByText("当前无人说话")).toBeNull();

		// Per-speaker mute button sets only that speaker's volume to 0% and restores it
		const muteBtn = within(popup).getByRole("button", {
			name: "静音 远野 澪",
		});
		fireEvent.click(muteBtn);
		expect(controller.getSnapshot().memberVolumes[playerOne.id]).toBe(0);
		expect(controller.getSnapshot().memberVolumes[playerTwo.id]).toBe(100);
		expect(setVolume).toHaveBeenLastCalledWith(0);

		const unmuteBtn = within(popup).getByRole("button", {
			name: "取消静音 远野 澪",
		});
		fireEvent.click(unmuteBtn);
		expect(controller.getSnapshot().memberVolumes[playerOne.id]).toBe(100);
		expect(setVolume).toHaveBeenLastCalledWith(100);

		// Minimize collapses to compact live speaking pill, clicking reopens
		fireEvent.click(
			within(popup).getByRole("button", { name: "收起说话人弹窗" }),
		);
		expect(view.queryByRole("region", { name: "当前说话人" })).toBeNull();
		const pill = view.getByRole("button", { name: "打开说话人弹窗" });
		expect(pill.textContent).toContain("远野 澪 正在说话");

		fireEvent.click(pill);
		expect(view.getByRole("region", { name: "当前说话人" })).toBeTruthy();

		// Opening the main dock 语音 panel hides the floating popup while open
		fireEvent.click(view.getByRole("button", { name: "语音" }));
		expect(view.queryByRole("region", { name: "当前说话人" })).toBeNull();
		const voicePanel = view.getByRole("region", { name: "语音" });
		expect(within(voicePanel).getByText("正在说话")).toBeTruthy();
		expect(
			within(voicePanel).getByRole("slider", { name: "调节 远野 澪 的音量" }),
		).toBeTruthy();

		await act(async () => controller.disconnect(false));
	});

	test("player dock opens stage-glass popover on desktop and dialog on portrait", async () => {
		const { controller } = createVoiceFixture(false);
		const desktop = render(
			<PlayerActionDock variant="desktop" voice={controller} />,
		);
		fireEvent.click(desktop.getByRole("button", { name: "语音" }));
		await waitFor(() => {
			const popover = document.querySelector('[data-slot="popover-content"]');
			expect(popover).not.toBeNull();
			expect(popover?.className).toContain("stage-glass");
		});
		await act(async () => desktop.unmount());

		const portrait = render(
			<PlayerActionDock variant="portrait" voice={controller} />,
		);
		fireEvent.click(portrait.getByRole("button", { name: "语音" }));
		await waitFor(() => {
			expect(portrait.getByRole("dialog", { name: "语音" })).toBeTruthy();
		});
		await act(async () => {
			portrait.unmount();
			controller.disconnect(false);
		});
	});

	test("mic test UI measures input level, toggles loopback, and stops when panel closes", async () => {
		const stop = mock(() => {});
		const track = {
			kind: "audio",
			stop,
			addEventListener: () => {},
		};
		const stream = {
			getTracks: () => [track],
			getAudioTracks: () => [track],
		} as unknown as MediaStream;
		const { controller, emitMicSample } = createVoiceFixture(
			true,
			async () => stream,
		);

		const view = render(
			<GmToolProvider>
				<GmToolDock voice={controller} />
			</GmToolProvider>,
		);

		fireEvent.click(view.getByRole("button", { name: "语音" }));
		const panel = view.getByRole("region", { name: "语音" });
		openSettings(within(panel));

		await act(async () => {
			fireEvent.click(
				within(panel).getByRole("button", { name: "测试麦克风" }),
			);
		});

		const meter = within(panel).getByRole("progressbar", {
			name: "麦克风输入音量",
		});
		expect(meter.getAttribute("aria-valuenow")).toBe("0");
		expect(within(panel).getByText("请说话测试…")).toBeTruthy();

		await act(async () => emitMicSample(68, true));
		expect(meter.getAttribute("aria-valuenow")).toBe("68");
		expect(within(panel).getByText("68%")).toBeTruthy();
		expect(within(panel).getByText("已检测到声音")).toBeTruthy();

		fireEvent.click(within(panel).getByRole("button", { name: "开启回听" }));
		expect(controller.getSnapshot().micTestLoopback).toBe(true);
		expect(
			within(panel).getByRole("button", { name: "关闭回听" }),
		).toBeTruthy();

		// Closing the voice panel automatically stops the mic test and releases the track
		fireEvent.click(within(panel).getByRole("button", { name: "关闭" }));
		expect(controller.getSnapshot().micTest).toBe("idle");
		expect(stop).toHaveBeenCalledTimes(1);

		await act(async () => controller.disconnect(false));
	});
});

describe("voice audio settings UI", () => {
	test("deep noise suppression offers the model choice and shows the active engine", async () => {
		const { view, section, updateAudioSettings } = renderAudioSettings({
			audioSettings: { deepNoiseSuppression: true },
			audioProcessing: "deepfilter",
		});
		expect(within(section).getByRole("status").textContent).toBe(
			"DeepFilterNet3 处理中",
		);
		const engine = within(section).getByRole("combobox", { name: "降噪模型" });
		expect(engine.textContent).toContain("DeepFilterNet3（高质量）");
		fireEvent.keyDown(engine, { key: "ArrowDown" });
		fireEvent.click(
			await view.findByRole("option", { name: "RNNoise（轻量）" }),
		);
		expect(updateAudioSettings).toHaveBeenLastCalledWith({
			noiseSuppressionEngine: "rnnoise",
		});
	});

	test("processing switches and device selection submit independent patches", async () => {
		const { view, section, updateAudioSettings, refreshAudioDevices } =
			renderAudioSettings();

		expect(refreshAudioDevices).toHaveBeenCalledTimes(1);
		const cases = [
			["回声消除", { echoCancellation: false }],
			["浏览器降噪", { noiseSuppression: false }],
			["自动增益", { autoGainControl: true }],
			["深度降噪", { deepNoiseSuppression: true }],
			["噪声门", { noiseGate: true }],
			["压限器", { compressor: true }],
		] as const;
		for (const [name, patch] of cases) {
			fireEvent.click(within(section).getByRole("switch", { name }));
			expect(updateAudioSettings).toHaveBeenLastCalledWith(patch);
		}

		fireEvent.click(
			within(section).getByRole("button", { name: "刷新麦克风设备" }),
		);
		await waitFor(() => expect(refreshAudioDevices).toHaveBeenCalledTimes(2));

		expect(
			within(section).queryByRole("combobox", { name: "降噪模型" }),
		).toBeNull();
		const trigger = within(section).getByRole("combobox", {
			name: "麦克风设备",
		});
		fireEvent.keyDown(trigger, { key: "ArrowDown" });
		expect(
			await view.findByRole("option", { name: "未命名麦克风" }),
		).toBeTruthy();
		fireEvent.click(view.getByRole("option", { name: "USB 麦克风" }));
		expect(updateAudioSettings).toHaveBeenLastCalledWith({
			deviceId: "usb-mic",
		});

		fireEvent.click(within(section).getByRole("radio", { name: "按键说话" }));
		expect(updateAudioSettings).toHaveBeenLastCalledWith({ pushToTalk: true });
	});

	test("push-to-talk key selection and hold button release capture safely", async () => {
		const { view, section, updateAudioSettings, setPushToTalkActive } =
			renderAudioSettings({
				audioSettings: { pushToTalk: true, pushToTalkKey: "Space" },
			});

		const keyTrigger = within(section).getByRole("combobox", {
			name: "说话按键",
		});
		fireEvent.keyDown(keyTrigger, { key: "ArrowDown" });
		fireEvent.click(await view.findByRole("option", { name: "V" }));
		expect(updateAudioSettings).toHaveBeenLastCalledWith({
			pushToTalkKey: "KeyV",
		});

		// The hold button lives on the status card, not in the settings section.
		const hold = view.getByRole("button", { name: "按住说话" });
		fireEvent.pointerDown(hold, { button: 0 });
		expect(setPushToTalkActive).toHaveBeenLastCalledWith(true);
		fireEvent.pointerUp(hold);
		expect(setPushToTalkActive).toHaveBeenLastCalledWith(false);

		fireEvent.pointerDown(hold, { button: 0 });
		fireEvent.pointerCancel(hold);
		expect(setPushToTalkActive).toHaveBeenLastCalledWith(false);

		fireEvent.pointerDown(hold, { button: 0 });
		fireEvent.pointerLeave(hold);
		expect(setPushToTalkActive).toHaveBeenLastCalledWith(false);

		fireEvent.pointerDown(hold, { button: 0 });
		view.unmount();
		expect(setPushToTalkActive).toHaveBeenLastCalledWith(false);
	});

	test("armed push-to-talk is not reported as a live microphone", () => {
		const armed = renderAudioSettings({
			audioSettings: { pushToTalk: true },
			mic: "on",
			pushToTalkActive: false,
		});
		expect(armed.view.queryByText("麦克风已开启")).toBeNull();
		expect(armed.view.getAllByText("按键说话待命").length).toBeGreaterThan(0);
		armed.view.unmount();

		const held = renderAudioSettings({
			audioSettings: { pushToTalk: true },
			mic: "on",
			pushToTalkActive: true,
		});
		expect(held.view.getAllByText("麦克风已开启").length).toBeGreaterThan(0);
		expect(held.view.queryByText("按键说话待命")).toBeNull();
	});

	test("sends and monitors the active output and lets the panel resume interrupted capture", async () => {
		const rawTrack = {
			enabled: true,
			stop() {},
			addEventListener() {},
			getSettings: () => ({ sampleRate: 48_000 }),
		};
		const processedTrack = { ...rawTrack };
		const streamFor = (track: typeof rawTrack) =>
			({
				getAudioTracks: () => [track],
				getTracks: () => [track],
			}) as unknown as MediaStream;
		const raw = streamFor(rawTrack);
		const processed = streamFor(processedTrack);
		let allowResume = false;
		let activeContext: CaptureContext | undefined;
		class CaptureContext extends EventTarget {
			state = "running";
			sampleRate = 48_000;
			createMediaStreamSource = mock(() => ({ connect() {}, disconnect() {} }));

			constructor() {
				super();
				activeContext = this;
			}
			createMediaStreamDestination() {
				return { stream: processed, disconnect() {} };
			}
			createDynamicsCompressor() {
				return {
					connect() {},
					disconnect() {},
					threshold: {},
					knee: {},
					ratio: {},
					attack: {},
					release: {},
				};
			}
			setState(state: string) {
				this.state = state;
				this.dispatchEvent(new Event("statechange"));
			}
			async resume() {
				if (allowResume) this.setState("running");
			}
			async close() {
				this.setState("closed");
			}
		}
		const previous = Object.getOwnPropertyDescriptor(
			globalThis,
			"AudioContext",
		);
		Object.defineProperty(globalThis, "AudioContext", {
			configurable: true,
			value: CaptureContext,
		});
		const { controller, joinRoom, peer, monitor } = createVoiceFixture(
			false,
			async () => raw,
		);
		const view = render(<ConnectedVoicePanel voice={controller} />);
		try {
			await act(async () => {
				await controller.updateAudioSettings({
					deepNoiseSuppression: false,
					noiseGate: false,
					compressor: false,
				});
				joinRoom();
				await controller.toggleMic();
			});
			const context = activeContext;
			if (!context) throw new Error("Capture did not create an audio context");
			const resumeButton = () =>
				view.queryByRole("button", { name: "恢复麦克风" });
			expect(peer.setTrack).toHaveBeenLastCalledWith(rawTrack);
			expect(monitor.setTrack).toHaveBeenLastCalledWith(selfMember.id, raw);
			expect(context.createMediaStreamSource).not.toHaveBeenCalled();
			act(() => context.setState("interrupted"));
			expect(resumeButton()).toBeNull();
			await act(() => controller.updateAudioSettings({ compressor: true }));
			expect(peer.setTrack).toHaveBeenLastCalledWith(processedTrack);
			expect(monitor.setTrack).toHaveBeenLastCalledWith(
				selfMember.id,
				processed,
			);
			expect(view.getByText("麦克风已暂停，请点按恢复。")).toBeTruthy();
			const resume = view.getByRole("button", { name: "恢复麦克风" });
			allowResume = true;
			await act(async () => fireEvent.click(resume));
			expect(context.state).toBe("running");
			expect(resumeButton()).toBeNull();
			allowResume = false;
			act(() => context.setState("suspended"));
			expect(resumeButton()).toBeTruthy();
			await act(() => controller.updateAudioSettings({ pushToTalk: true }));
			expect(rawTrack.enabled).toBe(false);
			expect(processedTrack.enabled).toBe(false);
			await act(() => controller.updateAudioSettings({ compressor: false }));
			expect(peer.setTrack).toHaveBeenLastCalledWith(rawTrack);
			expect(rawTrack.enabled).toBe(false);
			act(() => controller.setPushToTalkActive(true));
			expect(rawTrack.enabled).toBe(true);
			expect(monitor.setTrack).toHaveBeenLastCalledWith(selfMember.id, raw);
			expect(resumeButton()).toBeNull();
		} finally {
			view.unmount();
			controller.disconnect(false);
			if (previous) Object.defineProperty(globalThis, "AudioContext", previous);
			else Reflect.deleteProperty(globalThis, "AudioContext");
		}
	});

	test("leave button only exists once the user has joined", () => {
		const { controller, joinRoom } = createVoiceFixture(false);
		const view = render(<ConnectedVoicePanel voice={controller} />);
		expect(view.queryByRole("button", { name: "离开语音" })).toBeNull();
		act(() => joinRoom());
		expect(view.getByRole("button", { name: "离开语音" })).toBeTruthy();
		view.unmount();
		controller.disconnect(false);
	});

	test("closing the voice room asks for confirmation first", async () => {
		const { controller } = createVoiceFixture(true);
		const configure = mock(() => {});
		const voice = Object.create(controller) as VoiceController;
		Object.assign(voice, { configure });
		const view = render(
			<VoicePanelBody voice={voice} snapshot={controller.getSnapshot()} />,
		);
		fireEvent.click(view.getByRole("button", { name: "关闭语音房间" }));
		expect(configure).not.toHaveBeenCalled();
		const dialog = await view.findByRole("alertdialog");
		fireEvent.click(
			within(dialog).getByRole("button", { name: "关闭语音房间" }),
		);
		expect(configure).toHaveBeenCalledWith({ enabled: false });
	});

	test("fallback and browser-decided constraints are reported without false enabled states", () => {
		const { section } = renderAudioSettings({
			audioSettings: { noiseGate: true },
			audioProcessing: "fallback",
			appliedAudioConstraints: {
				echoCancellation: null,
				noiseSuppression: false,
				autoGainControl: true,
			},
		});

		expect(within(section).getByText("已回退到浏览器处理")).toBeTruthy();
		expect(
			within(section).getByText(
				"部分已开启的增强处理不可用，当前使用可用的音频处理。",
			),
		).toBeTruthy();
		const echoRow = within(section).getByRole("switch", {
			name: "回声消除",
		}).parentElement;
		const noiseRow = within(section).getByRole("switch", {
			name: "浏览器降噪",
		}).parentElement;
		expect(echoRow).not.toBeNull();
		expect(noiseRow).not.toBeNull();
		// Browser-decided (null) constraints keep the plain hint instead of
		// claiming a state the browser never reported.
		expect(within(echoRow as HTMLElement).queryByText(/实际/)).toBeNull();
		expect(
			within(noiseRow as HTMLElement).getByText(
				"浏览器未按设置应用（实际：关闭）",
			),
		).toBeTruthy();
		expect(within(section).queryByText(/RNNoise 替代浏览器降噪/)).toBeNull();
	});

	test("speaker output selector updates outputDeviceId and degrades gracefully when unsupported", async () => {
		const supported = renderAudioSettings();
		const speakerTrigger = within(supported.section).getByRole("combobox", {
			name: "扬声器设备",
		});
		fireEvent.keyDown(speakerTrigger, { key: "ArrowDown" });
		expect(
			await supported.view.findByRole("option", { name: "未命名扬声器" }),
		).toBeTruthy();
		fireEvent.click(supported.view.getByRole("option", { name: "USB 耳机" }));
		expect(supported.updateAudioSettings).toHaveBeenLastCalledWith({
			outputDeviceId: "usb-spk",
		});
		supported.view.unmount();

		const unsupported = renderAudioSettings({
			supportsOutputSelection: false,
		});
		expect(
			within(unsupported.section)
				.getByRole("combobox", { name: "扬声器设备" })
				.hasAttribute("disabled"),
		).toBe(true);
		expect(
			within(unsupported.section).getByText(
				"当前浏览器不支持切换扬声器输出，将跟随系统默认设备。",
			),
		).toBeTruthy();
	});

	test("reflects true WebRTC peer connecting and failed states with reconnect action", () => {
		const { controller, joinRoom } = createVoiceFixture(true);
		joinRoom();
		const reconnect = mock(() => {});
		const voice = Object.create(controller) as VoiceController;
		Object.assign(voice, { reconnect, stopMicTest: mock(() => {}) });
		const base = controller.getSnapshot();

		const connecting = render(
			<VoicePanelBody
				voice={voice}
				snapshot={{
					...base,
					peerConnecting: 2,
					peerConnected: 0,
					peerFailed: 0,
					peerStates: {
						[playerOne.id]: "connecting",
						[playerTwo.id]: "connecting",
					},
				}}
			/>,
		);
		expect(connecting.getByText("正在建立语音连接…")).toBeTruthy();
		expect(connecting.getAllByText("连接中")).toHaveLength(2);
		connecting.unmount();

		const failed = render(
			<VoicePanelBody
				voice={voice}
				snapshot={{
					...base,
					peerConnecting: 0,
					peerConnected: 0,
					peerFailed: 2,
					peerStates: {
						[playerOne.id]: "failed",
						[playerTwo.id]: "failed",
					},
				}}
			/>,
		);
		expect(failed.getByText("语音连接失败")).toBeTruthy();
		expect(failed.getAllByText("连接失败")).toHaveLength(2);
		fireEvent.click(failed.getByRole("button", { name: "重新连接" }));
		expect(reconnect).toHaveBeenCalledTimes(1);
		failed.unmount();
		controller.disconnect(false);
	});
});

function ConnectedVoicePanel({ voice }: { voice: VoiceController }) {
	const snapshot = useSyncExternalStore(voice.subscribe, voice.getSnapshot);
	return <VoicePanelBody voice={voice} snapshot={snapshot} />;
}

describe("local voice diagnostics UI", () => {
	test("requires explicit acceptance and downloads the stopped log after same-tab reload", async () => {
		sessionStorage.clear();
		const sessionId = "session-diagnostics-ui";
		const { controller, joinRoom } = createVoiceFixture(false);
		controller.setSessionId(sessionId);
		const downloads: { filename: string; href: string }[] = [];
		const anchorClick = spyOn(
			HTMLAnchorElement.prototype,
			"click",
		).mockImplementation(function (this: HTMLAnchorElement) {
			downloads.push({ filename: this.download, href: this.href });
		});
		const createUrl = spyOn(URL, "createObjectURL");
		const revokeUrl = spyOn(URL, "revokeObjectURL");
		const view = render(<ConnectedVoicePanel voice={controller} />);
		try {
			act(() => joinRoom());
			openSettings(view);
			const toggle = view.getByRole("switch", { name: "语音诊断" });
			const exportButton = view.getByRole("button", { name: "导出诊断日志" });
			expect(toggle.getAttribute("aria-checked")).toBe("false");
			expect(exportButton.hasAttribute("disabled")).toBe(true);
			fireEvent.click(toggle);
			const dialog = view.getByRole("dialog", { name: "语音诊断说明" });
			expect(dialog.textContent).toMatch(/RMS/);
			expect(dialog.textContent).toMatch(/不发送到服务器/);
			fireEvent.click(within(dialog).getByRole("button", { name: "拒绝" }));
			expect(toggle.getAttribute("aria-checked")).toBe("false");
			fireEvent.click(toggle);
			fireEvent.keyDown(view.getByRole("dialog"), { key: "Escape" });
			expect(view.queryByRole("dialog")).toBeNull();
			expect(toggle.getAttribute("aria-checked")).toBe("false");
			expect(exportButton.hasAttribute("disabled")).toBe(true);
			fireEvent.click(toggle);
			fireEvent.click(view.getByRole("button", { name: "同意并开启" }));
			expect(toggle.getAttribute("aria-checked")).toBe("true");
			expect(exportButton.hasAttribute("disabled")).toBe(false);
			fireEvent.click(toggle);
			act(() => controller.leave());
			expect(toggle.getAttribute("aria-checked")).toBe("false");
			expect(exportButton.hasAttribute("disabled")).toBe(false);
			expect(downloads).toEqual([]);
			view.unmount();
			controller.disconnect(false);

			const { controller: reloaded } = createVoiceFixture(false);
			try {
				reloaded.setSessionId(sessionId);
				const restored = render(<ConnectedVoicePanel voice={reloaded} />);
				openSettings(restored);
				expect(
					restored
						.getByRole("switch", { name: "语音诊断" })
						.getAttribute("aria-checked"),
				).toBe("false");
				fireEvent.click(restored.getByRole("button", { name: "导出诊断日志" }));
				expect(downloads).toEqual([
					{
						filename: "cogm-voice-diagnostics.json",
						href: expect.stringMatching(/^blob:/),
					},
				]);
				const [blob] = createUrl.mock.calls[0] ?? [];
				if (!(blob instanceof Blob)) throw new Error("Expected a JSON Blob");
				expect(blob.type).toBe("application/json");
				const json = await blob.text();
				expect(JSON.parse(json ?? "null")).toMatchObject({
					schemaVersion: 1,
					events: [{ kind: "ws-open", roomId, memberId: selfMember.id }],
					samples: [],
				});
				await waitFor(() =>
					expect(revokeUrl).toHaveBeenCalledWith(downloads[0]?.href),
				);
			} finally {
				act(() => reloaded.disconnect(false));
			}
		} finally {
			view.unmount();
			controller.disconnect(false);
			anchorClick.mockRestore();
			createUrl.mockRestore();
			revokeUrl.mockRestore();
			sessionStorage.clear();
		}
	});
});
