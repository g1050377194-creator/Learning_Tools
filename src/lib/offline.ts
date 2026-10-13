import { LEVELS, type FeedbackResult, type LevelId, type PathDraft, type ReadResult, type VocabItem } from "@/lib/types";
import { clip, splitParagraphs, splitSentences } from "@/lib/text";

export const SAMPLE_GOAL = "六个月内能读懂英语技术文章，并写出清楚的摘要";
export const SAMPLE_PASSAGE = `Memory is not a warehouse. When you review a word a day later, you are not repeating a fact. You are rebuilding the path that leads back to it.

A short, honest review today is worth more than a long cram the night before an exam. Each time the path gets a little more stable, the next visit can wait a little longer.`;

const DICTIONARY: Record<string, string> = {
  memory: "记忆",
  warehouse: "仓库",
  review: "复习；回顾",
  repeating: "重复",
  repeat: "重复",
  fact: "事实",
  rebuilding: "重建",
  rebuild: "重建",
  path: "路径",
  leads: "通向",
  honest: "诚实的",
  cram: "突击死记",
  exam: "考试",
  stable: "稳定的",
  stability: "稳定度",
  visit: "回访",
  acquire: "获得",
  retain: "记住",
  retention: "保持率",
  schedule: "安排；日程",
  interval: "间隔",
  difficulty: "难度",
  lapse: "遗忘；失误",
  recall: "回忆",
  recognition: "再认",
  vocabulary: "词汇",
  sentence: "句子",
  paragraph: "段落",
  summary: "摘要",
  abstract: "摘要",
  passage: "短文",
  context: "语境",
  meaning: "意思",
  translate: "翻译",
  translation: "翻译",
  grammar: "语法",
  fluent: "流利的",
  fluency: "流利度",
  pronounce: "发音",
  pronunciation: "发音",
  article: "文章",
  technical: "技术的",
  concept: "概念",
  assume: "假设",
  assumption: "假设",
  evidence: "证据",
  however: "然而",
  although: "尽管",
  therefore: "因此",
  because: "因为",
  compare: "比较",
  contrast: "对比",
  analyze: "分析",
  analysis: "分析",
  approach: "方法",
  method: "方法",
  practice: "练习",
  feedback: "反馈",
  mistake: "错误",
  error: "错误",
  improve: "改进",
  improvement: "改进",
  specific: "具体的",
  concrete: "具体的",
  abstractly: "抽象地",
  argument: "论点",
  claim: "主张",
  support: "支持",
  example: "例子",
  detail: "细节",
  structure: "结构",
  process: "过程",
  function: "功能；函数",
  variable: "变量",
  algorithm: "算法",
  data: "数据",
  model: "模型",
  prompt: "提示",
  response: "回应",
  accurate: "准确的",
  concise: "简洁的",
  relevant: "相关的",
  significant: "重要的",
  previous: "之前的",
  following: "接下来的",
  require: "需要",
  requirement: "要求",
  available: "可用的",
  sufficient: "足够的",
  necessary: "必要的",
  attempt: "尝试",
  achieve: "达成",
  maintain: "维持",
  develop: "发展",
  describe: "描述",
  explain: "解释",
  indicate: "表明",
  suggest: "建议；暗示",
  occur: "发生",
  increase: "增加",
  decrease: "减少",
  benefit: "益处",
  challenge: "挑战",
  strategy: "策略",
  goal: "目标",
  weekly: "每周的",
  milestone: "里程碑",
};

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "in", "on", "at", "to", "for", "of", "as", "by", "with",
  "from", "into", "over", "after", "before", "about", "than", "then", "that", "this", "these", "those",
  "is", "are", "was", "were", "be", "been", "being", "it", "its", "you", "your", "we", "our", "they",
  "their", "i", "me", "my", "he", "she", "his", "her", "not", "no", "yes", "do", "does", "did", "can",
  "could", "would", "should", "will", "just", "more", "most", "some", "any", "each", "when", "where",
  "what", "which", "who", "how", "why", "there", "here", "up", "out", "so", "too", "very", "also",
]);

const CJK_STOP = new Set("的了是在和与或及也都不就都还又把被让给对从把而而且如果因为所以这那一个有没有我们你们他们自己什么怎么已经可以需要通过进行以及其中".split(""));

const FALLBACK_GLOSSES = ["放弃", "延伸", "谨慎", "立刻", "尽管", "复杂", "偶尔", "频繁", "假设", "结论", "对比", "推迟", "维持", "证明", "大致"];

export function fallbackGlosses() {
  return FALLBACK_GLOSSES;
}

export function levelLabel(level: LevelId) {
  return LEVELS.find((item) => item.id === level)?.label ?? "有一些基础";
}

function topicOf(goal: string) {
  const text = goal.toLowerCase();
  if (/英语|托福|雅思|单词|口语|阅读|写作/.test(goal) || /english|toefl|ielts|vocab/.test(text)) return "english";
  if (/编程|代码|程序|开发|算法|python|前端|后端/.test(goal) || /python|code|program|javascript/.test(text)) return "code";
  if (/考研|考试|备考|中考|高考|雅思|托福/.test(goal)) return "exam";
  if (/数学|微积分|线代|几何|统计/.test(goal)) return "math";
  return "general";
}

function stageCount(hours: number) {
  if (hours >= 10) return 5;
  if (hours >= 4) return 4;
  return 3;
}

function weeksFor(level: LevelId, hours: number) {
  const base = { beginner: 3, basic: 2, independent: 2, fluent: 1 }[level];
  if (hours <= 3) return base + 1;
  if (hours >= 12) return Math.max(1, base - 1);
  return base;
}

interface StageTemplate {
  title: string;
  summary: string;
  milestones: string[];
  practice: string[];
}

function templates(topic: ReturnType<typeof topicOf>, goal: string, hours: number, weeks: number): StageTemplate[] {
  const pace = `每周 ${hours} 小时，本阶段大约 ${weeks} 周。`;
  const bank: Record<string, StageTemplate[]> = {
    english: [
      {
        title: "先抓住会反复出现的词",
        summary: `${pace}围绕「${goal}」，先别铺开整本教材。每天从真实句子里收 8 到 12 个会再见到的词，正面写英语，背面写中文意思和原句。`,
        milestones: ["收满 80 张词汇卡，每张都有原句", "能看着中文意思写出其中一半的英语", "分得出哪些词只是眼熟，哪些已经能用"],
        practice: ["阅读时遇到生词先整句收藏，再决定要不要做卡", "同一词做一张词汇卡和一张完形卡", "第二天用回忆模式把昨天的词写出来"],
      },
      {
        title: "把句子拆开再装回去",
        summary: `${pace}目标仍然是「${goal}」。这一阶段读短文，不追求读完，追求能指出每段的第一句在说什么，以及后面的句子是在举例、转折还是下结论。`,
        milestones: ["读完 8 篇一页以内的材料，并写出三句摘要", "标出每篇里 5 个使句子变难的结构", "能不看原文，用自己的话重述一段"],
        practice: ["把难句做成完形，空出关键词", "摘要里必须用上当天的 3 个目标词", "读完把不确定的词全部收进这一阶段的牌组"],
      },
      {
        title: "用短文把词用出去",
        summary: `${pace}从认识转到输出。每次用 40 到 80 个英语词写一小段，题目就从牌组里的词来，写完对照反馈改一版。`,
        milestones: ["写满 6 篇短文，每篇都改过一版", "目标词的使用不再只是硬塞进句子", "能指出自己最常犯的两类错误"],
        practice: ["先写再看反馈，不要边写边改", "把改过的句子做成新卡", "隔天不看反馈，把同一段再写一次"],
      },
      {
        title: "限时读一篇并留下摘要",
        summary: `${pace}用接近真实任务的材料。计时阅读，时间到就停，写下摘要，再回头只查影响理解的词。`,
        milestones: ["完成 4 次限时阅读", "摘要能被别人看懂，而不只是摘抄原句", "查过的词都进了复习，而不是留在备忘录里"],
        practice: ["阅读前先看标题，用一句话猜内容", "只把挡住理解的词做成卡", "摘要写完用练习里的短译核对关键句"],
      },
      {
        title: "只复习会忘的，加长间隔",
        summary: `${pace}新内容减少，复习变多。看牌组里到期的卡，把仍然不稳的词放回短文里再用一次。`,
        milestones: ["连续两周完成到期复习", "重来的卡有笔记说明当时为什么没想起来", "能用自己的话讲清这条路线还剩哪一块不稳"],
        practice: ["复习时先回忆再翻面", "重来的词当天写进一句新句子", "周末只处理重来和困难，不另开新坑"],
      },
    ],
    code: [
      {
        title: "做出一个能跑的最小版本",
        summary: `${pace}「${goal}」先落成一个小到能在一次学习里跑起来的程序。不收集教程清单，先让输入和输出说得清。`,
        milestones: ["写下这个程序接受什么、吐出什么", "本地能跑通一次", "把卡住的报错收成卡片，正面是报错，背面是原因"],
        practice: ["每次只改一处再运行", "术语不熟就做成词汇卡", "第二天不看笔记，把程序再搭一遍"],
      },
      {
        title: "补上刚好缺的那一块",
        summary: `${pace}对照最小版本里反复出错的地方补语法、数据或工具，而不是从头看完一门课。`,
        milestones: ["列出 5 个真正挡住进度的知识点", "每个知识点有一张能考自己的卡", "最小版本比上一阶段少一类错误"],
        practice: ["先自己写，再对照文档改", "把文档里的关键句做成完形", "用练习模式回忆术语，而不是反复看定义"],
      },
      {
        title: "做一个贯穿的小项目",
        summary: `${pace}把前面的碎片接到同一件作品上，让「${goal}」有一个可以演示的结果。`,
        milestones: ["项目有清楚的完成标准", "核心路径自己走通，不靠复制整段", "留下 10 张以后还会忘的实现细节卡"],
        practice: ["每天结束时写三句：做成了什么、卡在哪、明天第一件事", "把容易混的 API 做成对比卡", "隔天先复习再写新代码"],
      },
      {
        title: "读别人的实现并改一处",
        summary: `${pace}找一个小而完整的例子，读懂以后只改一个行为。读代码和写代码用同一套牌组。`,
        milestones: ["能讲出示例的数据怎么流", "改动有你自己的理由，不只是换个名字", "不懂的标识符都收进牌组"],
        practice: ["先画三步流程图再看代码", "把函数名和职责做成卡", "改完用自己的话写一段说明"],
      },
      {
        title: "用复习保住已经会的部分",
        summary: `${pace}停止横向开新坑。到期的卡、还会犯的错、项目里不稳的路径，这三样就够。`,
        milestones: ["到期复习不断档", "项目仍能跑，而且你能解释关键路径", "写下下一步真正要学的只有一件事"],
        practice: ["重来的卡必须配一段你自己的代码或句子", "每周删掉已经不会忘的笔记，只留卡片", "用一次限时实现检验，而不是再看教程"],
      },
    ],
    exam: [
      {
        title: "摸清题型和分值",
        summary: `${pace}先看「${goal}」要考什么。用一份真题或大纲，标出题型、分值和你现在完全不会的部分。`,
        milestones: ["有一张题型清单", "知道哪两类题最拉分", "每类题有一个最朴素的做法"],
        practice: ["不做完整套，先拆题型", "把审题关键词做成卡", "写下每种题的时间预算"],
      },
      {
        title: "把基础缺口补成卡片",
        summary: `${pace}只补会反复扣分的基础。概念用正面提问、背面短答，不要抄一整页笔记。`,
        milestones: ["基础卡至少 40 张", "能闭卷回答其中的定义题", "错题不再只存在卷子空白处"],
        practice: ["做错立刻做成卡，写上当时的误区", "第二天先复习再做新题", "同类题连做三道，第三道限时"],
      },
      {
        title: "分题型限时",
        summary: `${pace}每种题单独计时。时间到就停，对答案，只深挖错因。`,
        milestones: ["每类题有两次限时记录", "错因能归成不超过三类", "限时下的正确率和不限时的差距在缩小"],
        practice: ["先做会的，卡壳超过预算就标记", "错题当天进牌组", "用回忆模式把公式或步骤写出来"],
      },
      {
        title: "整卷和错题回看",
        summary: `${pace}开始做接近整卷的练习，但复盘时间不少于做题时间。路线的重点是留下会忘的错，不是刷完数量。`,
        milestones: ["完成两套完整练习", "每套有错题卡", "能说出下一周只攻哪一类"],
        practice: ["对答案时先自己讲为什么错", "把易混选项做成对比卡", "隔天重做错题，不看解析"],
      },
      {
        title: "考前只碰不稳的",
        summary: `${pace}新题减少。打开到期队列，把重来和困难的卡过一遍，再用一组短题确认。`,
        milestones: ["到期卡清完或明确剩下哪些故意留到明天", "睡眠和节奏没有被临时加量打乱", "进考场前能用几句话讲清自己的策略"],
        practice: ["不新开章节", "重来的卡配一个最小例子", "最后一次练习用考试时间，不再加码"],
      },
    ],
    math: [
      {
        title: "把符号和概念对齐",
        summary: `${pace}「${goal}」先处理符号。每个新符号都要能说出它代表什么，以及它出现在哪一步。`,
        milestones: ["整理一页符号表，并做成卡片", "能不看笔记口述一个核心定义", "分得清定义和定理"],
        practice: ["正面写符号，背面写口头解释", "把定义里的关键词做成完形", "第二天先回忆再翻书"],
      },
      {
        title: "例题跟着做，不看一步写一步",
        summary: `${pace}例题盖住下一步再写。写不出就停，把那一步做成卡，而不是把整题抄下来。`,
        milestones: ["独立做完 8 道例题", "每道题留下真正卡住的那一步", "能解释这一步为什么成立"],
        practice: ["先自己写，再对照", "错步做成问答卡", "隔天重做，不看昨天的草稿"],
      },
      {
        title: "做变式，而不是再看一遍",
        summary: `${pace}同一方法换一个条件。能做变式，才算这个方法开始属于你。`,
        milestones: ["每个方法有两道变式", "能说出变式改了哪个条件", "仍然会错的步骤都在牌组里"],
        practice: ["自己改一个数字或条件再做", "把易混公式放在同一张卡的背面对比", "用回忆写出公式适用的前提"],
      },
      {
        title: "综合题只抓断点",
        summary: `${pace}综合题允许做不完。目标是找到推理在哪一步断掉，并把那一步补上。`,
        milestones: ["做 4 道综合题", "每道题有一个明确断点", "断点第二天能单独做对"],
        practice: ["限时 20 分钟，到点就停", "断点写成卡片", "先复习断点再做新题"],
      },
      {
        title: "用间隔把方法留住",
        summary: `${pace}少做新题，多做到期的卡和上周的错题。能在间隔之后仍然写对，才进入下一章。`,
        milestones: ["到期复习连续完成", "上周错题重做正确", "能讲清「${goal}」里你现在最稳和最不稳的部分"],
        practice: ["重来的方法当天再做一道最小题", "不追加新章节", "周末只处理困难和重来"],
      },
    ],
    general: [
      {
        title: "把目标画成一张小地图",
        summary: `${pace}先写清「${goal}」做成什么样算数。地图上只留必须会的几块，其余先不学。`,
        milestones: ["用三句话写下完成标准", "列出不超过 5 个必须会的块", "知道第一周只碰哪一块"],
        practice: ["把术语做成卡片，而不是收藏链接", "每块写一个最小例子", "第二天能不看笔记讲出这张地图"],
      },
      {
        title: "做出最小的一次输出",
        summary: `${pace}学完就要有一个能拿给别人看的小结果：一段话、一道题或一个小演示。`,
        milestones: ["有一个可以重复做的小任务", "第一次独立完成", "卡住的点收成了卡片"],
        practice: ["先做再查", "查到的关键句做成完形", "隔天不看资料重做一遍"],
      },
      {
        title: "专攻最不稳的一块",
        summary: `${pace}看哪一块做的时候还会停。只加这一块的练习，不横向开新内容。`,
        milestones: ["指出当前最不稳的一块", "这块有专门的牌组", "同样的任务比上周更顺"],
        practice: ["错一次就做一张卡，写上误区", "用回忆而不是重读", "每次学习先复习再做新的"],
      },
      {
        title: "用一次真实任务检验",
        summary: `${pace}找一个接近真实使用的任务，限时完成。检验的是「${goal}」，不是笔记完不完整。`,
        milestones: ["完成一次限时任务", "写下哪里还要查", "查过的内容进了复习队列"],
        practice: ["时间到就停，不要无限延长", "只保留影响结果的卡片", "第二天先处理这些卡"],
      },
      {
        title: "把会忘的留下，把不会忘的放下",
        summary: `${pace}路线后段以复习为主。到期的卡、仍然会错的任务，比新的资料重要。`,
        milestones: ["连续完成到期复习", "能讲清还剩哪一件事不稳", "下一步只有一个，而不是一个书单"],
        practice: ["重来的卡配一个新例子", "删掉已经稳的临时笔记", "用一次小任务收尾，而不是再找教程"],
      },
    ],
  };
  return bank[topic] ?? bank.general;
}

export function offlinePath(input: { goal: string; level: LevelId; weeklyHours: number }): PathDraft {
  const goal = input.goal.trim();
  const hours = Math.min(40, Math.max(1, Math.round(input.weeklyHours) || 1));
  const weeks = weeksFor(input.level, hours);
  const count = stageCount(hours);
  const stages = templates(topicOf(goal), goal, hours, weeks).slice(0, count).map((stage) => ({
    ...stage,
    weeks,
  }));
  const short = goal.length > 18 ? `${goal.slice(0, 18)}…` : goal;
  return {
    title: short || "未命名路线",
    overview: `这条路线按每周 ${hours} 小时来排，默认你${levelLabel(input.level)}。它只服务「${goal}」：每个阶段都可以单独建牌组，读到和练到的内容最后都进同一套 FSRS 复习。`,
    stages,
  };
}

function keywords(text: string) {
  const english = text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  const found: string[] = [];
  for (const raw of english) {
    const word = raw.toLowerCase();
    if (STOPWORDS.has(word) || word.length < 3) continue;
    if (DICTIONARY[word] && !found.includes(word)) found.push(word);
  }
  return found;
}

function sentenceOf(text: string, word: string) {
  const sentences = splitSentences(text.replace(/\s+/g, " "));
  const lower = word.toLowerCase();
  return (
    sentences.find((sentence) => sentence.toLowerCase().includes(lower)) ??
    sentences[0] ??
    text
  );
}

export function offlineRead(passage: string): ReadResult {
  const text = passage.trim();
  const paragraphs = splitParagraphs(text).slice(0, 8);
  const allSentences = splitSentences(text.replace(/\s+/g, " "));
  const summarySource = paragraphs
    .map((paragraph) => splitSentences(paragraph)[0] ?? paragraph)
    .filter(Boolean);
  const summary = clip(summarySource.join(""), 220) || "这篇材料太短，摘要就是原文本身。";
  const explained = paragraphs.map((paragraph, index) => {
    const sentences = splitSentences(paragraph);
    const lead = sentences[0] ?? paragraph;
    const keys = keywords(paragraph).slice(0, 3);
    const follow =
      sentences.length > 1
        ? `后面还有 ${sentences.length - 1} 句，多半是在举例、转折或补原因。`
        : "这一段只有一句，先确认主语和结论。";
    const keyText = keys.length ? `可以先抓住：${keys.join("、")}。` : "";
    return {
      original: paragraph,
      explanation: `先读第 ${index + 1} 段的第一句：${clip(lead, 56)}。${follow}${keyText}离线模式只标阅读顺序，没有改写原文。`,
    };
  });
  const difficult = allSentences
    .filter((sentence) => {
      const words = sentence.split(/\s+/).length;
      const cjk = sentence.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
      return words >= 18 || cjk >= 36 || /although|however|because|尽管|然而|因为|如果/.test(sentence);
    })
    .slice(0, 5)
    .map((sentence) => ({
      sentence,
      note: "这句话偏长，或带着转折和原因。先找出主干，再看修饰是在补条件还是补例子。",
    }));
  const vocabulary = extractVocab(text);
  return {
    summary,
    paragraphs: explained,
    difficult,
    vocabulary,
  };
}

function extractVocab(text: string): VocabItem[] {
  const items: VocabItem[] = [];
  const seen = new Set<string>();
  const tokens = text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  for (const raw of tokens) {
    const word = raw.toLowerCase();
    if (seen.has(word) || STOPWORDS.has(word)) continue;
    if (DICTIONARY[word]) {
      seen.add(word);
      items.push({ word: raw, meaning: DICTIONARY[word], example: clip(sentenceOf(text, raw), 160) });
    }
  }
  if (items.length < 6) {
    for (const raw of tokens) {
      const word = raw.toLowerCase();
      if (seen.has(word) || STOPWORDS.has(word) || word.length < 7) continue;
      seen.add(word);
      items.push({
        word: raw,
        meaning: "离线词表未收录，可在牌组里改成你的释义",
        example: clip(sentenceOf(text, raw), 160),
      });
      if (items.length >= 8) break;
    }
  }
  const cjkCount = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  if (cjkCount > 20 && items.length < 6) {
    const compact = text.replace(/\s+/g, "");
    const grams = new Map<string, number>();
    for (let index = 0; index < compact.length - 1; index += 1) {
      const gram = compact.slice(index, index + 2);
      if (![...gram].every((char) => /[\u4e00-\u9fff]/.test(char))) continue;
      if ([...gram].some((char) => CJK_STOP.has(char))) continue;
      grams.set(gram, (grams.get(gram) ?? 0) + 1);
    }
    const ranked = [...grams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    for (const [gram] of ranked) {
      if (seen.has(gram)) continue;
      seen.add(gram);
      items.push({
        word: gram,
        meaning: "离线提取的反复出现的词，建议你补上自己的解释",
        example: clip(sentenceOf(text, gram), 80),
      });
    }
  }
  return items.slice(0, 10);
}

export function writingPrompt(words: string[]) {
  const list = words.filter(Boolean);
  const topic = list[0] ? `a moment when “${list[0]}” mattered` : "something you tried to learn this week";
  const required = list.length ? ` Use each of these words at least once: ${list.join(", ")}.` : "";
  return `Write 40 to 80 words about ${topic}.${required} Keep the sentences short and concrete.`;
}

export function offlineFeedback(input: { writing: string; words: string[] }): FeedbackResult {
  const writing = input.writing.trim();
  const words = input.words.map((word) => word.trim()).filter(Boolean);
  const count = writing ? writing.split(/\s+/).filter(Boolean).length : 0;
  const used = words.filter((word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(writing));
  const missed = words.filter((word) => !used.some((item) => item.toLowerCase() === word.toLowerCase()));
  const lengthNote =
    count === 0
      ? "The draft is empty, so start with two plain sentences."
      : count < 25
        ? "The draft is short. Add one sentence that shows a person, a place, or a result."
        : count > 110
          ? "The draft is longer than this exercise needs. Cut one sentence that repeats an idea."
          : "The length fits this short exercise.";
  const wordNote = words.length
    ? used.length
      ? `You used ${used.length} of ${words.length} target words (${used.join(", ")}).`
      : "None of the target words appear yet."
    : "There were no target words for this prompt.";
  const missingNote = missed.length ? ` Add “${missed[0]}” in a concrete sentence.` : " Every target word is present.";
  const revisedBase = writing
    ? writing.replace(/\s+/g, " ").replace(/[.?!]?$/, ".")
    : `I am still learning how to use ${words.join(", ") || "these words"}.`;
  const revised = missed[0]
    ? `${revisedBase} A clearer next sentence would use “${missed[0]}” with a specific detail.`
    : `${revisedBase} The target words already sit inside the paragraph.`;
  return {
    comment: `${lengthNote} ${wordNote}${missingNote} This note was written by the offline coach, so treat it as a checklist rather than a full correction.`,
    revised,
    wordNotes: words.map((word) => {
      const hit = used.some((item) => item.toLowerCase() === word.toLowerCase());
      return {
        word,
        used: hit,
        note: hit ? "Used in the draft." : "Missing from the draft.",
      };
    }),
  };
}
