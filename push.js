/* Dokodemo — push notifications, 3 times a day in Japan time AND 3 times a day in Myanmar time (6 runs in total).
   Runs from GitHub Actions (.github/workflows/sabbath-push.yml).
   Each run sends to one time zone only: ZONE=jp (Japan, UTC+9) or ZONE=mm (Myanmar, UTC+6:30).
   Slots (local time):  am 07:00 = Sabbath / Sabbath-eve message, otherwise good-morning study message
                        noon 12:00 = word of the day
                        pm 20:00 = study reminder (JLPT countdown on milestone days)
   Who gets what: Sabbath messages → subscribers with sb !== false. Study / morning / word → subscribers with st === true.
   The app saves tz:'jp'|'mm' with each token (v1.0.215). Tokens without tz count as 'jp'.
   Every message also has a Japanese line (jp) that the app reads aloud when the user taps the notification. */
const admin = require('firebase-admin');
const { ceDateTime, ceMmDateTime, MMM, MMJ, MME } = require('./mmcal.js');

const SCHED = (process.env.SCHED || '').trim();
const CRON = {                    // cron (UTC) → [zone, slot]
  '0 22 * * *': ['jp', 'am'],     // 07:00 Japan
  '0 3 * * *': ['jp', 'noon'],    // 12:00 Japan
  '0 11 * * *': ['jp', 'pm'],     // 20:00 Japan
  '30 0 * * *': ['mm', 'am'],     // 07:00 Myanmar
  '30 5 * * *': ['mm', 'noon'],   // 12:00 Myanmar
  '30 13 * * *': ['mm', 'pm']     // 20:00 Myanmar
};
let [ZONE, SLOT] = CRON[SCHED] || [(process.env.ZONE || 'jp').trim(), (process.env.MODE || 'test').trim()];
if (SLOT === 'auto') SLOT = 'am';            // old manual mode names
if (SLOT === 'study') SLOT = 'pm';
const SITE = 'https://dokodemojapanese.github.io/';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
const db = admin.firestore();

/* "today" in the zone's local time */
const OFF = { jp: 9, mm: 6.5 }[ZONE] || 9;
const now = new Date(Date.now() + OFF * 3600e3);
function mmDay(y, m, d) {
  const jdn = Math.round(ceDateTime.w2j(y, m, d)), o = ceMmDateTime.j2m(jdn);
  const mi = (o.myt > 0 && o.mm === 4) ? -1 : o.mm;
  const mn = mi < 0 ? ['ဒုတိယဝါဆို', '第二ワーゾー', 'Second Waso'] : [MMM[mi], MMJ[mi], MME[mi]];
  return { sb: ceMmDateTime.cal_sabbath(o.md, o.mm, o.myt), mp: ceMmDateTime.cal_mp(o.md, o.mm, o.myt), mn };
}
function kind(x) {
  if (x.mp === 1) return [x.mn[0] + 'လပြည့်နေ့', x.mn[1] + 'の満月', x.mn[2] + ' full moon'];
  if (x.mp === 3) return [x.mn[0] + 'လကွယ်နေ့', x.mn[1] + 'の新月', x.mn[2] + ' new moon'];
  if (x.mp === 0) return ['လဆန်း ၈ ရက် အဋ္ဌမီနေ့', '上弦の八日', '8th waxing day'];
  return ['လဆုတ် ၈ ရက် အဋ္ဌမီနေ့', '下弦の八日', '8th waning day'];
}
const dayNo = Math.floor(now.getTime() / 864e5);
const noEmoji = t => String(t).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();

/* 20:00 — study reminders, a different message each day (3 languages) */
const STUDY = [
  ['📚 စာလုပ်ချိန် ရောက်ပါပြီ', 'ဒီနေ့ ၅ မိနစ်လောက် ဂျပန်စာ လေ့လာရအောင် 💪', '📚 勉強の時間です', '今日も5分だけ日本語を勉強しましょう 💪', '📚 Study time', 'Just 5 minutes of Japanese today 💪'],
  ['🍱 ညစာ စားပြီးပြီလား', 'စားပြီးရင် ဝေါဟာရ ၅ လုံးလောက် ကျက်ကြည့်ရအောင်နော် 😊', '🍱 晩ごはん食べた？', '食べたら単語を5つ覚えましょう 😊', '🍱 Had dinner?', 'After eating, let’s learn 5 new words 😊'],
  ['🌙 စာလုပ်ဖို့ မမေ့နဲ့နော်', 'နည်းနည်းချင်း နေ့တိုင်းလုပ်ရင် တကယ်တော်လာမှာပါ ✨', '🌙 勉強を忘れずに', '毎日少しずつが一番の近道です ✨', '🌙 Don’t forget to study', 'A little every day goes a long way ✨'],
  ['🔥 ဒီနေ့ စာလုပ်ပြီးပြီလား', 'Streak မပျက်အောင် ခဏလေး ဝင်လေ့လာလိုက်ပါ', '🔥 今日の勉強はもう済んだ？', '連続記録を続けましょう', '🔥 Studied today?', 'Keep your streak going'],
  ['🎌 頑張って！', 'ကြိုးစားပါ — ဒီနေ့ သင်ခန်းစာ တစ်ခုလောက် လုပ်ကြည့်ရအောင်', '🎌 頑張って！', '今日はレッスンを1つやってみましょう', '🎌 Ganbatte!', 'Try one lesson today'],
  ['🎧 နားထောင်ချိန်လေး', 'ဂျပန် သီချင်း ဒါမှမဟုတ် စကားပြော တစ်ပုဒ်လောက် နားထောင်ကြည့်ပါ', '🎧 リスニングの時間', '日本語の歌や会話を聞いてみましょう', '🎧 Listening time', 'Listen to a Japanese song or conversation'],
  ['✍️ ကန်ဂျီ တစ်လုံး', 'ဒီနေ့ ကန်ဂျီ အသစ် တစ်လုံးလောက် မှတ်ကြည့်ရအောင်', '✍️ 今日の漢字', '新しい漢字を1つ覚えましょう', '✍️ One kanji', 'Learn one new kanji today'],
  ['☕ ခဏနားပြီး စာလုပ်ရအောင်', 'တစ်နေ့တာ ပင်ပန်းခဲ့ရင်တောင် ၃ မိနစ်လောက်ဆို လုံလောက်ပါတယ် 🙂', '☕ 一息ついて勉強', '疲れた日は3分だけでも大丈夫 🙂', '☕ Take a break & study', 'Even 3 minutes is enough on a tiring day 🙂'],
  ['🧠 ပြန်နွှေးချိန်', 'မနေ့က လေ့လာခဲ့တာလေးတွေ ပြန်ကြည့်ရအောင်', '🧠 復習の時間', '昨日の内容を復習しましょう', '🧠 Review time', 'Let’s review what you learned yesterday'],
  ['🌸 どこでも日本語', 'ဘယ်နေရာမှာမဆို ဂျပန်စာ — ဒီနေ့လည်း အတူတူ လေ့လာရအောင်', '🌸 どこでも日本語', '今日も一緒に勉強しましょう', '🌸 Japanese anywhere', 'Let’s study together today']
];
function studyMessage() {
  const r = STUDY[dayNo % STUDY.length];
  return { my: [r[0], r[1]], ja: [r[2], r[3]], en: [r[4], r[5]], jp: noEmoji(r[3]) };
}

/* 07:00 — good-morning study messages (on days that are not Sabbath / Sabbath eve) */
const MORNING = [
  ['🌅 မင်္ဂလာနံနက်ခင်းပါ', 'おはようございます！ ဒီနေ့လည်း ဂျပန်စာ နည်းနည်း လေ့လာရအောင်', '🌅 おはようございます', '今日も少し日本語を勉強しましょう', '🌅 Good morning', 'Let’s study a little Japanese today', 'おはようございます。今日も一緒に頑張りましょう。'],
  ['☀️ နေ့သစ် စပါပြီ', 'ရထားပေါ် ဒါမှမဟုတ် ဘတ်စ်ကားပေါ်မှာ ဝေါဟာရ ၃ လုံးလောက် ကြည့်သွားရအောင်', '☀️ 新しい一日', '通勤中に単語を3つ見てみましょう', '☀️ A new day', 'Look at 3 words on your way today', 'おはようございます。今日もいい一日になりますように。'],
  ['🍵 မနက်ခင်း ၅ မိနစ်', 'ကော်ဖီ/လက်ဖက်ရည် သောက်ရင်း ဂျပန်စာ ၅ မိနစ် လေ့လာကြည့်ပါ', '🍵 朝の5分', 'お茶を飲みながら5分だけ勉強しましょう', '🍵 5 morning minutes', 'Study 5 minutes with your morning tea', 'おはようございます。朝の五分で日本語を勉強しましょう。'],
  ['🦉 ဒီနေ့ ရည်မှန်းချက်', 'ဒီနေ့ စကားလုံးအသစ် ၅ လုံး မှတ်မယ်လို့ ဆုံးဖြတ်ကြည့်ပါ', '🦉 今日の目標', '今日は新しい言葉を5つ覚えましょう', '🦉 Today’s goal', 'Decide to learn 5 new words today', 'おはようございます。今日の目標は新しい言葉を五つ覚えることです。'],
  ['🌸 おはよう！', 'အပြုံးနဲ့ နေ့သစ်ကို စလိုက်ရအောင် — 今日も頑張りましょう', '🌸 おはよう！', '笑顔で一日を始めましょう', '🌸 Good morning!', 'Start the day with a smile', 'おはよう。今日も頑張りましょう。'],
  ['📖 မနက်ခင်း ပြန်နွှေး', 'မနေ့က လေ့လာခဲ့တာ တစ်ခေါက် ပြန်ကြည့်ရင် ပိုမှတ်မိပါတယ်', '📖 朝の復習', '昨日の内容をもう一度見ると覚えやすいです', '📖 Morning review', 'A quick look at yesterday helps you remember', 'おはようございます。昨日の復習をしましょう。'],
  ['💪 ကြိုးစားကြရအောင်', 'နေ့တိုင်း နည်းနည်းချင်း — JLPT အောင်ဖို့ အဓိကသော့ချက်ပါ', '💪 頑張ろう', '毎日少しずつがJLPT合格のカギです', '💪 Keep going', 'A little every day is the key to passing the JLPT', 'おはようございます。毎日少しずつ頑張りましょう。']
];
function morningMessage() {
  const r = MORNING[dayNo % MORNING.length];
  return { my: [r[0], r[1]], ja: [r[2], r[3]], en: [r[4], r[5]], jp: r[6] };
}

/* 12:00 — word of the day [word, reading, Myanmar, English] */
const WORDS = [
  ['水', 'みず', 'ရေ', 'water'], ['学校', 'がっこう', 'ကျောင်း', 'school'], ['先生', 'せんせい', 'ဆရာ / ဆရာမ', 'teacher'],
  ['友達', 'ともだち', 'သူငယ်ချင်း', 'friend'], ['電車', 'でんしゃ', 'ရထား', 'train'], ['天気', 'てんき', 'ရာသီဥတု', 'weather'],
  ['時間', 'じかん', 'အချိန်', 'time'], ['仕事', 'しごと', 'အလုပ်', 'work'], ['家族', 'かぞく', 'မိသားစု', 'family'],
  ['食べる', 'たべる', 'စားသည်', 'to eat'], ['飲む', 'のむ', 'သောက်သည်', 'to drink'], ['行く', 'いく', 'သွားသည်', 'to go'],
  ['来る', 'くる', 'လာသည်', 'to come'], ['見る', 'みる', 'ကြည့်သည်', 'to see'], ['話す', 'はなす', 'ပြောသည်', 'to speak'],
  ['読む', 'よむ', 'ဖတ်သည်', 'to read'], ['書く', 'かく', 'ရေးသည်', 'to write'], ['買う', 'かう', 'ဝယ်သည်', 'to buy'],
  ['寝る', 'ねる', 'အိပ်သည်', 'to sleep'], ['起きる', 'おきる', 'အိပ်ရာထသည်', 'to get up'], ['勉強', 'べんきょう', 'စာလေ့လာခြင်း', 'study'],
  ['大きい', 'おおきい', 'ကြီးသော', 'big'], ['小さい', 'ちいさい', 'သေးသော', 'small'], ['新しい', 'あたらしい', 'အသစ်ဖြစ်သော', 'new'],
  ['安い', 'やすい', 'ဈေးပေါသော', 'cheap'], ['暑い', 'あつい', 'ပူသော (ရာသီဥတု)', 'hot (weather)'], ['寒い', 'さむい', 'အေးသော (ရာသီဥတု)', 'cold (weather)'],
  ['駅', 'えき', 'ဘူတာ', 'station'], ['病院', 'びょういん', 'ဆေးရုံ', 'hospital'], ['お金', 'おかね', 'ပိုက်ဆံ', 'money'],
  ['雨', 'あめ', 'မိုး', 'rain'], ['名前', 'なまえ', 'နာမည်', 'name'], ['毎日', 'まいにち', 'နေ့တိုင်း', 'every day'],
  ['明日', 'あした', 'မနက်ဖြန်', 'tomorrow'], ['昼ご飯', 'ひるごはん', 'နေ့လယ်စာ', 'lunch'], ['会社', 'かいしゃ', 'ကုမ္ပဏီ', 'company'],
  ['休み', 'やすみ', 'အားလပ်ရက် / နားချိန်', 'holiday / break'], ['約束', 'やくそく', 'ကတိ / ချိန်းဆိုမှု', 'promise / appointment'],
  ['大切', 'たいせつ', 'အရေးကြီးသော', 'important'], ['頑張る', 'がんばる', 'ကြိုးစားသည်', 'to do one’s best']
];
const mmN = n => String(n).replace(/\d/g, d => '၀၁၂၃၄၅၆၇၈၉'[d]);
function wordMessage() {
  const w = WORDS[dayNo % WORDS.length], jw = w[0] === w[1] ? w[0] : w[0] + '（' + w[1] + '）';
  return {
    my: ['🍀 ဒီနေ့ စကားလုံး · ' + jw, w[0] + ' = ' + w[2] + ' — နေ့လယ်စာ စားရင်း တစ်ခါ ရွတ်ကြည့်ပါ 🙂'],
    ja: ['🍀 今日のことば · ' + jw, w[0] + ' = ' + w[3] + ' — 昼休みに声に出して言ってみましょう 🙂'],
    en: ['🍀 Word of the day · ' + jw, w[0] + ' = ' + w[3] + ' — say it out loud over lunch 🙂'],
    jp: '今日のことばは、' + w[1] + '。' + w[1] + '。'
  };
}

/* JLPT countdown (v1.0.193) — replaces the 20:00 study reminder on milestone days, and the 07:00 message on exam day */
const JLPT_DATES = ['2026-12-06'];
const JLPT_MS = [90, 60, 45, 30, 21, 14, 10, 7, 5, 3, 2, 1];
function jlptLeft() {
  const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (const d of JLPT_DATES) { const [y, m, dd] = d.split('-').map(Number); const k = Math.round((Date.UTC(y, m - 1, dd) - t) / 864e5); if (k >= 0) return k; }
  return -1;
}
function jlptMessage(k) {
  if (k === 0) return {
    my: ['📝 ဒီနေ့ JLPT စာမေးပွဲနေ့!', '頑張って 💪 — 受験票၊ ခဲတံ၊ ခဲဖျက် မမေ့နဲ့နော်။ အောင်မြင်ပါစေ ✨'],
    ja: ['📝 今日はJLPT本番！', '頑張って 💪 受験票・鉛筆・消しゴムを忘れずに ✨'],
    en: ['📝 JLPT is today!', 'Good luck 💪 Don’t forget your admission ticket, pencils and eraser ✨'], jp: '今日はJLPT本番です。頑張ってください。' };
  if (k === 1) return {
    my: ['📝 မနက်ဖြန် JLPT!', 'ဒီည စောစော အိပ်ပါ၊ 受験票 နဲ့ စာမေးပွဲ နေရာ ပြန်စစ်ထားပါ 😊'],
    ja: ['📝 明日はJLPT！', '今夜は早く寝て、受験票と会場を確認しましょう 😊'],
    en: ['📝 JLPT is tomorrow!', 'Sleep early tonight and check your ticket and test venue 😊'], jp: '明日はJLPTです。今夜は早く寝ましょう。' };
  return {
    my: ['📝 JLPT အထိ နောက် ' + mmN(k) + ' ရက်', '၂၀၂၆ ဒီဇင်ဘာ ၆ (တနင်္ဂနွေ) — ဒီနေ့လည်း 模試 တစ်ခု ဒါမှမဟုတ် ဝေါဟာရ နည်းနည်း လုပ်ကြရအောင် 💪'],
    ja: ['📝 JLPTまで あと' + k + '日', '2026年12月6日（日）— 今日も模試や単語を少しやりましょう 💪'],
    en: ['📝 ' + k + ' days until the JLPT', 'Sunday, Dec 6, 2026 — do a mock test or a few words today 💪'], jp: 'JLPTまで、あと' + k + '日です。頑張りましょう。' };
}

/* Sabbath / Sabbath eve (07:00) */
function sabbathMessage() {
  const t = mmDay(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
  if (t.sb === 1) { const k = kind(t); return {
    my: ['☸ ယနေ့ ဥပုသ်နေ့ (' + k[0] + ')', 'ဗုဒ္ဓဘာသာဝင်တို့၏ နေ့ထူးနေ့မြတ် ဖြစ်ပါသည်။ တတ်စွမ်းနိုင်သမျှ ကုသိုလ်ကောင်းမှုများ ဆည်းပူးနိုင်ကြပါစေ 🙏'],
    ja: ['☸ 今日は布薩日（' + k[1] + '）', '仏教徒にとって大切な日です。できる限り善い行いを心がけましょう 🙏'],
    en: ['☸ Today is Sabbath day (' + k[2] + ')', 'A special day for Buddhists. May we do as many good deeds as we can 🙏'], jp: '今日は布薩日です。善い行いを心がけましょう。' }; }
  if (t.sb === 2) {
    const n = new Date(now.getTime() + 864e5), k = kind(mmDay(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate()));
    return {
    my: ['☸ မနက်ဖြန် ဥပုသ်နေ့ (' + k[0] + ')', 'ယနေ့ အဖိတ်နေ့ ဖြစ်ပါသည်။ ကုသိုလ်ကောင်းမှုများ ပြုလုပ်နိုင်ရန် ကြိုတင်ပြင်ဆင်ထားကြပါစို့ 🙏'],
    ja: ['☸ 明日は布薩日（' + k[1] + '）', '善い行いの準備をしておきましょう 🙏'],
    en: ['☸ Tomorrow is Sabbath day (' + k[2] + ')', 'Let us prepare to do good deeds 🙏'], jp: '明日は布薩日です。' }; }
  return null;
}

/* Tester period (Google Play closed test): the 20:00 message asks everyone to open the app today.
   Turns off automatically when config.json has "tpop": false (after production approval). */
let TEST_PERIOD = true;
try { TEST_PERIOD = require('./config.json').tpop !== false; } catch (e) {}
const OPEN_TODAY = [
  { my: ['🦉 ဒီနေ့ Dokodemo အသုံးပြုပြီးပြီလား?', 'မသုံးရသေးရင် အသုံးပြုဖို့ မမေ့နဲ့နော် — တစ်မိနစ်လောက်ဆိုလည်း ရပါတယ် 🙏'],
    ja: ['🦉 今日はDokodemoを開きましたか？', 'まだなら、少しだけでも開いてみてくださいね 🙏'],
    en: ['🦉 Opened Dokodemo today?', 'If not, don’t forget to open it — even one minute is fine 🙏'], jp: '今日はDokodemoを開きましたか。忘れないでくださいね。' },
  { my: ['🦉 Dokodemo အသုံးပြုဖို့ မမေ့နဲ့နော်', 'ဒီနေ့လည်း App လေးကို အသုံးပြုပြီး စကားလုံး တစ်လုံးလောက် လေ့လာကြရအောင် ✨'],
    ja: ['🦉 Dokodemoを忘れずに', '今日もアプリを開いて、ことばを1つ覚えましょう ✨'],
    en: ['🦉 Don’t forget Dokodemo', 'Open the app today and learn just one word ✨'], jp: '今日もDokodemoで、ことばを一つ覚えましょう。' }
];

/* plan = list of { msg, tag, who(token) } — a token gets the first message it matches */
function plan() {
  const jk = jlptLeft(), study = x => x.st === true, sab = x => x.sb !== false;
  if (SLOT === 'test') return [{ tag: 'dokodemo-test', who: () => true, msg: {
    my: ['🔔 Dokodemo', 'Notification စနစ် စမ်းသပ်ခြင်း — ဒီစာ ရောက်ရင် အဆင်ပြေပါပြီ ✅'],
    ja: ['🔔 Dokodemo', '通知のテストです ✅'], en: ['🔔 Dokodemo', 'Test notification — it works ✅'], jp: '通知のテストです。' } }];
  if (SLOT === 'am') {
    if (jk === 0) return [{ tag: 'dokodemo-jlpt', who: x => sab(x) || study(x), msg: jlptMessage(0) }];
    const sm = sabbathMessage(), out = [];
    if (sm) out.push({ tag: 'dokodemo-sabbath', who: sab, msg: sm });
    out.push({ tag: 'dokodemo-am', who: study, msg: morningMessage() });
    return out;
  }
  if (SLOT === 'noon') return [{ tag: 'dokodemo-noon', who: study, msg: wordMessage() }];
  if (SLOT === 'pm' && TEST_PERIOD && !(jk > 0 && JLPT_MS.includes(jk))) return [{ tag: 'dokodemo-open', who: x => sab(x) || study(x), msg: OPEN_TODAY[dayNo % OPEN_TODAY.length] }];
  if (SLOT === 'pm') return [{ tag: (jk > 0 && JLPT_MS.includes(jk)) ? 'dokodemo-jlpt' : 'dokodemo-study', who: study, msg: (jk > 0 && JLPT_MS.includes(jk)) ? jlptMessage(jk) : studyMessage() }];
  return [];
}

(async () => {
  console.log('Zone:', ZONE, ' Slot:', SLOT, ' Local date:', now.toISOString().slice(0, 10), ' Schedule:', SCHED || '(manual)');
  const P = plan();
  if (!P.length) { console.log('Nothing to send.'); return; }
  const snap = await db.collection('pushTokens').get();
  const zoneOK = x => ZONE === 'all' || (x.tz === 'mm' ? 'mm' : 'jp') === ZONE;
  const list = [];
  snap.docs.forEach(d => { const x = { id: d.id, ...d.data() }; if (!x.token || !zoneOK(x)) return; const p = P.find(p => p.who(x)); if (p) list.push([x, p]); });
  console.log('Recipients:', list.length);
  let ok = 0, removed = 0;
  for (let i = 0; i < list.length; i += 500) {
    const chunk = list.slice(i, i + 500);
    const res = await admin.messaging().sendEach(chunk.map(([x, p]) => {
      const [title, body] = p.msg[x.lang] || p.msg.my;
      return { token: x.token, data: { title, body, url: SITE, tag: p.tag, jp: p.msg.jp || '' },
        webpush: { headers: { Urgency: 'high', TTL: '43200' } },
        android: { priority: 'high' } };
    }));
    for (let j = 0; j < res.responses.length; j++) {
      const r = res.responses[j];
      if (r.success) { ok++; continue; }
      const code = r.error && r.error.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token' || code === 'messaging/invalid-argument') {
        await db.collection('pushTokens').doc(chunk[j][0].id).delete().catch(() => {}); removed++;
      } else console.log('fail:', code);
    }
  }
  console.log('Sent:', ok, ' Removed stale tokens:', removed);
})().catch(e => { console.error(e); process.exit(1); });
