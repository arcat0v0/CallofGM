# CoGM 骰子模型包

本目录为 CoGM 投骰动画使用的静态 glTF 资产，由 Pachat 群「CallofGM」中 xixigugu Muse 提供，主人于 2026-11-13 授权下载并接入项目。

## 文件

- `olive/`：定制款「雾湖石」，`d4` / `d6` / `d8` / `d10` / `d100-tens` / `d12` / `d20` 七颗自包含 `.gltf`。
- `bone/`：定制款「骨白」，`d6` / `d10` / `d100-tens` / `d20` 四颗。
- `orientations/`：`d4.json` / `d6.json` / `d8.json` / `d10.json` / `d100-tens.json` / `d12.json` / `d20.json`，每个点数对应 three.js 四元数 `[x, y, z, w]`；两套定制款几何相同，共用这份数据。

所有 `.gltf` 均为单文件 glTF 2.0，几何与贴图以内嵌 data URI 保存，`GLTFLoader.loadAsync()` 可直接加载。Pachat 原始附件后缀为 `.gltf.json`，入库时已统一改回 `.gltf`。

## 接入原则

- 服务端先生成权威掷骰结果；客户端只播放翻滚动画并落到已定结果对应的点数面。
- 不使用物理引擎决定点数；动画是视觉表现，不是随机数来源。
- 结果事件到达后再展示结果卡；断线补发与历史回看仍以服务端事件为准。
