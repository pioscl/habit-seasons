export const HABIT_ICON_GROUPS = [
  {
    "name": "身心健康",
    "icons": [
      "leaf",
      "water",
      "moon",
      "sun",
      "heart",
      "calm",
      "pill",
      "tooth"
    ]
  },
  {
    "name": "运动活力",
    "icons": [
      "run",
      "dumbbell",
      "bike",
      "walk",
      "swim",
      "stretch",
      "ball",
      "mountain"
    ]
  },
  {
    "name": "学习创作",
    "icons": [
      "book",
      "pencil",
      "code",
      "language",
      "music",
      "palette",
      "camera",
      "brain"
    ]
  },
  {
    "name": "生活日常",
    "icons": [
      "home",
      "coffee",
      "meal",
      "fruit",
      "clean",
      "plant",
      "pet",
      "wallet"
    ]
  },
  {
    "name": "专注成长",
    "icons": [
      "target",
      "timer",
      "phone",
      "journal",
      "smile",
      "people",
      "globe",
      "briefcase"
    ]
  }
];
export const HABIT_ICONS = {
  "leaf": "健康",
  "water": "喝水",
  "moon": "睡眠",
  "sun": "早起",
  "heart": "关爱",
  "calm": "冥想",
  "pill": "用药",
  "tooth": "护齿",
  "run": "跑步",
  "dumbbell": "力量",
  "bike": "骑行",
  "walk": "散步",
  "swim": "游泳",
  "stretch": "拉伸",
  "ball": "球类",
  "mountain": "徒步",
  "book": "阅读",
  "pencil": "写作",
  "code": "编程",
  "language": "语言",
  "music": "音乐",
  "palette": "绘画",
  "camera": "摄影",
  "brain": "学习",
  "home": "日常",
  "coffee": "休息",
  "meal": "饮食",
  "fruit": "水果",
  "clean": "清洁",
  "plant": "植物",
  "pet": "宠物",
  "wallet": "储蓄",
  "target": "目标",
  "timer": "专注",
  "phone": "少看手机",
  "journal": "日记",
  "smile": "心情",
  "people": "社交",
  "globe": "探索",
  "briefcase": "工作"
};
// A shared 24 × 24 grid; all glyphs inherit the same fine stroke.
export const HABIT_ICON_PATHS = {
  "leaf": "<path d=\"M19.5 4.5c-8.3-.8-14 2.4-14 8.2a5.8 5.8 0 0 0 5.8 5.8c5.8 0 9-5.7 8.2-14Z\"/><path d=\"m4.5 20 10-10\"/>",
  "water": "<path d=\"M12 3.5c-2 3.3-6.5 7.8-6.5 11.3a6.5 6.5 0 0 0 13 0C18.5 11.3 14 6.8 12 3.5Z\"/><path d=\"M9 14.5a3 3 0 0 0 3 3\"/>",
  "moon": "<path d=\"M19.6 14a8 8 0 0 1-9.5-9.6A8 8 0 1 0 19.6 14Z\"/>",
  "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 3v1.5m0 15V21M3 12h1.5m15 0H21M5.6 5.6l1.1 1.1m10.6 10.6 1.1 1.1m-12.8 0 1.1-1.1M17.3 6.7l1.1-1.1\"/>",
  "heart": "<path d=\"M12 20s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 5.8-8 11-8 11Z\"/>",
  "calm": "<circle cx=\"12\" cy=\"5\" r=\"1.8\"/><path d=\"m8 14 1.5-4h5l1.5 4 4 2.5-4 3h-8l-4-3L8 14Zm1.5 1 2.5 2 2.5-2M8 19.5l4-2.5 4 2.5\"/>",
  "pill": "<path d=\"m9 5-4 4a5.7 5.7 0 0 0 8 8l4-4a5.7 5.7 0 0 0-8-8ZM9 9l6 6\"/>",
  "tooth": "<path d=\"M12 5.5c-2.4-2.4-6.5-2.2-7.2.8-.7 3.2 1.7 5.8 1.9 7.8.3 2.4.3 6.4 2.1 6.4 1.7 0 1.1-5.5 3.2-5.5s1.5 5.5 3.2 5.5c1.8 0 1.8-4 2.1-6.4.2-2 2.6-4.6 1.9-7.8-.7-3-4.8-3.2-7.2-.8Z\"/>",
  "run": "<circle cx=\"14.5\" cy=\"4.5\" r=\"1.7\"/><path d=\"m4 10 4-.5 3.5-3L15 11h4.5m-8-4.5-3 6 5.5 3L15 21m-6.5-8.5-2 4L3.5 20\"/>",
  "dumbbell": "<path d=\"M8 12h8M4 9v6m4-9v12m8-12v12m4-9v6M4 12h4m8 0h4\"/>",
  "bike": "<circle cx=\"6\" cy=\"16.5\" r=\"3.5\"/><circle cx=\"18\" cy=\"16.5\" r=\"3.5\"/><path d=\"m6 16.5 4-9 5 9H6m9 0 2-12h-3m-6 0h4m-2 0v3\"/>",
  "walk": "<circle cx=\"13\" cy=\"4.5\" r=\"1.7\"/><path d=\"m5.5 12 4-4 4 .5 3 4 3 .5M12 9l-2 6-4 5m4-5 4 2 1 4\"/>",
  "swim": "<circle cx=\"18.5\" cy=\"9\" r=\"1.7\"/><path d=\"m4 12 4.5-4.5 6 4.5M8.5 7.5l4-3 3 1.5M3 16.5q2.2-2 4.5 0t4.5 0 4.5 0 4.5 0M3 20q2.2-2 4.5 0t4.5 0 4.5 0 4.5 0\"/>",
  "stretch": "<circle cx=\"12\" cy=\"4.5\" r=\"1.7\"/><path d=\"m4 8 8 3 8-3m-8 3v5m-5 4 5-4 5 4\"/>",
  "ball": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M4 12h16M12 4v16M6.5 6.2a9 9 0 0 1 0 11.6m11-11.6a9 9 0 0 0 0 11.6\"/>",
  "mountain": "<path d=\"m3 19 6.5-13 5 9L17 10l4 9H3Zm3.5-7 3 1.5 2-2.5\"/>",
  "book": "<path d=\"M12 6c-2-1.5-5-2-8-1v14c3-1 6-.5 8 1 2-1.5 5-2 8-1V5c-3-1-6-.5-8 1Zm0 0v14\"/>",
  "pencil": "<path d=\"m15 4 5 5M4 20l4.5-1L20 7.5A2.8 2.8 0 0 0 16 3.5L4.5 15 4 20Z\"/>",
  "code": "<path d=\"m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18\"/>",
  "language": "<path d=\"M3.5 6h11M9 3v3m-3 0c.5 4.5 3.5 7.5 7 9m0-9c-.5 4.5-3.5 8.5-9.5 11m10 3 3.5-10 3.5 10m-5.8-3h4.6\"/>",
  "music": "<path d=\"M9 17V6l10-2v11M9 9l10-2\"/><ellipse cx=\"6.5\" cy=\"17.5\" rx=\"2.5\" ry=\"2.5\"/><ellipse cx=\"16.5\" cy=\"15.5\" rx=\"2.5\" ry=\"2.5\"/>",
  "palette": "<path d=\"M12 4a8 8 0 1 0 0 16h1a1.8 1.8 0 0 0 1-3.4 1.8 1.8 0 0 1 1-3.3h2a3 3 0 0 0 3-3c0-3.6-3.6-6.3-8-6.3Z\"/><path d=\"M8 8h.01M12.5 6.8h.01M16.5 9h.01M6.8 12.5h.01\"/>",
  "camera": "<path d=\"M4.5 7h3.8l1.5-2.5h4.4L15.7 7h3.8a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-10A1.5 1.5 0 0 1 4.5 7Z\"/><circle cx=\"12\" cy=\"13\" r=\"3.5\"/>",
  "brain": "<path d=\"M12 5.5C9 2 5.5 4 5.5 7.5c-3 1.5-2.5 5.5 0 7-.5 4.5 4 7 6.5 3.5 2.5 3.5 7 1 6.5-3.5 2.5-1.5 3-5.5 0-7C18.5 4 15 2 12 5.5Zm0 0V18M5.5 7.5 8 9m-2.5 5.5L8 13m10.5-5.5L16 9m2.5 5.5L16 13\"/>",
  "home": "<path d=\"m3.5 10 8.5-7 8.5 7M5.5 8.5V20h13V8.5M10 20v-7h4v7\"/>",
  "coffee": "<path d=\"M4 8h12.5v7a4.5 4.5 0 0 1-4.5 4.5H8.5A4.5 4.5 0 0 1 4 15V8Zm12.5 1H18a3 3 0 0 1 0 6h-1.5M7 3v2m4-2v2M3 22h15\"/>",
  "meal": "<path d=\"M4 3.5v6a3 3 0 0 0 6 0v-6m-3 0V21m12 0V3.5c-4.5 3-4.5 10 0 10\"/>",
  "fruit": "<path d=\"M12 7.5C5 2.5 1.5 11.5 6 18c2 3 4.5 1 6 1s4 2 6-1c4.5-6.5 1-15.5-6-10.5Zm0 0V3m0 2c.5-2 2.5-3 5-2.5-.5 2.5-2.5 3.5-5 2.5Z\"/>",
  "clean": "<path d=\"m14 3-4 10m-4 0 7 3-3 5-7-3 3-5Zm12-6v5m-2.5-2.5h5\"/>",
  "plant": "<path d=\"M12 15V8m0 5c-5 0-8-3.5-8-8 5 0 8 3.5 8 8Zm0-3c0-4.5 3.5-7 8-7 0 4.5-3.5 7-8 7ZM6.5 15h11l-1.5 6H8l-1.5-6Z\"/>",
  "pet": "<ellipse cx=\"6\" cy=\"9.5\" rx=\"1.7\" ry=\"2.3\"/><ellipse cx=\"10.5\" cy=\"6\" rx=\"1.7\" ry=\"2.3\"/><ellipse cx=\"15.5\" cy=\"6\" rx=\"1.7\" ry=\"2.3\"/><ellipse cx=\"19.5\" cy=\"10\" rx=\"1.7\" ry=\"2.3\"/><path d=\"M6 18c0-2.5 3.5-6 6-6s6 3.5 6 6c0 3-3.5 1.2-6 1.2S6 21 6 18Z\"/>",
  "wallet": "<path d=\"M19.5 7V4.5H6A2.5 2.5 0 0 0 6 9h14v11H6a2.5 2.5 0 0 1-2.5-2.5v-11M20 12h-5v5h5\"/><path d=\"M17 14.5h.01\"/>",
  "target": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 12h.01\"/>",
  "timer": "<circle cx=\"12\" cy=\"13.5\" r=\"7.5\"/><path d=\"M9 3h6m-3 0v3m6 1.5 1.5-1.5M12 9v5l3 1.5\"/>",
  "phone": "<rect x=\"6.5\" y=\"3\" width=\"11\" height=\"18\" rx=\"2\"/><path d=\"M10 5.5h4m-3 12.5h2\"/>",
  "journal": "<rect x=\"5\" y=\"3.5\" width=\"14.5\" height=\"17\" rx=\"1.5\"/><path d=\"M3.5 7h3m-3 5h3m-3 5h3M10 8h5.5m-5.5 4h5.5m-5.5 4h3\"/>",
  "smile": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M8.5 14a3.8 3.8 0 0 0 7 0M9 9h.01M15 9h.01\"/>",
  "people": "<circle cx=\"9\" cy=\"7.5\" r=\"2.8\"/><path d=\"M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M16 5a2.8 2.8 0 0 1 0 5.5m1.5 3a5.5 5.5 0 0 1 3 4.5v2\"/>",
  "globe": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><ellipse cx=\"12\" cy=\"12\" rx=\"3.5\" ry=\"8\"/><path d=\"M4 12h16\"/>",
  "briefcase": "<rect x=\"3.5\" y=\"7.5\" width=\"17\" height=\"13\" rx=\"1.5\"/><path d=\"M8.5 7.5v-4h7v4m-12 5c5 3 12 3 17 0M12 12v4\"/>"
};
