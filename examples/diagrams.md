---
title: 图型速查
category: 示例
status: 可用
updated: 2026-10-30
type: 语法说明
strength: 每张图都对应一个解析器
conclusion: 八种图示都能渲染，解析失败一律退回代码块
lead: 这份文件同时是"支持哪些图"的说明和渲染器的活体测试——每张图都能在本页看到结果。
---

# 图型速查

下面每一节给出一段源码和它的渲染结果。**规则只有一条**：解析失败就原样退回代码块，绝不画出半对半错的图。

## 流程图

```mermaid
flowchart TD
  A[用户请求] --> B[Nginx]
  B --> C[实例 1]
  B --> D[实例 2]
  C --> E[(Redis)]
  D --> E
```

横向流程与判断分支：

```mermaid
flowchart LR
  A(开始) --> B{是否已登录}
  B -->|是| C[进入首页]
  B -->|否| D[跳转登录]
  D -.-> A
```

## 时序图

```mermaid
sequenceDiagram
  participant U as 用户
  participant S as 服务
  participant D as 数据库
  U->>S: 提交订单
  S->>D: 写入订单
  D-->>S: 主键
  S-->>U: 订单号
```

## 状态机

```mermaid
stateDiagram-v2
  [*] --> 待支付
  待支付 --> 已支付: 支付成功
  待支付 --> 已取消: 超时
  已支付 --> 已发货: 出库
  已发货 --> [*]: 签收
```

## ER 图

```mermaid
erDiagram
  USER ||--o{ ORDER : 下单
  ORDER ||--|{ ITEM : 包含
  USER {
    string name
    string email
  }
```

## 类图

```mermaid
classDiagram
  class Order {
    +String id
    +int amount
    +pay()
  }
  Customer "1" --> "*" Order : places
  Order <|-- Refund
```

## 用例图

```usecase
actor 用户
actor 运营
usecase 浏览商品
usecase 下单
usecase 上架商品
用户 --> 浏览商品
用户 --> 下单
运营 --> 上架商品
```

## 排期图

```mermaid
gantt
  title 季度交付计划
  dateFormat YYYY-MM-DD
  section 设计
  需求评审 :a1, 2026-01-05, 5d
  方案设计 :a2, after a1, 8d
  section 开发
  核心链路 :2026-01-20, 20d
  联调 :2026-02-10, 7d
  section 上线
  灰度 :2026-02-18, 5d
```

## ASCII 架构图（自动识别）

用制表符和箭头画的图会被自动识别；识别不了就按"图"排版显示文本。

```text
用户请求
   ↓
Nginx / 负载均衡器
   ├── 应用实例 1
   ├── 应用实例 2
   └── 应用实例 N
          ↓
 Redis、数据库、共享文件存储
```

## 不支持的写法

下面这段用了 mermaid 的 `Note`，本项目不支持，于是整块原样显示——**这是设计行为，不是缺陷**：

```mermaid
sequenceDiagram
  Note over A: 这一段暂不支持
  A->>B: 请求
```
