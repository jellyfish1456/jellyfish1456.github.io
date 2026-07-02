這是一個非常漂亮且具備實戰價值的架構設計。你提到的兩個核心原則——「Deterministic 工具負責壓縮，LLM 負責推理」以及「跨階段的 Causal Chain (因果鏈) 根因分析」——精準打中了目前 AI 落地 EDA (Electronic Design Automation) 領域的最大痛點：Token 成本、幻覺 (Hallucination) 以及下游 Error 噪音。

這個專案的賣點極強，以下為你梳理出這個 c Debugging Verification Framework 的系統專案計畫（Plan Mode）。

1. 系統架構設計 (Hybrid Multi-Agent System)
系統將分為三個主要層級：資料處理層、子代理層（Domain Experts）、以及編排層（Orchestrator）。

A. Deterministic Parsing Layer (確定性工具層)
這是系統的第一道防線，作為 Agent 可呼叫的 Tools。

Log Summarizer Tool: 針對 GB 級別的 a / b / c log，寫死特定的 Regex 腳本或 Python Parser，專門抓取結尾的 Summary block、Exit status (Pass/Fail) 以及特定的 Error/Warning ID。

Context Extractor Tool: 當抓到特定的 Error ID 後，提取該行及上下各 50 行的 Context，並附加上真實行號，打包成 JSON 格式。

Error Codebook RAG (知識庫): 將你向 EDA 廠商要到的 Error Codebook Manuals (如 Ansys RedHawk, Cadence Voltus, Mentor Calibre 等) 建立成向量資料庫或結構化查詢表。當抽取出 Error ID 時，直接 Query 出對應的官方解說與 Debug 建議。

B. Sub-Agent Layer (領域專家子代理)
每個 Sub-agent 只專注處理自己階段被壓縮後的關鍵資訊。

a Debug Agent: 負責判讀 a log 的精華片段。判斷是否有 Short, Open, 或 Device Mismatch，並標示出有問題的 Net names。

b Extraction Debug Agent: 判讀 b 萃取階段的 log。檢查是否有缺失的 layer mapping、未定義的 vias、或是不合理的電阻/電容值警告。

c Debug Agent: 結合 c error codebook，判讀 c 階段的 floating nets, missing vias, IR drop violation 或 electromigration 警告。

C. Orchestrator Agent (編排與根因推理大腦)
這是整個 Framework 的核心。它不自己讀 log，而是綜合三個 Sub-agents 的報告，執行跨階段根因推導 (Cross-stage Root Cause Analysis)。

2. 核心工作流：因果鏈推理 (Causal Chain Logic)
為了實現你提到的「找出連鎖反應的真正上游原因」，Orchestrator Agent 必須具備依序向下推導的邏輯思維：

a 優先權審查： Orchestrator 首先檢視 a Agent 的報告。如果 a 階段發現 VDD_CORE 存在 Mismatch 或 Open，系統會將此標記為 Blocker (阻斷性根因)。

噪音過濾 (Noise Cancellation)： 當 Orchestrator 檢視 b 和 c Agent 的報告時，如果發現 c 回報了數百個與 VDD_CORE 相關的 Floating net 或 IR Drop 錯誤，它會主動將這些 c 錯誤降級。

生成最終決策報告： 系統最終輸出給 User 的結論不會是「你有 1 個 a 錯誤和 300 個 c 錯誤」，而是結構化的人話：

「系統在 c 階段偵測到大量 floating net (VDD_CORE)，但追溯上游發現 a 階段該 net 存在 Mismatch。這 300 個 c 警告為連鎖效應噪音。Root Cause: a Mismatch at VDD_CORE。Action Item: 請先修復 a，暫略 c log。」

3. 專案開發階段計畫 (Implementation Roadmap)
建議將此專案分為四個階段來迭代開發，確保每一步的準確性：

Phase 1: 基礎建設與確定性工具開發 (Deterministic Tooling): 不碰 LLM，先處理資料流。收集 a, b, c 的真實 log 樣本（包含 Pass 與各類常見 Fail 案例）。開發 Python Parser，確保能穩定將數 GB 的 log 壓縮成不到 10KB 的結構化 JSON 片段（包含 Error ID, Context, Net names）。同時將 EDA Error Codebook 數位化，建立檢索 API 或 RAG 系統。

Phase 2: Sub-Agent 單點突破 (Domain Expert Prompts): 驗證 LLM 理解單一領域的能力。為 a, b, c 各自撰寫 System Prompt。將 Phase 1 產生的 JSON 片段丟給對應的 Sub-agent，測試它們是否能準確結合 Error Codebook 產生正確的「單一階段」除錯建議。調整 Prompt 確保 Agent 不會產生幻覺。

Phase 3: Orchestrator 跨階段因果鏈開發 (The Core Value): 專案成敗的關鍵。開發 Orchestrator Agent，導入 a -> b -> c 的依賴關係邏輯。設計測試案例（例如：刻意植入 a 錯誤導致 c 大爆發的 log），驗證 Orchestrator 是否能成功執行「下游噪音過濾」，精準指出上游 Root Cause，而非單純把三個 Agent 的報告貼在一起。

Phase 4: 使用者介面與 Post-run 整合 (UX & Pipeline Integration): 最後一哩路。設計一個簡單的 Web UI (例如 Streamlit) 或 CLI 介面。讓 User 可以輸入專案路徑，系統自動抓取三個階段的最新 log 進行分析，並輸出最終的「根因分析與行動建議報告」。

4. 關鍵成功要素 (Key Success Factors)
Error Codebook 的精確度： 這是 Sub-agent 準確度的天花板。如果能拿到越詳細的 Manual，Agent 解釋問題的深度就越高。

Parser 的防呆機制： EDA tools 在不同 corner 或不同版本下，log 格式可能會微調。Deterministic parser 需要足夠強健（Robust），否則一開始抓錯段落，後面的 LLM 推理全都會歪掉。

定義因果關聯字典 (Causal Mapping)： 你可以事先準備一個輕量級的 mapping rule 給 Orchestrator（例如：a Open -> b Missing Via -> c Floating Net），當 LLM 發現這三個關鍵字同時出現時，能更具確定性地把因果鏈連起來。
