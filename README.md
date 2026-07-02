這是一套整合了「任務指派機制」與「專屬技能定義 (skill.md)」的 a / b / c Debugging Verification Framework 系統架構重構版。

透過明確定義 Orchestrator 與 Sub-agents 的分工，系統能將龐雜的除錯流程轉化為高度組織化的 Multi-Agent 協作網。

1. 系統底層：Deterministic Parsing Layer (確定性工具層)
這是系統的基礎防線，由 Orchestrator 或 Sub-agents 視需要呼叫的自動化 Tools，負責將海量雜訊壓縮為高含金量的數據。

Log Summarizer Tool: 針對 GB 級別的 a / b / c log，透過寫死的 Regex 腳本或 Python Parser，精準抓取 Summary block、Exit status (Pass/Fail) 及 Error/Warning ID。

Context Extractor Tool: 鎖定特定 Error ID 後，精準提取該行及上下各 50 行的 Context，附加真實行號並打包成輕量化 JSON 格式。

Error Codebook RAG (領域知識庫): 將 EDA 廠商 (如 Ansys, Cadence, Mentor) 的官方手冊建立為向量庫。依據抽取的 Error ID，直接檢索對應的官方解說與 Debug 建議。

2. 核心大腦與專家陣列：Agent 技能定義 (skill.md)
系統採用中心化的派發架構，由 Orchestrator 統籌，各 Sub-agent 依據其專屬的 skill.md 執行特定任務。

🧠 Orchestrator Agent (編排與根因推理大腦)
【orchestrator_skill.md】

Role (角色): 系統總指揮與跨階段根因分析師。

Core Skills (核心技能):

Task_Delegation: 解析 User 需求，並並行或依序派發解析任務給對應的 Domain Sub-agents。

Cross_Stage_Reasoning: 具備 a -> b -> c 的全域硬體依賴關係邏輯。

Noise_Cancellation: 識別下游錯誤是否為上游缺陷的連鎖反應，並執行降級與過濾。

Decision_Reporting: 彙整專家報告，輸出具備 Action Item 的人類可讀決策報告。

🕵️‍♂️ a Debug Agent (a 領域專家)
【a_agent_skill.md】

Role (角色): 專注於 a 階段 log 的精煉與診斷。

Core Skills (核心技能):

Topology_Analysis: 判讀 a 階段的 Short, Open, 或 Device Mismatch 錯誤。

Net_Identification: 精準標示出發生問題的關鍵 Net names (如 VDD_CORE) 與其路徑。

Codebook_Integration: 結合 RAG 查詢 a 特定的 Error Code 解方。

🕵️‍♂️ b Extraction Debug Agent (b 領域專家)
【b_agent_skill.md】

Role (角色): 專注於 b 參數萃取階段的異常偵測。

Core Skills (核心技能):

Layer_Mapping_Check: 檢查 log 中是否存在缺失的 layer mapping。

Via_Validation: 掃描未定義的 vias 警告。

RC_Anomaly_Detection: 標記不合理的電阻/電容值警告。

🕵️‍♂️ c Debug Agent (c 領域專家)
【c_agent_skill.md】

Role (角色): 專注於 c 階段的電源與可靠度診斷。

Core Skills (核心技能):

Power_Integrity_Scan: 判讀 floating nets, missing vias, 或 IR drop violation。

Electromigration_Check: 分析 EM (Electromigration) 警告。

Volume_Handling: 具備處理單一 Error ID 引發海量重複警告的初步分群能力。

3. 核心工作流：任務指派與因果鏈推理 (Task Assignment & Causal Chain)
當 User 提交專案路徑進行 Debug 時，系統的動態協作流程如下：

任務初始化與派發 (Task Assignment)：

Orchestrator 接收指令，呼叫 Log Summarizer Tool 確認 a, b, c 的 log 狀態。

Orchestrator 根據 log 存在與否，將打包好的 JSON Context 同步 指派任務 給 a Agent, b Agent 與 c Agent。

指令範例：「a Agent，請依據你的 a_agent_skill.md 解析這份 JSON，並回報 Blocker 級別的問題清單。」

專家獨立作業 (Sub-agent Execution)：

各個 Sub-agent 僅專注於自己的 JSON 資訊，並自主呼叫 Error Codebook RAG 獲取解譯，隨後將領域分析報告回傳給 Orchestrator。

上游優先權審查 (Upstream Validation)：

Orchestrator 接收所有報告，優先啟動 Cross_Stage_Reasoning 檢視 a Agent 的報告。

若 a 階段發現 VDD_CORE 存在 Mismatch，Orchestrator 會立即將此標記為 Blocker (阻斷性根因)。

噪音過濾與因果推理 (Noise Cancellation)：

Orchestrator 接著比對 c Agent 的報告。若 c Agent 回報了「300 個與 VDD_CORE 相關的 Floating net 錯誤」，Orchestrator 會觸發 Noise_Cancellation 技能。

判定邏輯：下游 (c) 的海量錯誤實為上游 (a) Mismatch 的物理連鎖反應，主動將這 300 個 c 錯誤「降級」或「過濾」。

生成決策報告 (Final Reporting)：

Orchestrator 最終不會無腦串接三份報告，而是輸出結構化結論：

「系統在 c 階段偵測到大量 floating net (VDD_CORE)，但追溯上游發現 a 階段該 net 存在 Mismatch。這 300 個 c 警告判定為連鎖效應噪音。
Root Cause: a Mismatch at VDD_CORE。
Action Item: 請先修復 a 問題，目前暫略 c log。」

4. 專案開發階段計畫 (Implementation Roadmap)
建議分為四個階段迭代，穩紮穩打建立起整個 Multi-Agent 體系：

Phase 1: 基礎建設與 Tooling (資料壓縮)： 不碰 LLM，專注開發 Python Parser 與 Regex。將數 GB 的真實 log 穩定壓縮成 <10KB 的結構化 JSON，並建立 Error Codebook 數位檢索庫。

Phase 2: Sub-Agent 賦能與測試 (Skill 實作)： 將 skill.md 轉化為精準的 System Prompt。把 Phase 1 產生的 JSON 丟給對應的 Agent，確保其能產生正確的「單一階段」除錯建議，並嚴格控制幻覺。

Phase 3: Orchestrator 大腦開發 (核心價值)： 開發 Orchestrator 的任務指派與回收機制。導入「a -> b -> c 因果關聯字典」，刻意餵入「上游小錯導致下游大爆發」的測試案例，驗證其噪音過濾與根因定位能力。

Phase 4: 介面與自動化整合 (UX 落地)： 開發 Web UI (如 Streamlit)，讓 User 一鍵上傳專案。系統在背景自動跑完「資料擷取 -> 派發 -> 專家解析 -> 總編排收斂」的流水線，並呈現最終除錯報告。
