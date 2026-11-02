import type { Lang } from "./data";

type L = Partial<Record<Lang, string>> & { en: string }; // all 9 languages fully supported (en ta hi ml te kn mr bn sa)

// Hero banner = running offers: festive offers, seasonal offers, brochures and ads.
// To change an offer, edit the text below (percentages and dates are placeholders until the client confirms them).
export type HeroSlide = {
  id: "festive" | "seasonal" | "brochure" | "daily"; // banner images carry their own text
  image: string;
  width: number;
  height: number;
  tone: string; // flat panel colour behind the image
  action: "shop-makeup" | "shop-all" | "book";
  kind: L; // small tag: Festive offer / Seasonal offer / Brochure / Today's deal
  badge: L; // the big discount pill on the picture
  title: L;
  copy: L;
  cta: L;
  alt: L;
};

export const heroSlides: HeroSlide[] = [
  {
    id: "festive",
    image: "/assets/hero/hb-festive.jpg",
    width: 1920,
    height: 823,
    tone: "#FFFFFF",
    action: "shop-all",
    kind: { en: "Festive offer", ta: "பண்டிகை ஆஃபர்", hi: "त्योहार ऑफर", ml: "ഉത്സവ ഓഫർ", te: "పండుగ ఆఫర్" , kn: "ಹಬ್ಬದ ಆಫರ್", mr: "सण ऑफर", bn: "উৎসব অফার", sa: "उत्सव-प्रस्तावः"},
    badge: { en: "Up to 20% OFF", ta: "20% வரை தள்ளுபடி", hi: "20% तक की छूट", ml: "20% വരെ കിഴിവ്", te: "20% వరకు తగ్గింపు" , kn: "20% ವರೆಗೆ ರಿಯಾಯಿತಿ", mr: "२०% पर्यंत सूट", bn: "২০% পর্যন্ত ছাড়", sa: "२०% यावत् न्यूनीकरणम्"},
    title: { en: "Festive season sale on herbal care", ta: "மூலிகை பராமரிப்புக்கு பண்டிகை கால சலுகை", hi: "हर्बल केयर पर त्योहारों की सेल", ml: "ഹെർബൽ കെയറിന് ഉത്സവകാല വിൽപ്പന", te: "హెర్బల్ కేర్‌పై పండుగ సేల్" , kn: "ಹರ್ಬಲ್ ಕೇರ್‌ನಲ್ಲಿ ಹಬ್ಬದ ಸೀಸನ್ ಸೇಲ್", mr: "हर्बल केअरवर सण हंगामाची सेल", bn: "হার্বাল কেয়ারে উৎসব সিজন সেল", sa: "औषधि-रक्षणे उत्सव-काल-विक्रयः"},
    copy: { en: "Hair oils, soaps, face creams and gift sets at festival prices. Free delivery above ₹1,999.", ta: "ஹேர் ஆயில், சோப்பு, ஃபேஸ் கிரீம், கிஃப்ட் செட் பண்டிகை விலையில். ₹1,999-க்கு மேல் இலவச டெலிவரி.", hi: "हेयर ऑयल, साबुन, फेस क्रीम और गिफ्ट सेट त्योहार के दामों पर। ₹1,999 से ऊपर फ्री डिलीवरी।", ml: "ഹെയർ ഓയിൽ, സോപ്പ്, ഫേസ് ക്രീം, ഗിഫ്റ്റ് സെറ്റ് ഉത്സവ വിലയിൽ. ₹1,999-ന് മുകളിൽ സൗജന്യ ഡെലിവറി.", te: "హెయిర్ ఆయిల్, సబ్బులు, ఫేస్ క్రీమ్‌లు, గిఫ్ట్ సెట్‌లు పండుగ ధరలకు. ₹1,999 పైన ఉచిత డెలివరీ." , kn: "ಹೇರ್ ಆಯಿಲ್, ಸೋಪ್, ಫೇಸ್ ಕ್ರೀಮ್ ಮತ್ತು ಗಿಫ್ಟ್ ಸೆಟ್‌ಗಳು ಹಬ್ಬದ ಬೆಲೆಯಲ್ಲಿ. ₹1,999 ಮೇಲೆ ಉಚಿತ ಡೆಲಿವರಿ.", mr: "हेअर ऑइल, साबण, फेस क्रीम आणि गिफ्ट सेट सण किंमतीत. ₹1,999 वर मोफत डिलिव्हरी.", bn: "চুলের তেল, সাবান, ফেস ক্রিম ও গিফট সেট উৎসবের দামে। ₹1,999-এর উপরে ফ্রি ডেলিভারি।", sa: "केश-तैलानि, साबुनानि, मुख-लेपानि उपहार-पेटिकाः च उत्सव-मूल्येषु। ₹१,९९९ उपरि मुक्त-प्रेषणम्।"},
    cta: { en: "Shop festive offers", ta: "பண்டிகை சலுகைகளை வாங்குங்கள்", hi: "त्योहार ऑफर खरीदें", ml: "ഉത്സവ ഓഫറുകൾ വാങ്ങൂ", te: "పండుగ ఆఫర్లు షాప్ చేయండి" , kn: "ಹಬ್ಬದ ಆಫರ್‌ಗಳನ್ನು ಖರೀದಿಸಿ", mr: "सण ऑफर खरेदी करा", bn: "উৎসব অফার কিনুন", sa: "उत्सव-प्रस्तावान् क्रीणातु"},
    alt: { en: "Revathi herbal products with festive offer", ta: "பண்டிகை சலுகையில் ரேவதி மூலிகைப் பொருட்கள்", hi: "त्योहार ऑफर पर रेवती हर्बल प्रोडक्ट्स", ml: "ഉത്സവ ഓഫറിൽ രേവതി ഹെർബൽ ഉൽപ്പന്നങ്ങൾ", te: "పండుగ ఆఫర్‌లో రేవతి హెర్బల్ ఉత్పత్తులు" , kn: "ಹಬ್ಬದ ಆಫರ್‌ನೊಂದಿಗೆ ರೇವತಿ ಹರ್ಬಲ್ ಉತ್ಪನ್ನಗಳು", mr: "सण ऑफरसह रेवती हर्बल उत्पादने", bn: "উৎসব অফার সহ রেবতী হার্বাল পণ্য", sa: "रेवती औषधि-उत्पादाः उत्सव-प्रस्तावेन सह"},
  },
  {
    id: "seasonal",
    image: "/assets/hero/hb-seasonal.jpg",
    width: 1920,
    height: 823,
    tone: "#FFFFFF",
    action: "shop-all",
    kind: { en: "Seasonal offer", ta: "சீசன் ஆஃபர்", hi: "सीज़न ऑफर", ml: "സീസൺ ഓഫർ", te: "సీజన్ ఆఫర్" , kn: "ಋತುವಿನ ಆಫರ್", mr: "हंगामी ऑफर", bn: "মৌসুমি অফার", sa: "ऋतु-प्रस्तावः"},
    badge: { en: "Gift sets from ₹999", ta: "கிஃப்ட் செட் ₹999 முதல்", hi: "गिफ्ट सेट ₹999 से", ml: "ഗിഫ്റ്റ് സെറ്റ് ₹999 മുതൽ", te: "గిఫ్ట్ సెట్‌లు ₹999 నుండి" , kn: "Gift sets from ₹999", mr: "Gift sets from ₹999", bn: "Gift sets from ₹999", sa: "उपहार-पेटिकाः ₹९९९ तः"},
    title: { en: "Herbal lipstick gift boxes for the season", ta: "இந்த சீசனுக்கான மூலிகை லிப்ஸ்டிக் கிஃப்ட் பெட்டிகள்", hi: "इस सीज़न के हर्बल लिपस्टिक गिफ्ट बॉक्स", ml: "ഈ സീസണിലെ ഹെർബൽ ലിപ്സ്റ്റിക് ഗിഫ്റ്റ് ബോക്സുകൾ", te: "ఈ సీజన్ హెర్బల్ లిప్‌స్టిక్ గిఫ్ట్ బాక్స్‌లు" , kn: "Herbal lipstick gift boxes for the season", mr: "Herbal lipstick gift boxes for the season", bn: "Herbal lipstick gift boxes for the season", sa: "ऋतवे औषधि-ओष्ठरञ्जक-उपहार-पेटिकाः"},
    copy: { en: "Six herbal shades in one box. A lovely gift for family and friends.", ta: "ஒரே பெட்டியில் ஆறு மூலிகை நிறங்கள். குடும்பத்தினருக்கும் நண்பர்களுக்கும் அழகான பரிசு.", hi: "एक बॉक्स में छह हर्बल शेड्स। परिवार और दोस्तों के लिए सुंदर तोहफ़ा।", ml: "ഒരു ബോക്സിൽ ആറ് ഹെർബൽ ഷേഡുകൾ. കുടുംബത്തിനും കൂട്ടുകാർക്കും മനോഹരമായ സമ്മാനം.", te: "ఒక్క బాక్స్‌లో ఆరు హెర్బల్ షేడ్స్. కుటుంబం, స్నేహితులకు చక్కని బహుమతి." , kn: "Six herbal shades in one box. A lovely gift for family and friends.", mr: "Six herbal shades in one box. A lovely gift for family and friends.", bn: "Six herbal shades in one box. A lovely gift for family and friends.", sa: "एकस्मिन् पेटिकायां षड् औषधि-वर्णाः। कुटुम्बाय मित्राय च सुन्दरम् उपहारम्।"},
    cta: { en: "See gift boxes", ta: "கிஃப்ட் பெட்டிகளைப் பாருங்கள்", hi: "गिफ्ट बॉक्स देखें", ml: "ഗിഫ്റ്റ് ബോക്സുകൾ കാണൂ", te: "గిఫ్ట్ బాక్స్‌లు చూడండి" , kn: "See gift boxes", mr: "See gift boxes", bn: "See gift boxes", sa: "उपहार-पेटिकाः पश्यतु"},
    alt: { en: "Revathi lipstick gift box with six shades", ta: "ஆறு நிறங்களுடன் ரேவதி லிப்ஸ்டிக் கிஃப்ட் பெட்டி", hi: "छह शेड्स वाला रेवती लिपस्टिक गिफ्ट बॉक्स", ml: "ആറ് ഷേഡുകളുള്ള രേവതി ലിപ്സ്റ്റിക് ഗിഫ്റ്റ് ബോക്സ്", te: "ఆరు షేడ్స్‌తో రేవతి లిప్‌స్టిక్ గిఫ్ట్ బాక్స్" , kn: "Revathi lipstick gift box with six shades", mr: "Revathi lipstick gift box with six shades", bn: "Revathi lipstick gift box with six shades", sa: "रेवती-ओष्ठरञ्जक-उपहार-पेटिका षड्भिः वर्णैः"},
  },
  {
    id: "brochure",
    image: "/assets/hero/hb-service.jpg",
    width: 1920,
    height: 823,
    tone: "#FFFFFF",
    action: "book",
    kind: { en: "Salon & spa brochure", ta: "சலூன் & ஸ்பா பிரசுரம்", hi: "सैलून और स्पा ब्रोशर", ml: "സലൂൺ & സ്പാ ബ്രോഷർ", te: "సెలూన్ & స్పా బ్రోషర్" , kn: "Salon & spa brochure", mr: "Salon & spa brochure", bn: "Salon & spa brochure", sa: "सैलून-स्पा-पत्रिका"},
    badge: { en: "Weekday spa offers", ta: "வார நாள் ஸ்பா சலுகை", hi: "वीकडे स्पा ऑफर", ml: "ആഴ്ചദിന സ്പാ ഓഫർ", te: "వారపు రోజుల స్పా ఆఫర్" , kn: "Weekday spa offers", mr: "Weekday spa offers", bn: "Weekday spa offers", sa: "कार्यदिन-स्पा-प्रस्तावाः"},
    title: { en: "Facials, bridal and spa packages", ta: "ஃபேஷியல், மணப்பெண் மற்றும் ஸ்பா பேக்கேஜ்கள்", hi: "फेशियल, ब्राइडल और स्पा पैकेज", ml: "ഫേഷ്യൽ, ബ്രൈഡൽ, സ്പാ പാക്കേജുകൾ", te: "ఫేషియల్, బ్రైడల్, స్పా ప్యాకేజీలు" , kn: "Facials, bridal and spa packages", mr: "Facials, bridal and spa packages", bn: "Facials, bridal and spa packages", sa: "मुखचिकित्साः, वैवाहिक-स्पा-सङ्कलनाः च"},
    copy: { en: "See our service brochure, pick a package and book your slot online.", ta: "எங்கள் சேவை பிரசுரத்தைப் பார்த்து, பேக்கேஜைத் தேர்ந்தெடுத்து ஆன்லைனில் நேரம் பதிவு செய்யுங்கள்.", hi: "हमारा सर्विस ब्रोशर देखें, पैकेज चुनें और ऑनलाइन स्लॉट बुक करें।", ml: "ഞങ്ങളുടെ സേവന ബ്രോഷർ കാണൂ, പാക്കേജ് തിരഞ്ഞെടുത്ത് ഓൺലൈനായി സമയം ബുക്ക് ചെയ്യൂ.", te: "మా సర్వీస్ బ్రోషర్ చూసి, ప్యాకేజీ ఎంచుకుని ఆన్‌లైన్‌లో స్లాట్ బుక్ చేయండి." , kn: "See our service brochure, pick a package and book your slot online.", mr: "See our service brochure, pick a package and book your slot online.", bn: "See our service brochure, pick a package and book your slot online.", sa: "अस्माकं सेवा-पत्रिकां पश्यतु, सङ्कलनं वृणु, स्थानं च जाले आरक्षतु।"},
    cta: { en: "Book Appointment", ta: "அப்பாயின்ட்மென்ட் பதிவு செய்", hi: "अपॉइंटमेंट बुक करें", ml: "അപ്പോയിന്റ്മെന്റ് ബുക്ക് ചെയ്യൂ", te: "అపాయింట్‌మెంట్ బుక్ చేయండి" , kn: "Book Appointment", mr: "Book Appointment", bn: "Book Appointment", sa: "समय-निर्धारणं आरक्षतु"},
    alt: { en: "A therapist giving a herbal facial at the Revathi spa", ta: "ரேவதி ஸ்பாவில் மூலிகை ஃபேஷியல் செய்யும் தெரபிஸ்ட்", hi: "रेवती स्पा में हर्बल फेशियल करती थेरेपिस्ट", ml: "രേവതി സ്പായിൽ ഹെർബൽ ഫേഷ്യൽ ചെയ്യുന്ന തെറാപ്പിസ്റ്റ്", te: "రేవతి స్పాలో హెర్బల్ ఫేషియల్ చేస్తున్న థెరపిస్ట్" , kn: "A therapist giving a herbal facial at the Revathi spa", mr: "A therapist giving a herbal facial at the Revathi spa", bn: "A therapist giving a herbal facial at the Revathi spa", sa: "रेवती-स्पा इत्यत्र औषधीय-मुखचिकित्सां कुर्वन् चिकित्सकः"},
  },
  {
    id: "daily",
    image: "/assets/hero/hb-combo.jpg",
    width: 1920,
    height: 823,
    tone: "#FFFFFF",
    action: "shop-all",
    kind: { en: "Today's deals", ta: "இன்றைய சலுகைகள்", hi: "आज के ऑफर", ml: "ഇന്നത്തെ ഓഫറുകൾ", te: "ఈ రోజు ఆఫర్లు" , kn: "ಇಂದಿನ ಡೀಲ್‌ಗಳು", mr: "आजचे डील्स", bn: "আজকের ডিল", sa: "अद्य प्रस्तावाः"},
    badge: { en: "Buy 2, save 10%", ta: "2 வாங்கினால் 10% சேமிப்பு", hi: "2 लें, 10% बचाएं", ml: "2 വാങ്ങിയാൽ 10% ലാഭം", te: "2 కొంటే 10% ఆదా" , kn: "2 ಖರೀದಿಸಿ, 10% ಉಳಿಸಿ", mr: "२ घ्या, १०% वाचवा", bn: "২ কিনুন, ১০% সাশ্রয়", sa: "२ क्रीत्वा १०% रक्षतु"},
    title: { en: "New offers every day", ta: "தினமும் புதிய சலுகைகள்", hi: "हर दिन नए ऑफर", ml: "ദിവസവും പുതിയ ഓഫറുകൾ", te: "ప్రతి రోజూ కొత్త ఆఫర్లు" , kn: "ಪ್ರತಿದಿನ ಹೊಸ ಆಫರ್‌ಗಳು", mr: "दररोज नवीन ऑफर", bn: "প্রতিদিন নতুন অফার", sa: "प्रतिदिनं नूतनाः प्रस्तावाः"},
    copy: { en: "First order discount, combo deals and free delivery. Check back daily.", ta: "முதல் ஆர்டர் தள்ளுபடி, காம்போ சலுகைகள், இலவச டெலிவரி. தினமும் பாருங்கள்.", hi: "पहले ऑर्डर पर छूट, कॉम्बो डील और फ्री डिलीवरी। रोज़ देखते रहें।", ml: "ആദ്യ ഓർഡർ കിഴിവ്, കോമ്പോ ഡീലുകൾ, സൗജന്യ ഡെലിവറി. ദിവസവും നോക്കൂ.", te: "మొదటి ఆర్డర్ తగ్గింపు, కాంబో డీల్స్, ఉచిత డెలివరీ. రోజూ చూడండి." , kn: "ಮೊದಲ ಆರ್ಡರ್ ರಿಯಾಯಿತಿ, ಕಾಂಬೋ ಡೀಲ್‌ಗಳು ಮತ್ತು ಉಚಿತ ಡೆಲಿವರಿ. ಪ್ರತಿದಿನ ಪರಿಶೀಲಿಸಿ.", mr: "पहिल्या ऑर्डरवर सूट, कॉम्बो डील्स आणि मोफत डिलिव्हरी. दररोज तपासा.", bn: "প্রথম অর্ডারে ছাড়, কম্বো ডিল ও ফ্রি ডেলিভারি। প্রতিদিন দেখুন।", sa: "प्रथम-आदेश-न्यूनता, संयोग-प्रस्तावाः मुक्त-प्रेषणं च। प्रतिदिनं पश्यतु।"},
    cta: { en: "Shop today's deals", ta: "இன்றைய சலுகைகளை வாங்குங்கள்", hi: "आज के ऑफर खरीदें", ml: "ഇന്നത്തെ ഓഫറുകൾ വാങ്ങൂ", te: "ఈ రోజు ఆఫర్లు షాప్ చేయండి" , kn: "ಇಂದಿನ ಡೀಲ್‌ಗಳನ್ನು ಖರೀದಿಸಿ", mr: "आजचे डील्स खरेदी करा", bn: "আজকের ডিল কিনুন", sa: "अद्य प्रस्तावान् क्रीणातु"},
    alt: { en: "Revathi herbal products on offer", ta: "சலுகையில் ரேவதி மூலிகைப் பொருட்கள்", hi: "ऑफर पर रेवती हर्बल प्रोडक्ट्स", ml: "ഓഫറിൽ രേവതി ഹെർബൽ ഉൽപ്പന്നങ്ങൾ", te: "ఆఫర్‌లో రేవతి హెర్బల్ ఉత్పత్తులు" , kn: "ಆಫರ್‌ನಲ್ಲಿ ರೇವತಿ ಹರ್ಬಲ್ ಉತ್ಪನ್ನಗಳು", mr: "ऑफरवर रेवती हर्बल उत्पादने", bn: "অফারে রেবতী হার্বাল পণ্য", sa: "प्रस्तावे रेवती-औषधीय-उत्पादाः"},
  },
];

// Running strip under the hero: general day-to-day offers. The brand line is added in Landing.tsx.
export const heroTicker: L[] = [
  { en: "Today's offer: up to 20% off herbal hair care", ta: "இன்றைய சலுகை: மூலிகை ஹேர் கேரில் 20% வரை தள்ளுபடி", hi: "आज का ऑफर: हर्बल हेयर केयर पर 20% तक की छूट", ml: "ഇന്നത്തെ ഓഫർ: ഹെർബൽ ഹെയർ കെയറിന് 20% വരെ കിഴിവ്", te: "ఈ రోజు ఆఫర్: హెర్బల్ హెయిర్ కేర్‌పై 20% వరకు తగ్గింపు" , kn: "ಇಂದಿನ ಆಫರ್: ಹರ್ಬಲ್ ಹೇರ್ ಕೇರ್‌ನಲ್ಲಿ 20% ವರೆಗೆ ರಿಯಾಯಿತಿ", mr: "आजचा ऑफर: हर्बल हेअर केअरवर २०% पर्यंत सूट", bn: "আজকের অফার: হার্বাল হেয়ার কেয়ারে ২০% পর্যন্ত ছাড়", sa: "अद्य प्रस्तावः: औषधीय-केश-रक्षणे २०% यावत् न्यूनीकरणम्"},
  { en: "Free delivery on orders above ₹1,999", ta: "₹1,999-க்கு மேல் ஆர்டருக்கு இலவச டெலிவரி", hi: "₹1,999 से ऊपर के ऑर्डर पर फ्री डिलीवरी", ml: "₹1,999-ന് മുകളിലുള്ള ഓർഡറിന് സൗജന്യ ഡെലിവറി", te: "₹1,999 పైన ఆర్డర్లకు ఉచిత డెలివరీ" , kn: "₹1,999 ಮೇಲಿನ ಆರ್ಡರ್‌ಗಳಿಗೆ ಉಚಿತ ಡೆಲಿವರಿ", mr: "₹1,999 वरील ऑर्डरवर मोफत डिलिव्हरी", bn: "₹1,999-এর বেশি অর্ডারে ফ্রি ডেলিভারি", sa: "₹१,९९९ उपरि आदेशेषु मुक्त-प्रेषणम्"},
  { en: "Buy 2 products, save 10%", ta: "2 பொருட்கள் வாங்கினால் 10% சேமிப்பு", hi: "2 प्रोडक्ट लें, 10% बचाएं", ml: "2 ഉൽപ്പന്നങ്ങൾ വാങ്ങിയാൽ 10% ലാഭം", te: "2 ఉత్పత్తులు కొంటే 10% ఆదా" , kn: "2 ಉತ್ಪನ್ನಗಳನ್ನು ಖರೀದಿಸಿ, 10% ಉಳಿಸಿ", mr: "२ उत्पादने घ्या, १०% वाचवा", bn: "২টি পণ্য কিনুন, ১০% সাশ্রয়", sa: "२ उत्पादौ क्रीत्वा १०% रक्षतु"},
  { en: "First order? Get a welcome discount", ta: "முதல் ஆர்டரா? வரவேற்பு தள்ளுபடி பெறுங்கள்", hi: "पहला ऑर्डर? वेलकम डिस्काउंट पाएं", ml: "ആദ്യ ഓർഡറോ? സ്വാഗത കിഴിവ് നേടൂ", te: "మొదటి ఆర్డరా? వెల్‌కమ్ డిస్కౌంట్ పొందండి" , kn: "ಮೊದಲ ಆರ್ಡರ್? ಸ್ವಾಗತ ರಿಯಾಯಿತಿ ಪಡೆಯಿರಿ", mr: "पहिला ऑर्डर? स्वागत सूट मिळवा", bn: "প্রথম অর্ডার? স্বাগত ছাড় পান", sa: "प्रथम-आदेशः? स्वागत-न्यूनतां प्राप्नुहि"},
  { en: "Weekday salon & spa offers", ta: "வார நாள் சலூன் & ஸ்பா சலுகைகள்", hi: "वीकडे सैलून और स्पा ऑफर", ml: "ആഴ്ചദിന സലൂൺ & സ്പാ ഓഫറുകൾ", te: "వారపు రోజుల సెలూన్ & స్పా ఆఫర్లు" , kn: "ವಾರದ ದಿನಗಳ ಸೆಲೂನ್ & ಸ್ಪಾ ಆಫರ್‌ಗಳು", mr: "आठवड्याच्या दिवसांचे सलून आणि स्पा ऑफर", bn: "সপ্তাহের দিনের সেলুন ও স্পা অফার", sa: "कार्यदिन-सैलून-स्पा-प्रस्तावाः"},
];
