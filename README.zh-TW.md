# 臺北翡翠水庫與水環境地圖

[English](README.md)

這是一個以 Vite、React 與 TypeScript 建置的行動優先雙語網站，用於探索臺北市公開的水環境、河川、生態、水利設施與防汛整備資料。

瀏覽器只會讀取 `public/data` 內的本機靜態 JSON。臺北市開放資料的抓取僅在 `scripts/` 的 Node 腳本中進行；正式網站不會在執行階段呼叫臺北市開放資料 API。

## 使用範圍與限制

本網站是資料探索與公開透明工具，並非緊急應變系統、淹水警報、即時水情服務、飲用水安全判定、設備可用性清冊或工程設計工具。

使用每個模組前請先閱讀資料日期與詮釋說明。尤其歷史生態、淤積調查及防汛外租機械資料，不得描述為目前狀況。

## 資料模組

### 政策 #13：河川監測證據查核

由 **河川與生態 → 河川監測證據查核** 開啟，亦可使用 `/#river-policy`（GitHub Pages：`/taipei-feitsui-water-map/#river-policy`）。獨立延遲載入面板只讀取本機不可變快照，並驗證精確檔案 SHA-256。

固定分析日為 2026-10-27。已准入 112–115 年官方年版，共 **768 公布列、720 含量測列**；10 月 16 列尚無量測，11–12 月 32 列為未來預留。460 列具有四項完整數值，但 RPI 精度／四捨五入及同次採樣證據尚未充分准入，因此不產生研究重現 RPI。歷史實體站點連續性未核實，嚴格跨年比較不可用；有限同名標籤配對僅供描述。查核級別是文件疑問，不是污染嚴重度或法規符合性。

離線依序執行 `npm run data:audit:river-water-policy`、`npm run data:build:river-water-policy`、`npm run data:verify:river-water-policy`、`npm run data:report:river-water-policy`。抓取命令預設也僅離線稽核；明確加上 `-- --refresh` 才會暫存官方來源，查閱後以 `-- --accept=<sha256>` 准入指定暫存版本。失敗時保留原先已准入來源與快照，舊探索器資料另行保留。

完整結果見[中文研究報告](docs/river-water-policy-decision-mvp.zh-TW.md)、[來源稽核](docs/river-water-policy-source-audit.md)、[縱向比較方法](docs/river-water-policy-longitudinal-methodology.md)及[交付驗證](docs/river-water-policy-delivery.md)。

為了讓桌面與手機操作更容易，導覽採分類後的次級模組結構。

| 分類 | 模組 |
| --- | --- |
| 總覽 | 翡翠水庫水質、綜合脈絡儀表板、資料表 |
| 水庫 | 水文氣象、水庫操作、淤積調查、卡爾森優養指數 |
| 河川與生態 | 臺北河川水質、歷史底棲生物調查、歷史兩棲類調查、歷史蝴蝶調查 |
| 都市水務與防汛 | 防汛整備決策分析、抽水站、防汛外租機械據點、沉砂池、公園水域安全設施 |
| 自來水服務 | 支援台水統計、清水水質、營運關鍵指標 |

### 重要歷史資料

- **翡翠水庫淤積調查**（`reservoir_sedimentation_surveys`）：1984–2025 的定期調查結果，不是目前可用蓄水量、乾旱風險、大壩安全或壽命預測。
- **臺北市河濱生態底棲**（`4cb2cb61-1b3f-4c0f-894b-353266b8a06b`）：一次性歷史調查；本機資料範圍為 2014-05-28 至 2015-04-30。
- **臺北市河濱生態兩棲**（`a9228b5e-84fc-4781-916c-6c3e186b9f0c`）：一次性歷史調查；官方調查範圍為 2012-08-01 至 2015-05-31，不代表目前兩棲類分布。
- **臺北市河濱生態蝴蝶**（`679ae4e4-0fc2-4ac5-8db0-bab87990ada4`）：一次性歷史調查；官方調查範圍為 2012-08-01 至 2015-05-31，不代表目前蝴蝶分布或生物多樣性狀況。
- **颱風豪雨外租機械據點**（`storm_rainfall_rented_machinery_sites`）：來源記載的防汛整備地點，不是即時派遣或設備可用性追蹤器。

### 防汛整備證據查核

從「都市水務與防汛 → 防汛整備決策分析」進入，或使用 `/#preparedness`（GitHub Pages 為 `/taipei-feitsui-water-map/#preparedness`）。模組延後載入，只讀單一靜態快照；直接進入時不需先載入舊水庫／生態資料。它比較有限文件／現地查核名額下的候選清單，不預測淹水、不認證整備現況、不建議派遣。

稽核輸入為 88 筆抽水站、僅採 2026 版的 73 筆機械、67 筆沉砂池及 9 個官方易積水參考多邊形。歷史淹水 739 筆中納入 695 筆觀測，實際日期為 1991-06-19 至 2025-10-19；因期間／版本限制維持有限證據，預設嚴格模式排除，寬鬆模式才允許行政區彙整。未知設備狀態不等於故障，鄰近不代表排水服務。來源日期、排除原因、實際情境及重現方式見 [MVP 說明](docs/preparedness-decision-mvp.zh-TW.md)、[精確方法](docs/preparedness-decision-methodology.md) 與 [來源稽核](docs/preparedness-source-audit.md)。

## 資料來源與處理方式

| 資料領域 | 來源與本機處理流程 |
| --- | --- |
| 翡翠水庫水質 | `data/raw/feitsui-water/` → `convertFeitsuiWaterQuality.ts` |
| 水文氣象與水庫操作 | `data/raw/feitsui-hydromet/`、`data/raw/feitsui-operation/` → 專用轉換腳本 |
| 河川水質 | `data/raw/river-water-quality/` → `convertRiverWaterQuality.ts` |
| 抽水站與沉砂池 | 本機 CSV → TWD97-TM2 / EPSG:3826 轉 WGS84 |
| 河川生態與兩棲類 | 本機 CSV → TWD97-TM2 / EPSG:3826 轉換並驗證 WGS84 |
| 防汛外租機械 | 驗證來源提供的 WGS84 座標後才繪製 |

系統會盡可能保留來源值。缺值、`ND`、`<` 值、破折號與無法解析文字不會被默默轉為零；只有已驗證的座標才會顯示為地圖標記。

## 常用指令

安裝相依套件：

```sh
npm install
```

執行測試與 TypeScript 檢查：

```sh
npm test
```

建立正式版本：

```sh
npm run build
```

啟動開發伺服器：

```sh
npm run dev
```

轉換目前本機所有來源資料：

```sh
npm run convert:data
```

生態與整備資料的常用指令：

```sh
npm run data:fetch:river-ecology
npm run data:convert:river-ecology
npm run data:fetch:amphibian-ecology
npm run data:convert:amphibian-ecology
npm run data:fetch:butterfly-ecology
npm run data:convert:butterfly-ecology
npm run data:fetch:storm-machinery
npm run data:convert:storm-machinery
npm run data:convert:reservoir-sedimentation-surveys
npm run data:convert:preparedness
```

`npm run fetch:data` 會進行網路請求並可能覆寫原始資料；僅在確定需要更新來源資料時使用。

`npm run data:convert:preparedness` 為離線轉換，先驗證已保存來源的雜湊，再重建決策快照。`npm run data:audit:preparedness` 明確進行網路作業，只取得本模組選定五個來源；僅在有意更新來源時執行。轉換後以 `npm test` 與 `npm run build` 驗證。

## 產生的靜態資料

網站透過 `public/sw.js` 快取主要靜態資產。重要輸出包括：

- `public/data/water-quality-*.json`
- `public/data/river-water-quality-*.json`
- `public/data/river-ecology/{records,summary,sites,metadata}.json`
- `public/data/amphibian-ecology/{records,summary,sites,metadata}.json`
- `public/data/butterfly-ecology/{records,summary,sites,metadata}.json`
- `public/data/storm-rainfall-rented-machinery-sites/{records,metadata,sites}.json`
- `public/data/reservoir-sedimentation-surveys/{records,summary,conversion-report}.json`
- `public/data/preparedness-decision/{snapshot,source-health,review-areas,evidence-summary,conversion-report}.json`

## 部署

此專案可建置為靜態網站。GitHub Pages 會以 `GITHUB_PAGES=true` 建置，並保留 `/taipei-feitsui-water-map/` 基底路徑。

## 文件

- [客戶儀表板洞察](doc/customer-dashboard-insights.md)
- [English README](README.md)
- [代理與專案工作流程](AGENTS.md)
- [防汛整備決策支援 MVP](docs/preparedness-decision-mvp.zh-TW.md)
- [防汛查核方法](docs/preparedness-decision-methodology.md)
- [官方來源稽核](docs/preparedness-source-audit.md)

## 更新或新增資料集

新增或更新資料集時：

1. 將原始來源保留在 `data/raw/<module>/`。
2. 將來源解析保留在獨立轉換腳本。
3. 保守驗證日期、數量與座標。
4. 產生靜態輸出並更新 PWA 快取清單。
5. 為解析器加入回歸測試並重新執行測試與建置。
6. 同一變更中同步更新兩種 README 語言版本。
