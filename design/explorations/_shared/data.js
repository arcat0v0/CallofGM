// 原型用的真实感数据（与演示库一致），时长单位：秒
window.MODULES = [
  "雾港疑案","沉默的灯塔","第七号病房","米斯卡托尼克的遗产","无名小镇","破晓矿坑","龙脊群岛","灰烬王冠",
];
window.TRACKS = [
  {id:1,m:"雾港疑案",name:"雾港夜航",type:"bgm",src:"upload",dur:214,added:"11-21 13:15",size:"3.4 MB"},
  {id:2,m:"雾港疑案",name:"Fog Lamp (Slow Piano)",type:"bgm",src:"upload",dur:263,added:"11-21 13:15",size:"4.1 MB"},
  {id:3,m:"雾港疑案",name:"潮水与铁锚",type:"bgm",src:"upload",dur:312,added:"11-21 13:15",size:"4.9 MB"},
  {id:4,m:"雾港疑案",name:"River Flows In You",type:"bgm",src:"netease",dur:187,artists:"Yiruma",album:"First Love",added:"11-21 13:20"},
  {id:5,m:"雾港疑案",name:"Lux Aeterna (Remix)",type:"bgm",src:"qq",dur:231,artists:"Clint Mansell",album:"Requiem for a Dream",added:"11-21 13:21"},
  {id:6,m:"雾港疑案",name:"汽笛 · 远",type:"se",src:"upload",dur:6,added:"11-21 13:15",size:"96 KB"},
  {id:7,m:"雾港疑案",name:"码头木板脚步声",type:"se",src:"upload",dur:3,added:"11-21 13:15",size:"48 KB"},
  {id:8,m:"沉默的灯塔",name:"灯塔里的风",type:"bgm",src:"upload",dur:402,added:"11-20 21:02",size:"6.3 MB"},
  {id:9,m:"沉默的灯塔",name:"Gymnopédie No.1",type:"bgm",src:"netease",dur:191,artists:"Erik Satie / Alexandre Tharaud",album:"Satie: Piano Works",added:"11-20 21:05"},
  {id:10,m:"沉默的灯塔",name:"心跳（逐渐加快）",type:"se",src:"upload",dur:8,added:"11-20 21:03",size:"120 KB"},
  {id:11,m:"沉默的灯塔",name:"玻璃碎裂",type:"se",src:"upload",dur:2,added:"11-20 21:03",size:"40 KB"},
  {id:12,m:"第七号病房",name:"走廊荧光灯嗡鸣",type:"bgm",src:"upload",dur:540,added:"11-19 10:44",size:"8.4 MB"},
  {id:13,m:"第七号病房",name:"Breathing Room",type:"bgm",src:"upload",dur:248,added:"11-19 10:45",size:"3.9 MB"},
  {id:14,m:"第七号病房",name:"病房门 · 吱呀",type:"se",src:"upload",dur:4,added:"11-19 10:44",size:"64 KB"},
  {id:15,m:"第七号病房",name:"监护仪 · 长鸣",type:"se",src:"upload",dur:12,added:"11-19 10:44",size:"190 KB"},
  {id:16,m:"米斯卡托尼克的遗产",name:"图书馆的呼吸",type:"bgm",src:"upload",dur:360,added:"11-18 18:30",size:"5.6 MB"},
  {id:17,m:"米斯卡托尼克的遗产",name:"深潜者低语",type:"bgm",src:"qq",dur:276,artists:"Hans Zimmer",album:"Interstellar",added:"11-18 18:33"},
  {id:18,m:"米斯卡托尼克的遗产",name:"古籍翻页",type:"se",src:"upload",dur:2,added:"11-18 18:31",size:"36 KB"},
  {id:19,m:"龙脊群岛",name:"启航——龙脊之歌",type:"bgm",src:"upload",dur:205,added:"11-17 09:12",size:"3.2 MB"},
  {id:20,m:"龙脊群岛",name:"战鼓 · 渐进",type:"bgm",src:"upload",dur:168,added:"11-17 09:13",size:"2.6 MB"},
  {id:21,m:"龙脊群岛",name:"酒馆喧闹",type:"bgm",src:"upload",dur:222,added:"11-17 09:14",size:"3.5 MB"},
  {id:22,m:"龙脊群岛",name:"龙吼",type:"se",src:"upload",dur:7,added:"11-17 09:12",size:"110 KB"},
  {id:23,m:"龙脊群岛",name:"剑出鞘",type:"se",src:"upload",dur:1,added:"11-17 09:12",size:"20 KB"},
  {id:24,m:"灰烬王冠",name:"王座厅",type:"bgm",src:"upload",dur:296,added:"11-16 20:00",size:"4.6 MB"},
  {id:25,m:"灰烬王冠",name:"号角",type:"se",src:"upload",dur:5,added:"11-16 20:01",size:"80 KB"},
  {id:26,m:"破晓矿坑",name:"矿道滴水",type:"bgm",src:"upload",dur:480,added:"11-15 15:20",size:"7.5 MB"},
  {id:27,m:"破晓矿坑",name:"岩层崩塌",type:"se",src:"upload",dur:6,added:"11-15 15:21",size:"96 KB"},
];
window.SRC = {upload:"上传",netease:"网易云",qq:"QQ 音乐"};
window.mmss = (s)=>String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
window.ICON = {
  play:'<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  pause:'<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
  more:'<circle cx="12" cy="5.5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="18.5" r="1.4" fill="currentColor"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  chev:'<path d="m6 9 6 6 6-6"/>',
  chevs:'<path d="m7 15 5 5 5-5M7 9l5-5 5 5"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  repeat:'<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
  zap:'<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  pencil:'<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
  ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  vol:'<path d="M4 9.5v5h4l5 4v-13l-5 4zM16.5 9a4 4 0 0 1 0 6"/>',
  list:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  sliders:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/>',
  folder:'<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>',
  swords:'<path d="m14.5 17.5 5 3 1.5-1.5-3-5M19 5l-9 9M3 3l7 7M5 14l5 5"/>',
  box:'<path d="M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"/>',
  mask:'<path d="M4 6c5 0 6 2 8 2s3-2 8-2v6c0 5-4 8-8 8s-8-3-8-8zM8 11h2M14 11h2"/>',
  wave:'<path d="M4 10v4M8 6v12M12 3v18M16 8v8M20 11v2"/>',
  ban:'<circle cx="12" cy="12" r="8"/><path d="m6.5 6.5 11 11"/>',
  clip:'<path d="M8 4h8M9 2h6v4H9zM6 5v16h12V5"/><path d="m9 14 2 2 4-4"/>',
  bin:'<path d="M4 7h16M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};
window.ic = (n, s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
// 外壳：96px 导航栏（与现网一致），页面为其右侧圆角表面
window.railHTML = ()=>{
  const it=[["swords","团"],["box","模组"],["layers","模组模板"],["mask","人物"],["wave","音乐",1],["ban","黑名单"],["clip","审核"],["bin","回收站"]];
  return `<nav class="rail" aria-label="主导航"><div class="logo"></div>${it.map(([i,l,a])=>`<a class="${a?"on":""}" href="#"><span class="pill">${ic(i,22)}</span><span>${l}</span></a>`).join("")}<div class="avatar">KP</div></nav>`;
};
