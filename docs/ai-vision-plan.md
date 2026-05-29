# AI 看圖估算 — 技術規劃文件

> 目標：在現有的純前端 EXIF 讀取之上，加上「看圖估算」能力。
> 版本：規劃 v1 · 對應站點 Kris's Fuji Recipe

---

## 1. 定位：重現氛圍 > 猜原始參數

要 AI 去還原一張照片「當初真實的 ISO / 光圈 / 快門」本質上**不可靠**——那些數值不存在於像素中。
因此把問題重新定義為兩件可達成、且更有價值的事：

1. **情境估算**：從畫面判讀光線、色溫、對比、氛圍、場景類型。
2. **重現建議**：「要用 X-T50 拍出／重現這種感覺，該怎麼設定？」並對應到站上最接近的配方。

真實 EXIF（若存在）永遠優先，當作 ground truth；AI 只在缺資料時補位，且永遠標示「估算」。

---

## 2. 整體架構

```
┌──────────┐   1. 讀 EXIF (本機)         ┌─────────────────────┐
│ 瀏覽器    │ ─────────────────────────▶ │ 有真實參數 → 直接顯示 │
│ (前端)    │                            └─────────────────────┘
│          │   2. 無 EXIF 且用戶同意
│          │   POST 圖片(縮圖)+EXIF
│          │ ───────────────────────────▶ ┌──────────────────────┐
│          │                              │ Serverless 代理         │
│          │                              │ (Cloudflare Worker)    │
│          │                              │ · 藏 API key           │
│          │                              │ · CORS 白名單           │
│          │                              │ · 限流                  │
│          │                              │ · 呼叫視覺模型           │
│          │ ◀─────────────────────────── │ · 回結構化 JSON         │
└──────────┘   3. 渲染估算 + 配方建議      └──────────────────────┘
```

**為什麼一定要後端**：GitHub Pages 是純靜態，API key 放前端 = 公開洩漏。後端代理是唯一安全做法。

---

## 3. 混合策略流程（前端）

```
選擇/拖入檔案
   │
   ├─ 讀 EXIF (exifr，本機)
   │     │
   │     ├─ 有 光圈/快門/ISO  → 顯示「✓ 真實 EXIF」(現況，免後端)
   │     │
   │     └─ 無 → 詢問用戶：「要把這張圖送到 AI 分析嗎？(會離開你的裝置)」
   │              │
   │              ├─ 同意 → 縮圖(如 768px) + base64 → POST 給 Worker
   │              │           └─ 顯示「≈ AI 估算」+ 重現建議 + 配方
   │              │
   │              └─ 拒絕 → 維持現有純像素估算 (本機，不外傳)
```

縮圖很重要：傳 768px 邊長就夠模型判讀，省 token、省頻寬、降隱私風險。

---

## 4. 後端：Cloudflare Worker 範例

> 部署：`npm create cloudflare@latest` → 貼上以下 → `wrangler secret put ANTHROPIC_API_KEY` → `wrangler deploy`

```js
// worker.js
const ALLOWED_ORIGINS = ['https://jellyfish1456.github.io'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

    // --- 簡易限流：用 Cloudflare KV 以 IP 計數（範例略，正式環境請綁 KV）---
    // const ip = request.headers.get('CF-Connecting-IP');
    // ...每分鐘 N 次上限，超過回 429...

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400, cors); }
    const { imageBase64, mediaType, exif } = body;
    if (!imageBase64) return json({ error: 'no image' }, 400, cors);

    const prompt = buildPrompt(exif);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',          // 視成本選 model
        max_tokens: 700,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    if (!resp.ok) return json({ error: 'upstream', status: resp.status }, 502, cors);
    const data = await resp.json();
    const text = data.content?.[0]?.text || '{}';
    // 模型被要求只回 JSON；保險起見抓出 {...}
    const match = text.match(/\{[\s\S]*\}/);
    return json(match ? JSON.parse(match[0]) : { error: 'parse', raw: text }, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...cors } });
}
```

---

## 5. Prompt 設計（結構化 JSON 輸出）

```js
function buildPrompt(exif) {
  const exifNote = exif && Object.keys(exif).length
    ? `部分真實 EXIF 已知，請當作 ground truth：${JSON.stringify(exif)}`
    : '此圖無 EXIF，請純粹依畫面估算，並在 confidence 標示較低。';

  return `你是 Fujifilm 攝影與調色專家。分析這張照片，只回傳 JSON，不要任何其他文字。
${exifNote}

JSON 結構：
{
  "scene": "一句話描述場景與光線（如：室內窗光逆光人像，暖色調）",
  "estimated": {
    "lightLevel": "bright | normal | low | dark",
    "colorTemp": "暖/中性/冷，附大概 Kelvin 範圍",
    "contrast": "low | medium | high",
    "mood": "如 cinematic / nostalgic / vivid / airy"
  },
  "toRecreate_XT50": {
    "filmSimulation": "如 Classic Neg.",
    "dynamicRange": "DR100 | DR200 | DR400",
    "whiteBalance": "如 Daylight, R+2 B-1",
    "highlightTone": -2..4, "shadowTone": -2..4,
    "color": -4..4, "sharpness": -4..4,
    "noiseReduction": -4..4, "grainEffect": "Off|Weak|Strong",
    "clarity": -5..5
  },
  "closestRecipe": "從這份清單挑最接近的名稱：Kodachrome 64 / Fujicolor 200 / Ilford HP5 Plus / Velvia Landscape / Eterna Cinema Street / Classic Negative Street",
  "confidence": "high | medium | low",
  "disclaimer": "估算說明（提醒無法還原真實光圈/快門/ISO）"
}`;
}
```

重點：把「站上現有配方清單」寫進 prompt，模型才會回對得上的名稱，前端就能直接連到該配方。

---

## 6. 前端整合（接到現有 `analyzeFile`）

在現有 `js/app.js` 的無-EXIF 分支，加一個「送 AI」的選項：

```js
const AI_ENDPOINT = 'https://your-worker.your-subdomain.workers.dev';

async function analyzeWithAI(file, exif) {
  // 1. 縮圖到 768px 邊長，轉 base64（省 token / 降隱私）
  const { base64, mediaType } = await downscaleToBase64(file, 768);
  // 2. 呼叫後端
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mediaType, exif: exif || {} }),
  });
  const ai = await res.json();
  renderAIResult(ai);   // 顯示 scene / estimated / toRecreate / 連到 closestRecipe
}
```

`downscaleToBase64` 用 canvas 畫到 768px 再 `toDataURL('image/jpeg', 0.85)`，取逗號後段即 base64。

**同意流程**：第一次使用先跳一個確認框
「這張圖會傳送到 AI 服務進行分析（會離開你的裝置）。原始 EXIF 讀取仍是本機完成。要繼續嗎？」

---

## 7. 成本估算（量級概念）

- 一張 768px 圖約數百個 image token + 文字，**單次大約一美分上下**（依 model 與用量浮動）。
- 控制成本三招：**縮圖**、**限流**（每 IP 每分鐘 N 次）、**選較便宜的 model**（Haiku 級做初篩，Sonnet 級做精修）。
- 免費額度：Cloudflare Workers 每日請求數免費額度足夠個人站。

---

## 8. 隱私與安全 Checklist

- [ ] API key **只**存在後端 secret（`wrangler secret`），前端永不出現
- [ ] CORS 白名單只允許你的網域
- [ ] 後端限流（KV/Durable Object）防濫用
- [ ] 圖片在後端**不落地、不記錄**，處理完即丟
- [ ] 前端明確**告知並取得同意**才上傳（純 EXIF / 純像素分析維持本機）
- [ ] 若照片含人物：只做光線/氛圍分析，**不做人臉辨識或蒐集**
- [ ] 文件/UI 明示：AI 為「估算」，無法還原真實光圈/快門/ISO

---

## 9. 部署步驟（Cloudflare 路線）

1. `npm create cloudflare@latest ai-vision-proxy`
2. 貼上 §4 的 `worker.js`
3. `npx wrangler secret put ANTHROPIC_API_KEY`（貼入你的 key）
4. 改 `ALLOWED_ORIGINS` 為你的網域
5. `npx wrangler deploy` → 得到 `https://...workers.dev`
6. 前端把 `AI_ENDPOINT` 指過去，加同意框與 `analyzeWithAI`
7. （建議）綁 KV 做限流

---

## 10. 漸進式 Roadmap

| 階段 | 內容 | 後端 |
|---|---|---|
| ✅ 0 | 前端 EXIF + 像素估算（現況）| 無 |
| 1 | Cloudflare Worker + 視覺模型，回情境 + 重現建議 | 輕量 |
| 2 | 加同意框、縮圖、限流、KV 快取（同圖不重打）| + KV |
| 3 | Haiku 初篩 → Sonnet 精修的兩段式，壓成本 | 同上 |
| 4 |（選）影片：抽多幀取代表幀再分析 | 同上 |

---

*本文件為規劃，未含任何金鑰。實作前請先確認 API 供應商條款與你的預算上限。*
