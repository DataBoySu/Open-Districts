// ─── MOCK TRANSLATIONS — OpenDistricts V4 ─────────────────────────────────────
// Schema source: docs/V4-transition-schema.md
// Format: BCP 47 locale codes. Keys are dot-notation UI keys (not DOM IDs).
// Supported: "en" (English), "or" (Odia), "hi" (Hindi)

export const MOCK_TRANSLATIONS = [

    {
        locale: "en",
        strings: {
            // Top bar
            "ui.appName": "OpenDistricts",
            "ui.currentDistrict": "CURRENT DISTRICT",
            "ui.changeArea": "CHANGE AREA",
            "ui.districtMode": "DISTRICT",
            "ui.liveMode": "LIVE",
            "ui.guidedAI": "GUIDED AI",
            "ui.live": "LIVE",
            "ui.historical": "HISTORICAL",
            "ui.cloudActive": "CLOUD ACTIVE",

            // Timeline panel
            "ui.weeklyEvents": "WEEKLY EVENTS",
            "ui.today": "Today",
            "ui.verified": "Verified",
            "ui.unverified": "Unverified",

            // AI panel
            "ui.guidedIntelligence": "Guided Intelligence",
            "ui.selectQuery": "SELECT A QUERY",
            "ai.general.context": "DISTRICT · {name} · GENERAL",
            "ai.intent.diseaseHistory": "Disease History",
            "ai.intent.diseaseHistorySub": "Historical spread and severity trends for this district",
            "ai.intent.nearestFacility": "Nearest Health Facility",
            "ai.intent.nearestFacilitySub": "Find operational PHCs within 10km",
            "ai.intent.waterStatus": "Water Point Status",
            "ai.intent.waterStatusSub": "Active borewells and supply coverage today",
            "ai.intent.safeTravel": "Safe Travel Routes",
            "ai.intent.safeTravelSub": "Road conditions and mobility advisories",
            "ai.intent.spreading": "Is This Spreading?",
            "ai.intent.spreadingSub": "7-day case trajectory for this event",
            "ai.intent.historicalCompare": "Historical Comparison",
            "ai.intent.historicalCompareSub": "Same event type, same region — past 3 years",

            // Hierarchy selector
            "ui.selectDistrict": "Select Your District",
            "ui.searchState": "Search state...",
            "ui.back": "Back",
            "ui.alertCount": "{count} alerts",

            // Time axis
            "ui.play": "PLAY",
            "ui.fastForward": "FF",

            // Severity labels
            "sev.critical": "Critical",
            "sev.elevated": "Elevated",
            "sev.informational": "Info",
            "sev.clear": "Clear",

            // Category labels
            "category.health": "Health",
            "category.safety": "Safety",
            "category.mobility": "Mobility",
            "category.weather": "Weather",
            "category.emergency": "Emergency",
            "category.infrastructure": "Infrastructure",

            // Detail row labels
            "detail.cases": "CASES",
            "detail.wards": "WARDS",
            "detail.teams": "TEAMS",
            "detail.source": "SOURCE",
            "detail.updated": "UPDATED",
            "detail.region": "REGION",
            "detail.action": "ACTION"
        }
    },

    {
        locale: "or",
        strings: {
            // Top bar
            "ui.appName": "OpenDistricts",
            "ui.currentDistrict": "ବର୍ତ୍ତମାନ ଜିଲ୍ଲା",
            "ui.changeArea": "ଅଞ୍ଚଳ ପ୍ରବର୍ତ",
            "ui.districtMode": "ଜିଲ୍ଲା",
            "ui.liveMode": "ସରାସରି",
            "ui.guidedAI": "ନିର୍ଦ୍ଦେଶ AI",
            "ui.live": "ସରାସରି",
            "ui.historical": "ଐତିହାସିକ",
            "ui.cloudActive": "ସଂଯୁକ୍ତ",

            // Timeline panel
            "ui.weeklyEvents": "ସାପ୍ତାହିକ ଘଟଣା",
            "ui.today": "ଆଜି",
            "ui.verified": "ଯାଞ୍ଚ ହୋଇଛି",
            "ui.unverified": "ଅଯାଞ୍ଚିତ",

            // AI panel
            "ui.guidedIntelligence": "ନିର୍ଦ୍ଦେଶିତ ବୁଦ୍ଧି",
            "ui.selectQuery": "ଏକ ପ୍ରଶ୍ନ ବାଛନ୍ତୁ",
            "ai.general.context": "ଜିଲ୍ଲା · {name} · ସାଧାରଣ",
            "ai.intent.diseaseHistory": "ରୋଗ ଇତିହାସ",
            "ai.intent.diseaseHistorySub": "ଏହି ଜିଲ୍ଲার ବ୍ୟାପ୍ତି ଓ ଗୁରୁତ୍ୱ ଧାରା",
            "ai.intent.nearestFacility": "ନିକଟତମ ସ୍ୱାସ୍ଥ୍ୟ ସ୍ଥାପନ",
            "ai.intent.nearestFacilitySub": "10 କିମି ମଧ୍ୟରେ PHC",
            "ai.intent.waterStatus": "ଜଳ ବିନ୍ଦୁ ସ୍ଥିତି",
            "ai.intent.waterStatusSub": "ଆଜି ସକ୍ରିୟ ବୋରୱେଲ",
            "ai.intent.safeTravel": "ନିରାପଦ ଯାତ୍ରା",
            "ai.intent.safeTravelSub": "ରାସ୍ତା ଅବସ୍ଥା ଓ ଯାନ ପଥ",
            "ai.intent.spreading": "ବ୍ୟାପୁଛି କି?",
            "ai.intent.spreadingSub": "7 ଦିନ ମାମଲା ଧାରା",
            "ai.intent.historicalCompare": "ଐତିହାସିକ ତୁଳନା",
            "ai.intent.historicalCompareSub": "ସମାନ ଘଟଣା — ଗତ 3 ବର୍ଷ",

            // Hierarchy selector
            "ui.selectDistrict": "ଆପଣଙ୍କ ଜିଲ୍ଲା ବାଛନ୍ତୁ",
            "ui.searchState": "ରାଜ୍ୟ ଖୋଜନ୍ତୁ...",
            "ui.back": "ଫେରନ୍ତୁ",
            "ui.alertCount": "{count} ସତର୍କ",

            // Time axis
            "ui.play": "ଚଳାନ୍ତୁ",
            "ui.fastForward": "ଦ୍ରୁତ",

            // Severity labels
            "sev.critical": "ଗୁରୁତ୍ୱ",
            "sev.elevated": "ଉଚ୍ଚ",
            "sev.informational": "ସୂଚନା",
            "sev.clear": "ସ୍ୱଚ୍ଛ",

            // Category labels
            "category.health": "ସ୍ୱାସ୍ଥ୍ୟ",
            "category.safety": "ସୁରକ୍ଷା",
            "category.mobility": "ଯାନ",
            "category.weather": "ପାଣିପାଗ",
            "category.emergency": "ଜରୁରୀ",
            "category.infrastructure": "ଭିତ୍ତିଭୂମି",

            // Detail row labels
            "detail.cases": "ମାମଲା",
            "detail.wards": "ୱାର୍ଡ",
            "detail.teams": "ଦଳ",
            "detail.source": "ଉତ୍ସ",
            "detail.updated": "ଅଦ୍ୟତନ",
            "detail.region": "ଅଞ୍ଚଳ",
            "detail.action": "ପଦକ୍ଷେପ"
        }
    },

    {
        locale: "hi",
        strings: {
            // Top bar
            "ui.appName": "OpenDistricts",
            "ui.currentDistrict": "वर्तमान जिला",
            "ui.changeArea": "क्षेत्र बदलें",
            "ui.districtMode": "जिला",
            "ui.liveMode": "लाइव",
            "ui.guidedAI": "निर्देशित AI",
            "ui.live": "लाइव",
            "ui.historical": "ऐतिहासिक",
            "ui.cloudActive": "सक्रिय",

            // Timeline panel
            "ui.weeklyEvents": "साप्ताहिक घटनाएं",
            "ui.today": "आज",
            "ui.verified": "सत्यापित",
            "ui.unverified": "असत्यापित",

            // AI panel
            "ui.guidedIntelligence": "निर्देशित बुद्धिमत्ता",
            "ui.selectQuery": "एक प्रश्न चुनें",
            "ai.general.context": "जिला · {name} · सामान्य",
            "ai.intent.diseaseHistory": "रोग इतिहास",
            "ai.intent.diseaseHistorySub": "इस जिले के प्रसार और गंभीरता के रुझान",
            "ai.intent.nearestFacility": "निकटतम स्वास्थ्य केंद्र",
            "ai.intent.nearestFacilitySub": "10 किमी के भीतर सक्रिय PHC",
            "ai.intent.waterStatus": "जल बिंदु स्थिति",
            "ai.intent.waterStatusSub": "आज सक्रिय बोरवेल",
            "ai.intent.safeTravel": "सुरक्षित यात्रा",
            "ai.intent.safeTravelSub": "सड़क की स्थिति और यातायात",
            "ai.intent.spreading": "क्या फैल रहा है?",
            "ai.intent.spreadingSub": "7-दिन की मामला प्रवृत्ति",
            "ai.intent.historicalCompare": "ऐतिहासिक तुलना",
            "ai.intent.historicalCompareSub": "समान घटना — पिछले 3 वर्ष",

            // Hierarchy selector
            "ui.selectDistrict": "अपना जिला चुनें",
            "ui.searchState": "राज्य खोजें...",
            "ui.back": "वापस",
            "ui.alertCount": "{count} अलर्ट",

            // Time axis
            "ui.play": "चलाएं",
            "ui.fastForward": "तेज़",

            // Severity labels
            "sev.critical": "गंभीर",
            "sev.elevated": "उच्च",
            "sev.informational": "जानकारी",
            "sev.clear": "स्पष्ट",

            // Category labels
            "category.health": "स्वास्थ्य",
            "category.safety": "सुरक्षा",
            "category.mobility": "यातायात",
            "category.weather": "मौसम",
            "category.emergency": "आपातकाल",
            "category.infrastructure": "बुनियादी ढांचा",

            // Detail row labels
            "detail.cases": "मामले",
            "detail.wards": "वार्ड",
            "detail.teams": "दल",
            "detail.source": "स्रोत",
            "detail.updated": "अद्यतन",
            "detail.region": "क्षेत्र",
            "detail.action": "कार्रवाई"
        }
    }
];
