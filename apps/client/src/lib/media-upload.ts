import { api } from "@/lib/api";

/** 上传一个文件到媒体库，返回资源 id。 */
export async function uploadMediaAsset(
	file: File,
	purpose: string,
): Promise<string> {
	const body = new FormData();
	body.append("file", file);
	body.append("purpose", purpose);
	body.append("filename", file.name);
	const asset = await api<{ id: string }>("/media/upload", {
		method: "POST",
		body,
	});
	return asset.id;
}
