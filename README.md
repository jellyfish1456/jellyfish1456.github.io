先講結論:你的「orchestration agent 指派 sub-agent」直覺是對的,但理由不是為了炫技,而是兩個具體工程效益 —— context 隔離,以及跨階段的 root-cause 推理。這兩點決定了整個架構怎麼切。我把想法整理成一份 plan,先不動手實作。
一個關鍵前提:別讓 LLM 直接讀整份 log
 的 log 動輒幾百 MB 到 GB,多 corner 時更多。如果丟原始 log 給 agent 逐行讀,會很慢、很貴、而且它會「幻想」出根本不存在的行號。
所以核心原則是 hybrid:確定性的 parser 當「工具」,LLM 當「推理層」。

Deterministic layer(tool):grep / regex / 抓 log 尾端 summary block / 檢查 exit status。負責把 GB 級 log 壓縮成「命中的 signature + 行號 + 前後文」的結構化片段。快、便宜、可重現。
LLM / agent layer:只看被抽出來的片段,負責判讀嚴重性、排序、推測 root cause、產生人話說明、以及判斷「下游的一堆 error 其實只是上游一個原因的連鎖」。

value 幾乎全在後者;前者是把雜訊擋掉的守門員。
為什麼要 sub-agent(而不是單 agent 三個 skill)
MVP 其實單 agent 也能跑,但 sub-agent 在這裡有兩個實質好處:

Context 隔離 —— 每個 sub-agent 只在自己的 context window 裡處理該階段的 log,產出一個精簡的 structured summary 回傳給 orchestrator。這樣三個巨大 log 不會互相污染彼此的 context,orchestrator 只需要在三份小 summary 上做推理。
各自帶不同的 skill 與 tool adapter —— 

Sub-agent 的職責大致是:

a log analyzer — mismatch / short / open / missing device / property error
b  extraction log analyzer — tech file / missing layer / netlist / SPEF 產出問題
c log analyzer — missing power pad、floating net、缺 輸入,以及真正的 IR drop / EM 違規

這個框架最該做對的一件事:分清「flow 壞了」vs「signoff 違規」
一個 debugging framework 如果只回「有 error / warning」其實幫助有限。真正有用的是把兩類東西分開:

Flow / setup failure:tool 根本沒跑完(缺輸入、license、tech 設定錯)。→ user 要去修環境或設定。
Design violation:run 有完成,但報出 IR drop / EM 超標。→ 這是真正的設計問題,要回去改 PG network / 加 pad。

同一個「ERROR」字串,這兩種意義天差地別。skill 裡要把這個分類編碼進去。
跨階段 root-cause —— 這才是 AI agent 打贏 grep script 的地方
c 掛掉,很常見的真因其實在上游:a 有 mismatch → extraction 出來的 netlist 就不對 → c一堆 floating/missing net。單獨看 c log 你只會看到一堆下游噪音。
所以 orchestrator 拿到三份 summary 後,要做的不是把 error 加總,而是沿著 a->b->c 的因果鏈往回推,輸出類似:「c 的 32 個 floating net 警告,root cause 是 b 在 net VDD_CORE 的 mismatch,建議先修 a」。這是你這個 project 的賣點。
Skill 在這裡扮演什麼
每個階段一個 SKILL.md,內容是該 EDA tool 的 hard-won 知識:log 格式怎麼 parse、已知 signature → 含義的對照表、severity map、常見 root cause 與修法。這正是 skill 機制的甜蜜點 —— 把工程師腦袋裡「看到這行代表什麼」的經驗沉澱成可累積的 signature library,之後遇到新 pattern 就往裡加。
Sub-agent → Orchestrator 的契約(先定這個)
最該先定義的不是程式,是回傳的 structured schema,因為它是整個系統的介面。大概像:
{ stage, tool, status: completed|failed,
  findings: [ { severity, signature, location(file:line),
               category: flow_error|design_violation,
               root_cause_hint } ] }
schema 定死了,三個 sub-agent 就能各自獨立開發、orchestrator 也能穩定消化。
先用文字把架構講完,配一張圖會更清楚各層怎麼疊。這張圖把分層架構畫清楚:log 從上往下,經過三個各自帶 skill 與 parser 的 sub-agent,最後由 orchestrator 做跨階段關聯並產出報告。
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: 0.25s;
    animation-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
  }
VvisualizeVvisualize show_widget建議的建置順序(先別急著把三階段一起做)
第一步先定 schema(sub-agent → orchestrator 的 structured findings),這是整個系統的介面,定死後三個 agent 可以各自獨立開發。
接著單一階段跑通端到端 —— 建議從 c 開始(你最熟、signature 最好蒐集),把「deterministic parser + c skill + 產出 findings」一路做完,驗證判讀品質。
然後複製到 a 與 b,補上各自的 skill 與 signature library。
最後才接 orchestrator + 跨階段關聯,這時三份 findings 都在了,root-cause 推理才有料可推。之後再擴充報告 UX、多 corner 彙整、更多 tool adapter。
先把最容易踩雷的關鍵抓穩,再往外長,會比一次全做穩很多。
幾個會影響設計、值得你先決定的分岔
底層要用什麼跑?你說是「skill project」,那 Claude Agent SDK / Claude Code 的 subagent + Skills 是最自然的對應;若你偏好 LangGraph 之類自己編排也行,但 skill 與 sub-agent 的實作方式會不同。

log 規模多大、要不要 multi-corner?幾百 MB 以上就得先想 streaming / 預過濾,不然 parser 這關會卡。
