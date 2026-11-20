# WebRTC 语音弱网与切网验证

## 证据边界

本文区分真实浏览器媒体证据、网络损伤能力和推断，避免把页面状态当作 RTP 质量：

- 使用两个相互隔离的 Chromium 会话完成 GM 与玩家的真实加入、信令和 WebRTC 音频链路；单元测试、Happy DOM、mock `RTCPeerConnection` 只能证明状态机逻辑，不能证明弱网媒体表现。
- CDP `Network.emulateNetworkConditions` 主要作用于 HTTP/TCP，对 WebRTC UDP/RTP 不可靠。页面 `offline`、WS 断开或 CDP 页面离线条件都不能表述为 RTP 丢包、限速或无线切网。
- 实际 UDP 损伤必须在独立 user/network namespace 的 veth 路径上实施，并用 Chromium `getStats()` 的 RTP 丢包、jitter、RTT、candidate pair 与音频采样交叉确认。不得修改宿主机全局网络。
- 合成采集必须同时包含有声音段和静音段。远端 RMS 与固定阈值只能作为“有信号/静音”的代理指标，不能代表语音可懂度、噪声抑制主观收益或人耳听感。
- 同机 host/host、relay/relay 与隔离 netns 结果不能替代实体汽车、高铁中的 Wi-Fi/蜂窝切换，也不能替代跨设备、跨公网 NAT 验收。

## 本次隔离环境

2026-11-20 的实测环境为 Linux `7.3.1-1-cachyos`、Bun `1.4.4`、Chromium `157.0.8103.79`。应用、浏览器、临时账号和数据库均使用本地隔离实例，不连接生产服务，不使用生产凭据。

实际采集源为 GM 440 Hz、PL 660 Hz 的单声道 48 kHz 正弦 WAV，音量均为 0.2；使用不同频率避免两个相同源触发回声抵消。WAV 本身连续发声，静音证据来自初始/远端 muted 轨道和零 RMS，不用于评价 DTX 或静音段听感。

内核未提供 `netem`，因此不能把固定 RTT 或抖动档位写成已注入。已独立确认 namespace 内 `fq` 可设置 64 kbps pacing；实际语音结果仍以场景采样为准。测试结束后删除临时 qdisc/nft 规则、浏览器、服务、账号、数据库、音频和脚本，namespace 退出即销毁其网络资源。

## 本次执行入口

核心 worker 与 QA 使用同一临时 harness 的独立副本和独立报告路径，避免并发改写：

```sh
VOICE_NET_REPORT=/tmp/cogm-voice-net-report.json unshare -Urnm bun /tmp/cogm-voice-net.mjs
VOICE_NET_MODE=switch VOICE_NET_REPORT=/tmp/cogm-voice-switch-report.json unshare -Urnm bun /tmp/cogm-voice-net.mjs
VOICE_NET_MODE=ws-only VOICE_NET_REPORT=/tmp/cogm-voice-ws-only-report.json unshare -Urnm bun /tmp/cogm-voice-ws-only.mjs
```

默认分支执行基线、CDP 对照与内核 UDP 档位，`switch` 执行路径/全链路中断，`ws-only` 只关闭 PL 的真实团 WS。脚本、临时报告与运行目录均不属于仓库长期测试入口，提取本文证据后清理；后续复验按本文步骤重建隔离环境，不要直接运行已不存在的临时路径。

## 复验步骤

1. 从仓库根目录运行 `bun run build:client`。在 `unshare -Urnm bash` 创建的临时环境中，用两对 veth 分别连接 GM、PL 的媒体地址（例如 `10.200.1.1/2` 与 `10.200.2.1/2`），再建第三条独立应用路径。这三个子网须使用不同的网段。将临时 Bun 服务绑定到应用地址，显式设置 `CORS_ORIGINS` 和临时 `DATABASE_URL`、`MEDIA_DIR`、`THEMES_DIR`，使用临时 GM 和 PL 账号及团席位。所有 `ip`、`nft`、`tc` 命令都在隔离 namespace 内执行。
2. 使用两个临时 Chromium profile，加入 `--use-fake-ui-for-media-stream`、`--use-fake-device-for-media-stream` 和各自的 `--use-file-for-fake-audio-capture=<wav>`。在非 localhost 上使用 HTTPS，或仅对本次隔离测试 origin 启用 Chromium 的安全上下文例外。下方示例生成每周期 3 秒有声、1 秒静音的 48 kHz 单声道 PCM，方便校验采样是否能区分两者。
3. GM 开启语音，双方在 UI 加入并开启麦克风。重建临时自动化时可用 `Page.addScriptToEvaluateOnNewDocument` 在创建 peer 前保存原生 `RTCPeerConnection` 实例。读取 `getStats()` 中 `transport.selectedCandidatePairId` 指向的 pair，每秒记录 stats，并通过 `AudioContext` 分析远端 track，每 100 ms 记录 RMS。同步记录 connection、ICE、signaling 与团 WS 事件，以及轨道状态。
4. 先采集 12 秒无损伤基线，再在双方媒体 veth 上分别设置 `tc qdisc replace dev <媒体网卡> root fq maxrate 128kbit limit 100` 或 `64kbit`。对两端隔离 namespace 的 nft `output` hook 添加 `meta l4proto udp meta random < <阈值> counter drop`，2%、10%、20% 档分别使用阈值 85899346、429496730、858993459。每档运行 15 秒，保存 `nft list table`、`tc -s qdisc show`、浏览器原始 JSON 和移除规则后的恢复采样，清理该档规则后再开始下一档。
5. 连续切换 3–5 次。用 `ip link set <PL 媒体网卡> down` 分别断开主路径和两条媒体路径。恢复时 `up` 并重设隔离路由，记录实际选中地址的变化、ICE connected、signaling stable、连续 RMS 达标并伴随 RTP 增长的时间。WS-only 独立测试只对 PL 已打开的团 socket 调用 `close()`，记录 WS open、同房成员状态、旧/新 peer、mic 状态以及显式重开后的远端音频。

```sh
ffmpeg -f lavfi -i 'sine=frequency=440:sample_rate=48000:duration=3' \
  -f lavfi -i 'anullsrc=channel_layout=mono:sample_rate=48000:duration=1' \
  -filter_complex '[0:a]volume=0.2[t];[t][1:a]concat=n=2:v=0:a=1' \
  -ac 1 -c:a pcm_s16le /tmp/cogm-voice-gm.wav
```

PL 使用 660 Hz 和另一输出文件。将生成的文件循环播放或重复拼接到足以完成测试的长度。区分由合成源产生的静音、源轨道停止后的静音和连续有声段中途出现的低 RMS，避免把预期静音当作丢包。

## 数据解释

- `candidateType` 与 `protocol` 用于证明媒体实际走 host、srflx 或 relay 以及 UDP/TCP；仅配置 STUN/TURN 不代表已选择该路径。
- SDP 的 Opus `useinbandfec=1`、`usedtx=1` 只证明协商结果；发送端参数和 RTP 统计仍需另存。FEC/DTX 协商成功不等于在所有弱网档位都能听清。
- `jitter` 与 RTT 的统计单位按 WebRTC stats 转换为毫秒；丢包率按同一 peer 的区间 `packetsLost / (packetsReceived + packetsLost)` 计算，并保留原始累计值。
- RMS 报告必须给出阈值，并结合远端 track `enabled`/`muted`/`readyState` 判断。AudioContext 未运行时不得据此宣称音频通过；本次临时探针未单列 `AudioContext.state`，只保留 RMS 与 track 状态，因此结果仅用于信号存在性判断。
- WS 自动重入同一语音 `roomId` 与麦克风恢复是两个独立判据。产品要求断线重连后由用户明确重新授权/启用麦克风，因此“不需重新加入房间”不等于“自动恢复采集”。

## 真实 UDP 弱网实测

最终矩阵 `errors=[]`，PL 入站选择的 candidate 均为 host/UDP。协商 SDP 包含 Opus `stereo=0`、`maxaveragebitrate=32000`、`usedtx=1`、`useinbandfec=1`；独立 sender 探针确认两端实际 `RTCRtpSender` encoding `maxBitrate=32000`，Opus codec fmtp 同样包含 DTX/FEC。`/2` 是 Opus RTP payload 的标准通道数写法，不能仅凭该字段声称立体声。

| 配置档位 | RTP received / lost | 观测区间丢包率 | Jitter / RTT | Concealment events | 远端音频代理 |
|---|---:|---:|---:|---:|---|
| 无损伤基线 | 558 / 0 | 0% | 2 / 1 ms | 0 | 平均 RMS 0.01000；94.55% 样本 ≥ 0.001，最长连续低于阈值 200 ms |
| nft 配置 2% + `fq` 128 kbps | 709 / 0 | 0% | 2 / 5 ms | 0 | 平均 RMS 0.00320；100% 样本 ≥ 0.001 |
| nft 配置 10% + `fq` 128 kbps | 708 / 2 | 0.28% | 3 / 19 ms | 2 | 平均 RMS 0.00319；100% 样本 ≥ 0.001 |
| nft 配置 20% + `fq` 64 kbps | 650 / 36 | 5.25% | 3 / 918 ms | 54 | 平均 RMS 0.00316；100% 样本 ≥ 0.001 |

nft 计数器确认实际 UDP drop：配置 2% 档两端为 18/17 包，10% 档为 80/124 包，20% 档为 202/170 包。这些是规则命中的总 UDP 包数，不等于该 peer 的 RTP lost；尤其 2% 档只能写“配置 2%、观测 RTP lost=0”，不能写成 2% 媒体丢包命中。

20%+64 kbps 档末样本 candidate pair 为 `in-progress`，同时仍有 RTP 与非零 RMS，因此不把该档简化为“连接质量全部正常”或“媒体完全中断”。每档清除损伤后，均通过 connected、signaling stable、连续 1.5 秒 RMS ≥ 0.0005 且 RTP 增长至少 10 包的恢复判据，三档记录的恢复耗时均为 1520 ms；该耗时包含 1.5 秒稳定窗口。

### CDP 对照，不作为 UDP 弱网证据

| 已建立的 peer 上设置 CDP 条件 | RTP received / lost | Jitter / RTT | 结论 |
|---|---:|---:|---|
| latency 200 ms、上下行各 64 KiB/s | 556 / 0 | 2 / 0 ms | 本轮未观察到配置的 200 ms 反映到 RTP RTT |
| `packetLoss=20` | 558 / 0 | 2 / 0 ms | 本轮未观察到 RTP 丢包 |

这只说明本轮 Chromium/已建立 peer 没有呈现对应 UDP 效果，不证明所有 CDP 版本或参数永远无效。验收结论采用内核档位和实际 stats，不采用 CDP 页面条件。

## 双路径与全媒体路径中断实测

五个场景均 `errors=[]`、`restored=true`，房间和成员保持，WS 始终连接，未要求重新开启 mic。稳定媒体判据为 connected + signaling stable、连续 1.5 秒 RMS ≥ 0.0005 且 RTP 增长至少 10 包。以下耗时从路径恢复开始计算，媒体耗时包含稳定窗口。

| 场景 | 中断时状态与路径 | ICE connected | Signaling stable | 稳定媒体 | ICE ufrag |
|---|---|---:|---:|---:|---|
| 主路径断 8 秒 #1 | 保持 connected；candidate 从路径 1 切到路径 2 | 未断开 | 3 ms | 1528 ms | 不变 |
| 主路径断 8 秒 #2 | 保持 connected；candidate 从路径 1 切到路径 2 | 未断开 | 2 ms | 1520 ms | 不变 |
| 双媒体路径断 12 秒 #1 | disconnected / have-local-offer | 168 ms | 521 ms | 2279 ms | 更新 |
| 主路径断 8 秒 #3 | 保持 connected；candidate 从路径 1 切到路径 2 | 未断开 | 3 ms | 1522 ms | 不变 |
| 双媒体路径断 12 秒 #2 | disconnected / have-local-offer | 128 ms | 77 ms | 1777 ms | 更新 |

主路径场景实际观察到 candidate pair 从 `10.200.1.x` 切到 `10.200.2.x`，恢复后回到原路径。两次 harness 名为 `full-offline` 的场景只是两条媒体 veth 同时 down；应用/WS 使用另一条路径且未断开，所以不能表述为整机 offline 或 WS 重连。该结果证明同机双地址媒体路径切换与 ICE restart 恢复，不证明实体无线/蜂窝切换。

## WS-only 独立中断实测

本次 QA 单独运行 `ws-only`：PL 初始 peer 为 host/UDP，关闭其唯一一条团 WS，未执行 `measure`、veth down、nft 或 tc impairment；报告中的条件档位数和切网档位数均为 0，错误列表为空。

| 判据 | 单次实测结果 |
|---|---|
| WS 关闭与重连 | 原 socket 记录 close code 1005；新 socket 随后 open 并处于 OPEN |
| 房间与成员 | `roomId` 保持不变；服务端按重新加入签发新的 member UUID，无需用户手动点击重新加入 |
| 媒体重建 | 旧 peer 变为 closed/closed；建立新 peer 和新 ICE ufrag，新 peer 为 connected/connected、host/UDP |
| 分阶段恢复耗时 | 新 WS open 1021 ms；新成员状态 1022 ms；新 ICE connected 1022 ms；双方 signaling stable 1023 ms |
| 麦克风 | `micRequired=true`；自动重入后必须显式重新开启，不能表述为自动恢复采集 |
| 显式重开后的 GM 入站 | 连续至少 3 次 RMS > 0.005 后再观察 1 秒，RTP 增长 51 包；末样本累计 310 packets、0 lost、jitter 3 ms，双方均为 connected + stable |
| 稳定音频恢复耗时 | 9088 ms，包含脚本点击“开启麦克风”、连续非静音判定及额外 1 秒 RTP 增长窗口；末 5 次 GM RMS 约 0.01005–0.01010，人工操作耗时尚未测量 |

该场景的非静音等待阈值为 RMS > 0.005。它证明一次同机 WS 断开后的自动重入、peer 重建和显式 mic 恢复，不证明 RTP 已经历丢包，也不证明真实无线切换。

## 恢复实现的风险与判据

- 原 `VoicePeer` 只在 `connected` 时清零 ICE restart 次数；一个恢复周期耗尽两次重启后，后续断线事件仍可能被既有预算卡住。核心 worker 已用 fake timers 建立“前两次失败后，新断线应触发第三次 restart”的回归用例，并确认修复后通过。这是状态机证据，不替代真实 UDP 切换。
- 当前策略仍是每个恢复周期最多两次 ICE restart：断线后有 4 秒宽限，重启连接超时为 15 秒。修复允许新的 `disconnected`/`failed` 事件开启后续恢复周期，但不能保证所有持续断网或路径永久消失都能恢复；若再无状态事件，仍可能停留在 failed，必须由真实场景继续观察。
- `VoiceController.disconnect(true)` 会清理 peer、采集与发送轨道，再自动重入相同 `roomId`。验收必须分别检查“不手动重新加入房间”和“用户显式重新启用 mic 后恢复发送”，不得把后者写成自动恢复。

## 当前版本的本地诊断验收

在隔离本地服务中打开生产构建，使用两个独立 Chromium 配置文件登录 GM 与玩家。基线使用双方加入语音并开启合成麦克风的真实 WebRTC 连接。

1. 玩家先保持诊断关闭，再打开说明并点击「拒绝」。两个阶段各等待超过 5 秒，确认未调用原生 `RTCPeerConnection.getStats()`，且导出按钮不可用。
2. 点击「同意并开启」，等待自然采样。点击「导出诊断日志」并读取下载的 `cogm-voice-diagnostics.json`。检查 RTC 样本的 RTP 包数增量、候选类型与协议和远端 RMS，同时检查日志的隐私字段限制。
3. 关闭玩家的团 WS，确认同房重入换发成员 ID 后继续采样。关闭诊断后再等一个采样周期，确认没有新增采样。刷新同一标签页后，确认采集仍关闭且下载内容一致。
4. 全程记录两个标签页的 HTTP 请求和 WS 收发帧。检查旧诊断 URL、诊断消息及样本字段，确认没有诊断传输。

2026-11-20，使用 Bun `1.4.4`、本地生产构建和两个 Chromium `157.0.8103.79` 配置文件完成实测。GM 和玩家分别使用 440 Hz 和 660 Hz 的单声道 48 kHz 合成麦克风。Vite 预览代理 HTTP 和 WS 到真实 Bun 服务。两端均实际进入语音，未连接生产环境。

- 玩家在默认关闭和拒绝后各等待 5.5 秒，两次都没有调用 `getStats()`，导出按钮均不可用。同意后按自然计时下载到 2 条采样和 1 条事件。样本记录到 `host/udp`，收发 RTP 包均增加 253，远端 RMS 为 `0.00569`。
- 关闭玩家的 WS 后，浏览器重连并在同一语音房间以新成员 ID 继续采样。日志记录数字关闭代码 `4099` 和重入事件，没有记录关闭原因。停止诊断后再等 5.5 秒，未调用 `getStats()`。实际下载并解析的 JSON 包含 4 条采样、6 条事件，经检查不含地址、设备、账号、SDP 或指纹字段。刷新同一标签页后，采集仍关闭，再下载的 JSON 内容相同。
- CDP 记录到 GM 的 12 个 API 请求及 10 个发出、30 个收到的 WS 帧。玩家相应计数为 9、11、28。检查请求 URL、请求体及两向 WS 帧时，两端的诊断 HTTP 请求、发出诊断帧和收到诊断帧均为 0。

服务端契约测试 `apps/server/tests/contract/voice-diagnostics-retirement.test.ts` 使用真实应用监听器、同团已加入语音的 GM 和预置的旧报告。原同意、样本、撤销和 GM 导出四条接口均返回 `404`，旧报告行保持原样。

## 历史实测（旧版诊断上传与 GM 导出）

以下记录对应旧版上传功能。当前版本的诊断只在浏览器中生成和下载，旧接口已退役。

2026-11-20 使用隔离本地 Bun 服务、临时 SQLite/账号和两个独立 Chromium `157.0.8103.79` profile 验收生产客户端。GM 与 PL 分别使用 440 Hz、660 Hz 的单声道 48 kHz 合成音频；客户端先由 `bunx --bun vite build` 完成生产构建，再由本地服务托管。未连接生产服务，临时账号、数据库、音频、浏览器和 profile 均在验收后清理。

- GM 开启语音，双方真实加入并开启麦克风。加入后及额外等待 16 秒期间，GM/PL 的 `voice-diagnostics` 请求均为 0；PL 打开说明并点击「拒绝」后仍为 0。
- PL 同意后，真实 `PUT /api/v1/sessions/:id/voice-diagnostics/consent` 于 `06:52:34.815Z` 返回 200。未手动调用采集或 flush，经过自然 5 秒采样与 15 秒上传周期，`POST .../samples` 于 `06:52:49.859Z` 返回 200。
- GM 在页面内执行真实 `GET /api/v1/gm/sessions/:id/voice-diagnostics?limit=200`，返回 200 和 1 份 PL member 报告，含 2 个 RTC 样本。两个样本均有正远端 RMS；candidate 为 `host/udp`；区间 `packetsReceivedDelta` 与 `packetsSentDelta` 最大值均为 253。导出不含地址、设备字段、SDP、浏览器指纹、人物名或自由文本 detail，且未出现 IPv4 值。
- PL 撤销后，`POST .../revoke` 于 `06:52:52.987Z` 返回 200。再等待 18 秒，PL 没有新的 samples POST；GM 于 `06:53:10.992Z` 再次 GET export 仍返回 200，报告总数及该 member 的报告 ID 集合与撤销前完全一致，没有新报告。

本次采集证明真实浏览器中的同意门禁、自然计时器、RTP/candidate/RMS 上传、GM export 和撤销停止新数据，不代表弱网质量或主观听感验收。

## 尚未覆盖

- 实体汽车、高铁中的 Wi-Fi/蜂窝无线切换，物理麦克风与扬声器、跨设备、跨公网 NAT，以及这些环境中的主观听感均未实测。
- 未做 RNNoise 开/关的弱网对照；现有 WASM/处理单测不等于 RNNoise 在丢包下改善听感。连续正弦源与 RMS 也不能评价噪声抑制、可懂度、回声或音乐/人声质量。
- 本机没有 `netem`，未注入固定 120–250 ms RTT 或 30–80 ms 抖动档位；报告中的 RTT/jitter 是浏览器观测值，不是配置承诺。
- 每档为短时长合成信号验证，不是长期 soak、多人全网状容量或多终端性能测试。FEC/DTX 已协商不等于其主观收益已验收。
