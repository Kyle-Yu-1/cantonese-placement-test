'use strict';
/* 机械产品介绍 · 纯评分引擎（浏览器 + Node 通用）
 * 设计目标：同一把尺（6 维 × 1–5，总分 30）横向比较不同主题；
 * 主题只换「知识点卡」（hard 陷阱 / groups 信息格 / segs 结构槽 / terms 术语表），评分公式不动。
 */
(function(root, factory){
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof self !== 'undefined' ? self : this, function(){

const DIMS = ['流利度', '准确性', '语言复杂度', '信息完整性', '逻辑结构', '自信度'];

const TOPICS = {
  /* ---------- 主题一：瓶盖夹爪（历史默认，关键词与旧版一致） ---------- */
  gripper: {
    name: '瓶盖夹爪',
    short: '夹爪',
    hint: '对着麦克风完整介绍你的瓶盖夹取末端执行器（建议 60–90 秒），系统自动转写并按课程 6 维量表打分。',
    infoLabel: '名称/构成/原理/用途/优势/安全要点',
    segLabel: '问题→方案→机制→制造与测试→收尾',
    hard: [
      { re:/气形力/, msg:'“气形力”应为“楔形力”（wedge force）' },
      { re:/卷曲/, msg:'建议改用术语“屈曲”（buckling）' },
      { re:/\bp\s+l\s+a\b/i, msg:'“p l a”应写作“PLA”' },
      { re:/费斯通/, msg:'公司名请核对：Festo 通用中文名为“费斯托”' },
      { re:/机械臂/, msg:'本装置是“末端执行器”，说“机械臂”范围偏大' },
    ],
    groups: [
      { name:'名称', re:/瓶盖|夹取|夹爪|末端执行器/ },
      { name:'构成', re:/平行夹爪|夹爪|手指|底座|连杆|肋条|结构/ },
      { name:'原理', re:/肋条|屈曲|卷曲|包覆|包裹|finray|鱼鳍|仿生|自适应|贴合|受力/i },
      { name:'用途', re:/夹取|抓取|瓶盖|装配|拧盖/ },
      { name:'优势', re:/摩擦|防脱落|脱落|接触面积|不同尺寸|自适应|防滑/ },
      { name:'安全要点', re:/打滑|损坏|负载|安全|失效|超载|寿命/ },
    ],
    segs: [
      { name:'问题', re:/原先|现有|问题|脱落|打滑|太滑|缺点|不足/ },
      { name:'方案', re:/解决|改用|采用|设计|采取|新增|加上/ },
      { name:'机制', re:/当|受力|肋条|屈曲|卷曲|包覆|包裹|贴合|接触/ },
      { name:'制造与测试', re:/打印|材料|tpU|pla|petg|组装|测试|成功率|95|样机/i },
      { name:'收尾', re:/下一步|未来|量产|欢迎|谢谢|支持|安全/ },
    ],
    terms: /平行|夹爪|肋条|屈曲|包覆|仿生|3D|TPU|PLA|PETG|成功率|摩擦|末端执行器|自适应/gi,
  },

  /* ---------- 主题二：液压千斤顶（与夹爪卡同构：同为 6 格 / 5 槽 / 5 陷阱） ---------- */
  jack: {
    name: '液压千斤顶',
    short: '千斤顶',
    hint: '对着麦克风完整介绍 ENERPAC GBJ010SA 液压瓶式千斤顶（建议 60–90 秒），系统自动转写并按同一套 6 维量表打分。',
    infoLabel: '名称/构成/原理/用途/优势/安全要点',
    segLabel: '问题→方案→机制→数据与规格→收尾',
    hard: [
      { re:/气压|气体/, msg:'液压千斤顶靠液压油传递压强，不是“气压/气体”' },
      { re:/抽气|吸气/, msg:'泵吸入的是液压油，不是空气' },
      { re:/大气压/, msg:'顶升靠“帕斯卡压强放大”，不是大气压' },
      { re:/拧松|旋松/, msg:'顶升前应先“旋紧”释放阀，泄压时才“缓慢旋开”' },
      { re:/直接顶|直接抬|直接举/, msg:'不是手柄直接顶起重物：手柄杠杆 × 活塞面积比 = 两级力放大' },
    ],
    groups: [
      { name:'名称', re:/千斤顶|瓶式|立式|油压|液压/ },
      { name:'构成', re:/油缸|缸体|柱塞|活塞|单向阀|释放阀|泄压阀|底座|手柄|储油|密封/ },
      { name:'原理', re:/帕斯卡|帕斯卡尔|压强|面积比|力放大|密闭|小活塞|大活塞|传递|放大/ },
      { name:'用途', re:/顶升|顶起|举升|举高|支撑|维修|重物|设备|负载/ },
      { name:'优势', re:/溢流阀|旁路|防过载|省力|工业级|耐用|稳定|寿命|安全/ },
      { name:'安全要点', re:/额定|超载|支架|垫板|枕木|缓慢|慢泄|泄压|平整|对正|载荷/ },
    ],
    segs: [
      { name:'问题', re:/原先|现有|问题|抬不动|费力|危险|麻烦|不足|压伤|倾倒/ },
      { name:'方案', re:/解决|改用|采用|使用|选择|设计|推荐|购买|更换/ },
      { name:'机制', re:/帕斯卡|帕斯卡尔|压强|面积比|活塞|力放大|单向阀|密闭|传递|放大/ },
      { name:'数据与规格', re:/吨|短吨|千牛|kN|行程|毫米|mm|高度|自重|认证|型号|编号|GBJ|SATA|MH-5/i },
      { name:'收尾', re:/下一步|安全|注意|提醒|欢迎|谢谢|总结|以上/ },
    ],
    /* 术语表只收「原理/部件/规格」级词汇，名称常用词不重复计分，保证与夹爪卡难度同构 */
    terms: /帕斯卡|压强|活塞|单向阀|释放阀|溢流阀|行程|吨|千牛|kN|过载|力放大|工业级|密封|旁路/gi,
  },
};

/* ---------------- 评分公式（对所有主题完全一致） ---------------- */
function analyze(text, met, topicId){
  const T = TOPICS[topicId] || TOPICS.gripper;
  const flags = [];

  /* 1. 准确性：陷阱词扣分，下限 1、上限 4 */
  const hardHits = T.hard.filter(c => c.re.test(text));
  for (const c of hardHits) flags.push(c.msg);
  const reps = text.match(/(.)\1{2,}/g) || [];
  if (reps.length) flags.push('重复字词：' + Array.from(new Set(reps)).join('、'));
  const fillers = text.match(/呃|嗯嗯|然后然后|这个这个|那个那个|就是说|\bem\b/gi) || [];
  if (fillers.length) flags.push('口头禅：' + Array.from(new Set(fillers)).join('、'));

  /* 2. 信息完整性：6 格覆盖数 → 5/4/3/2/1 */
  let covered = 0; const missing = [];
  for (const g of T.groups){ if (g.re.test(text)) covered++; else missing.push(g.name); }
  const infoScore = covered >= 6 ? 5 : covered >= 5 ? 4 : covered >= 3 ? 3 : covered >= 2 ? 2 : 1;

  /* 3. 逻辑结构：5 槽按序出现 → 4/3/2/1 */
  let last = -1, inOrder = 0;
  for (const s of T.segs){ const m = text.search(s.re); if (m >= 0){ if (m > last) inOrder++; last = m; } }
  const structScore = inOrder >= 4 ? 4 : inOrder >= 3 ? 3 : inOrder >= 2 ? 2 : 1;

  /* 4. 语言复杂度：连接词 + 术语密度 */
  const connectors = (text.match(/因为|因此|所以|同时|并且|此外|由于|当|目前|于是|由此/g) || []).length;
  const terms = (text.match(T.terms) || []).length;
  let compScore = 1;
  if (connectors >= 3 && terms >= 6) compScore = 5;
  else if (connectors >= 2 && terms >= 4) compScore = 4;
  else if (connectors >= 1 && terms >= 3) compScore = 3;
  else if (connectors >= 1 || terms >= 2) compScore = 2;

  /* 5. 准确性合计 */
  let accScore = 5 - hardHits.length - Math.min(reps.length, 1) - Math.min(fillers.length, 1);
  accScore = Math.max(1, Math.min(4, accScore));

  /* 6. 流利度：有录音看语速/停顿，无录音中性 3 */
  let fluScore = 3;
  if (met && met.hasAudio && met.rate > 0){
    const r = met.rate;
    fluScore = r >= 200 ? 5 : r >= 140 ? 4 : r >= 90 ? 3 : r >= 50 ? 2 : 1;
    if (met.pauseRatio > 0.35) fluScore = Math.max(1, fluScore - 1);
    if (reps.length) fluScore = Math.max(1, fluScore - 1);
  } else {
    fluScore = reps.length ? 2 : 3;
  }

  /* 7. 自信度：有声学特征时用 5 项，无录音只用文本 */
  const confFillerCount = fillers.length;
  const weakWords = (text.match(/可能|大概|也许|应该吧|我觉得吧|差不多|好像是|或许/g) || []).length;
  let confScore, confNote, confSub = [], confFeatures;
  if (met && met.hasAudio && typeof met.rmsMean === 'number'){
    const e1 = met.rmsMean >= 0.03 ? 1 : met.rmsMean >= 0.015 ? 0 : -1;
    const e2 = met.endHold >= 0.8 ? 1 : met.endHold >= 0.5 ? 0 : -1;
    const e3 = confFillerCount === 0 ? 1 : confFillerCount <= 2 ? 0 : -1;
    const e4 = met.rate > 160 ? 1 : met.rate < 90 ? -1 : 0;
    const e5 = met.pitchVar > 0.06 ? 1 : met.pitchVar < 0.02 ? -1 : 0;
    confScore = Math.max(1, Math.min(5, 3 + e1 + e2 + e3 + e4 + e5));
    confSub = [
      { k:'平均响度', v:e1, d:'RMS 均值 ' + (met.rmsMean*100).toFixed(1) + '（≥3 为足）', w: e1>0?'声音够响亮':e1<0?'整体偏轻，底气不足':'音量一般' },
      { k:'结尾保持', v:e2, d:'末15%能量/全篇均值 = ' + (met.endHold*100).toFixed(0) + '%', w: e2>0?'收尾不塌':e2<0?'结尾音量衰减，显犹豫':'收尾尚可' },
      { k:'填充词', v:e3, d:'检测到 ' + confFillerCount + ' 个', w: e3>0?'干净利落':e3<0?'填充词偏多':'有少量填充词' },
      { k:'语速', v:e4, d:Math.round(met.rate) + ' 字/分', w: e4>0?'语速干脆':e4<0?'偏慢拖沓':'速度适中' },
      { k:'语调起伏', v:e5, d:'音高波动 CV = ' + (met.pitchVar*100).toFixed(1) + '%', w: e5>0?'有强调起伏':e5<0?'语调平淡':'起伏一般' },
    ];
    confFeatures = { rmsMean: met.rmsMean, endHold: met.endHold, fillers: confFillerCount, rate: met.rate, pitchVar: met.pitchVar, weakWords: weakWords };
    confNote = '由响度/收尾/填充词/语速/语调 5 项估算，可点「AI 复核」二次确认';
  } else {
    const e3 = confFillerCount === 0 ? 1 : confFillerCount <= 2 ? 0 : -1;
    const w = weakWords === 0 ? 0 : weakWords <= 2 ? -1 : -2;
    confScore = Math.max(1, Math.min(5, 3 + e3 + w));
    confSub = [
      { k:'填充词', v:e3, d:'检测到 ' + confFillerCount + ' 个', w: e3>0?'干净利落':e3<0?'填充词偏多':'有少量填充词' },
      { k:'弱化词', v:w, d:'「可能/大概/我觉得吧」× ' + weakWords, w: w===0?'语气确定':weakWords<=2?'略有犹豫':'犹豫词较多' },
    ];
    confFeatures = { rmsMean: null, endHold: null, fillers: confFillerCount, rate: null, pitchVar: null, weakWords: weakWords };
    confNote = '无录音：仅按文本填充词/弱化词估计，录音后更准';
  }

  const sentences = text.split(/[。！？!?；;]/).filter(s => s.trim().length > 1);
  const avgLen = sentences.length ? Math.round(text.replace(/[，、]/g,'').length / sentences.length) : 0;
  const scores = [fluScore, accScore, compScore, infoScore, structScore, confScore];
  return { scores, flags, missing, confNote, confSub, confFeatures, sentences: sentences.length, avgLen, terms, connectors, inOrder, covered };
}

return { DIMS, TOPICS, analyze };
});
