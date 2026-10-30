---
date created: 2026-09-09 12:56:51
date modified: 2026-09-10 18:51:45
---
# Redis 集群与高可用：Java 高级开发面试复习文档

> 适用方向：Java 高级开发 / Spring Boot / 分布式系统面试  
> 重点范围：Redis 主从复制、Sentinel、Redis Cluster、读写分离、一致性、Spring Boot 接入、常见面试追问

---

## 一、Redis 常见三种高可用/集群方案总览

严格来说，Redis 常见的部署演进可以理解为：

1. 主从复制（Master + Replica）
2. Sentinel 哨兵模式（主从复制 + 自动故障转移）
3. Redis Cluster（数据分片 + 高可用）

对比：

| 模式 | 常见配置 | 数据分片 | 自动故障转移 | 读写分离 | 主要解决问题 |
|---|---|---:|---:|---:|---|
| 主从复制 | 1 主 1~2 从 | 否 | 否 | 可选 | 数据副本、读扩展 |
| Sentinel | 1 主 2 从 + 3 Sentinel | 否 | 是 | 可选 | 高可用、自动选主 |
| Redis Cluster | 3 主 3 从起步 | 是 | 是 | 可选 | 分片、扩容、高可用 |

核心演进逻辑：

```text
单机 Redis
   ↓
需要数据副本
   ↓
主从复制
   ↓
需要 Master 自动故障切换
   ↓
Sentinel
   ↓
单机内存或写性能不足
   ↓
Redis Cluster
```

---

# 二、主从复制

## 2.1 基本结构

典型一主两从：

```text
             Master
          10.0.0.1:6379
           /         \
          /           \
 Replica1             Replica2
10.0.0.2:6379       10.0.0.3:6379
```

Master 负责写入，Replica 自动复制 Master 的数据。

---

## 2.2 常见 redis.conf 配置

### Master

```conf
port 6379
bind 0.0.0.0

requirepass 123456
```

### Replica1

```conf
port 6379
bind 0.0.0.0

replicaof 10.0.0.1 6379
masterauth 123456

requirepass 123456
```

### Replica2

```conf
port 6379
bind 0.0.0.0

replicaof 10.0.0.1 6379
masterauth 123456

requirepass 123456
```

---

## 2.3 三个关键配置

### `replicaof`

```conf
replicaof 10.0.0.1 6379
```

表示：

> 当前 Redis 是 `10.0.0.1:6379` 的从节点。

---

### `masterauth`

```conf
masterauth 123456
```

表示：

> Replica 连接 Master 时使用的认证密码。

记忆：

```text
masterauth
= 我作为 Replica 连接 Master 时用的密码
```

---

### `requirepass`

```conf
requirepass 123456
```

表示：

> 其他客户端连接当前 Redis 节点时需要的密码。

记忆：

```text
requirepass
= 别人连接我时需要的密码
```

所以：

```text
masterauth = 我连接别人
requirepass = 别人连接我
```

---

## 2.4 主从复制是不是 Redis 自带的？

是。

主从复制是 Redis 原生功能，不需要 MyCat、Proxy 或其他中间件。

只要 Replica 配置：

```conf
replicaof master-ip master-port
```

Redis 就会自动建立复制关系。

---

## 2.5 主从复制过程

可以分成两部分：

### 第一次同步

Replica 第一次连接 Master：

```text
Replica
  ↓
连接 Master
  ↓
身份认证
  ↓
请求同步
  ↓
Master 生成/发送数据快照
  ↓
Replica 加载数据
```

通常涉及：

- PSYNC
- replication id
- replication offset
- RDB
- replication backlog

---

### 后续增量同步

例如 Master：

```redis
SET user:1 Tom
```

复制链路：

```text
Master
  ├──→ Replica1
  └──→ Replica2
```

Replica 自动执行对应复制流。

---

## 2.6 Redis 主从复制是同步还是异步？

默认是：

> 异步复制。

流程：

```text
客户端
  ↓
Master 写成功
  ↓
Master 返回成功
  ↓
之后将数据发送给 Replica
```

所以不会默认等待所有 Replica 都完成同步再返回。

优点：

- 写性能高
- Replica 卡顿不会直接拖死每次写操作

缺点：

- 存在主从复制延迟
- Master 突然宕机时，极端情况下可能丢失少量尚未同步的数据

---

## 2.7 主从延迟一般多久？

没有固定值。

正常情况下，同机房、网络正常、机器负载较低：

```text
通常是毫秒级
```

例如：

```text
1ms ~ 数十 ms
```

但 Redis 不保证这个数值。

以下情况可能导致延迟升高：

- 网络抖动
- Master 写 QPS 很高
- Replica CPU 满
- Replica 网络带宽不足
- 大 Key
- 阻塞命令
- Replica 断线重连
- 发生全量同步
- 跨机房复制

可能出现：

```text
几十 ms
几百 ms
甚至秒级
```

因此不能依赖“复制一定几毫秒完成”。

---

# 三、主从复制和读写分离

## 3.1 有主从复制就一定会读从节点吗？

不会。

例如 Spring Boot 只连接：

```yaml
spring:
  data:
    redis:
      host: 10.0.0.1
      port: 6379
```

那么客户端只访问：

```text
Spring Boot → Master
```

Replica 仍然会复制数据，但业务不会读它们。

---

## 3.2 不做读写分离，主从复制还有什么意义？

非常有意义。

主要价值：

1. 数据冗余
2. 为高可用提供候选节点
3. Master 故障后可以提升 Replica
4. 后续可以扩展读能力
5. 可用于备份或只读查询

即使：

```text
读 → Master
写 → Master
```

Replica 仍然可以作为故障切换节点。

因此：

```text
主从复制
≠
必须读写分离
```

---

## 3.3 为什么很多项目不做 Redis 读写分离？

因为 Redis 单节点本身读取性能很高。

如果业务：

```text
读 QPS 并没有达到瓶颈
```

那么读写都走 Master 往往更简单。

优点：

- 避免主从延迟
- 强化写后读一致性
- 配置简单
- 排查问题简单

所以生产中很常见：

```text
1 Master
2 Replica
3 Sentinel

但业务读写仍全部走 Master
```

Replica 主要承担高可用职责。

---

# 四、读写分离的数据一致性问题

## 4.1 为什么会出现不一致？

因为 Redis 主从复制是异步的。

例如：

```text
T1
Master:
order:1001 = PAID

T2
Replica:
order:1001 = UNPAID

T3
应用读取 Replica
→ 得到 UNPAID
```

这就是：

> 主从延迟导致的短暂数据不一致。

---

## 4.2 什么叫写后读一致性？

Read-after-write consistency：

```text
写入成功
↓
马上读取
↓
必须读到刚写入的新值
```

如果：

```text
写 Master
读 Replica
```

则不能天然保证写后读一致性。

---

## 4.3 哪些数据不建议从 Replica 读？

一致性要求高的数据，例如：

- 支付状态
- 库存
- 登录状态
- Token
- 验证码
- 幂等标记
- 分布式锁状态
- 刚更新的订单状态
- 权限变化

推荐：

```text
读 Master
```

---

## 4.4 哪些数据比较适合从 Replica 读？

允许短时间旧数据：

- 商品详情缓存
- 文章缓存
- 推荐数据
- 排行榜
- 统计数据
- 热门内容
- 非实时展示信息

这类业务可以：

```text
读 Replica
```

---

## 4.5 如何降低主从延迟带来的问题？

常见方案：

### 方案一：关键数据直接读 Master

最简单、最常见。

```text
关键读 → Master
普通读 → Replica
```

---

### 方案二：写后一定时间读 Master

例如：

```text
更新用户信息
↓
1 秒内读取走 Master
↓
之后恢复 Replica
```

实现复杂度较高。

---

### 方案三：使用 WAIT

例如：

```redis
SET order:1001 PAID
WAIT 1 100
```

大意：

> 等待最多 100ms，希望至少 1 个 Replica 确认复制到指定位置。

注意：

`WAIT` 可以提升复制确认程度，但不能把 Redis 变成严格强一致系统。

---

# 五、Spring Boot 如何配置读写分离

## 5.1 固定连接某个 Replica

例如：

```java
@Bean("replicaConnectionFactory")
public LettuceConnectionFactory replicaConnectionFactory() {

    RedisStandaloneConfiguration config =
            new RedisStandaloneConfiguration("10.0.0.2", 6379);

    config.setPassword("123456");

    return new LettuceConnectionFactory(config);
}
```

这表示：

```text
固定连接 10.0.0.2:6379
```

注意：

> 它只配置了一个节点。

即使 Redis 还有：

```text
10.0.0.3:6379
```

也不会自动访问。

---

## 5.2 为什么不推荐生产环境写死 Replica IP？

例如：

```text
10.0.0.1 Master
10.0.0.2 Replica
```

如果故障转移：

```text
10.0.0.1 Master ❌

10.0.0.2
Replica → 新 Master
```

那么：

```text
原来的 replicaConnectionFactory
```

实际上已经连接到新的 Master。

所以固定 IP 不能很好适应主从角色变化。

---

## 5.3 Lettuce ReadFrom

常见策略：

```java
ReadFrom.MASTER
```

只从 Master 读。

```java
ReadFrom.REPLICA
```

只从 Replica 读。

```java
ReadFrom.REPLICA_PREFERRED
```

优先从 Replica 读，Replica 不可用时使用 Master。

```java
ReadFrom.MASTER_PREFERRED
```

优先 Master，必要时使用 Replica。

---

## 5.4 `REPLICA_PREFERRED` 是否有一致性风险？

有。

```text
写 → Master
读 → Replica
```

只要 Replica 有同步延迟：

```text
就可能读到旧数据
```

所以：

```text
REPLICA_PREFERRED
```

只是路由策略，不解决一致性问题。

---

## 5.5 高级项目如何主动选择主读/从读？

常见方案：

### 方案一：两个 RedisTemplate

```text
masterRedisTemplate
replicaRedisTemplate
```

业务主动选择。

缺点：

- 侵入业务代码
- 固定节点不适合故障切换
- 多 Replica 管理复杂

---

### 方案二：封装 Redis Service

例如：

```java
redisService.readStrong(...)
redisService.readEventually(...)
```

其中：

```text
readStrong
→ Master

readEventually
→ Replica
```

业务语义更清晰。

---

### 方案三：AOP + 注解

例如：

```java
@RedisRead(ReadMode.MASTER)
public Order getOrder(...) {
}
```

或者：

```java
@RedisRead(ReadMode.REPLICA)
public Product getProduct(...) {
}
```

通过 AOP + ThreadLocal + 动态路由控制。

适合较复杂项目。

---

# 六、Sentinel 哨兵模式

## 6.1 Sentinel 解决什么问题？

普通主从：

```text
Master
 ↓
Replica
```

Master 挂了：

```text
无法自动选择新的 Master
```

Sentinel 就是为了解决：

> Master 自动故障检测和故障转移。

---

## 6.2 常见生产配置

非常经典：

```text
1 Master
2 Replica
3 Sentinel
```

例如：

```text
Redis：

10.0.0.1:6379   Master
10.0.0.2:6379   Replica1
10.0.0.3:6379   Replica2

Sentinel：

10.0.0.11:26379
10.0.0.12:26379
10.0.0.13:26379
```

其中：

```text
6379
= Redis 数据节点默认端口

26379
= Sentinel 默认端口
```

---

## 6.3 一定需要六台服务器吗？

不一定。

生产中可以部署为：

```text
服务器1：
Redis Master
Sentinel1

服务器2：
Redis Replica1
Sentinel2

服务器3：
Redis Replica2
Sentinel3
```

所以：

```text
3 台机器
可以运行
3 Redis + 3 Sentinel 进程
```

---

## 6.4 Sentinel 常见配置

```conf
port 26379

sentinel monitor mymaster 10.0.0.1 6379 2
sentinel auth-pass mymaster 123456

sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 60000
sentinel parallel-syncs mymaster 1
```

---

## 6.5 `sentinel monitor` 怎么理解？

```conf
sentinel monitor mymaster 10.0.0.1 6379 2
```

含义：

```text
mymaster
= Master 的逻辑名称

10.0.0.1 6379
= 当前 Master

2
= quorum
```

这个 `2`：

> 至少需要 2 个 Sentinel 认为 Master 已经主观下线，才能达到客观下线判断条件。

注意：

> quorum 和 Sentinel Leader 选举的多数票不是完全同一个概念。

---

## 6.6 为什么通常是 3 个 Sentinel？

如果只有两个 Sentinel：

```text
S1
S2
```

发生网络分区时，很容易无法形成多数。

三个：

```text
S1
S2
S3
```

多数是：

```text
2
```

因此可以容忍其中一个 Sentinel 故障。

这也是分布式系统常见的奇数节点设计。

---

## 6.7 Sentinel 故障转移过程

例如：

```text
Master ❌
```

流程：

```text
Sentinel 发现 Master 不可达
↓
主观下线 SDOWN
↓
多个 Sentinel 达到 quorum
↓
客观下线 ODOWN
↓
Sentinel 选举 Leader
↓
Leader 选择一个 Replica
↓
Replica 晋升为 Master
↓
其他 Replica 改为复制新 Master
↓
客户端重新发现 Master
```

---

## 6.8 Spring Boot Sentinel 配置

```yaml
spring:
  data:
    redis:
      password: 123456

      sentinel:
        master: mymaster
        nodes:
          - 10.0.0.11:26379
          - 10.0.0.12:26379
          - 10.0.0.13:26379
```

Spring Boot 不是把普通 GET/SET 发给 Sentinel。

Sentinel 主要帮助客户端获取：

```text
当前 Master 是谁？
有哪些 Replica？
Master 是否发生切换？
```

Redis 数据读写最终还是访问：

```text
Redis 数据节点 :6379
```

---

# 七、Redis Cluster

## 7.1 Cluster 主要解决什么问题？

Sentinel 仍然是：

```text
一个 Master 承担所有写
```

所有数据也完整存储在这个 Master 上。

如果：

- 单机内存装不下
- 写 QPS 单机不够
- 需要横向扩容

就考虑：

> Redis Cluster。

---

## 7.2 最常见配置

最经典：

```text
3 Master + 3 Replica
```

即：

```text
M1 → R1
M2 → R2
M3 → R3
```

共 6 个 Redis 节点。

---

## 7.3 Redis Cluster 为什么至少常见 3 个 Master？

Cluster 要进行：

- 节点通信
- 故障判断
- 投票
- 分片

三个 Master 是生产环境最基本的多数派结构之一。

---

## 7.4 Redis Cluster 有多少个 Hash Slot？

固定：

```text
16384 个 Hash Slot
```

常见分配：

```text
M1
0 ~ 5460

M2
5461 ~ 10922

M3
10923 ~ 16383
```

Key 大致通过：

```text
CRC16(key) % 16384
```

确定属于哪个 slot。

---

## 7.5 Cluster 和普通主从数据存储最大的区别

### 主从 / Sentinel

假设数据 100GB：

```text
Master    100GB
Replica1  100GB
Replica2  100GB
```

每个副本都是完整数据。

---

### Cluster

假设 3 个 Master：

```text
M1 ≈ 33GB
M2 ≈ 33GB
M3 ≈ 34GB
```

数据被真正拆分了。

所以：

```text
主从
= 数据复制

Cluster
= 数据分片 + 副本
```

---

## 7.6 Cluster 需要 Sentinel 吗？

通常：

> 不需要。

因为 Redis Cluster 自身就包含：

- 节点间 Gossip
- 故障检测
- 投票
- Replica 晋升
- 自动故障转移

所以：

```text
Sentinel
用于非 Cluster 的主从高可用

Cluster
自己拥有故障转移机制
```

---

## 7.7 Cluster 一个 Master 只有一个 Replica，Master 挂了怎么办？

假设：

```text
M1 → R1
M2 → R2
M3 → R3
```

如果：

```text
M1 ❌
```

Cluster 会：

```text
发现 M1 下线
↓
R1 参与故障转移
↓
R1 晋升为新的 Master
↓
继续负责原来 M1 的 Slots
```

最终：

```text
新 M1
无 Replica

M2 → R2
M3 → R3
```

集群仍然可以继续服务。

---

## 7.8 如果新的 M1 又挂了呢？

因为它已经没有 Replica：

```text
新 M1 ❌
```

那么对应 Slot 没有可接管节点。

例如：

```text
Slot 0 ~ 5460
```

失去服务能力。

所以：

```text
3主3从
```

只能理解为：

> 每一个 Master 正常情况下有一次 Replica 接管机会。

不是无限容灾。

---

## 7.9 如果 M1 和 R1 同时挂了？

```text
M1 ❌
R1 ❌
```

那这一分片就没有可用节点。

M2、M3 不会自动复制 M1 的数据来接管。

这一点非常重要。

错误理解：

```text
M1 挂了
→ M2 接管 M1 数据
```

正确理解：

```text
M1 挂了
→ R1 晋升为 Master
```

每个分片本质上类似：

```text
一个小型 Master + Replica 高可用组
```

---

## 7.10 更高可用怎么配？

例如：

```text
M1 → R1a
   → R1b

M2 → R2a
   → R2b

M3 → R3a
   → R3b
```

即：

```text
3 Master + 6 Replica
```

优点：

- Master 故障后，一个 Replica 晋升
- 仍然保留另一个 Replica
- 容灾能力更强

缺点：

- 内存成本高
- 机器成本高
- 运维复杂度提高

普通业务一般：

```text
3主3从
```

已经很常见。

---

# 八、读压力达到什么级别需要 Replica？

不能单纯看 Redis 数据量。

更应该看：

- QPS
- CPU
- 网络带宽
- 命令复杂度
- Value 大小
- Hot Key
- P95 / P99 延迟
- 慢查询
- 连接数

粗略量级感：

| 单节点读 QPS | 一般判断 |
|---:|---|
| < 1 万 | 通常较轻 |
| 1 万 ~ 5 万 | 大多数场景可承受 |
| 5 万 ~ 10 万 | 开始需要重点监控 |
| 10 万+ | 强烈建议压测 |
| 20 万+ | 不能再靠经验判断 |

注意：

> 这只是量级感，绝对不能当 SLA 或容量保证。

---

## 8.1 为什么不能只看 QPS？

例如：

```redis
GET user:1
```

Value：

```text
100 Byte
```

和：

```redis
GET report
```

Value：

```text
5MB
```

即使 QPS 相同，网络和 CPU 压力完全不同。

---

## 8.2 网络带宽也可能先到瓶颈

例如：

```text
10 万 QPS
每个 Value 1KB
```

粗略返回流量：

```text
≈ 100 MB/s
```

此时可能是：

```text
网络先成为瓶颈
```

而不是 Redis CPU。

---

## 8.3 Hot Key

例如：

```text
总 QPS = 5 万
```

但其中：

```text
4 万 QPS
```

全部访问：

```text
product:10086
```

就是典型 Hot Key。

可能导致：

- 单核压力集中
- 网络集中
- 单节点异常
- 客户端负载不均

---

## 8.4 什么时候加 Replica？

如果：

```text
主要是读压力
```

可以考虑：

```text
增加 Replica
+
读写分离
```

如果：

```text
主要是写压力
```

增加 Replica 基本解决不了，因为：

```text
所有写依然进入 Master
```

应考虑：

```text
Redis Cluster
```

如果：

```text
单机内存装不下
```

同样应该考虑：

```text
Redis Cluster
```

记忆：

```text
读压力大
→ Replica

写压力大
→ Cluster

数据单机放不下
→ Cluster
```

---

# 九、Java 高级开发高频面试题

下面部分建议按照：

```text
问题
→ 30 秒答案
→ 深挖点
```

进行准备。

---

## 面试题 1：Redis 主从复制是怎么实现的？

### 推荐回答

Redis 主从复制是 Redis 原生提供的数据复制机制。

Replica 通过：

```conf
replicaof master-ip master-port
```

指定 Master。

第一次建立复制关系时可能进行全量同步，后续通过复制偏移量、Replication ID 和 replication backlog 实现增量复制。

Redis 默认使用异步复制，所以 Master 写成功后通常不会等待 Replica 完成同步才返回客户端，因此存在复制延迟。

### 可能追问

- PSYNC 和 SYNC 区别
- 全量复制什么时候发生
- replication backlog 有什么作用
- replid 和 offset 是什么
- Replica 重连如何实现部分同步

---

## 面试题 2：Redis 主从复制为什么存在数据不一致？

### 推荐回答

Redis 默认异步复制。

流程：

```text
客户端写 Master
↓
Master 写成功返回
↓
复制给 Replica
```

Master 返回成功和 Replica 完成复制之间存在时间窗口，因此如果客户端马上从 Replica 读取，可能读到旧值。

### 关键词

```text
异步复制
复制延迟
最终一致性
写后读一致性
```

---

## 面试题 3：有了主从复制，为什么还需要 Sentinel？

### 推荐回答

普通主从复制只能解决数据副本问题，不能自动完成 Master 故障切换。

Master 挂掉后，需要人工把某个 Replica 提升为 Master。

Sentinel 提供：

- Master 监控
- 故障判断
- Leader 选举
- Replica 选主
- 自动故障转移
- 客户端服务发现

因此：

```text
主从复制
= 数据复制

Sentinel
= 主从复制 + 自动故障转移
```

---

## 面试题 4：为什么 Sentinel 一般是 3 个？

### 推荐回答

Sentinel 是分布式协调机制，需要多数派。

3 个节点可以允许 1 个 Sentinel 故障后，剩余两个仍然形成多数。

如果只有两个 Sentinel，一旦一个故障，就无法形成多数派完成 Leader 选举。

同时使用奇数节点可以减少节点数量浪费。

---

## 面试题 5：Sentinel 的 quorum=2 是什么意思？

例如：

```conf
sentinel monitor mymaster 10.0.0.1 6379 2
```

### 推荐回答

`2` 是 quorum。

表示至少需要 2 个 Sentinel 认为 Master 处于主观下线，才能达到客观下线判定条件。

但要注意：

> quorum 和 Sentinel Leader 选举需要的多数票不是同一个概念。

这是高级面试比较容易追问的点。

---

## 面试题 6：什么是 SDOWN 和 ODOWN？

### SDOWN

Subjectively Down：

```text
某一个 Sentinel
认为 Master 下线
```

### ODOWN

Objectively Down：

```text
达到 quorum 数量的 Sentinel
认为 Master 下线
```

达到 ODOWN 后才会进入后续故障转移流程。

---

## 面试题 7：Sentinel 如何选择新的 Master？

回答思路：

Sentinel 会综合考虑 Replica 的状态，例如：

- 是否在线
- 复制状态
- replica-priority
- replication offset
- 与 Master 的同步程度

从合适的 Replica 中选择节点晋升。

不建议面试时只回答：

```text
随机选一个从节点
```

这是错误的。

---

## 面试题 8：Redis Cluster 和 Sentinel 最大区别？

### 推荐回答

Sentinel：

```text
没有数据分片
所有数据仍然在一个 Master
主要解决高可用
```

Cluster：

```text
数据拆分到多个 Master
同时具备高可用
解决容量和写吞吐横向扩展
```

一句话：

> Sentinel 解决单主高可用，Cluster 解决分片 + 高可用。

---

## 面试题 9：Redis Cluster 为什么有 16384 个 Slot？

Cluster 不直接使用一致性 Hash 环，而是把 Key 映射到固定的：

```text
16384 Hash Slot
```

通过：

```text
CRC16(key) % 16384
```

计算 Slot。

Slot 再归属于不同 Master。

优点：

- 节点扩缩容时迁移 Slot
- 不需要直接以节点为 Hash 环
- 集群管理简单
- 数据迁移粒度明确

---

## 面试题 10：Redis Cluster 为什么不是 16384 个节点？

因为：

```text
Slot 是逻辑分片
Node 是物理/进程节点
```

一个 Master 可以负责大量 Slot。

例如：

```text
M1 → 5461 Slots
M2 → 5462 Slots
M3 → 5461 Slots
```

---

## 面试题 11：Redis Cluster 某个 Master 挂了怎么办？

例如：

```text
M1 → R1
```

M1 下线：

```text
Cluster 判断 M1 故障
↓
R1 发起故障转移
↓
获取多数 Master 授权
↓
R1 晋升为新 Master
↓
继续负责原 Slot
```

---

## 面试题 12：M1 和 R1 同时挂了怎么办？

这是非常高频的追问。

正确回答：

> 如果某个 Master 和它唯一的 Replica 都不可用，该 Master 负责的 Slot 没有节点可以接管。

此时可能导致 Cluster 进入不可用状态，具体还受：

```conf
cluster-require-full-coverage
```

等配置影响。

因此：

```text
3主3从
```

不是意味着可以任意坏两个节点。

容灾的关键是：

> 不能让同一个分片的 Master 和 Replica 同时丢失。

---

## 面试题 13：3 主 3 从可以容忍几个节点故障？

不要回答：

```text
最多挂 3 个
```

因为不准确。

应该回答：

> 取决于故障分布。

例如：

```text
M1 挂
M2 挂
M3 挂
```

如果：

```text
R1、R2、R3 都活着
```

理论上可以分别晋升。

但：

```text
M1 + R1 同时挂
```

即使其他 4 个节点都活着，这个分片也没有副本可接管。

所以容灾不能只看“挂了几个节点”，必须看：

```text
是不是同一个主从组同时故障
```

这是高级面试很好的回答。

---

## 面试题 14：Redis Cluster 需要 Sentinel 吗？

不需要。

Redis Cluster 自身包含：

- 节点探测
- Gossip
- 故障判断
- 投票
- Replica 晋升
- 故障转移

Sentinel 主要用于：

```text
非 Cluster 的主从架构
```

---

## 面试题 15：Redis Cluster 是强一致的吗？

不是。

Redis Cluster 的主从复制同样主要基于异步复制。

因此：

```text
Master 写成功
Replica 尚未收到
Master 立即宕机
```

极端情况下仍可能丢失最新写入。

所以 Redis Cluster 更准确属于：

```text
高性能、高可用、最终一致性倾向的系统
```

而不是严格 CP 强一致数据库。

---

## 面试题 16：Redis 读写分离有什么缺点？

主要：

1. 主从延迟
2. 可能读到旧数据
3. 写后读不一致
4. 运维和客户端路由复杂
5. 故障切换时角色动态变化

所以 Redis 是否读写分离，需要业务根据一致性要求决定。

---

## 面试题 17：Spring Boot 如何实现 Redis 读写分离？

常见使用 Lettuce 的 ReadFrom：

```java
ReadFrom.REPLICA_PREFERRED
```

实现：

```text
写 → Master
读 → 优先 Replica
```

但是必须说明：

> `REPLICA_PREFERRED` 只解决路由问题，不解决主从同步延迟。

如果业务需要强一致查询：

```text
必须主动读 Master
```

---

## 面试题 18：Java 项目怎么主动选择读 Master 还是 Replica？

可以回答三层方案：

### 简单项目

多个 RedisTemplate：

```text
masterRedisTemplate
replicaRedisTemplate
```

---

### 中等项目

封装：

```java
redisService.readStrong()
redisService.readEventually()
```

---

### 大型项目

AOP + 注解：

```java
@RedisRead(MASTER)
@RedisRead(REPLICA)
```

再结合：

- ThreadLocal
- AbstractRoutingConnectionFactory / 自定义路由
- Lettuce 拓扑发现

注意：

> 不推荐把具体 Replica IP 写死到业务层。

---

## 面试题 19：Redis 为什么不建议大量 Replica？

Replica 越多：

- Master 网络复制流量越大
- 复制连接更多
- 内存成本更高
- 运维复杂
- 故障恢复更复杂

如果只是高可用：

```text
1 主 2 从
```

通常已经比较合理。

---

## 面试题 20：什么时候应该从 Sentinel 升级到 Cluster？

典型三个信号：

### 1. 单机数据量接近内存上限

```text
单个 Master 放不下
```

### 2. 写 QPS 单机成为瓶颈

增加 Replica 只能扩展读，不能分摊写。

### 3. 需要水平扩容

希望：

```text
加 Master
↓
增加总内存
+
增加总写能力
```

这时候应该考虑 Cluster。

---

# 十、面试常见陷阱

## 陷阱 1

### 错误

> Redis 有 Replica 后，客户端会自动读 Replica。

### 正确

不会。

是否读取 Replica 取决于客户端配置和路由策略。

---

## 陷阱 2

### 错误

> Redis 主从复制是同步复制，所以不会丢数据。

### 正确

默认异步复制。

因此存在：

- 复制延迟
- 极端情况下的数据丢失窗口

---

## 陷阱 3

### 错误

> Replica 越多越好。

### 正确

Replica 会增加：

- 网络
- 内存
- 复制
- 运维成本

需要根据读压力和容灾要求选择。

---

## 陷阱 4

### 错误

> Sentinel 有 3 个，就必须 3 台 Sentinel 独立服务器。

### 正确

Sentinel 是独立进程，但可以和 Redis 数据节点部署在同一台机器。

典型：

```text
3 台服务器
每台：
1 个 Redis + 1 个 Sentinel
```

---

## 陷阱 5

### 错误

> Cluster 3 主 3 从可以任意坏 3 个节点。

### 正确

取决于故障分布。

```text
M1 + R1
```

同时挂掉，就可能导致对应分片无副本。

---

## 陷阱 6

### 错误

> Cluster 的其他 Master 会自动接管宕机 Master 的数据。

### 正确

正常故障转移是：

```text
Master 对应的 Replica
→ 晋升为新的 Master
```

不是其他 Master 自动接管数据。

---

## 陷阱 7

### 错误

> Redis Cluster 就没有主从延迟问题。

### 正确

Cluster 的每个 Master 和 Replica 仍然是主从复制机制。

因此：

```text
仍然存在复制延迟
```

---

# 十一、面试中的架构选型回答模板

如果面试官问：

> 你们为什么选择 Sentinel，而不是 Cluster？

可以回答：

```text
我们的 Redis 数据量单机可以承载，
写 QPS 也没有达到单机瓶颈。

主要需求是解决 Master 单点故障，
所以采用 1 主 2 从 + 3 Sentinel。

业务一致性要求较高，因此主要读写 Master，
Replica 主要作为高可用副本。

这种方案比 Cluster 运维成本更低，
也满足当前容量和可用性要求。
```

这是一个很成熟的高级开发回答。

---

如果面试官问：

> 为什么后来需要 Cluster？

可以回答：

```text
随着 Redis 数据量和写流量增长，
单个 Master 的内存容量和写吞吐成为瓶颈。

继续增加 Replica 只能扩展读取能力，
无法分摊写入和数据容量。

因此升级到 Redis Cluster，
通过多个 Master 分担 Hash Slot，
实现数据分片和写流量水平扩展，
同时每个 Master 配置 Replica 保证高可用。
```

---

# 十二、Java 高级开发应该掌握到什么程度？

面试 Redis 集群时，至少应该能够解释清楚以下链路：

```text
主从复制
↓
为什么会有复制延迟
↓
为什么不一定做读写分离
↓
为什么需要 Sentinel
↓
Sentinel 如何发现故障
↓
SDOWN / ODOWN
↓
quorum
↓
为什么 3 Sentinel
↓
如何自动选新 Master
↓
为什么 Sentinel 仍然不能扩展写
↓
Redis Cluster
↓
16384 Slot
↓
数据如何分片
↓
3主3从如何容灾
↓
为什么同一主从组不能同时挂
↓
Spring Boot / Lettuce 如何接入
↓
读写分离的一致性风险
```

答案：

```Text
Redis 为了避免单点和保存数据副本，
可以使用主从复制。
↓
主从复制默认是异步的，
所以存在复制延迟。
↓
因为 Replica 可能存在旧数据，
所以有主从并不代表一定要做读写分离，
一致性要求高的系统甚至可以全部读写 Master。
↓
但是普通主从存在一个问题：
Master 挂了不能自动切换。
↓
于是可以引入 Sentinel。
↓
Sentinel 通过周期性探测 Redis，
先形成 SDOWN，
多个 Sentinel 达到 quorum 后形成 ODOWN，
再进行 Sentinel Leader 选举，
选择合适的 Replica 晋升为新 Master。
↓
通常使用 3 个 Sentinel，
因为可以在一个 Sentinel 故障时仍保留多数派。
↓
但是 Sentinel 架构仍然只有一个 Master，
所以所有写请求还是集中在单节点，
无法横向扩展写能力。
↓
当单机容量或写吞吐不够时，
就需要 Redis Cluster。
↓
Redis Cluster 把数据映射到 16384 个 Hash Slot，
不同 Slot 分布在多个 Master 上，
实现数据分片和写流量扩展。
↓
典型配置是 3 主 3 从，
每个 Master 有一个 Replica。
Master 故障时由自己的 Replica 晋升接管。
↓
但如果某个 Master 和它唯一的 Replica 同时故障，
对应 Slot 就没有可用副本。
↓
Java Spring Boot 通常使用 Lettuce 接入 Sentinel 或 Cluster，
Lettuce 可以感知拓扑并完成节点路由。
↓
如果配置 Replica 读取，
仍然必须考虑异步复制导致的主从延迟，
对强一致业务应该读取 Master。
```


如果这些能够顺畅回答，已经基本覆盖 Java 高级开发 Redis 高可用方向的大部分常见面试题。

---

# 十三、最终速记

## 主从复制

```text
1 主 1~2 从

解决：
数据副本
读扩展

缺点：
Master 不能自动切换
```

---

## Sentinel

```text
1 主 2 从
+
3 Sentinel

解决：
Master 自动故障切换

不解决：
数据分片
写扩展
```

---

## Cluster

```text
3 主 3 从起步

16384 Hash Slot

解决：
数据分片
写扩展
容量扩展
高可用
```

---

## 三句话记忆

```text
主从：
解决“有没有副本”。

Sentinel：
解决“Master 挂了谁来接班”。

Cluster：
解决“一个 Master 装不下、写不动”。
```

---

## Java 项目选型口诀

```text
单机够用
→ 单机 / 主从

需要自动故障转移
→ Sentinel

只是读压力大
→ 增加 Replica + 选择性读写分离

写压力大
→ Cluster

单机内存放不下
→ Cluster
```

---

## 高级面试最重要的几个结论

1. Redis 主从复制默认是异步复制。
2. 有 Replica 不代表客户端自动读 Replica。
3. 主从复制不等于读写分离。
4. 读写分离存在主从延迟和写后读一致性问题。
5. Sentinel 解决高可用，不解决分片。
6. Redis Cluster 不需要 Sentinel。
7. Cluster 的每个 Master 通常由自己的 Replica 接管。
8. 3 主 3 从能容忍多少故障取决于故障分布，而不是简单看故障节点数量。
9. 增加 Replica 能扩展读，不能扩展写。
10. 单机数据容量或写吞吐成为瓶颈时，应考虑 Redis Cluster。


