#!/usr/bin/env node
'use strict';
/* 难度校准：双基准稿 × 双主题。
 * 满分稿应同分、残缺稿应同分，否则调整主题卡的词表。
 * 目标：
 *   满分稿   [3,4,5,5,4,4] = 25（无录音：流利3、自信4）
 *   残缺稿   [3,4,1,2,1,4] = 15（仅名称+用途）
 */
const { DIMS, TOPICS, analyze } = require('../js/engine.js');

const BENCH = {
  gripper_full: '原先人工拧瓶盖不仅费力，而且瓶盖与夹爪的接触面太滑，导致瓶盖在抓取时脱落。为解决这个问题，我们采取了平行夹爪结构，并在末端执行器上采用鱼鳍仿生原理。当夹爪受力时，肋条发生屈曲，像鱼鳍一样包覆瓶盖，同时自适应不同尺寸，增大接触面积和摩擦力，因此防止瓶盖脱落。目前样机用3D打印的TPU、PLA、PETG材料组装并测试，成功率大于95%，并在超载时优先打滑而不损坏瓶盖，更加安全。下一步将推进量产。',
  gripper_partial: '这是一款瓶盖夹取装置，用来夹取瓶盖。',
  jack_full: '人工徒手顶升重物非常费力，而且设备一旦倾倒非常危险。为解决这个问题，我推荐ENERPAC公司编号GBJ010SA的液压瓶式千斤顶。它由油缸、柱塞、泵、单向阀、释放阀和厚底座组成。工作时先旋紧释放阀，同时按压手柄让泵把液压油压入油缸，由于密闭液体中的压强处处相等，依据帕斯卡原理，小活塞与大活塞的面积比把力放大，因此将重物逐级顶起。它内置溢流阀防止过载，还有旁路防止过度伸长，工业级钢制结构更耐用，吨位11短吨约98千牛，行程62毫米。使用时请确认承载面平整、顶头对正，顶起后垫上支架，泄压时缓慢旋开释放阀，注意安全。',
  jack_partial: '这是一款液压千斤顶，用来顶升重物。',
};

function run(name, text, topicId){
  const a = analyze(text, { hasAudio:false }, topicId);
  return { name, topic: topicId, scores: a.scores, total: a.scores.reduce((x,y)=>x+y,0), covered: a.covered, inOrder: a.inOrder, terms: a.terms, connectors: a.connectors, flags: a.flags, missing: a.missing };
}

const rows = [
  run('满分稿', BENCH.gripper_full, 'gripper'),
  run('残缺稿', BENCH.gripper_partial, 'gripper'),
  run('满分稿', BENCH.jack_full, 'jack'),
  run('残缺稿', BENCH.jack_partial, 'jack'),
];

console.log('维度：' + DIMS.join(' / '));
console.log('—— 校准结果 ——');
for (const r of rows){
  console.log(`[${r.topic}] ${r.name}  总分 ${r.total}/30  scores=[${r.scores.join(',')}]  信息格 ${r.covered}/6  结构槽 ${r.inOrder}/5  术语 ${r.terms}  连接词 ${r.connectors}`);
  if (r.flags.length) console.log('   需纠正: ' + r.flags.join(' | '));
  if (r.missing.length) console.log('   缺项: ' + r.missing.join('、'));
}

const eq = (a,b) => a.every((v,i) => v === b[i]);
const gf = rows[0], gp = rows[1], jf = rows[2], jp = rows[3];
const checks = {
  '满分稿跨主题同分(25)': eq(gf.scores, jf.scores) && gf.total === 25,
  '残缺稿跨主题同分(15)': eq(gp.scores, jp.scores) && gp.total === 15,
  '满分稿信息完整性=5': gf.scores[3] === 5 && jf.scores[3] === 5,
  '残缺稿信息完整性=2': gp.scores[3] === 2 && jp.scores[3] === 2,
  '满分稿逻辑结构=4': gf.scores[4] === 4 && jf.scores[4] === 4,
  '满分稿复杂度=5': gf.scores[2] === 5 && jf.scores[2] === 5,
  '残缺稿复杂度=1': gp.scores[2] === 1 && jp.scores[2] === 1,
  '满分稿准确性=4(无错误)': gf.scores[1] === 4 && jf.scores[1] === 4,
};
let pass = true;
console.log('—— 通过项 ——');
for (const [k,v] of Object.entries(checks)){
  console.log((v ? '✅' : '❌') + ' ' + k);
  if (!v) pass = false;
}
console.log(pass ? '\n✅ 校准通过：两主题难度对齐，可上线。' : '\n❌ 校准未通过：请调整词表后重跑。');
process.exit(pass ? 0 : 1);
