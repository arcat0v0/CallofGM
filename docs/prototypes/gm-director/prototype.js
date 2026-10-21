const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const { controller: previewMotion, SelectionIndicator } = window.cogmMotion;
const queue = $("#queue-list");
const initialQueue = queue.innerHTML;
const phaseIndicator = new SelectionIndicator($(".phase-list"), ".selected");
const chatIndicator = new SelectionIndicator($(".chat-filters"), ".active");
let toastTimer;
let activeFilter = "all";
function notify(message) {
	const bar = $("#snackbar");
	bar.textContent = message;
	bar.hidden = false;
	previewMotion.animate(bar, null, [{ opacity: 0 }, { opacity: 1 }]);
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		bar.hidden = true;
	}, 3600);
}
function present(speaker, message, expression = "演绎") {
	const name = $("#stage-speaker");
	name.replaceChildren(document.createTextNode(speaker));
	const label = document.createElement("small");
	label.textContent = expression;
	name.append(label);
	$("#stage-text").textContent = message;
	previewMotion.enter($(".stage-dialogue"), "expressive");
}
function applyFilter() {
	$$(".message").forEach((message) => {
		message.hidden =
			activeFilter !== "all" && message.dataset.channel !== activeFilter;
	});
	$$(".system-message, .chat-date").forEach((element) => {
		element.hidden = activeFilter !== "all";
	});
}
function appendMessage(speaker, message, channel) {
	const article = document.createElement("article");
	article.className = "message";
	article.dataset.channel = channel;
	const meta = document.createElement("div");
	meta.className = "message-meta";
	const avatar = document.createElement("span");
	avatar.className = `avatar ${speaker === "KP" ? "kp" : ""}`;
	avatar.textContent = speaker === "KP" ? "KP" : speaker.slice(0, 1);
	const name = document.createElement("strong");
	name.textContent = speaker;
	const time = document.createElement("time");
	time.textContent = "演示";
	meta.append(avatar, name, time);
	const bubble = document.createElement("div");
	bubble.className = `bubble ${speaker === "KP" ? "gm-bubble" : channel === "ooc" ? "ooc-bubble" : ""}`;
	bubble.textContent = message;
	article.append(meta, bubble);
	$("#chat-feed").append(article);
	applyFilter();
	if (!article.hidden) $("#chat-feed").scrollTop = $("#chat-feed").scrollHeight;
	if (!article.hidden) previewMotion.enter(article);
}
function updateQueue() {
	const items = $$(".queue-item");
	$("#queue-count").textContent = String(items.length);
	$("#queue-empty").hidden = items.length !== 0;
	items.forEach((item, index) => {
		item.classList.toggle("next", index === 0);
		item.querySelector(".queue-order").textContent = String(index + 1).padStart(
			2,
			"0",
		);
		const up = item.querySelector('[data-action="up"]');
		const down = item.querySelector('[data-action="down"]');
		if (up) up.disabled = index === 0;
		if (down) down.disabled = index === items.length - 1;
	});
}
queue.addEventListener("click", (event) => {
	const button = event.target.closest("button[data-action]");
	if (!button) return;
	const item = button.closest(".queue-item");
	const positions = previewMotion.capture($$(".queue-item"));
	const action = button.dataset.action;
	if (action === "up" && item.previousElementSibling) {
		queue.insertBefore(item, item.previousElementSibling);
	} else if (action === "down" && item.nextElementSibling) {
		queue.insertBefore(item.nextElementSibling, item);
	} else if (action === "present" || action === "discard") {
		const focusTarget = item.nextElementSibling || item.previousElementSibling;
		if (action === "present") {
			const { speaker, kind, expression } = item.dataset;
			const message = item.querySelector(".queue-content p").textContent;
			if (kind === "role") present(speaker, message, expression);
			appendMessage(speaker, message, kind);
			notify(
				kind === "role"
					? `演示：${speaker}的发言已呈现到舞台`
					: "演示：观战消息已放行至聊天，舞台保持当前对话",
			);
		} else {
			notify("演示：已静默丢弃，玩家侧不显示提示");
		}
		item.remove();
		if (focusTarget) focusTarget.querySelector("button").focus();
		else $("#reset-queue").focus();
	}
	updateQueue();
	previewMotion.reflow(positions);
});
$("#reset-queue").addEventListener("click", () => {
	queue.innerHTML = initialQueue;
	updateQueue();
	previewMotion.enter(queue);
	notify("已恢复 3 条示例发言");
});
const phaseCopy = {
	discussion: [
		"自由讨论",
		"把故事暂放一旁，让桌边的每个人都能畅所欲言。",
		"所有发言记为场外",
	],
	performance: [
		"演绎时间",
		"角色发言由你逐条呈现，让每一句话都有自己的时刻。",
		"演绎入队 · 场外关闭",
	],
	cg: [
		"强制 CG",
		"将舞台交给主持人，玩家静听这一幕故事的展开。",
		"玩家禁言 · GM 演出",
	],
	free: [
		"自由演绎",
		"容纳灵感，也保留秩序。角色演绎与桌边交流并行。",
		"演绎入队 · PC 场外即时发送",
	],
};
$$("[data-phase]").forEach((button) => {
	button.addEventListener("click", () => {
		if (button.getAttribute("aria-pressed") === "true") return;
		$$("[data-phase]").forEach((option) => {
			const selected = option === button;
			option.classList.toggle("selected", selected);
			option.setAttribute("aria-pressed", String(selected));
		});
		const [title, description, permission] = phaseCopy[button.dataset.phase];
		$("#phase-title").textContent = title;
		$("#phase-description").textContent = description;
		$("#phase-permission").textContent = permission;
		phaseIndicator.update();
		previewMotion.enter($("#phase-title"));
		notify(`阶段外观预览：${title}。现有待呈现队列保留。`);
	});
});
const scenes = {
	library: [
		"library.png",
		"雨夜图书馆",
		"雨声渐密，书页里藏着未说完的秘密。",
		"图书馆 · 一层",
	],
	boathouse: [
		"boathouse-thumb.png",
		"湖畔船屋",
		"风穿过朽木，湖面传来一声迟到的回响。",
		"湖畔 · 旧船屋",
	],
	altar: [
		"lake-altar-thumb.png",
		"湖底祭坛",
		"幽绿的微光，照见沉睡于水底的古老约定。",
		"湖底 · 遗迹深处",
	],
};
let sceneRequest = 0;
$$("[data-scene]").forEach((button) => {
	button.addEventListener("click", async () => {
		const request = ++sceneRequest;
		$$("[data-scene]").forEach((option) => {
			option.removeAttribute("aria-busy");
		});
		if (button.getAttribute("aria-pressed") === "true") return;
		button.setAttribute("aria-busy", "true");
		const [image, title, subtitle, location] = scenes[button.dataset.scene];
		const next = new Image();
		next.src = `../../../apps/client/public/demo/scenes/${image}`;
		try {
			await next.decode();
		} catch {
			if (request === sceneRequest) {
				button.removeAttribute("aria-busy");
				notify("场景图片加载失败，保留当前场景，请重试。");
			}
			return;
		}
		if (request !== sceneRequest) return;
		$$(".scene-image-outgoing").forEach((element) => {
			previewMotion.cancel(element);
			element.remove();
		});
		const scene = $("#scene-image");
		const outgoing = scene.cloneNode();
		outgoing.removeAttribute("id");
		outgoing.classList.add("scene-image-outgoing");
		outgoing.alt = "";
		outgoing.setAttribute("aria-hidden", "true");
		scene.after(outgoing);
		scene.src = next.src;
		scene.alt = title;
		$("#scene-title").textContent = title;
		$("#scene-subtitle").textContent = subtitle;
		$("#scene-location").textContent = location;
		$$("[data-scene]").forEach((option) => {
			const selected = option === button;
			option.classList.toggle("selected", selected);
			option.setAttribute("aria-pressed", String(selected));
			option.removeAttribute("aria-busy");
			option.querySelector("small").textContent = selected
				? "当前场景"
				: "候选场景";
			const check = option.querySelector("svg");
			if (check) check.toggleAttribute("hidden", !selected);
		});
		previewMotion.enter($(".scene-heading"), "expressive", "default");
		previewMotion.animate(
			scene,
			[{ transform: "scale(1.025)" }, { transform: "scale(1)" }],
			null,
			"expressive",
			"slow",
		);
		previewMotion
			.animate(
				outgoing,
				null,
				[{ opacity: 1 }, { opacity: 0 }],
				"expressive",
				"slow",
			)
			.then(() => outgoing.remove());
		notify(`场景本地预览：${title}`);
	});
});
$$("[data-filter]").forEach((button) => {
	button.addEventListener("click", () => {
		if (button.getAttribute("aria-pressed") === "true") return;
		activeFilter = button.dataset.filter;
		$$("[data-filter]").forEach((option) => {
			option.classList.toggle("active", option === button);
			option.setAttribute("aria-pressed", String(option === button));
		});
		applyFilter();
		chatIndicator.update();
		previewMotion.animate($("#chat-feed"), null, [
			{ opacity: 0 },
			{ opacity: 1 },
		]);
	});
});
$$(".portrait-toggle").forEach((button) => {
	let revision = 0;
	button.addEventListener("click", async () => {
		const current = ++revision;
		const portrait = $(`#portrait-${button.dataset.portrait}`);
		const visible = button.getAttribute("aria-pressed") !== "true";
		button.setAttribute("aria-pressed", String(visible));
		button.setAttribute(
			"aria-label",
			`${visible ? "隐藏" : "显示"}${portrait.querySelector("img").alt.slice(0, 4)}立绘`,
		);
		if (visible) {
			const positions = previewMotion.capture($$(".portrait:not([hidden])"));
			portrait.hidden = false;
			previewMotion.reflow(positions);
			previewMotion.enter(portrait, "expressive");
		} else {
			await previewMotion.animate(
				portrait,
				[
					{ transform: "translateY(0) scale(1)" },
					{ transform: "translateY(16px) scale(.96)" },
				],
				[{ opacity: 1 }, { opacity: 0 }],
				"expressive",
			);
			if (current !== revision) return;
			const positions = previewMotion.capture($$(".portrait:not([hidden])"));
			portrait.hidden = true;
			previewMotion.reflow(positions);
		}
	});
});
$("#focus-toggle").addEventListener("click", () => {
	const focused = document.body.classList.toggle("focus-mode");
	$("#focus-toggle").setAttribute("aria-pressed", String(focused));
	$("#focus-toggle").lastChild.textContent = focused
		? " 返回工作台"
		: " 专注预览";
	previewMotion.enter($("#stage"), "expressive", "slow");
});
$("#composer").addEventListener("submit", (event) => {
	event.preventDefault();
	const input = $("#message-input");
	const message = input.value.trim();
	if (!message) {
		input.focus();
		return;
	}
	const identity = $("#identity").value;
	appendMessage(identity, message, "role");
	present(identity, message, identity === "KP" ? "旁白" : "NPC");
	input.value = "";
	input.focus();
	notify("演示消息已呈现；刷新页面后清空");
});
const dialogs = {
	members: [
		"桌边的伙伴",
		'<p class="dialog-copy">当前在线 · 4 人（示例）</p><div class="dialog-row"><span>KP · 主持人</span><small>在线</small></div><div class="dialog-row"><span>远野 澪 · PC</span><small>在线</small></div><div class="dialog-row"><span>白石 拓真 · PC</span><small>在线</small></div><div class="dialog-row"><span>匿名访客 #f2a9 · OB</span><small>在线</small></div><p class="dialog-note">成员管理在这里展开。踢出与拉黑在正式版本提供，本设计稿不执行管理操作。</p>',
	],
	session: [
		"沉没的记忆 · 第三夜",
		'<p class="dialog-copy">进行中 · CoC 第 7 版</p><div class="dialog-row"><span>模组</span><span>沉没的记忆</span></div><div class="dialog-row"><span>当前视角</span><span>主持人</span></div><p class="dialog-note">结团操作收纳于团设置中，并需要独立确认，避免与高频控场操作相邻。</p>',
	],
	characters: [
		"登场人物",
		'<div class="dialog-row"><span>远野 澪 · PC</span><small>默认 · HP 9/11 · SAN 52/58</small></div><div class="dialog-row"><span>白石 拓真 · PC</span><small>默认 · 重伤 · HP 5/12</small></div><div class="dialog-row"><span>馆长 · 乌有 · NPC</span><small>未登场 · 仅 GM 可见</small></div><p class="dialog-note">人物卡、表情与状态编辑由此进入。此版仅演示侧栏的立绘显隐，不执行数值修改。</p>',
	],
	handouts: [
		"一页未寄出的信",
		'<p class="dialog-copy">“如果你读到这里，请不要再去湖边。我们带回来的东西，从来没有睡着。”</p><label class="dialog-field">发放范围<select id="handout-audience"><option>全体（包含 OB）</option><option>仅远野 澪</option><option>仅白石 拓真</option></select></label><p class="dialog-note">秘密情报只向指定角色发送。已发放情报可追加对象，不可撤回。</p><button class="dialog-primary" data-demo="handout">预览发放提示</button>',
	],
	check: [
		"发起心理学鉴定",
		'<label class="dialog-field">目标角色<select><option>白石 拓真</option><option>远野 澪</option></select></label><label class="dialog-field">难度<select><option>常规</option><option>困难</option><option>极难</option></select></label><label><input type="checkbox" checked> 暗骰，结果仅主持人可见</label><p class="dialog-note">玩家收到一键鉴定请求。此处只展示面板，不生成骰点，也不修改团内状态。</p><button class="dialog-primary" data-demo="check">预览请求提示</button>',
	],
	notes: [
		"只有你知道的下一幕",
		'<p class="dialog-copy">主持人私有草稿 · 仅保留本次页面会话</p><label class="dialog-field">剧情备忘<textarea id="private-note" rows="6" placeholder="写下伏笔、人物动机和下一个转折……"></textarea></label><button class="dialog-primary" data-demo="notes">保留本页草稿</button>',
	],
};
let privateNote =
	"门后的脚步声每隔七秒响起一次。\n馆长知道沉船的真相，但还不打算开口。";
const dialog = $("#detail-dialog");
async function closeDialog() {
	if (!dialog.open || dialog.classList.contains("closing")) return;
	dialog.classList.add("closing");
	await previewMotion.animate(
		dialog,
		[
			{ transform: "translateY(0) scale(1)" },
			{ transform: "translateY(16px) scale(.96)" },
		],
		[{ opacity: 1 }, { opacity: 0 }],
		"standard",
		"default",
	);
	dialog.close();
	dialog.classList.remove("closing");
}
dialog.addEventListener("cancel", (event) => {
	event.preventDefault();
	closeDialog();
});
$$("[data-dialog]").forEach((button) => {
	button.addEventListener("click", () => {
		const [title, content] = dialogs[button.dataset.dialog];
		$("#dialog-title").textContent = title;
		$("#dialog-content").innerHTML = content;
		if ($("#private-note")) $("#private-note").value = privateNote;
		dialog.showModal();
		previewMotion.enter(dialog, "standard", "default");
	});
});
$("#close-dialog").addEventListener("click", () => {
	closeDialog();
});
$("#dialog-content").addEventListener("click", (event) => {
	const button = event.target.closest("[data-demo]");
	if (!button) return;
	if (button.dataset.demo === "notes") {
		privateNote = $("#private-note").value;
		closeDialog();
		notify("草稿已保留在本页内存中，刷新后重置");
	} else if (button.dataset.demo === "handout") {
		const audience = $("#handout-audience").value;
		closeDialog();
		notify(`发放提示预览：一页未寄出的信 → ${audience}（未实际发送）`);
	} else {
		closeDialog();
		notify("鉴定请求提示预览；未发送请求或生成骰点");
	}
});
dialog.setAttribute("aria-labelledby", "dialog-title");
updateQueue();
