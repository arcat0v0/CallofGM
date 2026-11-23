# DeepFilterNet3 语音降噪资源

来源：[Rikorose/DeepFilterNet](https://github.com/Rikorose/DeepFilterNet)，提交 `7b14b895fe7fc42cab72b4a4c1e49c982bd6404b`，MIT 或 Apache-2.0 双许可（见同目录 `LICENSE-MIT`、`LICENSE-APACHE`）。

| 文件 | 内容 |
|---|---|
| `deepfilternet3-runtime.bin` | gzip 压缩的 WebAssembly（启用 SIMD128，无任何导入），由 `native/deepfilter-wasm` 从上游 `libDF` 编译 |
| `deepfilternet3-model.bin` | 上游 `models/DeepFilterNet3_onnx.tar.gz` 原样拷贝 |

使用 `.bin` 扩展名，是为了防止静态托管或 CDN 给 `.gz` 文件加上 `Content-Encoding: gzip`，导致浏览器在传输途中就把内容解压掉。

重新生成（需要 Rust 和 `wasm32-unknown-unknown` target）：

```sh
rustup target add wasm32-unknown-unknown
bun run native/deepfilter-wasm/build.ts
```

脚本会打印两个文件的 SHA-256，与提交中的文件比对即可确认可复现。
