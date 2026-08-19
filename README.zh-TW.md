# 臺北翡翠水庫與水環境地圖

[English](README.md)

這是一個以 Vite、React 與 TypeScript 建置的行動優先雙語網站，用於探索臺北市公開的水環境、河川、生態、水利設施與防汛整備資料。

瀏覽器只會讀取 `public/data` 內的本機靜態 JSON。臺北市開放資料的抓取僅在 `scripts/` 的 Node 腳本中進行；正式網站不會在執行階段呼叫臺北市開放資料 API。

## 使用範圍與限制

本網站是資料探索與公開透明工具，並非緊急應變系統、淹水警報、即時水情服務、飲用水安全判定、設備可用性清冊或工程設計工具。

使用每個模組前請先閱讀資料日期與詮釋說明。尤其歷史生態、淤積調查及防汛外租機械資料，不得描述為目前狀況。

## 資料模組

為了讓桌面與手機操作更容易，導覽採分類後的次級模組結構。

| 分類 | 模組 |
| --- | --- |
| 總覽 | 翡翠水庫水質、綜合脈絡儀表板、資料表 |
| 水庫 | 水文氣象、水庫操作、淤積調查、卡爾森優養指數 |
| 河川與生態 | 臺北河川水質、歷史底棲生物調查、歷史兩棲類調查、歷史蝴蝶調查 |
| 都市水務與防汛 | 抽水站、防汛外租機械據點、沉砂池、公園水域安全設施 |
| 自來水服務 | 支援台水統計、清水水質、營運關鍵指標 |

### 重要歷史資料

- **翡翠水庫淤積調查**（`reservoir_sedimentation_surveys`）：1984–2025 的定期調查結果，不是目前可用蓄水量、乾旱風險、大壩安全或壽命預測。
- **臺北市河濱生態底棲**（`4cb2cb61-1b3f-4c0f-894b-353266b8a06b`）：一次性歷史調查；本機資料範圍為 2014-05-28 至 2015-04-30。
- **臺北市河濱生態兩棲**（`a9228b5e-84fc-4781-916c-6c3e186b9f0c`）：一次性歷史調查；官方調查範圍為 2012-08-01 至 2015-05-31，不代表目前兩棲類分布。
- **臺北市河濱生態蝴蝶**（`679ae4e4-0fc2-4ac5-8db0-bab87990ada4`）：一次性歷史調查；官方調查範圍為 2012-08-01 至 2015-05-31，不代表目前蝴蝶分布或生物多樣性狀況。
- **颱風豪雨外租機械據點**（`storm_rainfall_rented_machinery_sites`）：來源記載的防汛整備地點，不是即時派遣或設備可用性追蹤器。

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
```

`npm run fetch:data` 會進行網路請求並可能覆寫原始資料；僅在確定需要更新來源資料時使用。

## 產生的靜態資料

網站透過 `public/sw.js` 快取主要靜態資產。重要輸出包括：

- `public/data/water-quality-*.json`
- `public/data/river-water-quality-*.json`
- `public/data/river-ecology/{records,summary,sites,metadata}.json`
- `public/data/amphibian-ecology/{records,summary,sites,metadata}.json`
- `public/data/butterfly-ecology/{records,summary,sites,metadata}.json`
- `public/data/storm-rainfall-rented-machinery-sites/{records,metadata,sites}.json`
- `public/data/reservoir-sedimentation-surveys/{records,summary,conversion-report}.json`

## 部署

此專案可建置為靜態網站。GitHub Pages 會以 `GITHUB_PAGES=true` 建置，並保留 `/taipei-feitsui-water-map/` 基底路徑。

## 文件

- [客戶儀表板洞察](doc/customer-dashboard-insights.md)
- [English README](README.md)
- [代理與專案工作流程](AGENTS.md)

## 更新或新增資料集

新增或更新資料集時：

1. 將原始來源保留在 `data/raw/<module>/`。
2. 將來源解析保留在獨立轉換腳本。
3. 保守驗證日期、數量與座標。
4. 產生靜態輸出並更新 PWA 快取清單。
5. 為解析器加入回歸測試並重新執行測試與建置。
6. 同一變更中同步更新兩種 README 語言版本。
