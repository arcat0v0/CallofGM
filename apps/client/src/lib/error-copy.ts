const CODE_COPY: Record<string, string> = {
  AUTH_REQUIRED: "请先登录主持人账号",
  AUDIO_VERSION_CONFLICT: "音频状态已更新，请重试",
  BLACKLISTED_FINGERPRINT: "当前设备已被本团禁用",
  CHARACTER_ALREADY_PARTICIPATING: "该角色已在这个团中",
  CHARACTER_IN_USE: "该角色仍被团或记录引用，无法删除",
  CHARACTER_NOT_FOUND: "找不到该角色",
  CHARACTER_NOT_IN_MODULE: "该角色不属于这个模组",
  CHARACTER_NOT_IN_SESSION: "该角色不在本团中",
  CHARACTER_RULE_MISMATCH: "人物卡规则与模组规则不一致",
  CHECK_REQUEST_ALREADY_RESOLVED: "这条鉴定请求已经处理过了",
  CHECK_REQUEST_NOT_FOUND: "找不到这条鉴定请求",
  EXPRESSION_NOT_FOUND: "这个角色没有对应的立绘，请换一个表情",
  FILE_SIZE_EXCEEDED: "文件超过 10MB 上限",
  FORBIDDEN: "没有权限执行该操作",
  GM_PASSWORD_NOT_CONFIGURED: "尚未设置主持人密码，请先在服务端初始化",
  HANDOUT_GRANT_NOT_FOUND: "找不到该情报的发放记录",
  HANDOUT_NOT_FOUND: "找不到该情报",
  INTERNAL_SERVER_ERROR: "服务器出错了，请稍后重试",
  INVALID_CREDENTIALS: "密码不正确，请重新输入",
  INVALID_DICE_EXPRESSION: "骰点表达式无法识别，请使用如 1d100 的格式",
  INVALID_FILE_CONTENT: "文件内容无法识别或格式不匹配",
  INVALID_KIND: "人物类型必须是 PC 或 NPC",
  INVALID_SAN_LOSS_EXPRESSION: "理智损失格式应为「成功/失败」，如 1/1d6",
  INVALID_TOKEN: "身份校验失败，请刷新页面",
  MEDIA_INVALID: "媒体文件与用途不匹配",
  MEDIA_NOT_FOUND: "找不到该媒体文件",
  MESSAGE_NOT_FOUND: "找不到这条消息",
  MESSAGE_NOT_PENDING: "这条消息已不在待呈现队列中",
  MODULE_CHARACTER_ALREADY_LINKED: "该人物已关联到这个模组",
  MODULE_CHARACTER_NOT_LINKED: "该人物未关联到这个模组",
  MODULE_IN_USE: "该模组仍被团引用，无法删除",
  MODULE_NOT_FOUND: "找不到该模组",
  PLAYER_NOT_FOUND: "找不到该玩家",
  PORTRAIT_NOT_FOUND: "找不到该立绘",
  RATE_LIMITED: "操作太频繁，请稍后再试",
  RESOURCE_IN_USE: "该资源仍被其他记录引用，无法删除",
  RULE_ACTION_UNSUPPORTED: "当前规则不支持该操作",
  SCENE_NOT_FOUND: "找不到该场景",
  SEAT_ALREADY_CLAIMED: "这个位置已被认领",
  SESSION_EXPIRED: "登录状态已过期，请重新登录",
  SESSION_KICKED: "你已被主持人移出本团，需由主持人解除禁入后才能重新进入",
  SESSION_NOT_FOUND: "找不到这个团，链接可能已失效",
  SESSION_PHASE_FORBIDS_ACTION: "当前阶段或席位不允许自主掷骰",
  SESSION_STATE_INVALID: "当前团状态不允许该操作",
  SKILL_NOT_FOUND: "人物卡上没有这个技能或属性",
  STAGING_CONSUMED: "导入预览已失效，请重新上传",
  STAGING_EXPIRED: "导入预览已过期，请重新上传",
  STAGING_HAS_ERRORS: "导入预览存在解析错误，请修正后重新上传",
  STAGING_OWNER_MISMATCH: "这份导入预览不属于当前登录的主持人",
  STAGING_RECORD_NOT_FOUND: "找不到导入预览，请重新上传",
  TRACK_NOT_FOUND: "找不到该曲目",
  UNAUTHORIZED_MEDIA_ACCESS: "无权查看该媒体文件",
  UNSUPPORTED_MIME_TYPE: "不支持的文件类型",
  VALIDATION_FAILED: "提交的内容不符合要求，请检查后重试",
};

const STATUS_COPY: Record<number, string> = {
  400: "提交的内容不符合要求，请检查后重试",
  401: "登录状态已过期，请重新登录",
  403: "没有权限执行该操作",
  404: "找不到请求的内容",
  409: "当前状态下无法完成该操作",
  413: "文件太大了，请更换更小的文件",
};

const FALLBACK = "操作失败，请稍后重试";
const RATE_LIMITED = "操作太频繁，请稍后再试";

export function errorCopy(input: { code?: string | null; status?: number | null }): string {
  const byCode = input.code ? CODE_COPY[input.code] : undefined;
  if (byCode) {
    return byCode;
  }
  const status = input.status ?? 0;
  if (status === 429) {
    return RATE_LIMITED;
  }
  if (status >= 500) {
    return "服务器出错了，请稍后重试";
  }
  return STATUS_COPY[status] ?? FALLBACK;
}