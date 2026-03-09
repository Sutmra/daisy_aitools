const raw = '我想知道在系统进行抄表需要进行什么操作，有哪些步骤';
const clean = raw.replace(/[\s\p{P}，。？！、；：""''（）【】《》…—·\n\r\t]+/gu, ' ').trim();
const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
const segments = [...segmenter.segment(clean)];
const tokens = segments.filter(s => s.isWordLike).map(s => s.segment);
const GENERIC_WORDS = new Set(['管理', '系统', '平台', '功能', '模块', '操作', '手册', '指南', '规范', '流程', '说明', '步骤', '什么', '怎么', '如何', '哪些', '关于', '介绍', '常见', '故障', '处理', '办法', '使用', '进行', '配置', '遇到', '解决', '原因', '方案', '业务', '人员', '工具', '情况', '时候', '出现', '知道', '需要', '有些', '我想', '有', '在']);

const hasCoreToken = tokens.some(tok => !GENERIC_WORDS.has(tok));
const activeTokens = hasCoreToken ? tokens.filter(tok => !GENERIC_WORDS.has(tok)) : tokens;

console.log('Clean:', clean);
console.log('Tokens:', tokens);
console.log('Active Tokens:', activeTokens);

const raw2 = '如何抄表';
const clean2 = raw2.replace(/[\s\p{P}，。？！、；：""''（）【】《》…—·\n\r\t]+/gu, ' ').trim();
const segments2 = [...segmenter.segment(clean2)];
const tokens2 = segments2.filter(s => s.isWordLike).map(s => s.segment);
const activeTokens2 = tokens2.some(tok => !GENERIC_WORDS.has(tok)) ? tokens2.filter(tok => !GENERIC_WORDS.has(tok)) : tokens2;

console.log('Clean 2:', clean2);
console.log('Tokens 2:', tokens2);
console.log('Active Tokens 2:', activeTokens2);
