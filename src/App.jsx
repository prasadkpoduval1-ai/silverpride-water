import { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ─── FLAT STRUCTURE ───────────────────────────────────────────────────────────
// Ground: 101-106 (6), Floor 1: 201-207 (7), Floor 2: 301-307 (7), Floor 3: 401-407 (7) = 27
const FLAT_IDS = [
  ...Array.from({ length: 6 }, (_, i) => `10${i + 1}`),
  ...Array.from({ length: 7 }, (_, i) => `20${i + 1}`),
  ...Array.from({ length: 7 }, (_, i) => `30${i + 1}`),
  ...Array.from({ length: 7 }, (_, i) => `40${i + 1}`),
];

const FLOORS = [
  { label: "Ground Floor", prefix: "1" },
  { label: "1st Floor", prefix: "2" },
  { label: "2nd Floor", prefix: "3" },
  { label: "3rd Floor", prefix: "4" },
];

const COMMON_METERS = [
  { id: "CMN-PKG", label: "Parking" },
  { id: "CMN-GATE", label: "Front Gate" },
  { id: "CMN-SRV", label: "Servant Qtrs" },
];

const METER_FEE = 50;
const DEFAULT_MAINTENANCE_FEE = 1700;
const LOW_ADVANCE_THRESHOLD = 500;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function fmtMK(k) {
  const [y,m] = k.split("-");
  return `${MONTHS[parseInt(m)-1]} ${y}`;
}
function fmt(n) { return `₹${Math.round(n).toLocaleString("en-IN")}`; }

// ─── SEED ─────────────────────────────────────────────────────────────────────
function seed() {
  const contacts = {};

  // Real meter readings from SP-Temp.xlsx (Feb 2026 = prev, Mar 2026 = current)
  // Only previous month readings pre-loaded; latest come via Excel upload
  const readings = {
    "101":      { "2026-02": 41360 },
    "102":      { "2026-02": 40663 },
    "103":      { "2026-02": 26285 },
    "104":      { "2026-02": 28546 },
    "105":      { "2026-02": 47128 },
    "106":      { "2026-02": 57120 },
    "201":      { "2026-02": 29085 },
    "202":      { "2026-02": 41070 },
    "203":      { "2026-02": 42823 },
    "204":      { "2026-02": 32594 },
    "205":      { "2026-02": 30767 },
    "206":      { "2026-02": 36460 },
    "207":      { "2026-02": 29792 },
    "301":      { "2026-02": 44435 },
    "302":      { "2026-02": 26873 },
    "303":      { "2026-02": 50289 },
    "304":      { "2026-02": 20109 },
    "305":      { "2026-02": 29162 },
    "306":      { "2026-02": 83662 },
    "307":      { "2026-02": 74186 },
    "401":      { "2026-02": 30454 },
    "402":      { "2026-02": 72007 },
    "403":      { "2026-02": 22564 },
    "404":      { "2026-02": 24422 },
    "405":      { "2026-02": 56370 },
    "406":      { "2026-02": 55924 },
    "407":      { "2026-02": 38942 },
    "CMN-SRV":  { "2026-02": 63053 },
    "CMN-PKG":  { "2026-02":  6155 },
    "CMN-GATE": { "2026-02": 10951 },
  };

  // Bill for Mar 2026 — update with actual amounts via Enter Readings tab
  const bills = { "2026-03": { municipal: 0, borewell: 0 } };
  // Real resident data from Silverpride_Resident_Contact_Info.xlsx
  const realContacts = {
    "101": { name: "Anoop Nair",      email: "nairanoop123@yahoo.co.in",      phone: "9739979091" },
    "102": { name: "Sailesh Nair",    email: "saileshknair@gmail.com",         phone: "9916452396" },
    "103": { name: "Amit",            email: "kapatkar.amit@gmail.com",        phone: "7875897108" },
    "104": { name: "Flat 104",        email: "",                               phone: "" },
    "105": { name: "Somasundaram",    email: "umaiyer2024@gmail.com",          phone: "9008622775" },
    "106": { name: "John",            email: "Johnaruldoss13@gmail.com",       phone: "9894461789" },
    "201": { name: "Mehdi",           email: "mehdimfc2006@gmail.com",         phone: "8010689654" },
    "202": { name: "Chudiwala",       email: "rchudiwala@gmail.com",           phone: "9930654032" },
    "203": { name: "Giri",            email: "giridharansridhar@gmail.com",    phone: "9916930530" },
    "204": { name: "Darshan",         email: "darshangohel@gmail.com",         phone: "9535666199" },
    "205": { name: "Saket",           email: "jhasaket79@gmail.com",           phone: "9835241079" },
    "206": { name: "Flat 206",        email: "",                               phone: "" },
    "207": { name: "Prasad Poduval",  email: "prasadkpoduval1@gmail.com",      phone: "9886091144" },
    "301": { name: "Satish Tiwari",   email: "tiwarisatish01@gmail.com",       phone: "" },
    "302": { name: "Reddy",           email: "mrsreddy7@gmail.com",            phone: "8147795190" },
    "303": { name: "Prithesh",        email: "naikprithesh03@gmail.com",       phone: "8378988958" },
    "304": { name: "Gautam",          email: "niki.gautam15@gmail.com",        phone: "7829830839" },
    "305": { name: "Rishabh",         email: "rishabhsai3@gmail.com",          phone: "7976116533" },
    "306": { name: "Flat 306",        email: "",                               phone: "" },
    "307": { name: "Abhinav",         email: "abhinavkrishna5790@gmail.com",   phone: "6205404557" },
    "401": { name: "Touseef",         email: "touseefurrehman@gmail.com",      phone: "9569055034" },
    "402": { name: "Maggie",          email: "maggie.fernandes21@gmail.com",   phone: "9986431967" },
    "403": { name: "Ravipod",         email: "ravipoddar4u@gmail.com",         phone: "9620048537" },
    "404": { name: "Flat 404",        email: "",                               phone: "" },
    "405": { name: "Safia A",         email: "Safia.a22@gmail.com",           phone: "8971430756" },
    "406": { name: "Kunal",           email: "kunal00@yandex.com",             phone: "7090611000" },
    "407": { name: "Luckydeb",        email: "luckydeb12@gmail.com",           phone: "9980871321" },
  };
  FLAT_IDS.forEach(id => { contacts[id] = realContacts[id] || { name: `Flat ${id}`, email: "", phone: "" }; });
  return { readings, bills, contacts };
}
const SEED = seed();

// ─── BILLING ──────────────────────────────────────────────────────────────────
function getCons(readings, id, mk) {
  const keys = Object.keys(readings[id]||{}).sort();
  const idx = keys.indexOf(mk);
  if(idx<1) return null;
  const diff = Math.max(0, readings[id][mk] - readings[id][keys[idx-1]]);
  return Math.round((diff * 10) / 1000 * 1000) / 1000; // × 10 litres ÷ 1000 = kL
}

function calcBill(readings, bills, flatId, mk, maintenanceFee=DEFAULT_MAINTENANCE_FEE) {
  const bill = bills[mk]; if(!bill) return null;
  const total = bill.municipal + bill.borewell;
  const fc = FLAT_IDS.map(id=>({id,c:getCons(readings,id,mk)})).filter(x=>x.c!==null);
  const cc = COMMON_METERS.map(m=>({id:m.id,c:getCons(readings,m.id,mk)})).filter(x=>x.c!==null);
  const tf = fc.reduce((s,x)=>s+x.c,0);
  const tc = cc.reduce((s,x)=>s+x.c,0);
  const all = tf+tc; if(all===0) return null;
  const commonCost = (tc/all)*total;
  const flatPool = total - commonCost;
  const mine = getCons(readings, flatId, mk); if(mine===null) return null;
  const prop = tf>0?(mine/tf)*flatPool:0;
  const share = commonCost/27;
  return { consumption:mine, proportional:prop, commonShare:share, meterFee:METER_FEE, maintenanceFee, total:prop+share+METER_FEE+maintenanceFee, totalFlatCons:tf, municipal:bill.municipal, borewell:bill.borewell, totalBill:total };
}

// ─── LATE FEE ─────────────────────────────────────────────────────────────────
// Bill for month mk is due by end of that month.
// If paid after that, late fee = ₹100 × days into the following month (from 1st).
function calcLateFee(mk, paymentDateStr) {
  if(!paymentDateStr) return 0;
  // Parse payment date — stored as "DD/MM/YYYY" (en-IN locale)
  const parts = paymentDateStr.split("/");
  if(parts.length !== 3) return 0;
  const payDate = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
  // Due by end of bill month
  const [yr, mo] = mk.split("-").map(Number);
  const dueEnd = new Date(yr, mo-1, 1); // first of bill month
  const dueEndMonth = mo; // month number of bill (1-based)
  const dueEndYear = yr;
  // Payment month
  const payMonth = payDate.getMonth() + 1; // 1-based
  const payYear = payDate.getFullYear();
  // If paid in same month as bill → no late fee
  if(payYear === dueEndYear && payMonth === dueEndMonth) return 0;
  // If paid in a later month → late fee starts from day 1 of next month after bill
  // Count days from start of month after bill month to payment date (inclusive)
  const lateStart = new Date(dueEndYear, dueEndMonth, 1); // 1st of month after bill
  const diffMs = payDate - lateStart;
  if(diffMs < 0) return 0; // paid before late period — shouldn't happen
  const days = Math.floor(diffMs / (1000*60*60*24)) + 1; // +1 to include payment day
  return days * 100;
}

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg:"#07101c", surface:"#0d1a28", surface2:"#132030",
  border:"rgba(56,189,248,0.1)", borderHi:"rgba(56,189,248,0.3)",
  accent:"#38bdf8", accentDim:"rgba(56,189,248,0.1)",
  text:"#dde8f4", muted:"#4d7a9a", dim:"#2a4a6a",
  green:"#34d399", yellow:"#fbbf24", red:"#f87171", orange:"#fb923c",
};

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
const Card = ({children,style={}}) => (
  <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:20,...style}}>{children}</div>
);

const Stat = ({label,value,sub,accent=T.accent,icon}) => (
  <Card style={{flex:1,minWidth:140}}>
    <div style={{fontSize:10,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:9,display:"flex",alignItems:"center",gap:5}}>
      {icon&&<span>{icon}</span>}{label}
    </div>
    <div style={{fontSize:21,fontWeight:800,color:accent,fontVariantNumeric:"tabular-nums",letterSpacing:"-0.02em"}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:T.muted,marginTop:4}}>{sub}</div>}
  </Card>
);

const Btn = ({children,onClick,variant="primary",small,disabled,style={}}) => {
  const v = {
    primary:{background:T.accent,color:"#fff"},
    ghost:{background:T.accentDim,color:T.accent},
    success:{background:"rgba(52,211,153,0.15)",color:T.green},
    danger:{background:"rgba(248,113,113,0.15)",color:T.red},
    muted:{background:T.surface2,color:T.muted,border:`1px solid ${T.border}`},
  };
  return <button onClick={disabled?undefined:onClick} style={{border:"none",borderRadius:7,cursor:disabled?"not-allowed":"pointer",fontWeight:700,fontSize:small?11:13,padding:small?"4px 9px":"8px 16px",opacity:disabled?0.5:1,fontFamily:"inherit",...v[variant],...style}}>{children}</button>;
};

const Tag = ({children,color=T.accent}) => (
  <span style={{background:color+"20",color,border:`1px solid ${color}35`,borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700,letterSpacing:"0.05em"}}>{children}</span>
);

const Inp = ({label,value,onChange,type="text",placeholder,hint}) => (
  <div style={{marginBottom:13}}>
    {label&&<div style={{fontSize:11,color:T.muted,marginBottom:5,fontWeight:600,letterSpacing:"0.04em"}}>{label}</div>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:"100%",boxSizing:"border-box",background:T.surface2,border:`1px solid ${T.border}`,borderRadius:7,padding:"8px 11px",color:T.text,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
    {hint&&<div style={{fontSize:10,color:T.dim,marginTop:3}}>{hint}</div>}
  </div>
);

const Modal = ({title,onClose,children,wide}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
    <div style={{background:T.bg,border:`1px solid ${T.borderHi}`,borderRadius:16,padding:26,width:"100%",maxWidth:wide?800:480,maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:16,fontWeight:800,color:T.text}}>{title}</h2>
        <button onClick={onClose} style={{background:"none",border:"none",color:T.muted,fontSize:20,cursor:"pointer"}}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

// ─── PAYMENT VERIFIER (AI OCR) ────────────────────────────────────────────────
function PaymentVerifier({flatId,bill,mk,onVerified,onClose}) {
  const [preview,setPreview] = useState(null);
  const [file,setFile] = useState(null);
  const [status,setStatus] = useState("idle");
  const [extracted,setExtracted] = useState(null);
  const ref = useRef();

  function handleFile(f) {
    setFile(f); setStatus("idle"); setExtracted(null);
    const r = new FileReader();
    r.onload = e => setPreview(e.target.result);
    r.readAsDataURL(f);
  }

  async function scan() {
    if(!file||!preview) return;
    setStatus("scanning");
    try {
      const base64 = preview.split(",")[1];
      const res = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType: file.type || "image/jpeg" })
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const p = await res.json();
      setExtracted(p);
      if(p.status==="failed") setStatus("failed");
      else if(p.amount!==null && Math.abs(Math.round(p.amount)-Math.round(bill.total))<=5) setStatus("matched");
      else setStatus("mismatch");
    } catch(e) { setStatus("error"); }
  }

  const cfg = {
    matched:{color:T.green,icon:"✓",msg:"Amount verified! Payment matched."},
    mismatch:{color:T.yellow,icon:"⚠",msg:`Amount mismatch — expected ${fmt(bill.total)}, got ${extracted?.amount?fmt(extracted.amount):"unknown"}.`},
    failed:{color:T.red,icon:"✗",msg:"Screenshot shows a failed transaction."},
    error:{color:T.red,icon:"✗",msg:"Could not read screenshot. Try a clearer image."},
  };

  return (
    <div>
      <div style={{padding:14,background:T.surface2,borderRadius:8,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:11,color:T.muted}}>Expected Amount</div>
          <div style={{fontSize:22,fontWeight:800,color:T.accent}}>{fmt(bill.total)}</div>
          <div style={{fontSize:11,color:T.muted}}>Flat {flatId} · {fmtMK(mk)}</div>
        </div>
        <div style={{fontSize:28}}>🧾</div>
      </div>

      <div onClick={()=>ref.current?.click()} style={{border:`2px dashed ${file?T.accent:T.border}`,borderRadius:10,padding:22,textAlign:"center",cursor:"pointer",marginBottom:14,background:file?T.accentDim:"transparent",transition:"all 0.2s"}}>
        {preview
          ? <img src={preview} alt="payment" style={{maxHeight:170,borderRadius:6,maxWidth:"100%"}}/>
          : <><div style={{fontSize:26,marginBottom:6}}>📱</div><div style={{fontSize:13,color:T.muted}}>Upload payment screenshot</div><div style={{fontSize:11,color:T.dim,marginTop:3}}>UPI (GPay/PhonePe) or NEFT confirmation</div></>
        }
        <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={e=>e.target.files[0]&&handleFile(e.target.files[0])}/>
      </div>

      {file&&status==="idle"&&<Btn onClick={scan} style={{width:"100%"}}>🔍 Scan & Verify Payment</Btn>}

      {status==="scanning"&&<div style={{textAlign:"center",padding:16,color:T.muted,fontSize:13}}><div style={{fontSize:22,marginBottom:6}}>⏳</div>Reading payment screenshot…</div>}

      {extracted&&status!=="scanning"&&status!=="idle"&&(
        <div style={{marginTop:12}}>
          <div style={{padding:13,borderRadius:8,border:`1px solid ${cfg[status]?.color}40`,background:cfg[status]?.color+"12",marginBottom:13}}>
            <div style={{fontWeight:800,color:cfg[status]?.color,marginBottom:7}}>{cfg[status]?.icon} {cfg[status]?.msg}</div>
            <div style={{fontSize:11,color:T.muted,display:"flex",flexDirection:"column",gap:3}}>
              {extracted.amount&&<span>Amount: <strong style={{color:T.text}}>{fmt(extracted.amount)}</strong></span>}
              {extracted.date&&<span>Date: <strong style={{color:T.text}}>{extracted.date}</strong></span>}
              {extracted.txn_id&&<span>Txn: <strong style={{color:T.text}}>{extracted.txn_id}</strong></span>}
              {extracted.type&&<span>Method: <strong style={{color:T.text}}>{extracted.type}</strong></span>}
            </div>
          </div>
          {status==="matched"&&<Btn variant="success" onClick={()=>onVerified(extracted)} style={{width:"100%"}}>✓ Mark as Paid</Btn>}
          {(status==="mismatch"||status==="failed")&&(
            <div style={{display:"flex",gap:9}}>
              <Btn variant="danger" onClick={onClose} style={{flex:1}}>Reject</Btn>
              <Btn variant="ghost" onClick={()=>onVerified(extracted)} style={{flex:1}}>Override & Mark Paid</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── NOTIFICATION PREVIEW ─────────────────────────────────────────────────────
function NotifPreview({flatId,bill,mk,contact,advance}) {
  const adv = advance?.balance||0;
  const used = Math.min(adv,bill.total);
  const net = Math.max(0,bill.total-adv);

  const email = `Dear ${contact?.name||`Flat ${flatId} Resident`},

Your water maintenance bill for ${fmtMK(mk)} is ready.

── BILL SUMMARY ─────────────────────
Flat              : ${flatId}
Month             : ${fmtMK(mk)}
Consumption       : ${bill.consumption} kL
─────────────────────────────────────
Proportional Charge : ${fmt(bill.proportional)}
Common Area (÷27)   : ${fmt(bill.commonShare)}
Meter Maintenance   : ${fmt(bill.meterFee)}
Flat Maintenance    : ${fmt(bill.maintenanceFee)}
─────────────────────────────────────
Gross Total         : ${fmt(bill.total)}${used>0?`\nAdvance Applied     : -${fmt(used)}\nNet Amount Due      : ${fmt(net)}`:`\nAmount Due          : ${fmt(net)}`}
${adv-used>0?`Remaining Advance   : ${fmt(adv-used)}`:""}
─────────────────────────────────────

To complete payment, use UPI/NEFT to society account.
Once paid, upload your screenshot here to auto-verify:
👉 [PAYMENT UPLOAD LINK]

Regards,
Society Management`;

  const wa = `Hi ${contact?.name?.split(" ")[0]||"Resident"} 👋\n\nWater bill for *${fmtMK(mk)}* is ready.\n\n🏠 Flat *${flatId}*\n💧 Consumed: *${bill.consumption} kL*\n💰 Net Due: *${fmt(net)}*${used>0?`\n✅ Advance of ${fmt(used)} applied`:""}\n\nPay via UPI/NEFT & upload screenshot:\n👉 [PAYMENT UPLOAD LINK]\n\n_(Auto-verified — no follow-up needed)_`;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div>
        <Tag color={T.accent}>✉ Email Preview</Tag>
        <pre style={{background:T.surface2,border:`1px solid ${T.border}`,borderRadius:8,padding:14,marginTop:8,fontSize:11,color:T.text,whiteSpace:"pre-wrap",fontFamily:"monospace",lineHeight:1.7,maxHeight:260,overflowY:"auto"}}>{email}</pre>
      </div>
      <div>
        <Tag color={T.green}>💬 WhatsApp Preview</Tag>
        <pre style={{background:"#071810",border:`1px solid ${T.green}30`,borderRadius:8,padding:14,marginTop:8,fontSize:11,color:"#a7f3d0",whiteSpace:"pre-wrap",fontFamily:"monospace",lineHeight:1.7}}>{wa}</pre>
      </div>
      <div style={{fontSize:11,color:T.dim,padding:"8px 12px",background:T.surface2,borderRadius:7}}>
        ℹ Actual sending requires backend/email-API integration. These show exact message content ready to dispatch.
      </div>
    </div>
  );
}

// ─── ADVANCE MANAGER ─────────────────────────────────────────────────────────
function AdvanceManager({flatId,advance,onSave}) {
  const [amt,setAmt] = useState("");
  const [note,setNote] = useState("");
  const bal = advance?.balance||0;
  const hist = advance?.history||[];

  return (
    <div>
      <div style={{padding:14,background:T.surface2,borderRadius:8,marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:11,color:T.muted,marginBottom:3}}>Current Advance Balance</div>
          <div style={{fontSize:26,fontWeight:800,color:bal>LOW_ADVANCE_THRESHOLD?T.green:bal>0?T.yellow:T.red}}>{fmt(bal)}</div>
          <div style={{marginTop:5}}>
            {bal===0&&<Tag color={T.red}>No advance</Tag>}
            {bal>0&&bal<LOW_ADVANCE_THRESHOLD&&<Tag color={T.yellow}>⚠ Low — will run out soon</Tag>}
            {bal>=LOW_ADVANCE_THRESHOLD&&<Tag color={T.green}>Active</Tag>}
          </div>
        </div>
        <div style={{fontSize:30}}>💳</div>
      </div>

      <div style={{marginBottom:18}}>
        <div style={{fontSize:11,fontWeight:700,color:T.muted,letterSpacing:"0.08em",marginBottom:10}}>ADD ADVANCE PAYMENT</div>
        <Inp label="Amount (₹)" type="number" value={amt} onChange={setAmt} placeholder="e.g. 3000"/>
        <Inp label="Note (optional)" value={note} onChange={setNote} placeholder="e.g. 6 months advance"/>
        <Btn disabled={!amt||isNaN(parseFloat(amt))} onClick={()=>{ onSave({amount:parseFloat(amt),note,date:new Date().toLocaleDateString("en-IN")}); setAmt(""); setNote(""); }}>Add Advance</Btn>
      </div>

      {hist.length>0&&(
        <div>
          <div style={{fontSize:11,fontWeight:700,color:T.muted,letterSpacing:"0.08em",marginBottom:10}}>HISTORY</div>
          {hist.slice().reverse().map((h,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderTop:`1px solid ${T.border}`}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:h.amount>0?T.green:T.red}}>{h.amount>0?"+":""}{fmt(Math.abs(h.amount))}</div>
                <div style={{fontSize:10,color:T.muted}}>{h.note||(h.amount<0?"Monthly deduction":"Advance")} · {h.date}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── METER SCANNER ───────────────────────────────────────────────────────────
function MeterScanner({ flatId, flatName, prevReading, onConfirm, onClose }) {
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | scanning | done | error
  const [extracted, setExtracted] = useState(null);
  const [corrected, setCorrected] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [resizedB64, setResizedB64] = useState(null);
  const camRef = useRef();

  // Resize image to max 1024px and compress to JPEG — critical for mobile photos
  function resizeAndLoad(file) {
    setStatus("idle"); setExtracted(null); setCorrected(""); setErrMsg(""); setResizedB64(null);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1024;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setPreview(dataUrl);
      setResizedB64(dataUrl.split(",")[1]);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { setErrMsg("Could not load image."); setStatus("error"); };
    img.src = url;
  }

  async function scan() {
    if (!resizedB64) return;
    setStatus("scanning"); setErrMsg("");
    try {
      // Call via backend proxy to avoid CORS issues
      const res = await fetch("/api/scan-meter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: resizedB64, mediaType: "image/jpeg" })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API error ${res.status}: ${errText.slice(0,200)}`);
      }
      const parsed = await res.json();
      setExtracted(parsed);
      setCorrected(parsed.reading !== null ? String(parsed.reading) : "");
      setStatus("done");
    } catch (e) {
      setErrMsg(e.message || "Unknown error");
      setStatus("error");
    }
  }

  const confColor = { high: "#34d399", medium: "#fbbf24", low: "#f87171" };

  return (
    <div>
      {/* Flat info */}
      <div style={{ padding: "10px 14px", background: "rgba(56,189,248,0.1)", borderRadius: 8, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#38bdf8" }}>Flat {flatId}</div>
          <div style={{ fontSize: 11, color: "#4d7a9a", marginTop: 2 }}>Previous reading: {prevReading ?? "—"}</div>
        </div>
        <div style={{ fontSize: 28 }}>💧</div>
      </div>

      {/* Camera / file area */}
      <div
        onClick={() => camRef.current?.click()}
        style={{
          border: `2px dashed ${preview ? "#38bdf8" : "rgba(56,189,248,0.2)"}`,
          borderRadius: 12, padding: preview ? 8 : 28, textAlign: "center",
          cursor: "pointer", marginBottom: 14,
          background: preview ? "rgba(56,189,248,0.05)" : "transparent",
          transition: "all 0.2s"
        }}
      >
        {preview
          ? <img src={preview} alt="meter" style={{ maxHeight: 220, borderRadius: 8, maxWidth: "100%", display: "block", margin: "0 auto" }} />
          : <>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📷</div>
              <div style={{ fontSize: 14, color: "#4d7a9a", fontWeight: 600 }}>Tap to take photo or upload</div>
              <div style={{ fontSize: 11, color: "#2a4a6a", marginTop: 4 }}>Point camera at meter dial clearly</div>
            </>
        }
        <input
          ref={camRef} type="file" accept="image/*" capture="environment"
          style={{ display: "none" }}
          onChange={e => e.target.files[0] && resizeAndLoad(e.target.files[0])}
        />
      </div>

      {/* Scan button */}
      {resizedB64 && status === "idle" && (
        <button onClick={scan} style={{ width: "100%", background: "#38bdf8", color: "#fff", border: "none", borderRadius: 9, padding: "12px", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
          🔍 Read Meter
        </button>
      )}

      {/* Scanning state */}
      {status === "scanning" && (
        <div style={{ textAlign: "center", padding: 20, color: "#4d7a9a", fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
          Reading meter dial…
        </div>
      )}

      {/* Result */}
      {status === "done" && extracted && (
        <div style={{ marginTop: 4 }}>
          <div style={{ padding: 14, background: "#0d1a28", borderRadius: 10, border: `1px solid ${confColor[extracted.confidence] || "#38bdf8"}40`, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#4d7a9a", fontWeight: 600 }}>EXTRACTED READING</div>
              <span style={{ background: (confColor[extracted.confidence] || "#38bdf8") + "20", color: confColor[extracted.confidence] || "#38bdf8", border: `1px solid ${confColor[extracted.confidence] || "#38bdf8"}40`, borderRadius: 5, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                {extracted.confidence?.toUpperCase()} CONFIDENCE
              </span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#f1f5f9", fontVariantNumeric: "tabular-nums", marginBottom: 6 }}>
              {extracted.reading ?? "Could not read"}
            </div>
            {prevReading && extracted.reading && (
              <div style={{ fontSize: 12, color: "#34d399" }}>
                Consumption: {Math.round((extracted.reading - prevReading) * 10 / 1000 * 100) / 100} kL ({(extracted.reading - prevReading) * 10} L)
              </div>
            )}
            {extracted.note && <div style={{ fontSize: 11, color: "#4d7a9a", marginTop: 4 }}>Note: {extracted.note}</div>}
          </div>

          {/* Correction field */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#4d7a9a", marginBottom: 5, fontWeight: 600 }}>CONFIRM OR CORRECT READING</div>
            <input
              type="number" value={corrected}
              onChange={e => setCorrected(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", background: "#132030", border: `1px solid rgba(56,189,248,0.3)`, borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 20, fontWeight: 700, outline: "none", fontFamily: "inherit", textAlign: "center" }}
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => { setPreview(null); setResizedB64(null); setStatus('idle'); setExtracted(null); setCorrected(''); setTimeout(()=>camRef.current?.click(),50); }}
              style={{ flex: 1, background: "#132030", color: "#4d7a9a", border: `1px solid rgba(56,189,248,0.15)`, borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              🔄 Retake
            </button>
            <button
              disabled={!corrected || isNaN(parseFloat(corrected))}
              onClick={() => onConfirm(parseFloat(corrected))}
              style={{ flex: 2, background: !corrected || isNaN(parseFloat(corrected)) ? "#132030" : "#34d399", color: !corrected || isNaN(parseFloat(corrected)) ? "#2a4a6a" : "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 800, cursor: !corrected || isNaN(parseFloat(corrected)) ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              ✓ Save Reading
            </button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div style={{ padding: 14, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, textAlign: "center" }}>
          <div style={{ color: "#f87171", fontWeight: 700, marginBottom: 8 }}>Could not read meter image</div>
          <div style={{ fontSize: 11, color: "#4d7a9a", marginBottom: 8 }}>Try a clearer photo with good lighting, close to the dial.</div>
          {errMsg && <div style={{ fontSize: 10, color: "#f87171", marginBottom: 10, wordBreak: "break-all", background: "rgba(248,113,113,0.1)", padding: "6px 8px", borderRadius: 5 }}>{errMsg}</div>}
          <button onClick={() => { setStatus("idle"); setPreview(null); setResizedB64(null); setErrMsg(""); }} style={{ background: "#132030", color: "#38bdf8", border: `1px solid rgba(56,189,248,0.3)`, borderRadius: 7, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>Try Again</button>
        </div>
      )}
    </div>
  );
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
const NAV = [
  {id:"overview",icon:"◈",label:"Overview"},
  {id:"readings",icon:"⌨",label:"Enter Readings"},
  {id:"bills",icon:"₹",label:"Bills & Payments"},
  {id:"residents",icon:"👥",label:"Residents"},
  {id:"trends",icon:"↗",label:"Trends"},
  {id:"settings",icon:"⚙",label:"Settings"},
];

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [readings,setReadings] = useState(SEED.readings);
  const [bills,setBills] = useState(SEED.bills);
  const [contacts,setContacts] = useState(SEED.contacts);
  const [payments,setPayments] = useState({});
  const [advances,setAdvances] = useState({});
  const [maintenanceFee,setMaintenanceFee] = useState(DEFAULT_MAINTENANCE_FEE);
  const [lateFees,setLateFees] = useState({});
  const [scanModal,setScanModal] = useState(null);
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768; // { id, label } // { "flatId-mk": { fee, days } }
  const [tab,setTab] = useState("overview");
  const [readMonth,setReadMonth] = useState(()=>monthKey());
  const [draftR,setDraftR] = useState({});
  const [draftB,setDraftB] = useState({municipal:"",borewell:""});
  const [modal,setModal] = useState(null);
  const csvRef = useRef();
  const xlsxRef = useRef();

  // Map common meter labels from Excel to internal IDs
  const COMMON_LABEL_MAP = {
    "COMMON-Servant": "CMN-SRV", "COMMON-SERVANT": "CMN-SRV",
    "COMMON-PARKING": "CMN-PKG", "COMMON-Parking": "CMN-PKG",
    "COMMON-FRONT SIDE": "CMN-GATE", "COMMON-Front Side": "CMN-GATE", "COMMON-FRONT": "CMN-GATE",
  };

  function handleXlsxUpload(e) {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, {type:"array"});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null});

        // Scan header row(s) for column positions
        let aptCol=-1, prevCol=-1, latestCol=-1, dataStartRow=0;

        for(let r=0; r<Math.min(5, rows.length); r++) {
          const row = rows[r] || [];
          let foundAny = false;
          row.forEach((cell, i) => {
            const v = String(cell==null?"":cell).trim().toLowerCase();
            if(v.includes("apartment") || v.includes("apt")) { aptCol=i; foundAny=true; }
            if(v==="previous" || v==="prev") { prevCol=i; foundAny=true; }
            if(v==="latest" || v==="current") { latestCol=i; foundAny=true; }
          });
          if(foundAny) dataStartRow = r+1;
        }

        if(aptCol===-1 || prevCol===-1 || latestCol===-1) {
          setModal({type:"ok", msg:`❌ Could not find columns. Need: Apartment, Previous, Latest`});
          return;
        }

        const [yr, mo] = readMonth.split("-").map(Number);
        const prevMK = monthKey(new Date(yr, mo-2, 1));
        const latestMK2 = readMonth;

        const newReadings = JSON.parse(JSON.stringify(readings));
        let loaded=0, skipped=0;

        rows.slice(dataStartRow).forEach(row => {
          const apt = row[aptCol];
          const prevVal = row[prevCol];
          const latestVal = row[latestCol];
          if(apt===null || apt===undefined || String(apt).trim()==="") return;

          const aptStr = String(apt).trim();
          let meterId = null;

          if(FLAT_IDS.includes(aptStr)) {
            meterId = aptStr;
          } else {
            const upper = aptStr.toUpperCase();
            if(upper.includes("SERVANT")) meterId="CMN-SRV";
            else if(upper.includes("PARKING")) meterId="CMN-PKG";
            else if(upper.includes("FRONT")) meterId="CMN-GATE";
          }

          if(!meterId) { skipped++; return; }

          if(!newReadings[meterId]) newReadings[meterId]={};
          const p = Number(prevVal), l = Number(latestVal);
          if(!isNaN(p) && prevVal!==null) newReadings[meterId][prevMK] = p;
          if(!isNaN(l) && latestVal!==null) newReadings[meterId][latestMK2] = l;
          loaded++;
        });

        setReadings(newReadings);

        // Also populate draftR so the input cells display the latest readings
        const newDraft = {};
        [...FLAT_IDS, ...COMMON_METERS.map(m=>m.id)].forEach(id => {
          const v = newReadings[id]?.[latestMK2];
          if(v !== undefined) newDraft[id] = String(v);
        });
        setDraftR(newDraft);

        const sample = ["101","205","407"].map(id=>
          `Flat ${id}: prev=${newReadings[id]?.[prevMK]??"-"} → latest=${newReadings[id]?.[latestMK2]??"-"}`
        ).join("\n");
        setModal({type:"ok", msg:`✓ ${loaded} meters updated!\nPrevious → ${fmtMK(prevMK)}, Latest → ${fmtMK(latestMK2)}\n\nSample check:\n${sample}${skipped>0?`\n(${skipped} rows skipped)`:""}`});
      } catch(err) {
        setModal({type:"ok", msg:`❌ Error: ${err.message}`});
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value="";
  }

  const billedMonths = useMemo(()=>Object.keys(bills).sort().reverse(),[bills]);
  const latestMK = billedMonths[0];

  function getFlatBills(mk) {
    return FLAT_IDS.map(id=>({id,bill:calcBill(readings,bills,id,mk,maintenanceFee)})).filter(x=>x.bill);
  }

  function getLiveFee(mk) {
    // For unpaid bills — show accruing late fee as of today
    const todayStr = new Date().toLocaleDateString("en-IN");
    return calcLateFee(mk, todayStr);
  }

  const overview = useMemo(()=>{
    if(!latestMK) return null;
    const fb = getFlatBills(latestMK);
    const paid = fb.filter(x=>payments[`${x.id}-${latestMK}`]).length;
    const pending = fb.filter(x=>!payments[`${x.id}-${latestMK}`]).reduce((s,x)=>s+Math.max(0,x.bill.total-(advances[x.id]?.balance||0)),0);
    const lowAdv = FLAT_IDS.filter(id=>{const b=advances[id]?.balance||0;return b>0&&b<LOW_ADVANCE_THRESHOLD;});
    return { fb, totalRev:fb.reduce((s,x)=>s+x.bill.total,0), totalCons:fb.reduce((s,x)=>s+x.bill.consumption,0), paid, pending, lowAdv };
  },[latestMK,readings,bills,payments,advances]);

  const trendData = useMemo(()=>Object.keys(bills).sort().map(mk=>{
    const fb=getFlatBills(mk);
    return {month:fmtMK(mk),consumption:fb.reduce((s,x)=>s+x.bill.consumption,0),revenue:Math.round(fb.reduce((s,x)=>s+x.bill.total,0))};
  }),[readings,bills]);

  function saveReadings(){
    const u={...readings};
    Object.entries(draftR).forEach(([id,v])=>{const n=parseFloat(v);if(!isNaN(n)&&n>0) u[id]={...(u[id]||{}),[readMonth]:n};});
    setReadings(u); setDraftR({});
    setModal({type:"ok",msg:`✓ Readings saved for ${fmtMK(readMonth)}`});
  }

  function saveBill(){
    const m=parseFloat(draftB.municipal),b=parseFloat(draftB.borewell);
    if(isNaN(m)||isNaN(b)) return;
    setBills(p=>({...p,[readMonth]:{municipal:m,borewell:b}}));
    setDraftB({municipal:"",borewell:""});
    setModal({type:"ok",msg:`✓ Bill saved for ${fmtMK(readMonth)}`});
  }

  function togglePaid(flatId,mk,txn=null){
    const key=`${flatId}-${mk}`;
    const was=!!payments[key];
    if(!was){
      // Record payment date and compute late fee
      const todayStr = new Date().toLocaleDateString("en-IN");
      const fee = calcLateFee(mk, todayStr);
      const [yr,mo] = mk.split("-").map(Number);
      const lateStart = new Date(yr, mo, 1);
      const today = new Date();
      const days = fee > 0 ? Math.floor((today - lateStart)/(1000*60*60*24))+1 : 0;
      setLateFees(p=>({...p,[key]:{fee, days, date:todayStr}}));

      const b=calcBill(readings,bills,flatId,mk,maintenanceFee);
      if(b){
        const adv=advances[flatId];
        if(adv?.balance>0){
          const used=Math.min(adv.balance,b.total+fee);
          setAdvances(p=>({...p,[flatId]:{balance:adv.balance-used,history:[...(adv.history||[]),{amount:-used,date:todayStr,note:`Applied to ${fmtMK(mk)}`}]}}));
        }
      }
    } else {
      // Remove late fee when unpaid
      setLateFees(p=>{const n={...p}; delete n[key]; return n;});
    }
    setPayments(p=>({...p,[key]:was?null:{paid:true,txn,date:new Date().toLocaleDateString("en-IN")}}));
  }

  function downloadExcel(mk) {
    const fb = getFlatBills(mk);
    if(!fb.length) { setModal({type:"ok", msg:"No bill data available for this month."}); return; }
    const b = bills[mk];

    // Build rows
    const header = [
      "Flat", "Resident", "Prev Reading", "Latest Reading",
      "Consumption (kL)", "Proportional Charge (₹)",
      "Common Area Share (₹)", "Meter Fee (₹)", "Maintenance (₹)", "Late Fee (₹)", "Gross Total (₹)",
      "Advance Applied (₹)", "Net Due (₹)", "Payment Status"
    ];

    const rows = fb.map(({id, bill}) => {
      const isPaid = !!payments[`${id}-${mk}`];
      const adv = advances[id]?.balance || 0;
      const used = Math.min(adv, bill.total);
      const net = Math.max(0, bill.total - adv);
      const mkeys = Object.keys(readings[id]||{}).sort();
      const idx = mkeys.indexOf(mk);
      const latestR = readings[id]?.[mk] ?? "";
      const prevR = idx > 0 ? readings[id][mkeys[idx-1]] : "";
      return [
        id,
        contacts[id]?.name || "",
        prevR,
        latestR,
        bill.consumption,
        Math.round(bill.proportional),
        Math.round(bill.commonShare),
        bill.meterFee,
        bill.maintenanceFee,
        (()=>{ const isPaid=!!payments[`${id}-${mk}`]; const rec=lateFees[`${id}-${mk}`]; if(isPaid&&rec?.fee>0) return rec.fee; const live=getLiveFee(mk); return live>0?live:0; })(),
        Math.round(bill.total),
        Math.round(used),
        Math.round(net),
        isPaid ? "Paid" : "Pending",
      ];
    });

    // Summary row
    const totalGross = fb.reduce((s,x)=>s+x.bill.total,0);
    const totalNet = fb.reduce((s,x)=>s+Math.max(0,x.bill.total-(advances[x.id]?.balance||0)),0);
    const totalCons = fb.reduce((s,x)=>s+x.bill.consumption,0);
    rows.push([]);
    rows.push([
      "TOTAL", "", "", "",
      Math.round(totalCons*100)/100, "", "", "",
      Math.round(totalGross), "", Math.round(totalNet), ""
    ]);

    // Meta info rows at top
    const meta = [
      [`Silverpride Society — Water Maintenance Bill`],
      [`Month: ${fmtMK(mk)}`],
      [`Municipal Bill: ₹${b.municipal}   Borewell: ₹${b.borewell}   Total: ₹${b.municipal+b.borewell}`],
      [`Generated on: ${new Date().toLocaleDateString("en-IN")}`],
      [],
    ];

    const allRows = [...meta, header, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(allRows);

    // Column widths
    ws["!cols"] = [
      {wch:8},{wch:20},{wch:14},{wch:14},{wch:16},
      {wch:22},{wch:20},{wch:12},{wch:16},{wch:18},{wch:12},{wch:14}
    ];

    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, ws, fmtMK(mk));
    XLSX.writeFile(wb2, `Silverpride_Water_Bill_${mk}.xlsx`);
  }

  function addAdvance(flatId,entry){
    setAdvances(p=>{
      const ex=p[flatId]||{balance:0,history:[]};
      return {...p,[flatId]:{balance:ex.balance+entry.amount,history:[...ex.history,entry]}};
    });
    setModal({type:"ok",msg:`✓ Advance of ${fmt(entry.amount)} added for Flat ${flatId}`});
  }

  function handleCSV(e){
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=ev=>{
      const lines=ev.target.result.split("\n").filter(Boolean);
      const u={...contacts};
      lines.forEach((line,i)=>{
        if(i===0&&line.toLowerCase().includes("flat")) return;
        const [flat,name,email,phone]=line.split(",").map(s=>s.trim().replace(/"/g,""));
        if(flat&&FLAT_IDS.includes(flat)) u[flat]={name:name||"",email:email||"",phone:phone||""};
      });
      setContacts(u);
      setModal({type:"ok",msg:"✓ Contacts imported from CSV"});
    };
    r.readAsText(f);
  }

  const payBtn = (id,mk) => {
    const isPaid=!!payments[`${id}-${mk}`];
    return (
      <button onClick={()=>togglePaid(id,mk)} style={{background:isPaid?"rgba(52,211,153,0.15)":"rgba(248,113,113,0.15)",color:isPaid?T.green:T.red,border:`1px solid ${isPaid?T.green:T.red}35`,borderRadius:5,padding:"3px 8px",cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap"}}>
        {isPaid?"✓ Paid":"Pending"}
      </button>
    );
  };

  const TH = ({children}) => <th style={{padding:"8px 11px",textAlign:"left",color:T.muted,fontWeight:600,fontSize:10,letterSpacing:"0.08em",whiteSpace:"nowrap",background:T.surface2}}>{children}</th>;
  const TD = ({children,style={}}) => <td style={{padding:"9px 11px",...style}}>{children}</td>;

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'IBM Plex Sans','Segoe UI',sans-serif",display:"flex",flexDirection:"column"}}>

      {/* ── MOBILE TOP BAR ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:T.surface,borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setSidebarOpen(o=>!o)} style={{background:"none",border:"none",color:T.accent,fontSize:22,cursor:"pointer",padding:"2px 6px",lineHeight:1}}>☰</button>
          <div>
            <div style={{fontSize:9,color:T.accent,fontWeight:800,letterSpacing:"0.2em"}}>SOCIETY</div>
            <div style={{fontSize:14,fontWeight:800,color:T.text,lineHeight:1.2}}>Water Meter Manager</div>
          </div>
        </div>
        <div style={{fontSize:12,color:T.muted}}>27 flats</div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

      {/* ── SIDEBAR ── */}
      {sidebarOpen&&<div onClick={()=>setSidebarOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:90}}/>}
      <aside style={{
        width:200, background:T.surface, borderRight:`1px solid ${T.border}`,
        padding:"18px 11px", display:"flex", flexDirection:"column", gap:3,
        position:"fixed", top:0, left:0, height:"100vh", zIndex:100,
        transform:sidebarOpen?"translateX(0)":"translateX(-100%)",
        transition:"transform 0.25s ease", overflowY:"auto"
      }}>
        <div style={{padding:"0 8px 16px",marginBottom:8,borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:9,color:T.accent,fontWeight:800,letterSpacing:"0.2em",marginBottom:3}}>SOCIETY</div>
            <div style={{fontSize:15,fontWeight:800,lineHeight:1.35,color:T.text}}>Water Meter<br/>Manager</div>
            <div style={{fontSize:10,color:T.muted,marginTop:5}}>27 flats · 3 common</div>
          </div>
          <button onClick={()=>setSidebarOpen(false)} style={{background:"none",border:"none",color:T.muted,fontSize:18,cursor:"pointer",padding:0,marginTop:2}}>✕</button>
        </div>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>{setTab(n.id);setSidebarOpen(false);}} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 12px",borderRadius:7,border:"none",cursor:"pointer",textAlign:"left",width:"100%",background:tab===n.id?T.accentDim:"transparent",color:tab===n.id?T.accent:T.muted,fontWeight:tab===n.id?700:500,fontSize:13,transition:"all .15s",fontFamily:"inherit"}}>
            <span style={{fontSize:16,width:20,textAlign:"center"}}>{n.icon}</span>{n.label}
          </button>
        ))}
        {overview?.lowAdv?.length>0&&(
          <div style={{marginTop:"auto",padding:"10px 8px 0",borderTop:`1px solid ${T.border}`}}>
            <div style={{fontSize:9,color:T.yellow,fontWeight:800,letterSpacing:"0.1em",marginBottom:6}}>⚠ LOW ADVANCE</div>
            {overview.lowAdv.map(id=><div key={id} style={{fontSize:10,color:T.muted,padding:"2px 0"}}>Flat {id}: {fmt(advances[id]?.balance)}</div>)}
          </div>
        )}
      </aside>

      {/* ── MAIN ── */}
      <main style={{flex:1,padding:"20px 16px",overflowY:"auto",width:"100%",maxWidth:"100vw",boxSizing:"border-box"}}>

        {/* ── OVERVIEW ── */}
        {tab==="overview"&&overview&&(
          <div>
            <h1 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>Overview</h1>
            <p style={{color:T.muted,margin:"0 0 22px",fontSize:12}}>Latest: {latestMK?fmtMK(latestMK):"—"}</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:18}}>
              <Stat icon="💰" label="Total Collection" value={fmt(overview.totalRev)} sub="this month"/>
              <Stat icon="💧" label="Consumption" value={`${overview.totalCons} kL`} sub="all flats" accent={T.green}/>
              <Stat icon="✓" label="Payments" value={`${overview.paid}/${overview.fb.length}`} sub="flats paid" accent={T.yellow}/>
              <Stat icon="⏳" label="Pending" value={fmt(overview.pending)} sub="outstanding" accent={T.red}/>
            </div>
            <Card>
              <div style={{fontWeight:700,fontSize:13,marginBottom:13,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>All Flats — {fmtMK(latestMK)}</span>
                <Tag>{overview.paid} paid</Tag>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr><TH>Flat</TH><TH>Consumed</TH><TH>Water</TH><TH>Common</TH><TH>Meter</TH><TH>Maint.</TH><TH>Late Fee</TH><TH>Advance</TH><TH>Net Due</TH><TH>Status</TH></tr></thead>
                  <tbody>
                    {overview.fb.map(({id,bill})=>{
                      const adv=advances[id]?.balance||0;
                      const isPaid=!!payments[`${id}-${latestMK}`];
                      const recorded=lateFees[`${id}-${latestMK}`];
                      const liveFee=!isPaid?getLiveFee(latestMK):0;
                      const lateFee=isPaid?(recorded?.fee||0):liveFee;
                      const used=Math.min(adv,bill.total+lateFee);
                      const net=Math.max(0,bill.total+lateFee-adv);
                      return (
                        <tr key={id} style={{borderTop:`1px solid ${T.border}`}} onMouseEnter={e=>e.currentTarget.style.background=T.surface2} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <TD><span style={{fontWeight:700}}>Flat {id}</span></TD>
                          <TD>{bill.consumption} kL</TD>
                          <TD>{fmt(bill.proportional)}</TD>
                          <TD>{fmt(bill.commonShare)}</TD>
                          <TD>₹50</TD>
                          <TD>{fmt(bill.maintenanceFee)}</TD>
                          <TD>{(()=>{
                            const isPaid=!!payments[`${id}-${latestMK}`];
                            const recorded=lateFees[`${id}-${latestMK}`];
                            if(isPaid && recorded?.fee>0) return <Tag color={T.red}>₹{recorded.fee} ({recorded.days}d)</Tag>;
                            if(isPaid) return <span style={{color:T.dim}}>—</span>;
                            const live=getLiveFee(latestMK);
                            if(live>0) return <Tag color={T.red}>₹{live} accruing</Tag>;
                            return <span style={{color:T.green,fontSize:10}}>None</span>;
                          })()}</TD>
                          <TD>{adv>0?<Tag color={T.green}>-{fmt(used)}</Tag>:<span style={{color:T.dim}}>—</span>}</TD>
                          <TD style={{fontWeight:700,color:T.accent}}>{fmt(net)}</TD>
                          <TD>{payBtn(id,latestMK)}</TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── READINGS ── */}
        {tab==="readings"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22,flexWrap:"wrap",gap:10}}>
              <div>
                <h1 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>Enter Readings</h1>
                <p style={{color:T.muted,margin:0,fontSize:12}}>Record monthly meter readings and society bill</p>
              </div>
              <div style={{display:"flex",gap:9,alignItems:"center"}}>
                <Btn variant="ghost" onClick={()=>xlsxRef.current?.click()}>📂 Upload Excel (SP-Temp format)</Btn>
                <input ref={xlsxRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={handleXlsxUpload}/>
              </div>
            </div>
            <div style={{fontSize:11,color:T.muted,padding:"9px 13px",background:T.surface2,borderRadius:7,marginBottom:18}}>
              📋 Excel format: columns <strong style={{color:T.accent}}>APARTMENT</strong>, <strong style={{color:T.accent}}>Previous</strong>, <strong style={{color:T.accent}}>Latest</strong> — matches your SP-Temp.xlsx exactly. Previous readings go to {fmtMK((() => { const [y,m]=readMonth.split("-").map(Number); return monthKey(new Date(y,m-2,1)); })())}, Latest to {fmtMK(readMonth)}.
            </div>
            <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:18}}>
              <Card style={{flex:1,minWidth:210}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:13}}>Select Month</div>
                <Inp label="Month (YYYY-MM)" value={readMonth} onChange={setReadMonth} placeholder="2024-06"/>
                <div style={{fontSize:11,color:T.muted}}>{fmtMK(readMonth)}</div>
              </Card>
              <Card style={{flex:2,minWidth:270}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:13}}>Society Water Bill</div>
                <div style={{display:"flex",gap:11}}>
                  <div style={{flex:1}}><Inp label="Municipal Bill (₹)" type="number" value={draftB.municipal} onChange={v=>setDraftB(d=>({...d,municipal:v}))} placeholder="18000"/></div>
                  <div style={{flex:1}}><Inp label="Borewell Cost (₹)" type="number" value={draftB.borewell} onChange={v=>setDraftB(d=>({...d,borewell:v}))} placeholder="6500"/></div>
                </div>
                {draftB.municipal&&draftB.borewell&&<div style={{fontSize:11,color:T.muted,marginBottom:10}}>Total: {fmt(parseFloat(draftB.municipal||0)+parseFloat(draftB.borewell||0))}</div>}
                <Btn onClick={saveBill}>Save Bill</Btn>
              </Card>
            </div>

            <Card style={{marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:13}}>Common Area Meters <Tag color={T.yellow}>3 meters</Tag></div>
              <div style={{display:"flex",gap:13,flexWrap:"wrap"}}>
                {COMMON_METERS.map(cm=>{
                  const keys=Object.keys(readings[cm.id]||{}).sort();
                  const prev=keys.length>=2?readings[cm.id][keys[keys.length-2]]:keys.length===1?readings[cm.id][keys[0]]:null;
                  const d=draftR[cm.id];
                  return (
                    <div key={cm.id} style={{flex:1,minWidth:170}}>
                      <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                        <div style={{flex:1}}>
                          <Inp label={`${cm.label}${prev?` (prev: ${prev})`:""}`} type="number" value={d||""} onChange={v=>setDraftR(r=>({...r,[cm.id]:v}))} placeholder={prev?String(prev+12):"Reading"} hint={d&&prev?`+${Math.round((Math.max(0,parseFloat(d)-prev)*10/1000)*100)/100} kL (${Math.max(0,parseFloat(d)-prev)*10} L)`:undefined}/>
                        </div>
                        <button onClick={()=>setScanModal({id:cm.id,label:cm.label})} style={{background:"rgba(56,189,248,0.15)",border:"none",borderRadius:7,padding:"8px 10px",cursor:"pointer",fontSize:16,color:T.accent,marginBottom:13}}>📷</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div style={{fontWeight:700,fontSize:13,marginBottom:13}}>Flat Meters <Tag>27 flats</Tag></div>
              {FLOORS.map(floor=>{
                const flats=FLAT_IDS.filter(f=>f.startsWith(floor.prefix));
                return (
                  <div key={floor.prefix} style={{marginBottom:18}}>
                    <div style={{fontSize:10,color:T.muted,fontWeight:700,letterSpacing:"0.1em",marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${T.border}`}}>
                      {floor.label.toUpperCase()} — {flats.length} FLATS
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:9}}>
                      {flats.map(id=>{
                        const keys=Object.keys(readings[id]||{}).sort();
                        const prev=keys.length>=2?readings[id][keys[keys.length-2]]:keys.length===1?readings[id][keys[0]]:null;
                        const d=draftR[id];
                        const cons=d&&prev?Math.max(0,parseFloat(d)-prev):null;
                        return (
                          <div key={id} style={{background:T.surface2,borderRadius:8,padding:"10px 11px",border:`1px solid ${d?T.accent+"60":T.border}`}}>
                            <div style={{fontWeight:700,fontSize:11,marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <span>Flat {id}</span>
                              <div style={{display:"flex",gap:5,alignItems:"center"}}>
                                {contacts[id]&&<span style={{color:T.muted,fontWeight:400,fontSize:10}}>{contacts[id].name?.split(" ")[0]}</span>}
                                <button onClick={()=>setScanModal({id,label:`Flat ${id}`})} title="Scan meter photo" style={{background:"rgba(56,189,248,0.15)",border:"none",borderRadius:5,padding:"2px 6px",cursor:"pointer",fontSize:12,color:T.accent}}>📷</button>
                              </div>
                            </div>
                            <input type="number" value={d||""} placeholder={prev?`prev: ${prev}`:"Reading"} onChange={e=>setDraftR(r=>({...r,[id]:e.target.value}))}
                              style={{width:"100%",boxSizing:"border-box",background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"6px 8px",color:T.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                            {cons!==null&&<div style={{fontSize:10,color:T.green,marginTop:4}}>+{Math.round(cons*10/1000*100)/100} kL ({cons*10} L)</div>}
                            {d&&<div style={{fontSize:9,color:T.accent,marginTop:3}}>✓ Reading entered</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <Btn onClick={saveReadings}>💾 Save All Readings — {fmtMK(readMonth)}</Btn>
            </Card>
          </div>
        )}

        {/* ── BILLS & PAYMENTS ── */}
        {tab==="bills"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22,flexWrap:"wrap",gap:10}}>
              <div>
                <h1 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>Bills & Payments</h1>
                <p style={{color:T.muted,margin:0,fontSize:12}}>Verify payments, track advances, send notifications</p>
              </div>
              <Btn variant="success" onClick={()=>setModal({type:"downloadPicker"})}>⬇ Download Excel</Btn>
            </div>
            {billedMonths.map(mk=>{
              const fb=getFlatBills(mk);
              const paid=fb.filter(x=>payments[`${x.id}-${mk}`]).length;
              const b=bills[mk];
              return (
                <Card key={mk} style={{marginBottom:18}}>
                  <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:13}}>
                    <div>
                      <div style={{fontWeight:800,fontSize:14}}>{fmtMK(mk)}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:2}}>Municipal: {fmt(b.municipal)} + Borewell: {fmt(b.borewell)} = {fmt(b.municipal+b.borewell)}</div>
                    </div>
                    <Tag color={paid===fb.length?T.green:T.yellow}>{paid}/{fb.length} paid</Tag>
                  </div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr><TH>Flat</TH><TH>Resident</TH><TH>Consumed</TH><TH>Bill</TH><TH>Late Fee</TH><TH>Advance</TH><TH>Net Due</TH><TH>Status</TH><TH>Actions</TH></tr></thead>
                      <tbody>
                        {fb.map(({id,bill})=>{
                          const adv=advances[id]?.balance||0;
                          const used=Math.min(adv,bill.total);
                          const net=Math.max(0,bill.total-adv);
                          return (
                            <tr key={id} style={{borderTop:`1px solid ${T.border}`}} onMouseEnter={e=>e.currentTarget.style.background=T.surface2} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                              <TD><span style={{fontWeight:700}}>Flat {id}</span></TD>
                              <TD style={{color:T.muted,fontSize:11}}>{contacts[id]?.name||"—"}</TD>
                              <TD>{bill.consumption} kL</TD>
                              <TD>{fmt(bill.total)}</TD>
                              <TD>{(()=>{
                                const isPaid=!!payments[`${id}-${mk}`];
                                const recorded=lateFees[`${id}-${mk}`];
                                if(isPaid && recorded?.fee>0) return <span style={{color:T.red,fontWeight:700}}>₹{recorded.fee}<span style={{color:T.muted,fontWeight:400}}> ({recorded.days}d)</span></span>;
                                if(isPaid) return <span style={{color:T.dim}}>—</span>;
                                const live=getLiveFee(mk);
                                return live>0
                                  ? <span style={{color:T.red,fontSize:11}}>₹{live} accruing</span>
                                  : <span style={{color:T.green,fontSize:11}}>None</span>;
                              })()}</TD>
                              <TD>{adv>0?<span style={{color:T.green,fontSize:11}}>-{fmt(used)}</span>:"—"}</TD>
                              <TD style={{fontWeight:700,color:T.accent}}>{fmt(net)}</TD>
                              <TD>{payBtn(id,mk)}</TD>
                              <TD>
                                <div style={{display:"flex",gap:5}}>
                                  <Btn small variant="ghost" onClick={()=>setModal({type:"ocr",flatId:id,mk,bill})}>📱 Verify</Btn>
                                  <Btn small variant="muted" onClick={()=>setModal({type:"notif",flatId:id,mk,bill})}>✉</Btn>
                                  <Btn small variant="muted" onClick={()=>setModal({type:"adv",flatId:id})}>💳</Btn>
                                </div>
                              </TD>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── RESIDENTS ── */}
        {tab==="residents"&&(
          <div>
            <h1 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>Residents</h1>
            <p style={{color:T.muted,margin:"0 0 22px",fontSize:12}}>Contact directory · Import via CSV</p>
            <Card style={{marginBottom:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:13}}>Import Contacts from CSV</div>
                <Btn variant="ghost" onClick={()=>csvRef.current?.click()}>📂 Upload CSV</Btn>
              </div>
              <input ref={csvRef} type="file" accept=".csv" style={{display:"none"}} onChange={handleCSV}/>
              <div style={{fontSize:11,color:T.muted,padding:"10px 12px",background:T.surface2,borderRadius:7}}>
                Format: <code style={{color:T.accent}}>flat,name,email,phone</code> &nbsp;·&nbsp; Example: <code style={{color:T.dim}}>101,Sharma Family,sharma@email.com,9876543210</code>
              </div>
            </Card>
            <Card>
              <div style={{fontWeight:700,fontSize:13,marginBottom:14}}>All Residents ({FLAT_IDS.length})</div>
              {FLOORS.map(floor=>{
                const flats=FLAT_IDS.filter(f=>f.startsWith(floor.prefix));
                return (
                  <div key={floor.prefix} style={{marginBottom:20}}>
                    <div style={{fontSize:10,color:T.muted,fontWeight:700,letterSpacing:"0.1em",marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${T.border}`}}>{floor.label.toUpperCase()}</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:9}}>
                      {flats.map(id=>{
                        const c=contacts[id]||{};
                        const adv=advances[id];
                        return (
                          <div key={id} style={{background:T.surface2,borderRadius:9,padding:"11px 13px",border:`1px solid ${T.border}`}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                              <span style={{fontWeight:700,fontSize:12}}>Flat {id}</span>
                              {adv?.balance>0&&<Tag color={adv.balance<LOW_ADVANCE_THRESHOLD?T.yellow:T.green}>Adv:{fmt(adv.balance)}</Tag>}
                            </div>
                            <div style={{fontSize:12,color:T.text,marginBottom:2}}>{c.name||<span style={{color:T.dim}}>No name</span>}</div>
                            <div style={{fontSize:11,color:T.muted}}>{c.email||"—"}</div>
                            <div style={{fontSize:11,color:T.muted}}>{c.phone||"—"}</div>
                            <div style={{display:"flex",gap:6,marginTop:9}}>
                              <Btn small variant="ghost" onClick={()=>setModal({type:"edit",flatId:id,draft:{...c}})}>Edit</Btn>
                              <Btn small variant="muted" onClick={()=>setModal({type:"adv",flatId:id})}>💳 Advance</Btn>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        )}

        {/* ── TRENDS ── */}
        {tab==="trends"&&(
          <div>
            <h1 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>Trends</h1>
            <p style={{color:T.muted,margin:"0 0 22px",fontSize:12}}>Consumption and billing over time</p>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              <Card style={{flex:1,minWidth:280}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:13}}>Monthly Consumption (kL)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                    <XAxis dataKey="month" tick={{fill:T.muted,fontSize:10}}/>
                    <YAxis tick={{fill:T.muted,fontSize:10}}/>
                    <Tooltip contentStyle={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,fontSize:11}}/>
                    <Bar dataKey="consumption" fill={T.accent} radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card style={{flex:1,minWidth:280}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:13}}>Monthly Revenue (₹)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                    <XAxis dataKey="month" tick={{fill:T.muted,fontSize:10}}/>
                    <YAxis tick={{fill:T.muted,fontSize:10}}/>
                    <Tooltip contentStyle={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,fontSize:11}} formatter={v=>fmt(v)}/>
                    <Line type="monotone" dataKey="revenue" stroke={T.green} strokeWidth={2} dot={{fill:T.green,r:3}}/>
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab==="settings"&&(
          <div>
            <h1 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>Settings</h1>
            <p style={{color:T.muted,margin:"0 0 22px",fontSize:12}}>Configure charges applied to all flats</p>
            <Card style={{maxWidth:480}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:18}}>Charge Configuration</div>

              <div style={{marginBottom:20,paddingBottom:20,borderBottom:`1px solid ${T.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:T.muted,marginBottom:6,letterSpacing:"0.05em"}}>MONTHLY FLAT MAINTENANCE</div>
                <div style={{fontSize:11,color:T.dim,marginBottom:10}}>Fixed charge added to every flat's bill each month, regardless of water consumption.</div>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <div style={{flex:1}}>
                    <Inp label="Amount (₹)" type="number" value={String(maintenanceFee)} onChange={v=>setMaintenanceFee(parseFloat(v)||0)} placeholder="1700"/>
                  </div>
                  <div style={{fontSize:12,color:T.muted,marginTop:14}}>per flat / month</div>
                </div>
                <div style={{fontSize:11,color:T.green,marginTop:4}}>Current: {fmt(maintenanceFee)} × 27 flats = {fmt(maintenanceFee*27)} / month</div>
              </div>

              <div style={{marginBottom:20,paddingBottom:20,borderBottom:`1px solid ${T.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:T.muted,marginBottom:6,letterSpacing:"0.05em"}}>METER MAINTENANCE FEE</div>
                <div style={{fontSize:11,color:T.dim,marginBottom:6}}>Fixed fee for meter upkeep, charged per flat per month.</div>
                <div style={{fontSize:13,color:T.text,fontWeight:600}}>₹{METER_FEE} <span style={{color:T.muted,fontWeight:400,fontSize:11}}>(fixed — contact developer to change)</span></div>
              </div>

              <div>
                <div style={{fontSize:12,fontWeight:700,color:T.muted,marginBottom:6,letterSpacing:"0.05em"}}>TOTAL FIXED CHARGES PER FLAT</div>
                <div style={{fontSize:20,fontWeight:800,color:T.accent}}>{fmt(maintenanceFee + METER_FEE)}</div>
                <div style={{fontSize:11,color:T.muted,marginTop:3}}>Maintenance {fmt(maintenanceFee)} + Meter fee ₹{METER_FEE} = {fmt(maintenanceFee+METER_FEE)} per flat / month</div>
              </div>
            </Card>
          </div>
        )}
      </main>
      </div>

      {/* ── MODALS ── */}
      {modal?.type==="downloadPicker"&&(
        <Modal title="Download Bill as Excel" onClose={()=>setModal(null)}>
          <div style={{fontSize:13,color:T.muted,marginBottom:16}}>Select the month you want to download:</div>
          {billedMonths.length===0&&<div style={{color:T.red,fontSize:13}}>No billed months available yet.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            {billedMonths.map(mk=>{
              const fb=getFlatBills(mk);
              const paid=fb.filter(x=>payments[`${x.id}-${mk}`]).length;
              return (
                <div key={mk} onClick={()=>{downloadExcel(mk);setModal(null);}} style={{
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"12px 16px",background:T.surface2,borderRadius:9,
                  border:`1px solid ${T.border}`,cursor:"pointer",transition:"border-color 0.15s"
                }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14}}>{fmtMK(mk)}</div>
                    <div style={{fontSize:11,color:T.muted,marginTop:2}}>
                      {fb.length} flats · {paid} paid · Total: {fmt(fb.reduce((s,x)=>s+x.bill.total,0))}
                    </div>
                  </div>
                  <span style={{color:T.accent,fontSize:18}}>⬇</span>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {/* ── METER SCAN MODAL ── */}
      {scanModal&&(
        <Modal
          title={`Scan Meter — ${scanModal.label}`}
          onClose={()=>setScanModal(null)}
        >
          <MeterScanner
            flatId={scanModal.id}
            flatLabel={scanModal.label}
            prevReading={(() => {
              const keys = Object.keys(readings[scanModal.id]||{}).sort();
              return keys.length >= 1 ? readings[scanModal.id][keys[keys.length-1]] : null;
            })()}
            onConfirm={val => {
              setDraftR(r => ({...r, [scanModal.id]: String(val)}));
              setScanModal(null);
            }}
            onClose={()=>setScanModal(null)}
          />
        </Modal>
      )}

      {modal?.type==="ok"&&<Modal title="Done" onClose={()=>setModal(null)}><p style={{color:T.muted,fontSize:13}}>{modal.msg}</p><Btn onClick={()=>setModal(null)}>OK</Btn></Modal>}

      {modal?.type==="notif"&&(
        <Modal title={`Notify — Flat ${modal.flatId} · ${fmtMK(modal.mk)}`} onClose={()=>setModal(null)} wide>
          <NotifPreview flatId={modal.flatId} bill={modal.bill} mk={modal.mk} contact={contacts[modal.flatId]} advance={advances[modal.flatId]}/>
          <div style={{marginTop:14,display:"flex",gap:9}}>
            <Btn variant="ghost">✉ Send Email</Btn>
            <Btn variant="success">💬 Send WhatsApp</Btn>
          </div>
        </Modal>
      )}

      {modal?.type==="ocr"&&(
        <Modal title={`Verify Payment — Flat ${modal.flatId}`} onClose={()=>setModal(null)}>
          <PaymentVerifier flatId={modal.flatId} bill={modal.bill} mk={modal.mk}
            onVerified={txn=>{togglePaid(modal.flatId,modal.mk,txn);setModal({type:"ok",msg:`✓ Flat ${modal.flatId} marked paid for ${fmtMK(modal.mk)}`});}}
            onClose={()=>setModal(null)}/>
        </Modal>
      )}

      {modal?.type==="adv"&&(
        <Modal title={`Advance — Flat ${modal.flatId}${contacts[modal.flatId]?.name?` · ${contacts[modal.flatId].name}`:""}`} onClose={()=>setModal(null)}>
          <AdvanceManager flatId={modal.flatId} advance={advances[modal.flatId]}
            onSave={entry=>{addAdvance(modal.flatId,entry);}}/>
        </Modal>
      )}

      {modal?.type==="edit"&&(
        <Modal title={`Edit Contact — Flat ${modal.flatId}`} onClose={()=>setModal(null)}>
          <Inp label="Name" value={modal.draft.name||""} onChange={v=>setModal(m=>({...m,draft:{...m.draft,name:v}}))} placeholder="Sharma Family"/>
          <Inp label="Email" value={modal.draft.email||""} onChange={v=>setModal(m=>({...m,draft:{...m.draft,email:v}}))} placeholder="sharma@email.com"/>
          <Inp label="Phone" value={modal.draft.phone||""} onChange={v=>setModal(m=>({...m,draft:{...m.draft,phone:v}}))} placeholder="9876543210"/>
          <div style={{display:"flex",gap:9,marginTop:4}}>
            <Btn onClick={()=>{setContacts(c=>({...c,[modal.flatId]:modal.draft}));setModal({type:"ok",msg:`✓ Contact updated for Flat ${modal.flatId}`});}}>Save</Btn>
            <Btn variant="muted" onClick={()=>setModal(null)}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
