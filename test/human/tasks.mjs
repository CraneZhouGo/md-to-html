// 人因测试题库：每题必须满足
//   1) 答案在文档里唯一且是短字符串（可机械校验）
//   2) 不是直接搜答案串就能搞定（要搜的是"问到的东西"，不是答案本身）
//   3) 八题分布在文档不同章节，逼出"定位"而不是"从头读"

export const TASKS = [
  {
    id: 'lag-normal',
    q: '同机房、负载正常时，主从延迟大约是多少？',
    accept: ['几毫秒', '100 毫秒', '100毫秒'],
    where: '§8 主从延迟',
  },
  {
    id: 'avg-tps',
    q: '一天 100 万订单，平均每秒约多少订单？给数字即可。',
    accept: ['11.6'],
    where: '§12.3 日订单量与 TPS',
  },
  {
    id: 'db-ops',
    q: '峰值 500 订单/秒、每单 13 条 SQL 时，数据库操作约多少次/秒？给数字即可。',
    accept: ['6500', '6,500'],
    where: '§12.3 日订单量与 TPS',
  },
  {
    id: 'async-stage',
    q: '「异步化」阶段推荐接入的一类中间件是什么？（缩写即可）',
    accept: ['MQ', '消息队列'],
    where: '§12.1 容量对照表',
  },
  {
    id: 'shard-first',
    q: '考虑分库分表之前，第一步应该先做的优化是什么？',
    accept: ['慢SQL', '慢 SQL', '索引优化', '索引'],
    where: '§14 分库分表评估',
  },
  {
    id: 'session-store',
    q: '推荐落地方案里，会话状态放在哪里？（组件名）',
    accept: ['Spring Session', 'Spring Session Data Redis'],
    where: '§15 推荐的务实落地方案',
  },
  {
    id: 'shard-signal',
    q: '单表达到多少行时，应该开始重点评估分片？',
    accept: ['数千万', '千万'],
    where: '§14 分库分表评估',
  },
  {
    id: 'registry',
    q: 'K8s 发布链路里，镜像仓库的组件叫什么？',
    accept: ['Harbor'],
    where: '§15 推荐的务实落地方案',
  },
];

export const CONFIG = {
  // 固定种子：每次生成同一套顺序，实验可复现
  seed: 20261030,
  // 两种条件：md = 原始 markdown 纯文本；html = 渲染后的单文件阅读面
  conditions: ['md', 'html'],
};
