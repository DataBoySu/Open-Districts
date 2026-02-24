// ═══════════════════════════════════════════
// DATA FRAMES — Temporal Slider
// ═══════════════════════════════════════════
const dataFrames = [
  {
    label: '2021 — Baseline',
    year: '2021',
    tag: 'ok', tagText: 'Good Coverage',
    alerts: 3, phc: 10, water: 20,
    vaxPct: 45, vaxDate: 'Mar 15', vaxTarget: '1,800 children',
    showDisease: false, showWater: false, showInfra: true,
    hudSub: 'Odisha · High PHC Density Phase',
    featurePulse: 'phc',
  },
  {
    label: '2022 — Vaccination Drive',
    year: '2022',
    tag: 'ok', tagText: 'Vax Drive Active',
    alerts: 2, phc: 12, water: 22,
    vaxPct: 82, vaxDate: 'Apr 10', vaxTarget: '2,200 children',
    showDisease: false, showWater: false, showInfra: true,
    hudSub: 'Odisha · Vaccination Drive Peak',
    featurePulse: 'phc',
  },
  {
    label: '2023 — Swine Flu Peak',
    year: '2023',
    tag: 'danger', tagText: 'Swine Flu Alert',
    alerts: 14, phc: 9, water: 18,
    vaxPct: 58, vaxDate: 'Jun 20', vaxTarget: '2,000 children',
    showDisease: true, showWater: false, showInfra: false,
    hudSub: 'Odisha · Swine Flu Outbreak',
    featurePulse: 'fever',
  },
  {
    label: '2024 — Recovery',
    year: '2024',
    tag: 'ok', tagText: 'Recovering',
    alerts: 6, phc: 11, water: 23,
    vaxPct: 69, vaxDate: 'Oct 05', vaxTarget: '2,300 children',
    showDisease: false, showWater: true, showInfra: true,
    hudSub: 'Odisha · Post-outbreak Recovery',
    featurePulse: 'water',
  },
  {
    label: 'Current — 2025–26',
    year: 'Current',
    tag: 'ok', tagText: 'Live Data',
    alerts: 7, phc: 12, water: 24,
    vaxPct: 73, vaxDate: 'Feb 27', vaxTarget: '2,400 children',
    showDisease: true, showWater: true, showInfra: true,
    hudSub: 'Odisha · 12 PHCs Active',
    featurePulse: null,
  },
];

let currentFrame = 4; // start at Current
let currentKnowledge = 'disease';
let currentDistrict = { name: 'Khordha', state: 'Odisha', alerts: 7, phc: 12, water: 24 };
let skeletonTimer;

// ═══════════════════════════════════════════
// APPLY DATA FRAME
// ═══════════════════════════════════════════
function applyFrame(idx) {
  const f = dataFrames[idx];
  currentFrame = idx;

  // Timeline label
  document.getElementById('tl-val').textContent = f.label;
  const pct = (idx / 4) * 100;
  const slider = document.getElementById('tl-slider');
  slider.style.background = `linear-gradient(to right, var(--primary) ${pct}%, var(--surface-3) ${pct}%)`;

  // Stat cards
  document.getElementById('sc1-n').textContent = f.alerts;
  document.getElementById('sc2-n').textContent = f.phc;
  document.getElementById('sc3-n').textContent = f.water;

  // Vax card
  document.getElementById('vax-fill').style.width = f.vaxPct + '%';
  document.getElementById('vax-pct').textContent = `Coverage: ${f.vaxPct}%`;
  document.getElementById('vax-date').textContent = f.vaxDate;
  document.getElementById('vax-target').textContent = `Target: ${f.vaxTarget}`;

  // HUD
  document.getElementById('hud-sub').textContent = f.hudSub;

  // Data banner
  const banner = document.getElementById('data-banner');
  if (idx < 4) {
    banner.classList.add('visible');
    document.getElementById('db-year').textContent = f.year;
    const tag = document.getElementById('db-tag');
    tag.textContent = f.tagText;
    tag.className = `db-tag ${f.tag}`;
  } else {
    banner.classList.remove('visible');
  }

  // Map layer visibility based on frame
  applyLayersForFrame(f);

  // Skeleton flash
  flashSkeleton();
}

function applyLayersForFrame(f) {
  const diseaseEls = document.querySelectorAll('.layer-disease');
  const waterEls = document.querySelectorAll('.layer-water');
  const infraEls = document.querySelectorAll('.layer-infra');

  const showD = currentKnowledge === 'disease' && f.showDisease;
  const showW = currentKnowledge === 'water' && f.showWater;
  const showI = currentKnowledge === 'infra' && f.showInfra;
  const showAll = currentKnowledge === 'disease' || true; // in "all" mode

  diseaseEls.forEach(el => el.style.opacity = (currentKnowledge === 'disease' && f.showDisease) || (currentKnowledge === 'infra' && false) || (currentKnowledge === 'water' && false) ? '1' : currentKnowledge === 'disease' ? '0.15' : '0.08');
  waterEls.forEach(el => el.style.opacity = currentKnowledge === 'water' ? '1' : '0.2');
  infraEls.forEach(el => el.style.opacity = currentKnowledge === 'infra' ? '1' : '0.3');

  // Simpler: just show/hide by knowledge state
  applyKnowledgeLayers();
}

// ═══════════════════════════════════════════
// KNOWLEDGE TOGGLE
// ═══════════════════════════════════════════
function setKnowledge(type) {
  currentKnowledge = type;
  const btns = document.querySelectorAll('.kt-btn');
  btns.forEach(b => { b.classList.remove('active', 'danger', 'primary', 'ok'); });

  const map = { disease: ['kt-disease', 'danger'], water: ['kt-water', 'primary'], infra: ['kt-infra', 'ok'] };
  const [id, cls] = map[type];
  document.getElementById(id).classList.add('active', cls);

  applyKnowledgeLayers();
  flashSkeleton();
}

function applyKnowledgeLayers() {
  const f = dataFrames[currentFrame];
  const disease = document.querySelectorAll('.layer-disease');
  const water = document.querySelectorAll('.layer-water');
  const infra = document.querySelectorAll('.layer-infra');

  // Disease layer: show if knowledge=disease AND frame has disease data
  disease.forEach(el => {
    el.style.opacity = (currentKnowledge === 'disease' && f.showDisease) ? '1' :
      currentKnowledge === 'disease' ? '0.12' : '0.08';
    el.style.transition = 'opacity 0.4s';
  });

  water.forEach(el => {
    el.style.opacity = currentKnowledge === 'water' ? '1' : '0.15';
    el.style.transition = 'opacity 0.4s';
  });

  infra.forEach(el => {
    el.style.opacity = currentKnowledge === 'infra' ? '1' : '0.3';
    el.style.transition = 'opacity 0.4s';
  });
}

// ═══════════════════════════════════════════
// TIMELINE SLIDER
// ═══════════════════════════════════════════
document.getElementById('tl-slider').addEventListener('input', function () {
  applyFrame(parseInt(this.value));
});

// ═══════════════════════════════════════════
// LANGUAGE SEGMENTED CONTROL
// ═══════════════════════════════════════════
function selectLang(el) {
  document.querySelectorAll('.lang-seg-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const lang = el.dataset.lang;
  const t = translations[lang];
  if (!t) return;

  try {
    document.querySelector('.brand-name-en').textContent = t.brandName;
    document.querySelector('.rc-label').textContent = t.district;
    document.querySelector('.conn-label').textContent = t.online;

    document.getElementById('tab-dash').textContent = t.dashTab;
    document.getElementById('tab-mosathi').textContent = t.botTab;

    // Update toggles
    document.getElementById('kt-disease').childNodes[2].nodeValue = t.disease;
    document.getElementById('kt-water').childNodes[2].nodeValue = t.water;
    document.getElementById('kt-infra').childNodes[2].nodeValue = t.infra;

    // Update cards
    let snapL = document.getElementById('snap-label');
    if (snapL) snapL.textContent = `${t.snap} — ${currentDistrict.name}`;

    document.getElementById('sc1-p').textContent = t.healthAlerts;
    document.getElementById('sc1-p').nextElementSibling.textContent = t.healthSub;

    document.getElementById('sc2-p').textContent = t.phcOp;
    document.getElementById('sc2-p').nextElementSibling.textContent = t.phcSub;

    document.getElementById('sc3-p').textContent = t.waterPts;
    document.getElementById('sc3-p').nextElementSibling.textContent = t.waterSub;

    document.getElementById('vax-t1').textContent = t.vaxDrive;
    document.querySelector('.pc-t2').textContent = t.vaxSub;

    document.querySelector('.sb-odia').textContent = t.speak;
    document.querySelector('.sb-en').textContent = t.speakSub;

    const tickerItems = document.querySelectorAll('.t-item');
    if (tickerItems.length >= 6) {
      tickerItems[0].childNodes[2].nodeValue = t.feverTick;
      tickerItems[1].childNodes[2].nodeValue = t.waterTick;
      tickerItems[2].childNodes[2].nodeValue = t.vaxTick;
      tickerItems[3].childNodes[2].nodeValue = t.roadTick;
      tickerItems[4].childNodes[2].nodeValue = t.phcTick;
      tickerItems[5].childNodes[2].nodeValue = t.ashaTick;
    }
  } catch (e) { console.error('Translation error', e); }
}

const translations = {
  'EN': {
    brandName: 'Community Health Kiosk',
    district: 'District',
    online: 'Cloud Active',
    dashTab: '📊 Dashboard',
    botTab: '💬 MoSathi Chat',
    disease: 'Disease Trends',
    water: 'Water Security',
    infra: 'Infrastructure',
    snap: 'Local Snapshot',
    healthAlerts: 'Active Health Alerts',
    healthSub: 'Tap for Report',
    phcOp: 'PHCs Operational',
    phcSub: 'Tap for Details',
    waterPts: 'Water Points Active',
    waterSub: 'Live Status',
    vaxDrive: 'Vaccination Drive',
    vaxSub: 'Coverage Target',
    speak: 'Talk to MoSathi',
    speakSub: 'Press & Speak',
    feverTick: 'Fever cluster — Balianta Block — 23 confirmed cases',
    waterTick: 'Borewell #7 restored — Tangi — Supply resumed 08:30',
    vaxTick: 'Vaccination camp — Khordha Block — Feb 27, 09:00–16:00',
    roadTick: 'NH-16 road block near Bhubaneswar — Diversion via SH-12',
    phcTick: 'New PHC operational — Bolagarh — Emergency: 104',
    ashaTick: 'ASHA worker training — Jatni — Feb 25–26, 08:00'
  },
  'OD': {
    brandName: 'କମ୍ୟୁନିଟି ହେଲଥ କିଓସ୍କ',
    district: 'ଜିଲ୍ଲା',
    online: 'କ୍ଲାଉଡ୍ ସକ୍ରିୟ',
    dashTab: '📊 ଡ୍ୟାସବୋର୍ଡ',
    botTab: '💬 ମୋ ସାଥୀ ଚାଟ୍',
    disease: 'ରୋଗ ଧାରା',
    water: 'ଜଳ ନିରାପତ୍ତା',
    infra: 'ଭିତ୍ତିଭୂମି',
    snap: 'ସ୍ଥାନୀୟ ସ୍ନାପସଟ୍',
    healthAlerts: 'ସ୍ୱାସ୍ଥ୍ୟ ସତର୍କତା',
    healthSub: 'ରିପୋର୍ଟ ପାଇଁ ଟ୍ୟାପ୍ କରନ୍ତୁ',
    phcOp: 'PHC ସଚଳ ଅଛି',
    phcSub: 'ବିବରଣୀ ପାଇଁ ଟ୍ୟାପ୍ କରନ୍ତୁ',
    waterPts: 'ଜଳ ବିନ୍ଦୁ',
    waterSub: 'ଲାଇଭ୍ ସ୍ଥିତି',
    vaxDrive: 'ଟୀକାକରଣ ଡ୍ରାଇଭ',
    vaxSub: 'କଭରେଜ୍ ଲକ୍ଷ୍ୟ',
    speak: 'ମୋ ସାଥୀ ସହ କଥା ହୁଅ',
    speakSub: 'ଦବାନ୍ତୁ ଏବଂ କୁହନ୍ତୁ',
    feverTick: 'ଜ୍ୱର ସଂକ୍ରମଣ — ବାଲିଅନ୍ତା ବ୍ଲକ — 23 ଟି ମାମଲା',
    waterTick: 'ବୋରୱେଲ୍ #7 ମରାମତି ହୋଇଛି — ଟାଙ୍ଗୀ',
    vaxTick: 'ଟିକାକରଣ ଶିବିର — ଖୋର୍ଦ୍ଧା ବ୍ଲକ',
    roadTick: 'ଭୁବନେଶ୍ୱର ନିକଟରେ NH-16 ରାସ୍ତା ଅବରୋଧ',
    phcTick: 'ନୂତନ PHC କାର୍ଯ୍ୟକ୍ଷମ — ବୋଲାଗଡ — ଜରୁରୀକାଳୀନ: 104',
    ashaTick: 'ଆଶା କର୍ମୀ ତାଲିମ — ଜଟଣୀ'
  },
  'MH': {
    brandName: 'समुदाय आरोग्य किओस्क',
    district: 'जिल्हा',
    online: 'क्लाउड सक्रिय',
    dashTab: '📊 डॅशबोर्ड',
    botTab: '💬 मोसाथी चॅट',
    disease: 'रोगाचा कल',
    water: 'पाणी सुरक्षा',
    infra: 'पायाभूत सुविधा',
    snap: 'स्थानिक स्नॅपशॉट',
    healthAlerts: 'सक्रिय आरोग्य सूचना',
    healthSub: 'अहवालासाठी टॅप करा',
    phcOp: 'PHC कार्यरत आहेत',
    phcSub: 'तपशीलांसाठी टॅप करा',
    waterPts: 'पाण्याचे बिंदू सक्रिय',
    waterSub: 'थेट स्थिती',
    vaxDrive: 'लसीकरण मोहीम',
    vaxSub: 'कव्हरेज लक्ष्य',
    speak: 'मोसाथीशी बोला',
    speakSub: 'दाबा आणि बोला',
    feverTick: 'तापाचा प्रादुर्भाव - 23 प्रकरणांची नोंद',
    waterTick: 'बोअरवेल 7 दुरुस्त केले',
    vaxTick: 'लसीकरण शिबिर - 27 फेब्रुवारी',
    roadTick: 'रस्ता अडवला - मार्ग वळवला',
    phcTick: 'नवीन PHC कार्यरत - आणीबाणी: 104',
    ashaTick: 'आशा स्वयंसेविकांचे प्रशिक्षण'
  }
};

// ═══════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════
function switchTab(t) {
  ['dash', 'mosathi'].forEach(id => {
    document.getElementById('tab-' + id).classList.remove('active');
  });
  document.getElementById('tab-' + t).classList.add('active');

  const dp = document.getElementById('dashboard-panel');
  const mp = document.getElementById('mosathi-panel');

  if (t === 'dash') {
    dp.style.display = 'flex';
    mp.style.display = 'none';
  } else {
    dp.style.display = 'none';
    mp.style.display = 'flex';
    document.getElementById('chat-result').classList.remove('visible');
  }
}

// ═══════════════════════════════════════════
// INTENT CARDS
// ═══════════════════════════════════════════
function runIntent(id) {
  const cr = document.getElementById('chat-result');
  const crH = document.getElementById('cr-header');
  const crB = document.getElementById('cr-body');

  cr.classList.add('visible');

  if (id === 'disease-history') {
    // Animate timeline to 2023
    const slider = document.getElementById('tl-slider');
    slider.value = 2;
    applyFrame(2);
    setKnowledge('disease');
    document.getElementById('kt-disease').click();
    crH.textContent = '📈 Disease History: Khordha (2023)';
    crB.textContent = 'Timeline set to 2023 — Swine Flu peak. 14 active alerts detected. Fever polygons rendered over Balianta and Cuttack blocks. PHC count reduced to 9 operational centers during this period.';
  } else if (id === 'nearest-hospitals') {
    setKnowledge('infra');
    document.getElementById('kt-infra').click();
    crH.textContent = '🏥 Nearest Operational PHCs';
    crB.textContent = 'Infrastructure layer activated. 12 PHC tiles highlighted. Nearest: Balianta PHC — 2.1 km. Tangi PHC — 4.8 km. Bolagarh PHC — 6.3 km. Call 104 for emergency referral.';
    // Reset to current frame
    document.getElementById('tl-slider').value = 4;
    applyFrame(4);
  } else if (id === 'water-status') {
    setKnowledge('water');
    document.getElementById('kt-water').click();
    crH.textContent = '💧 Water Point Status — Today';
    crB.textContent = '24 of 27 water points active. Borewell #7 (Tangi) restored this morning. 3 points in Balianta under maintenance — alternate tanker supply arranged. No contamination reports.';
    document.getElementById('tl-slider').value = 4;
    applyFrame(4);
  }

  flashSkeleton();
}

// ═══════════════════════════════════════════
// REGION MODAL — District selection
// ═══════════════════════════════════════════
function openRegionModal() {
  document.getElementById('region-modal').classList.add('visible');
}
function closeRegionModal() {
  document.getElementById('region-modal').classList.remove('visible');
}

let selectedPolyId = 'od-khordha';

function selectDistrict(state, name, stateName, alerts, phc, water) {
  // Remove dimming from all polys in this state
  const prefix = state + '-';
  document.querySelectorAll('.dist-poly').forEach(p => {
    if (p.id.startsWith(prefix)) {
      p.classList.remove('selected', 'dimmed');
      p.classList.add('dimmed');
    }
  });
  document.querySelectorAll('.dist-label').forEach(t => {
    const sibling = t.previousElementSibling;
    if (sibling && sibling.id && sibling.id.startsWith(prefix)) t.classList.add('dimmed');
    else t.classList.remove('dimmed');
  });

  const target = document.getElementById(`${state}-${name.toLowerCase()}`);
  if (target) {
    target.classList.remove('dimmed');
    target.classList.add('selected');
    selectedPolyId = target.id;
  }

  // Update all the data
  currentDistrict = { name, state: stateName, alerts, phc, water };
  document.getElementById('crumb-val').textContent = name;
  document.getElementById('hud-name').textContent = name;
  document.getElementById('snap-label').textContent = `Local Snapshot — ${name}`;
  document.getElementById('sc1-n').textContent = alerts;
  document.getElementById('sc2-n').textContent = phc;
  document.getElementById('sc3-n').textContent = water;
  document.getElementById('hud-sub').textContent = `${stateName} · ${phc} PHCs Active`;

  // Close after brief delay (let user see selection)
  setTimeout(closeRegionModal, 600);
  flashSkeleton();
}

// ═══════════════════════════════════════════
// SITUATION REPORT DRAWER
// ═══════════════════════════════════════════
const sitrepData = {
  fever: {
    icon: '<svg width="28" height="28"><use href="#icon-alert"/></svg>', title: 'Fever Outbreak — Balianta Block',
    loc: () => `${currentDistrict.name} · ${currentDistrict.state} · Updated Today 08:45`,
    body: '23 confirmed cases of seasonal fever reported in Balianta Block. Khordha District PHC has been notified. Mobile health teams deployed. Residents advised to use ORS, maintain hygiene, and visit nearest PHC if symptoms persist beyond 48 hours.',
    s: [['23', 'Cases'], ['4', 'Wards'], ['2', 'Teams']], cls: ['d', 'w', 'g'],
    cta: '📞 Call PHC Balianta — 104'
  },
  flu: {
    icon: '<svg width="28" height="28"><use href="#icon-alert"/></svg>', title: 'Swine Flu Alert — Cuttack Block',
    loc: () => `${currentDistrict.name} · ${currentDistrict.state} · Updated Yesterday`,
    body: 'Elevated H1N1 activity detected in Cuttack block. 8 confirmed cases, 3 hospitalized. District surveillance teams conducting contact tracing. Antiviral medication available at designated PHCs.',
    s: [['8', 'Cases'], ['3', 'Hospitalized'], ['1', 'PHC Alert']], cls: ['d', 'd', 'w'],
    cta: '📞 Call Surveillance Unit — 1800-11-1234'
  },
  water: {
    icon: '<svg width="28" height="28"><use href="#icon-water"/></svg>', title: 'Water Infrastructure — Active Status',
    loc: () => `${currentDistrict.name} · ${currentDistrict.state}`,
    body: '24 of 27 borewell and supply points active. Borewell #7 in Tangi restored at 08:30. 3 borewells in Balianta block under scheduled maintenance — alternate tanker supply arranged. No contamination reports filed.',
    s: [['24', 'Active'], ['3', 'Maintenance'], ['0', 'Contaminated']], cls: ['g', 'w', 'g'],
    cta: '📋 Report Water Issue — 1916'
  },
  phc: {
    icon: '<svg width="28" height="28"><use href="#icon-hospital"/></svg>', title: 'PHC Operational Status',
    loc: () => `${currentDistrict.name} · ${currentDistrict.state}`,
    body: () => `${currentDistrict.phc} of ${currentDistrict.phc + 2} PHCs are fully operational across ${currentDistrict.name}. 2 PHCs running on reduced hours. Emergency helpline 104 active 24/7. Nearest PHC: 2.1 km from this kiosk.`,
    s: () => [[currentDistrict.phc + '', 'Active'], [2, 'Reduced Hours'], ['104', 'Emergency']], cls: ['g', 'w', 'g'],
    cta: '📞 Find Nearest PHC — 104'
  },
};

function openSitrep(type) {
  const d = sitrepData[type] || sitrepData.fever;
  document.getElementById('srp-icon').innerHTML = d.icon;
  document.getElementById('srp-title').textContent = d.title;
  document.getElementById('srp-loc').textContent = typeof d.loc === 'function' ? d.loc() : d.loc;
  document.getElementById('srp-body').textContent = typeof d.body === 'function' ? d.body() : d.body;
  document.getElementById('srp-cta').textContent = d.cta;

  const stats = typeof d.s === 'function' ? d.s() : d.s;
  ['srs-1', 'srs-2', 'srs-3'].forEach((id, i) => {
    document.getElementById(id).textContent = stats[i][0];
    document.getElementById(id + 'l').textContent = stats[i][1];
    document.getElementById(id).parentElement.className = `srp-stat ${d.cls[i]}`;
  });

  document.getElementById('sitrep').classList.add('visible');
}
function closeSitrep() {
  document.getElementById('sitrep').classList.remove('visible');
}

// ═══════════════════════════════════════════
// VOICE
// ═══════════════════════════════════════════
let voiceTimer;
function openVoice() {
  document.getElementById('voice-ov').classList.add('visible');
  voiceTimer = setTimeout(closeVoice, 8000);
}
function closeVoice() {
  clearTimeout(voiceTimer);
  document.getElementById('voice-ov').classList.remove('visible');
}
document.getElementById('voice-ov').addEventListener('click', closeVoice);

// ═══════════════════════════════════════════
// SKELETON LOADER
// ═══════════════════════════════════════════
function flashSkeleton() {
  clearTimeout(skeletonTimer);
  const sk = document.getElementById('map-skeleton');
  sk.classList.add('visible');
  skeletonTimer = setTimeout(() => sk.classList.remove('visible'), 550);
}

// ═══════════════════════════════════════════
// ZOOM (mock — translates SVG viewBox)
// ═══════════════════════════════════════════
let vbX = 0, vbY = 0, vbW = 620, vbH = 430;
function zoomIn() {
  if (vbW <= 200) return;
  const cx = vbX + vbW / 2, cy = vbY + vbH / 2;
  vbW *= 0.7; vbH *= 0.7;
  vbX = cx - vbW / 2; vbY = cy - vbH / 2;
  document.getElementById('map-svg').setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
  flashSkeleton();
}
function zoomOut() {
  if (vbW >= 900) return;
  const cx = vbX + vbW / 2, cy = vbY + vbH / 2;
  vbW /= 0.7; vbH /= 0.7;
  vbX = cx - vbW / 2; vbY = cy - vbH / 2;
  vbX = Math.max(-50, vbX); vbY = Math.max(-30, vbY);
  document.getElementById('map-svg').setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
  flashSkeleton();
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
applyFrame(4);
applyKnowledgeLayers();
