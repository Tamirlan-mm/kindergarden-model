import { useState, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

// ─── РЕАЛЬНЫЕ ДАННЫЕ 2025-2026 (базовые, перезаписываются импортом) ───────────
const BASE_REAL_DATA = {
  Сентябрь: { activeKids: 85, plannedRevenue: 31_137_878, actualRevenue: 32_185_054, debt: -1_047_176, penalties: 2_199_840, fot: 8_000_000, food: 2_500_000, rent: 1_200_000, utilities: 400_000, materials: 300_000, other: 500_000 },
  Октябрь:  { activeKids: 89, plannedRevenue: 24_267_642, actualRevenue: 27_006_560, debt: -2_738_918, penalties: 1_981_766, fot: 8_000_000, food: 2_500_000, rent: 1_200_000, utilities: 400_000, materials: 300_000, other: 500_000 },
  Ноябрь:   { activeKids: 92, plannedRevenue: 19_630_582, actualRevenue: 20_698_318, debt: -1_067_736, penalties:   999_090, fot: 8_000_000, food: 2_500_000, rent: 1_200_000, utilities: 400_000, materials: 300_000, other: 500_000 },
  Декабрь:  { activeKids: 91, plannedRevenue: 20_959_491, actualRevenue: 25_539_232, debt: -4_579_741, penalties:   758_878, fot: 8_000_000, food: 2_500_000, rent: 1_200_000, utilities: 400_000, materials: 300_000, other: 500_000 },
  Январь:   { activeKids: 89, plannedRevenue: 20_878_810, actualRevenue: 26_281_048, debt: -5_402_238, penalties:   568_664, fot: 8_000_000, food: 2_500_000, rent: 1_200_000, utilities: 400_000, materials: 300_000, other: 500_000 },
  Февраль:  { activeKids: 90, plannedRevenue: 17_030_581, actualRevenue: 18_531_103, debt: -1_500_522, penalties:   686_568, fot: 8_000_000, food: 2_500_000, rent: 1_200_000, utilities: 400_000, materials: 300_000, other: 500_000 },
  Март:     { activeKids: 90, plannedRevenue: 20_661_040, actualRevenue: 20_381_814, debt:    279_226, penalties: 1_184_960, fot: 8_000_000, food: 2_500_000, rent: 1_200_000, utilities: 400_000, materials: 300_000, other: 500_000 },
};

const MONTHS_REAL     = ["Сентябрь","Октябрь","Ноябрь","Декабрь","Январь","Февраль","Март"];
const MONTHS_FORECAST = ["Апрель","Май","Июнь","Июль","Август"];
const MONTHS_NEXT_YEAR = ["Сентябрь","Октябрь","Ноябрь","Декабрь","Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август"];
const SEASONAL = [1.00,0.92,0.88,0.94,0.95,0.85,0.93,0.98,0.92,0.88,0.82,0.80];

const GROUPS = [
  { name: "Айголек 2+",    kids: 13, capacity: 15 },
  { name: "Я-сам! 3+",     kids: 16, capacity: 20 },
  { name: "Мұрагерлер 4+", kids: 15, capacity: 20 },
  { name: "Почемучки 4+",  kids: 11, capacity: 20 },
  { name: "Умники 5+",     kids: 25, capacity: 25 },
];

const GOSORDER_RATE    = 42_000;
const KIDS_ON_GOSORDER = 80;

const fmt  = n => new Intl.NumberFormat("ru-KZ").format(Math.round(n));
const fmtM = n => Math.abs(n) >= 1_000_000 ? (n/1_000_000).toFixed(1)+" млн" : fmt(n);
const num  = s => parseFloat(String(s).replace(/\s/g,"").replace(",",".")) || 0;

const COST_LABELS = { fot:"ФОТ (с налогами)", food:"Питание детей", rent:"Аренда", utilities:"Коммунальные", materials:"Материалы", other:"Прочие расходы" };
const COST_LIMITS = { fot:[3_000_000,15_000_000], food:[500_000,6_000_000], rent:[0,5_000_000], utilities:[100_000,3_000_000], materials:[0,1_000_000], other:[0,2_000_000] };

// ─── СЦЕНАРИИ СЛЕД. ГОДА ──────────────────────────────────────────────────────
const SCENARIOS = {
  pessimistic: {
    label:"Пессимистичный", emoji:"🔴", color:"#ef4444", bg:"#fef2f2",
    monthlyFee: 260_000, kids: 82, gosKids: 70, gosEnabled: true,
    fot: 9_500_000, food: 3_000_000, rent: 1_200_000, utilities: 700_000, materials: 400_000, other: 800_000,
    penaltyRate: 1, paymentRate: 0.70, avgLateDays: 7,
    description: "Потеря части детей, рост расходов, низкая собираемость оплат"
  },
  base: {
    label:"Стандартный", emoji:"🟡", color:"#f59e0b", bg:"#fffbeb",
    monthlyFee: 280_000, kids: 95, gosKids: 80, gosEnabled: true,
    fot: 9_000_000, food: 2_800_000, rent: 1_200_000, utilities: 500_000, materials: 350_000, other: 600_000,
    penaltyRate: 1, paymentRate: 0.85, avgLateDays: 5,
    description: "Умеренный рост числа детей и ставок, стабильные расходы"
  },
  optimistic: {
    label:"Оптимистичный", emoji:"🟢", color:"#10b981", bg:"#f0fdf4",
    monthlyFee: 300_000, kids: 108, gosKids: 85, gosEnabled: true,
    fot: 9_000_000, food: 2_800_000, rent: 1_200_000, utilities: 500_000, materials: 350_000, other: 500_000,
    penaltyRate: 1, paymentRate: 0.95, avgLateDays: 3,
    description: "Полная загрузка групп, повышение ставки, высокая дисциплина оплат"
  },
};

// ─── CSV ПАРСЕР ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const headers = lines[0].split(";").map(h => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(";");
    const row = {};
    headers.forEach((h, j) => row[h] = (vals[j]||"").trim());
    rows.push(row);
  }
  return { headers, rows };
}

function importRevenue(rows) {
  // Формат: месяц;активных_детей;плановый_доход;фактический_доход;долг;пени
  const updated = { ...BASE_REAL_DATA };
  const errors = [];
  rows.forEach(r => {
    const month = r["месяц"] || r["month"];
    if (!month || !updated[month]) { errors.push(`Неизвестный месяц: "${month}"`); return; }
    if (r["активных_детей"])   updated[month] = { ...updated[month], activeKids: num(r["активных_детей"]) };
    if (r["плановый_доход"])   updated[month] = { ...updated[month], plannedRevenue: num(r["плановый_доход"]) };
    if (r["фактический_доход"]) updated[month] = { ...updated[month], actualRevenue: num(r["фактический_доход"]) };
    if (r["долг"])             updated[month] = { ...updated[month], debt: num(r["долг"]) };
    if (r["пени"])             updated[month] = { ...updated[month], penalties: num(r["пени"]) };
  });
  return { data: updated, errors };
}

function importExpenses(rows) {
  const updated = { ...BASE_REAL_DATA };
  const errors = [];
  rows.forEach(r => {
    const month = r["месяц"] || r["month"];
    if (!month || !updated[month]) { errors.push(`Неизвестный месяц: "${month}"`); return; }
    const patch = {};
    if (r["фот"])          patch.fot       = num(r["фот"]);
    if (r["питание"])      patch.food      = num(r["питание"]);
    if (r["аренда"])       patch.rent      = num(r["аренда"]);
    if (r["коммунальные"]) patch.utilities = num(r["коммунальные"]);
    if (r["материалы"])    patch.materials = num(r["материалы"]);
    if (r["прочее"])       patch.other     = num(r["прочее"]);
    updated[month] = { ...updated[month], ...patch };
  });
  return { data: updated, errors };
}

// ════════════════════════════════════════════════════════════════════════════════
export default function KindergartenFinModel() {
  const [tab, setTab] = useState("overview");
  const [realData, setRealData] = useState(BASE_REAL_DATA);
  const [importLog, setImportLog] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState("revenue");

  // Текущий год
  const [forecastKids, setForecastKids]     = useState(90);
  const [monthlyFee, setMonthlyFee]         = useState(250_000);
  const [gosorderEnabled, setGosorderEnabled] = useState(true);
  const [penaltyRate, setPenaltyRate]       = useState(1);
  const [avgLatedays, setAvgLatedays]       = useState(5);

  // Расходы (текущий год)
  const [costs, setCosts] = useState({ fot:8_000_000, food:2_500_000, rent:1_200_000, utilities:400_000, materials:300_000, other:500_000 });

  // Следующий год — сценарии
  const [activeScenario, setActiveScenario] = useState("base");
  const [scenarios, setScenarios] = useState({ ...SCENARIOS });
  const sc = scenarios[activeScenario];
  const setSc = (k, v) => setScenarios(p => ({ ...p, [activeScenario]: { ...p[activeScenario], [k]: v } }));

  const totalCosts = Object.values(costs).reduce((a,b)=>a+b,0);

  // ── Расчёт реальных данных ────────────────────────────────────────────────
  const realMonthlyData = MONTHS_REAL.map(m => {
    const d = realData[m];
    const gosSubsidy = gosorderEnabled ? KIDS_ON_GOSORDER * GOSORDER_RATE : 0;
    const monthCosts = (d.fot||0)+(d.food||0)+(d.rent||0)+(d.utilities||0)+(d.materials||0)+(d.other||0);
    const usedCosts = monthCosts > 0 ? monthCosts : totalCosts;
    const totalRev = d.actualRevenue + gosSubsidy;
    return { month:m, planned:d.plannedRevenue, actual:d.actualRevenue, gosSubsidy, totalRevenue:totalRev, costs:usedCosts, profit:totalRev-usedCosts, penalties:d.penalties, kids:d.activeKids, debt:Math.abs(d.debt), isReal:true };
  });

  const forecastData = MONTHS_FORECAST.map(m => {
    const baseRev = forecastKids * monthlyFee;
    const penaltiesEst = baseRev * (penaltyRate/100) * avgLatedays * 0.3;
    const gosSubsidy = gosorderEnabled ? KIDS_ON_GOSORDER * GOSORDER_RATE : 0;
    const totalRev = baseRev + penaltiesEst + gosSubsidy;
    return { month:m, planned:baseRev, actual:null, gosSubsidy, totalRevenue:totalRev, costs:totalCosts, profit:totalRev-totalCosts, penalties:penaltiesEst, kids:forecastKids, debt:0, isReal:false };
  });

  const allData = [...realMonthlyData, ...forecastData];

  const totalRealRevenue   = realMonthlyData.reduce((s,d)=>s+d.actual,0);
  const totalRealGos       = realMonthlyData.reduce((s,d)=>s+d.gosSubsidy,0);
  const totalRealCosts     = realMonthlyData.reduce((s,d)=>s+d.costs,0);
  const totalRealProfit    = realMonthlyData.reduce((s,d)=>s+d.profit,0);
  const totalRealPenalties = realMonthlyData.reduce((s,d)=>s+d.penalties,0);
  const totalForecastRev   = forecastData.reduce((s,d)=>s+d.totalRevenue,0);
  const annualRevenue      = totalRealRevenue + totalRealGos + totalForecastRev;
  const annualCosts        = totalRealCosts + totalCosts*MONTHS_FORECAST.length;
  const annualProfit       = annualRevenue - annualCosts;

  const gosSubs         = gosorderEnabled ? KIDS_ON_GOSORDER * GOSORDER_RATE : 0;
  const breakevenNoGos  = Math.ceil(totalCosts / monthlyFee);
  const breakevenWithGos = Math.ceil(Math.max(0, totalCosts - gosSubs) / monthlyFee);
  const breakeven       = gosorderEnabled ? breakevenWithGos : breakevenNoGos;

  // ── Расчёт сценариев следующего года ─────────────────────────────────────
  function calcScenario(s) {
    const nyTotalCosts = s.fot+s.food+s.rent+s.utilities+s.materials+s.other;
    const nyGosSubsidy = s.gosEnabled ? s.gosKids * GOSORDER_RATE : 0;
    const nyBreakeven  = s.gosEnabled
      ? Math.ceil(Math.max(0, nyTotalCosts-nyGosSubsidy)/s.monthlyFee)
      : Math.ceil(nyTotalCosts/s.monthlyFee);
    const months = MONTHS_NEXT_YEAR.map((m,i) => {
      const baseKids = Math.round(s.kids * SEASONAL[i]);
      const baseRev  = baseKids * s.monthlyFee;
      const penalties = baseRev * (s.penaltyRate/100) * s.avgLateDays * (1-s.paymentRate);
      const totalRev  = baseRev + penalties + nyGosSubsidy;
      return { month:m, kids:baseKids, rawRevenue:totalRev, rawCosts:nyTotalCosts, rawProfit:totalRev-nyTotalCosts };
    });
    const annRev    = months.reduce((s,d)=>s+d.rawRevenue,0);
    const annCosts  = nyTotalCosts*12;
    const annProfit = annRev-annCosts;
    return { nyTotalCosts, nyGosSubsidy, nyBreakeven, months, annRev, annCosts, annProfit };
  }

  const scenarioResults = {
    pessimistic: calcScenario(scenarios.pessimistic),
    base:        calcScenario(scenarios.base),
    optimistic:  calcScenario(scenarios.optimistic),
  };
  const scResult = scenarioResults[activeScenario];

  // ── Импорт CSV ────────────────────────────────────────────────────────────
  const handleFile = useCallback((file, type) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      const parsed = parseCSV(text);
      if (!parsed) { setImportLog([{ type:"error", msg:"Не удалось прочитать файл. Проверьте формат." }]); return; }
      const log = [];
      let result;
      if (type === "revenue") {
        result = importRevenue(parsed.rows);
        log.push({ type:"success", msg:`✅ Импорт доходов: обновлено ${parsed.rows.length} строк` });
      } else {
        result = importExpenses(parsed.rows);
        log.push({ type:"success", msg:`✅ Импорт расходов: обновлено ${parsed.rows.length} строк` });
      }
      result.errors.forEach(e => log.push({ type:"error", msg:`⚠️ ${e}` }));
      setRealData(result.data);
      setImportLog(log);
    };
    reader.readAsText(file, "utf-8");
  }, []);

  // ── UI helpers ────────────────────────────────────────────────────────────
  const KPI = ({ label, value, sub, color="#6366f1" }) => (
    <div style={{ background:"#fff", borderRadius:12, padding:"14px 18px", boxShadow:"0 1px 4px rgba(0,0,0,0.08)", borderLeft:`4px solid ${color}` }}>
      <div style={{ fontSize:11, color:"#6b7280", marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:700, color:"#111827", lineHeight:1.2 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:"#9ca3af", marginTop:3 }}>{sub}</div>}
    </div>
  );

  const Tab = ({ id, label }) => (
    <button onClick={()=>setTab(id)} style={{ padding:"7px 14px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontWeight:500, background:tab===id?"#6366f1":"#f3f4f6", color:tab===id?"#fff":"#374151", whiteSpace:"nowrap" }}>{label}</button>
  );

  const Slider = ({ label, val, min, max, step=100_000, onChange, color="#6366f1", suffix=" тг" }) => (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
      <div style={{ minWidth:148, fontSize:12, color:"#374151" }}>{label}</div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={e=>onChange(+e.target.value)} style={{ flex:1, accentColor:color }} />
      <div style={{ minWidth:108, textAlign:"right", fontWeight:600, fontSize:12, color }}>{fmt(val)}{suffix}</div>
    </div>
  );

  const CostSlider = ({ k }) => (
    <Slider label={COST_LABELS[k]} val={costs[k]} min={COST_LIMITS[k][0]} max={COST_LIMITS[k][1]}
      onChange={v=>setCosts(p=>({...p,[k]:v}))} />
  );

  const ScSlider = ({ label, field, min, max, step=50_000, color, suffix=" тг" }) => (
    <Slider label={label} val={sc[field]} min={min} max={max} step={step} onChange={v=>setSc(field,v)} color={color||sc.color} suffix={suffix} />
  );

  // ── Сравнительный chart ───────────────────────────────────────────────────
  const comparisonData = MONTHS_NEXT_YEAR.map((m,i) => ({
    name: m.slice(0,3),
    "Оптим.": Math.round(scenarioResults.optimistic.months[i].rawProfit/1000),
    "Стандарт": Math.round(scenarioResults.base.months[i].rawProfit/1000),
    "Пессим.": Math.round(scenarioResults.pessimistic.months[i].rawProfit/1000),
  }));

  // ── Шаблоны CSV ──────────────────────────────────────────────────────────
  const TEMPLATE_REVENUE = `месяц;активных_детей;плановый_доход;фактический_доход;долг;пени
Сентябрь;85;31137878;32185054;-1047176;2199840
Октябрь;89;24267642;27006560;-2738918;1981766
Ноябрь;92;19630582;20698318;-1067736;999090
Декабрь;91;20959491;25539232;-4579741;758878
Январь;89;20878810;26281048;-5402238;568664
Февраль;90;17030581;18531103;-1500522;686568
Март;90;20661040;20381814;279226;1184960`;

  const TEMPLATE_EXPENSES = `месяц;фот;питание;аренда;коммунальные;материалы;прочее
Сентябрь;8000000;2500000;1200000;400000;300000;500000
Октябрь;8000000;2500000;1200000;400000;300000;500000
Ноябрь;8000000;2500000;1200000;400000;300000;500000
Декабрь;8000000;2500000;1200000;400000;300000;500000
Январь;8000000;2500000;1200000;400000;300000;500000
Февраль;8000000;2500000;1200000;400000;300000;500000
Март;8000000;2500000;1200000;400000;300000;500000`;

  const downloadTemplate = (content, filename) => {
    const bom = "\uFEFF";
    const blob = new Blob([bom+content], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=filename; a.click();
    URL.revokeObjectURL(url);
  };

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily:"'Inter',sans-serif", background:"#f8fafc", minHeight:"100vh", padding:20 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
        <div>
          <h1 style={{ fontSize:19, fontWeight:800, color:"#111827", margin:0 }}>🏫 Детский сад Тамирлан · Финансовая модель</h1>
          <p style={{ color:"#6b7280", marginTop:2, fontSize:11 }}>Факт: Сент–Март 2025-26 · Прогноз: Апр–Авг 2026 · + Сценарии 2026-27</p>
        </div>
        <button onClick={()=>setShowImport(p=>!p)} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:9, border:"2px solid #6366f1", background: showImport?"#6366f1":"#fff", color:showImport?"#fff":"#6366f1", cursor:"pointer", fontWeight:600, fontSize:13 }}>
          📂 Импорт данных {showImport?"▲":"▼"}
        </button>
      </div>

      {/* ── Импорт панель ──────────────────────────────────────────────────── */}
      {showImport && (
        <div style={{ background:"#fff", borderRadius:14, padding:20, boxShadow:"0 2px 12px rgba(99,102,241,0.15)", marginBottom:16, border:"1px solid #e0e7ff" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
            <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:"#3730a3" }}>📂 Импорт данных из CSV</h3>
            <button onClick={()=>setShowImport(false)} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"#9ca3af" }}>✕</button>
          </div>

          {/* Переключатель типа */}
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            {[["revenue","💰 Доходы"],["expenses","💸 Расходы"]].map(([id,lbl])=>(
              <button key={id} onClick={()=>setImportTab(id)} style={{ padding:"6px 14px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontWeight:500, background:importTab===id?"#6366f1":"#f3f4f6", color:importTab===id?"#fff":"#374151" }}>{lbl}</button>
            ))}
          </div>

          {/* Формат */}
          <div style={{ background:"#f0f9ff", borderRadius:10, padding:14, marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#0369a1", marginBottom:6 }}>
              Формат файла ({importTab==="revenue"?"доходы":"расходы"}):
            </div>
            <pre style={{ margin:0, fontSize:11, color:"#0c4a6e", fontFamily:"monospace", overflowX:"auto" }}>
              {importTab==="revenue"
                ? "месяц;активных_детей;плановый_доход;фактический_доход;долг;пени"
                : "месяц;фот;питание;аренда;коммунальные;материалы;прочее"}
            </pre>
            <div style={{ marginTop:8, fontSize:11, color:"#0369a1" }}>
              • Разделитель: точка с запятой (;)<br/>
              • Кодировка: UTF-8<br/>
              • Месяц на русском: Сентябрь, Октябрь, Ноябрь, Декабрь, Январь, Февраль, Март<br/>
              • Числа без пробелов и знаков валюты (пример: 8000000)
            </div>
          </div>

          {/* Кнопки скачать шаблон + загрузить */}
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <button onClick={()=>downloadTemplate(importTab==="revenue"?TEMPLATE_REVENUE:TEMPLATE_EXPENSES, importTab==="revenue"?"шаблон_доходы.csv":"шаблон_расходы.csv")}
              style={{ padding:"7px 14px", borderRadius:8, border:"1px solid #d1d5db", background:"#fff", cursor:"pointer", fontSize:12, fontWeight:500, color:"#374151" }}>
              ⬇️ Скачать шаблон CSV
            </button>
            <label style={{ padding:"7px 16px", borderRadius:8, border:"none", background:"#6366f1", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:600 }}>
              📂 Загрузить файл
              <input type="file" accept=".csv,.txt" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0], importTab)} />
            </label>
            {importLog.length > 0 && (
              <button onClick={()=>{ setRealData(BASE_REAL_DATA); setImportLog([{type:"info",msg:"♻️ Данные сброшены к базовым"}]); }}
                style={{ padding:"7px 14px", borderRadius:8, border:"1px solid #fca5a5", background:"#fef2f2", cursor:"pointer", fontSize:12, color:"#dc2626" }}>
                ♻️ Сбросить данные
              </button>
            )}
          </div>

          {/* Лог */}
          {importLog.length > 0 && (
            <div style={{ marginTop:12 }}>
              {importLog.map((l,i)=>(
                <div key={i} style={{ fontSize:12, padding:"5px 10px", borderRadius:6, marginBottom:4,
                  background:l.type==="success"?"#f0fdf4":l.type==="error"?"#fef2f2":"#f0f9ff",
                  color:l.type==="success"?"#15803d":l.type==="error"?"#dc2626":"#0369a1" }}>
                  {l.msg}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        <Tab id="overview" label="📊 Обзор" />
        <Tab id="monthly"  label="📅 По месяцам" />
        <Tab id="costs"    label="💸 Расходы" />
        <Tab id="groups"   label="👶 Группы" />
        <Tab id="gosorder" label="🏛️ Госзаказ" />
        <Tab id="nextyear" label="🔮 След. год 2026–2027" />
      </div>

      {/* ════════════ OVERVIEW ════════════════════════════════════════════════ */}
      {tab==="overview" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
            <KPI label="Доход факт (7 мес.)"   value={`${fmtM(totalRealRevenue+totalRealGos)} тг`} sub={`госсубсидия: ${fmtM(totalRealGos)} тг`}   color="#6366f1" />
            <KPI label="Расходы (7 мес.)"      value={`${fmtM(totalRealCosts)} тг`}   sub="из данных по месяцам"               color="#f87171" />
            <KPI label="Прибыль (7 мес.)"      value={`${fmtM(totalRealProfit)} тг`}  sub={totalRealProfit>0?"✅ В плюсе":"⚠️ Убыток"} color={totalRealProfit>0?"#34d399":"#f87171"} />
            <KPI label="Пени (7 мес.)"         value={`${fmtM(totalRealPenalties)} тг`} sub="1%/день за просрочку"             color="#fb923c" />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
            <KPI label="Прогноз дохода (год)"  value={`${fmtM(annualRevenue)} тг`}    sub="факт + прогноз апр-авг"             color="#8b5cf6" />
            <KPI label="Прогноз расходов (год)" value={`${fmtM(annualCosts)} тг`}                                              color="#ef4444" />
            <KPI label="Прогноз прибыли (год)" value={`${fmtM(annualProfit)} тг`}     sub={annualProfit>0?"✅ Год в плюсе":"⚠️ Убыток"} color={annualProfit>0?"#34d399":"#f87171"} />
            <KPI label="Детей (март 2026)"     value="90 детей"                        sub="80 на госзаказе"                    color="#0ea5e9" />
          </div>
          <div style={{ background:"#fff", borderRadius:14, padding:18, boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:700 }}>Доходы / Расходы / Прибыль (тыс. тг)</h3>
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={allData.map(d=>({ name:d.month.slice(0,3), "Доходы (факт)":d.actual?Math.round((d.actual+d.gosSubsidy)/1000):null, "Доходы (прогноз)":!d.isReal?Math.round(d.totalRevenue/1000):null, "Расходы":Math.round(d.costs/1000), "Прибыль":Math.round(d.profit/1000) }))} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize:11 }} />
                <YAxis tick={{ fontSize:10 }} tickFormatter={v=>`${v}K`} />
                <Tooltip formatter={(v,n)=>[`${fmt(v)} тыс.`,n]} />
                <Legend />
                <ReferenceLine y={0} stroke="#374151" />
                <Bar dataKey="Доходы (факт)"    fill="#6366f1" radius={[4,4,0,0]} />
                <Bar dataKey="Доходы (прогноз)" fill="#a5b4fc" radius={[4,4,0,0]} />
                <Bar dataKey="Расходы"          fill="#fca5a5" radius={[4,4,0,0]} />
                <Bar dataKey="Прибыль"          fill="#34d399" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ════════════ MONTHLY ════════════════════════════════════════════════ */}
      {tab==="monthly" && (
        <div>
          <div style={{ background:"#fff", borderRadius:14, padding:18, boxShadow:"0 1px 4px rgba(0,0,0,0.08)", marginBottom:14 }}>
            <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:700 }}>Детализация по месяцам</h3>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    {["Месяц","Детей","Плановый доход","Факт. доход","Госсубсидия","Расходы","Прибыль","Пени","Долги"].map(h=>(
                      <th key={h} style={{ padding:"8px 10px", textAlign:"right", fontWeight:600, color:"#374151", borderBottom:"2px solid #e5e7eb", whiteSpace:"nowrap", fontSize:11 }}>
                        {h==="Месяц"||h==="Детей"?<span style={{display:"block",textAlign:"left"}}>{h}</span>:h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allData.map((d,i)=>(
                    <tr key={d.month} style={{ background:d.isReal?(i%2===0?"#fff":"#fafafa"):"#faf5ff", borderBottom:"1px solid #f3f4f6" }}>
                      <td style={{ padding:"8px 10px", fontWeight:600, whiteSpace:"nowrap" }}>
                        {d.month} {!d.isReal&&<span style={{fontSize:9,color:"#8b5cf6",background:"#ede9fe",padding:"1px 5px",borderRadius:10}}>прогноз</span>}
                      </td>
                      <td style={{ padding:"8px 10px", textAlign:"right" }}>{d.kids}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"#9ca3af" }}>{fmt(d.planned)}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:600, color:d.isReal?"#111827":"#8b5cf6" }}>{d.actual!==null?fmt(d.actual):fmt(d.planned)}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"#16a34a" }}>{fmt(d.gosSubsidy)}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"#dc2626" }}>{fmt(d.costs)}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:700, color:d.profit>=0?"#16a34a":"#dc2626" }}>{d.profit>=0?"+":""}{fmt(d.profit)}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"#d97706" }}>{fmt(d.penalties)}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:"#dc2626" }}>{d.isReal?fmt(d.debt):"—"}</td>
                    </tr>
                  ))}
                  <tr style={{ background:"#eff6ff", borderTop:"2px solid #6366f1", fontWeight:700 }}>
                    <td style={{ padding:"10px", color:"#1e40af" }}>ИТОГО ГОД</td>
                    <td style={{ padding:"10px", textAlign:"right" }}>~90</td>
                    <td style={{ padding:"10px", textAlign:"right" }}>—</td>
                    <td style={{ padding:"10px", textAlign:"right", color:"#6366f1" }}>{fmt(annualRevenue)}</td>
                    <td style={{ padding:"10px", textAlign:"right", color:"#16a34a" }}>{fmt(gosorderEnabled?KIDS_ON_GOSORDER*GOSORDER_RATE*12:0)}</td>
                    <td style={{ padding:"10px", textAlign:"right", color:"#dc2626" }}>{fmt(annualCosts)}</td>
                    <td style={{ padding:"10px", textAlign:"right", color:annualProfit>=0?"#16a34a":"#dc2626" }}>{annualProfit>=0?"+":""}{fmt(annualProfit)}</td>
                    <td style={{ padding:"10px", textAlign:"right" }}>{fmt(totalRealPenalties)}</td>
                    <td style={{ padding:"10px", textAlign:"right" }}>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ background:"#fff", borderRadius:14, padding:18, boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:700, color:"#8b5cf6" }}>⚙️ Параметры прогноза Апрель–Август</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
                  <div style={{ minWidth:148, fontSize:12 }}>Детей (прогноз)</div>
                  <input type="range" min={70} max={110} step={1} value={forecastKids} onChange={e=>setForecastKids(+e.target.value)} style={{ flex:1, accentColor:"#8b5cf6" }} />
                  <div style={{ minWidth:36, fontWeight:700, color:"#8b5cf6", fontSize:13 }}>{forecastKids}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ minWidth:148, fontSize:12 }}>Ежемесячная плата</div>
                  <input type="range" min={200_000} max={350_000} step={5_000} value={monthlyFee} onChange={e=>setMonthlyFee(+e.target.value)} style={{ flex:1, accentColor:"#8b5cf6" }} />
                  <div style={{ minWidth:90, fontWeight:700, color:"#8b5cf6", fontSize:11, textAlign:"right" }}>{fmt(monthlyFee)} тг</div>
                </div>
              </div>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
                  <div style={{ minWidth:148, fontSize:12 }}>Ставка пени (%/день)</div>
                  <input type="range" min={0.5} max={2} step={0.1} value={penaltyRate} onChange={e=>setPenaltyRate(+e.target.value)} style={{ flex:1, accentColor:"#fb923c" }} />
                  <div style={{ minWidth:36, fontWeight:700, color:"#fb923c", fontSize:13 }}>{penaltyRate}%</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ minWidth:148, fontSize:12 }}>Ср. дней просрочки</div>
                  <input type="range" min={1} max={15} step={1} value={avgLatedays} onChange={e=>setAvgLatedays(+e.target.value)} style={{ flex:1, accentColor:"#fb923c" }} />
                  <div style={{ minWidth:36, fontWeight:700, color:"#fb923c", fontSize:13 }}>{avgLatedays}д</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ COSTS ════════════════════════════════════════════════ */}
      {tab==="costs" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <div style={{ background:"#fff", borderRadius:14, padding:18, boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ margin:0, fontSize:14, fontWeight:700 }}>📝 Расходы (прогноз)</h3>
              <button onClick={()=>setGosorderEnabled(p=>!p)} style={{ padding:"4px 10px", borderRadius:6, border:"none", cursor:"pointer", fontWeight:600, fontSize:11, background:gosorderEnabled?"#34d399":"#e5e7eb", color:gosorderEnabled?"#fff":"#374151" }}>
                {gosorderEnabled?"✅ Госзаказ вкл":"❌ Без госзаказа"}
              </button>
            </div>
            <CostSlider k="fot" /><CostSlider k="food" /><CostSlider k="rent" /><CostSlider k="utilities" /><CostSlider k="materials" /><CostSlider k="other" />
            <div style={{ borderTop:"2px solid #e5e7eb", marginTop:12, paddingTop:12, display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:13, fontWeight:700 }}>Итого/мес.</span>
              <span style={{ fontSize:18, fontWeight:800, color:"#dc2626" }}>{fmt(totalCosts)} тг</span>
            </div>
            <div style={{ marginTop:14, background:"#fef9c3", borderRadius:10, padding:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#854d0e", marginBottom:8 }}>📊 Точка безубыточности</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div style={{ background:"#fef3c7", borderRadius:8, padding:10, textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#78350f", marginBottom:3 }}>Без госзаказа</div>
                  <div style={{ fontSize:22, fontWeight:800, color:"#b45309" }}>{breakevenNoGos}</div>
                  <div style={{ fontSize:10, color:"#78350f" }}>детей</div>
                </div>
                <div style={{ background:gosorderEnabled?"#dcfce7":"#f3f4f6", borderRadius:8, padding:10, textAlign:"center", border:gosorderEnabled?"2px solid #86efac":"2px dashed #e5e7eb" }}>
                  <div style={{ fontSize:10, color:gosorderEnabled?"#14532d":"#6b7280", marginBottom:3 }}>С госзаказом {gosorderEnabled?"✅":"(выкл)"}</div>
                  <div style={{ fontSize:22, fontWeight:800, color:gosorderEnabled?"#16a34a":"#9ca3af" }}>{breakevenWithGos}</div>
                  <div style={{ fontSize:10, color:gosorderEnabled?"#14532d":"#9ca3af" }}>детей</div>
                </div>
              </div>
              <div style={{ marginTop:8, fontSize:11, color:forecastKids>=breakeven?"#16a34a":"#dc2626", fontWeight:600 }}>
                {forecastKids>=breakeven?`✅ ${forecastKids} дет. ≥ ${breakeven} — прибыльно`:`⚠️ ${forecastKids} дет. < ${breakeven} — убыток`}
              </div>
            </div>
          </div>
          <div style={{ background:"#fff", borderRadius:14, padding:18, boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:700 }}>Структура расходов (тыс. тг/мес.)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={Object.entries(costs).map(([k,v])=>({ name:COST_LABELS[k], value:Math.round(v/1000) }))} layout="vertical" margin={{ left:10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize:10 }} tickFormatter={v=>`${v}K`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize:11 }} width={120} />
                <Tooltip formatter={v=>[`${fmt(v)} тыс. тг`]} />
                <Bar dataKey="value" fill="#6366f1" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ marginTop:14, background:"#f0f9ff", borderRadius:10, padding:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#0369a1", marginBottom:6 }}>💡 Рентабельность</div>
              {(()=>{
                const rev = forecastKids*monthlyFee+gosSubs;
                const margin = rev>0?((rev-totalCosts)/rev*100).toFixed(1):0;
                return (<div style={{ fontSize:12, color:"#0c4a6e" }}>
                  <div>Доход/мес: <strong>{fmt(rev)} тг</strong></div>
                  <div>Расходы/мес: <strong>{fmt(totalCosts)} тг</strong></div>
                  <div>Прибыль/мес: <strong style={{color:rev>totalCosts?"#16a34a":"#dc2626"}}>{fmt(rev-totalCosts)} тг</strong></div>
                  <div>Маржа: <strong style={{color:+margin>0?"#16a34a":"#dc2626"}}>{margin}%</strong></div>
                </div>);
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ════════════ GROUPS ════════════════════════════════════════════════ */}
      {tab==="groups" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
          {GROUPS.map(g=>{
            const occ=Math.round(g.kids/g.capacity*100);
            return (
              <div key={g.name} style={{ background:"#fff", borderRadius:14, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>👶 {g.name}</div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, fontSize:12 }}>
                  <span style={{ color:"#6b7280" }}>Детей:</span><span style={{ fontWeight:700 }}>{g.kids}/{g.capacity}</span>
                </div>
                <div style={{ background:"#f3f4f6", borderRadius:6, height:8, marginBottom:6 }}>
                  <div style={{ background:occ>=90?"#34d399":occ>=70?"#fbbf24":"#f87171", height:"100%", borderRadius:6, width:`${occ}%` }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                  <span style={{ color:"#6b7280" }}>{occ}%</span>
                  <span style={{ fontWeight:600, color:"#6366f1" }}>{fmt(g.kids*monthlyFee)} тг/мес</span>
                </div>
                {g.capacity-g.kids>0&&<div style={{ marginTop:5, fontSize:10, color:"#f59e0b" }}>⚡ {g.capacity-g.kids} мест свободно</div>}
              </div>
            );
          })}
          <div style={{ background:"#f0fdf4", borderRadius:14, padding:16, border:"2px dashed #86efac" }}>
            <div style={{ fontWeight:700, fontSize:13, color:"#16a34a", marginBottom:10 }}>📈 Итого</div>
            {[["Всего детей",`${GROUPS.reduce((s,g)=>s+g.kids,0)} / ${GROUPS.reduce((s,g)=>s+g.capacity,0)}`],["Свободно мест",GROUPS.reduce((s,g)=>s+(g.capacity-g.kids),0)],["Доход/мес",`${fmt(GROUPS.reduce((s,g)=>s+g.kids,0)*monthlyFee)} тг`],["Потенциал",`+${fmt(GROUPS.reduce((s,g)=>s+(g.capacity-g.kids),0)*monthlyFee)} тг`]].map(([l,v])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", marginBottom:5, fontSize:12 }}>
                <span style={{ color:"#6b7280" }}>{l}</span><span style={{ fontWeight:700 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════ GOSORDER ════════════════════════════════════════════ */}
      {tab==="gosorder" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <div style={{ background:"#fff", borderRadius:14, padding:18, boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700 }}>🏛️ Государственный заказ</h3>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, padding:12, background:"#f0fdf4", borderRadius:10 }}>
              <div><div style={{ fontWeight:600, fontSize:13 }}>Статус госзаказа</div><div style={{ fontSize:11, color:"#6b7280" }}>Влияет на расчёты и точку б/у</div></div>
              <button onClick={()=>setGosorderEnabled(p=>!p)} style={{ padding:"6px 14px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:600, fontSize:12, background:gosorderEnabled?"#34d399":"#e5e7eb", color:gosorderEnabled?"#fff":"#374151" }}>
                {gosorderEnabled?"✅ Включён":"❌ Выключен"}
              </button>
            </div>
            {[["Детей на госзаказе",`${KIDS_ON_GOSORDER} из 90`],["Ставка субсидии",`${fmt(GOSORDER_RATE)} тг/ребёнок/мес`],["Субсидия в месяц",`${fmt(KIDS_ON_GOSORDER*GOSORDER_RATE)} тг`],["Субсидия в год",`${fmt(KIDS_ON_GOSORDER*GOSORDER_RATE*12)} тг`],["Льготники",`2 ребёнка (многодетные)`]].map(([l,v])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #f3f4f6", fontSize:13 }}>
                <span style={{ color:"#6b7280" }}>{l}</span><span style={{ fontWeight:600 }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop:14, background:"#fef9c3", borderRadius:10, padding:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#92400e", marginBottom:6 }}>Влияние на точку безубыточности</div>
              <div style={{ fontSize:12, color:"#78350f" }}>Без госзаказа: <strong>{breakevenNoGos}</strong> детей<br/>С госзаказом: <strong style={{color:"#16a34a"}}>{breakevenWithGos}</strong> детей<br/>Экономия: <strong>{breakevenNoGos-breakevenWithGos}</strong> детей</div>
            </div>
          </div>
          <div style={{ background:"#fff", borderRadius:14, padding:18, boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700 }}>⚠️ Пени и долги по месяцам</h3>
            <div style={{ background:"#fff7ed", borderRadius:10, padding:12, marginBottom:12 }}>
              <div style={{ fontSize:12, color:"#92400e", fontWeight:600, marginBottom:3 }}>Условия договора</div>
              <div style={{ fontSize:11, color:"#78350f" }}>• Срок оплаты: до 5-го числа каждого месяца<br/>• Пени: 1%/день за просрочку<br/>• Лимит: 10 дней = 10% от суммы</div>
            </div>
            {MONTHS_REAL.map(m=>(
              <div key={m} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #f9fafb", fontSize:12 }}>
                <span style={{ color:"#6b7280", minWidth:80 }}>{m}</span>
                <div style={{ display:"flex", gap:14 }}>
                  <span style={{ color:"#dc2626" }}>долг: {fmt(Math.abs(realData[m].debt))}</span>
                  <span style={{ color:"#d97706", fontWeight:600 }}>пени: {fmt(realData[m].penalties)}</span>
                </div>
              </div>
            ))}
            <div style={{ borderTop:"2px solid #fb923c", marginTop:8, paddingTop:8, display:"flex", justifyContent:"space-between", fontWeight:700, fontSize:13 }}>
              <span>ИТОГО пени (7 мес.)</span><span style={{ color:"#d97706" }}>{fmt(totalRealPenalties)} тг</span>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ NEXT YEAR — 3 SCENARIOS ════════════════════════════════ */}
      {tab==="nextyear" && (
        <div>
          {/* Шапка сценариев */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
            {Object.entries(SCENARIOS).map(([key,s])=>{
              const r = scenarioResults[key];
              const isActive = activeScenario===key;
              return (
                <button key={key} onClick={()=>setActiveScenario(key)} style={{ background:isActive?s.bg:"#fff", borderRadius:14, padding:16, boxShadow:isActive?"0 0 0 3px "+s.color:"0 1px 4px rgba(0,0,0,0.08)", border:`2px solid ${isActive?s.color:"#e5e7eb"}`, cursor:"pointer", textAlign:"left", transition:"all 0.2s" }}>
                  <div style={{ fontSize:14, fontWeight:700, color:s.color, marginBottom:4 }}>{s.emoji} {s.label}</div>
                  <div style={{ fontSize:11, color:"#6b7280", marginBottom:10 }}>{s.description}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                    <div style={{ background:"rgba(255,255,255,0.7)", borderRadius:8, padding:8 }}>
                      <div style={{ fontSize:10, color:"#6b7280" }}>Прибыль/год</div>
                      <div style={{ fontSize:14, fontWeight:800, color:r.annProfit>=0?"#16a34a":"#dc2626" }}>{fmtM(r.annProfit)} тг</div>
                    </div>
                    <div style={{ background:"rgba(255,255,255,0.7)", borderRadius:8, padding:8 }}>
                      <div style={{ fontSize:10, color:"#6b7280" }}>Детей/месяц</div>
                      <div style={{ fontSize:14, fontWeight:800, color:s.color }}>{s.kids}</div>
                    </div>
                  </div>
                  {isActive&&<div style={{ marginTop:8, fontSize:10, fontWeight:700, color:s.color }}>▶ Редактируется</div>}
                </button>
              );
            })}
          </div>

          {/* Сравнительный график прибыли */}
          <div style={{ background:"#fff", borderRadius:14, padding:18, boxShadow:"0 1px 4px rgba(0,0,0,0.08)", marginBottom:14 }}>
            <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:700 }}>Сравнение прибыли по сценариям (тыс. тг/мес.)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize:11 }} />
                <YAxis tick={{ fontSize:10 }} tickFormatter={v=>`${v}K`} />
                <Tooltip formatter={(v,n)=>[`${fmt(v)} тыс. тг`, n]} />
                <Legend />
                <ReferenceLine y={0} stroke="#374151" strokeDasharray="4 2" />
                <Line type="monotone" dataKey="Оптим."   stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Стандарт" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Пессим."  stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Настройки активного сценария */}
          <div style={{ background:sc.bg, borderRadius:14, padding:18, boxShadow:"0 1px 4px rgba(0,0,0,0.08)", marginBottom:14, border:`1px solid ${sc.color}30` }}>
            <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700, color:sc.color }}>{sc.emoji} Настройки: {sc.label} сценарий</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"#374151", marginBottom:10 }}>💰 Доходы</div>
                <ScSlider label="Ежемесячная плата" field="monthlyFee" min={200_000} max={400_000} step={5_000} />
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
                  <div style={{ minWidth:148, fontSize:12 }}>Кол-во детей</div>
                  <input type="range" min={60} max={120} step={1} value={sc.kids} onChange={e=>setSc("kids",+e.target.value)} style={{ flex:1, accentColor:sc.color }} />
                  <div style={{ minWidth:36, fontWeight:700, color:sc.color, fontSize:13 }}>{sc.kids}</div>
                </div>
                <div style={{ background:"rgba(255,255,255,0.6)", borderRadius:10, padding:10, marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <span style={{ fontSize:12, fontWeight:600 }}>🏛️ Госзаказ</span>
                    <button onClick={()=>setSc("gosEnabled",!sc.gosEnabled)} style={{ padding:"3px 8px", borderRadius:6, border:"none", cursor:"pointer", fontSize:10, fontWeight:600, background:sc.gosEnabled?"#34d399":"#e5e7eb", color:sc.gosEnabled?"#fff":"#374151" }}>
                      {sc.gosEnabled?"✅ Вкл":"❌ Выкл"}
                    </button>
                  </div>
                  {sc.gosEnabled&&(
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ minWidth:120, fontSize:11, color:"#6b7280" }}>Детей на ГЗ</div>
                      <input type="range" min={0} max={sc.kids} step={1} value={sc.gosKids} onChange={e=>setSc("gosKids",+e.target.value)} style={{ flex:1, accentColor:"#34d399" }} />
                      <div style={{ minWidth:30, fontWeight:700, color:"#16a34a", fontSize:12 }}>{sc.gosKids}</div>
                    </div>
                  )}
                  {sc.gosEnabled&&<div style={{ fontSize:10, color:"#16a34a", marginTop:4 }}>Субсидия: {fmt(sc.gosKids*GOSORDER_RATE)} тг/мес</div>}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <div style={{ minWidth:148, fontSize:12 }}>% платящих вовремя</div>
                  <input type="range" min={0.5} max={1} step={0.05} value={sc.paymentRate} onChange={e=>setSc("paymentRate",+e.target.value)} style={{ flex:1, accentColor:sc.color }} />
                  <div style={{ minWidth:40, fontWeight:700, color:sc.color, fontSize:12 }}>{Math.round(sc.paymentRate*100)}%</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ minWidth:148, fontSize:12 }}>Ставка пени (%/день)</div>
                  <input type="range" min={0.5} max={2} step={0.1} value={sc.penaltyRate} onChange={e=>setSc("penaltyRate",+e.target.value)} style={{ flex:1, accentColor:sc.color }} />
                  <div style={{ minWidth:40, fontWeight:700, color:sc.color, fontSize:12 }}>{sc.penaltyRate}%</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"#374151", marginBottom:10 }}>💸 Расходы</div>
                <ScSlider label="ФОТ (с налогами)"  field="fot"       min={5_000_000} max={15_000_000} step={100_000} />
                <ScSlider label="Питание детей"      field="food"      min={500_000}   max={6_000_000}  step={100_000} />
                <ScSlider label="Аренда"             field="rent"      min={0}         max={5_000_000}  step={100_000} />
                <ScSlider label="Коммунальные"       field="utilities" min={100_000}   max={3_000_000}  step={50_000} />
                <ScSlider label="Материалы"          field="materials" min={0}         max={1_000_000}  step={50_000} />
                <ScSlider label="Прочие расходы"     field="other"     min={0}         max={2_000_000}  step={50_000} />
                <div style={{ borderTop:"1px solid rgba(0,0,0,0.1)", marginTop:10, paddingTop:10, display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:12, fontWeight:700 }}>Итого расходов/мес.</span>
                  <span style={{ fontSize:16, fontWeight:800, color:"#dc2626" }}>{fmt(scResult.nyTotalCosts)} тг</span>
                </div>
              </div>
            </div>
          </div>

          {/* KPI сценария */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:14 }}>
            <KPI label="Доход/год" value={`${fmtM(scResult.annRev)} тг`}    sub="с госзаказом и пенями"           color={sc.color} />
            <KPI label="Расходы/год" value={`${fmtM(scResult.annCosts)} тг`} sub={`${fmtM(scResult.nyTotalCosts)} тг/мес`} color="#ef4444" />
            <KPI label="Прибыль/год" value={`${fmtM(scResult.annProfit)} тг`} sub={scResult.annProfit>=0?"✅ В плюсе":"⚠️ Убыток"} color={scResult.annProfit>=0?"#34d399":"#f87171"} />
            <div style={{ background:"#fff", borderRadius:12, padding:"14px 18px", boxShadow:"0 1px 4px rgba(0,0,0,0.08)", borderLeft:`4px solid #fbbf24` }}>
              <div style={{ fontSize:11, color:"#6b7280", marginBottom:3 }}>Точка безубыточности</div>
              <div style={{ fontSize:20, fontWeight:700 }}>{scResult.nyBreakeven} детей</div>
              <div style={{ fontSize:10, color:sc.kids>=scResult.nyBreakeven?"#16a34a":"#dc2626", marginTop:3, fontWeight:600 }}>
                {sc.kids>=scResult.nyBreakeven?"✅ В зоне прибыли":"⚠️ Ниже нормы"}
              </div>
            </div>
          </div>

          {/* Таблица по месяцам — активный сценарий */}
          <div style={{ background:"#fff", borderRadius:14, padding:18, boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:700 }}>Прогноз {sc.emoji} {sc.label} по месяцам 2026–2027</h3>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    {["Месяц","Детей","База дохода","Госсубсидия","Расходы","Прибыль","Маржа"].map(h=>(
                      <th key={h} style={{ padding:"8px 10px", textAlign:"right", fontWeight:600, color:"#374151", borderBottom:"2px solid #e5e7eb", fontSize:11 }}>
                        {h==="Месяц"||h==="Детей"?<span style={{display:"block",textAlign:"left"}}>{h}</span>:h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scResult.months.map((d,i)=>{
                    const margin = d.rawRevenue>0?((d.rawProfit/d.rawRevenue)*100).toFixed(1):"0";
                    return (
                      <tr key={d.month} style={{ background:i%2===0?"#fff":"#fafafa", borderBottom:"1px solid #f3f4f6" }}>
                        <td style={{ padding:"7px 10px", fontWeight:600 }}>{d.month}</td>
                        <td style={{ padding:"7px 10px", textAlign:"right" }}>{d.kids}</td>
                        <td style={{ padding:"7px 10px", textAlign:"right" }}>{fmt(d.kids*sc.monthlyFee)}</td>
                        <td style={{ padding:"7px 10px", textAlign:"right", color:"#16a34a" }}>{fmt(scResult.nyGosSubsidy)}</td>
                        <td style={{ padding:"7px 10px", textAlign:"right", color:"#dc2626" }}>{fmt(scResult.nyTotalCosts)}</td>
                        <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:700, color:d.rawProfit>=0?"#16a34a":"#dc2626" }}>{d.rawProfit>=0?"+":""}{fmt(d.rawProfit)}</td>
                        <td style={{ padding:"7px 10px", textAlign:"right", color:+margin>0?"#16a34a":"#dc2626" }}>{margin}%</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background:sc.bg, borderTop:`2px solid ${sc.color}`, fontWeight:700 }}>
                    <td style={{ padding:"10px", color:sc.color }}>ИТОГО {sc.emoji}</td>
                    <td style={{ padding:"10px", textAlign:"right" }}>{sc.kids}</td>
                    <td style={{ padding:"10px", textAlign:"right" }}>{fmt(sc.kids*sc.monthlyFee*12)}</td>
                    <td style={{ padding:"10px", textAlign:"right", color:"#16a34a" }}>{fmt(scResult.nyGosSubsidy*12)}</td>
                    <td style={{ padding:"10px", textAlign:"right", color:"#dc2626" }}>{fmt(scResult.annCosts)}</td>
                    <td style={{ padding:"10px", textAlign:"right", color:scResult.annProfit>=0?"#16a34a":"#dc2626" }}>{scResult.annProfit>=0?"+":""}{fmt(scResult.annProfit)}</td>
                    <td style={{ padding:"10px", textAlign:"right", color:scResult.annProfit>=0?"#16a34a":"#dc2626" }}>
                      {scResult.annRev>0?((scResult.annProfit/scResult.annRev)*100).toFixed(1)+"%":"—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop:20, textAlign:"center", fontSize:10, color:"#9ca3af" }}>
        Детский сад Тамирлан · Финансовая модель · 2025–2026 (факт) + 2026–2027 (3 сценария)
      </div>
    </div>
  );
}
