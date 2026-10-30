---
date created: 2026-09-11 08:17:09
date modified: 2026-09-11 09:17:34
---
# Java 服务架构演进与部署实践总结

> 本文总结从单体应用、多实例部署、数据库主从，到 Redis 共享 Session、共享文件、滚动发布、容器化及 Kubernetes 的核心概念与选型建议。

## 1. 单体项目与多实例部署

### 1.1 什么是单体项目

如果用户、商品、订单、库存、支付等模块：

- 位于同一个工程或代码仓库；
- 一起编译为同一个 JAR/WAR；
- 每次统一发布；
- 每个运行实例都包含全部业务模块；

那么它仍然是单体应用。把同一个 JAR 部署到十几台机器，只是**单体应用的多实例水平扩容**，并不等于微服务。

### 1.2 多实例架构

```text
用户请求
   ↓
Nginx / 负载均衡器
   ├── 单体实例 1
   ├── 单体实例 2
   └── 单体实例 N
          ↓
 Redis、数据库、共享文件存储
```

主要收益：

- 分担请求，提高吞吐量；
- 单个实例故障时，其他实例继续服务；
- 支持滚动发布；
- 可以根据流量增加或减少实例。

多实例应用必须尽量无状态，登录状态、文件、任务锁等不能只保存在某一台服务器本地。

## 2. Nginx 负载均衡

Nginx 作为统一入口，将请求转发到多个应用实例。

```nginx
upstream company_app {
    least_conn;
    server 10.0.0.11:8080;
    server 10.0.0.12:8080;
    server 10.0.0.13:8080;
}

server {
    listen 80;
    location / {
        proxy_pass http://company_app;
    }
}
```

常见策略：

| 策略 | 说明 |
|---|---|
| 轮询 | 请求依次分配给各实例 |
| 加权轮询 | 性能较强的机器接收更多请求 |
| 最少连接 | 优先选择当前连接数较少的实例 |
| IP Hash | 同一客户端尽量进入同一实例，但不能替代共享 Session |

## 3. Redis 共享 Session

### 3.1 为什么需要

如果 Session 只保存在 JVM 内存：

```text
登录请求 → 实例 1，登录成功
后续请求 → 实例 8，找不到 Session
```

使用 Spring Session Data Redis 后，所有实例通过 Session ID 访问 Redis 中的同一份 Session。

```text
应用实例 1 ─┐
应用实例 2 ─┼── Redis Session
应用实例 N ─┘
```

### 3.2 Spring Boot 实现

```xml
<dependency>
    <groupId>org.springframework.session</groupId>
    <artifactId>spring-session-data-redis</artifactId>
</dependency>

<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

```yaml
spring:
  data:
    redis:
      host: 10.0.0.20
      port: 6379
      password: ${REDIS_PASSWORD}
  session:
    timeout: 30m
    redis:
      namespace: company:session
```

业务仍可使用标准 `HttpSession`：

```java
session.setAttribute("LOGIN_USER", loginUser);
LoginUser user = (LoginUser) session.getAttribute("LOGIN_USER");
```

所有实例需要保持：

- Redis 地址一致；
- Session namespace 一致；
- Cookie 名称、Domain、Path 一致；
- Session 对象序列化兼容；
- 服务器时间同步。

Session 中应只保存用户 ID、租户 ID、角色摘要等小对象，不要保存图片、大集合或完整实体关联树。

### 3.3 Redis 高可用

- 只需要主从高可用：优先 Redis Sentinel；
- 单机容量或吞吐量不足、需要分片：使用 Redis Cluster；
- 单节点 Redis 会成为所有应用的共同故障点。

## 4. 数据库一主多从与读写分离

### 4.1 基本原理

```text
INSERT / UPDATE / DELETE → 主库
普通 SELECT              → 从库
主库变更                  → Binlog → 从库重放
```

所有写请求集中到主库，多个从库分担查询压力。

### 4.2 主从延迟

参考范围：

| 场景 | 常见延迟 |
|---|---:|
| 同机房、负载正常 | 几毫秒～100 毫秒 |
| 有一定写入压力 | 100 毫秒～1 秒 |
| 高峰、大事务、从库繁忙 | 数秒～几十秒 |
| 故障或严重积压 | 数分钟甚至更久 |

这个范围不是承诺。异步复制提供的是最终一致性，不能假定写入后固定多少毫秒必然可见。

### 4.3 路由原则

| 场景 | 推荐数据源 |
|---|---|
| 历史列表、普通展示、报表 | 从库 |
| 写入后的立即查询 | 主库 |
| 写事务中的所有查询 | 主库 |
| 库存、余额、支付状态 | 主库 |
| 幂等校验、唯一性判断 | 主库并配合数据库约束 |

关键原则：**不是所有 SELECT 都应该自动进入从库。**

### 4.4 延迟监控

MySQL 可以通过以下命令检查复制状态：

```sql
SHOW REPLICA STATUS;
```

重点关注：

- `Seconds_Behind_Source`；
- `Replica_IO_Running`；
- `Replica_SQL_Running`；
- GTID 执行位置；
- 复制错误和从库回放积压。

`Seconds_Behind_Source = 0` 也不代表绝对不存在毫秒级延迟。

## 5. 读写分离方案选择

| 方案 | 优点 | 局限 | 适用情况 |
|---|---|---|---|
| Mycat | 路由集中，对应用表现为 MySQL | 增加代理层、兼容和运维成本 | 已有成熟 Mycat 体系，或需要分片 |
| ShardingSphere-JDBC | Java 生态友好，嵌入应用 | 每个应用都要维护配置 | Java 项目读写分离、未来可能分片 |
| `AbstractRoutingDataSource` | 简单直接、可精确控制 | 事务切库规则需自行处理 | 仅有简单读写分离需求 |
| MySQL Router/数据库代理 | 数据库侧统一管理 | 依赖具体数据库架构 | 标准 MySQL 集群体系 |
| 云数据库读写地址 | 运维成本低 | 绑定云产品 | 公有云项目 |

推荐顺序：

1. 云数据库已经提供读写分离地址时，优先使用其官方能力。
2. 普通 Java 项目可选择 ShardingSphere-JDBC。
3. 仅做简单读写分离，可使用动态数据源，默认主库、明确标记的安全查询才走从库。
4. 公司已经稳定使用 Mycat，可以继续保留；新项目不必仅为读写分离单独引入 Mycat。

## 6. Mycat 工作原理

Mycat 位于应用和 MySQL 之间：

```text
应用 → Mycat 集群 → 主库 / 从库
```

应用连接 Mycat 提供的逻辑数据库地址，Mycat解析 SQL、判断事务状态，然后将写入转发到主库，将允许读旧数据的查询转发到从库。

生产环境至少要考虑：

- Mycat 多节点部署；
- 前置 VIP 或负载均衡；
- SQL 兼容性验证；
- 事务和强制主库查询规则；
- 从库延迟过大时自动摘除；
- Mycat 自身的日志、连接数与性能监控。

## 7. 多实例下的共享文件

### 7.1 为什么不能保存到应用本地

```text
上传请求 → 实例 3 → 文件保存在实例 3
下载请求 → 实例 9 → 找不到文件
```

### 7.2 NFS/NAS 方案

所有服务器挂载同一目录：

```text
NFS/NAS
  ├── 应用 1：/data/company-files
  ├── 应用 2：/data/company-files
  └── 应用 N：/data/company-files
```

适合：

- 遗留项目改造；
- 必须获得操作系统真实文件路径；
- 依赖目录、重命名、随机读写的组件。

需要解决 NFS 单点、IO 性能、锁和缓存一致性问题。生产环境优先使用高可用 NAS、云文件存储或 CephFS。

### 7.3 MinIO/S3 对象存储

更适合新系统的图片、附件、视频和导出文件：

```text
应用 → MinIO/S3 Bucket → Object Key
```

数据库建议保存：

```text
bucket
object_key
original_name
content_type
size
```

不要只保存完整 HTTP 地址，以免域名或存储入口变化。

大文件可以采用预签名 URL：

```text
前端向 Java 服务申请临时上传地址
→ 前端直接上传 MinIO/S3
→ 上传完成后通知 Java 保存元数据
```

推荐：普通附件使用 MinIO/S3；必须依赖文件路径的遗留功能使用 NFS/NAS。

## 8. Jenkins、GitLab CI/CD 与 Kubernetes

### 8.1 Jenkins 和 GitLab 是不是同类工具

- Jenkins 是专门的 CI/CD 自动化服务器。
- GitLab 是代码托管和研发协作平台。
- GitLab CI/CD 是 GitLab 内置的流水线能力，与 Jenkins 属于同类。

| 能力 | Jenkins | GitLab/GitLab CI |
|---|---|---|
| Git 代码托管 | 不负责 | 支持 |
| 构建、测试、部署 | 支持 | GitLab CI 支持 |
| 代码评审、Issue | 依赖其他平台 | 支持 |
| 执行节点 | Jenkins Agent | GitLab Runner |
| 流水线文件 | `Jenkinsfile` | `.gitlab-ci.yml` |

一般选择一套主流水线即可：已有成熟 Jenkins 就继续使用；代码托管在 GitLab 且希望统一平台，可选择 GitLab CI/CD。

### 8.2 Kubernetes 与 CI/CD 的关系

```text
GitLab 代码仓库
    ↓
Jenkins / GitLab CI：编译、测试、构建镜像
    ↓
Harbor / 镜像仓库
    ↓
Kubernetes：运行、扩容、更新应用
```

K8s 不替代 Git、Jenkins/GitLab CI、镜像仓库、MySQL、Redis或对象存储。

K8s 主要接管：

- Pod 调度与生命周期；
- 应用副本数量；
- 容器故障重启；
- 服务发现与内部负载均衡；
- 健康检查；
- 滚动更新和回滚；
- 自动扩缩容；
- 配置、Secret和存储挂载。

## 9. JAR、镜像、容器、Pod 与服务器

| 概念 | 含义 |
|---|---|
| JAR | Java 程序归档文件 |
| Docker 镜像 | 包含应用、运行环境和文件结构的只读模板 |
| 容器 | 镜像启动后的运行实例 |
| Pod | Kubernetes 管理容器的最小调度单位 |
| Node | 承载 Pod 的物理机或虚拟机 |

K8s 不是单纯管理镜像，而是根据声明的期望状态，使用镜像创建和管理 Pod。

传统部署需要把 JAR、JDK/JRE 和启动配置放到每台服务器。容器化后，JAR和Java运行环境被打入镜像，K8s节点自动从镜像仓库拉取并启动，无需人工逐台安装 JAR。

### 9.1 一个镜像与多个副本

通常不是“10个镜像”，而是：

```text
同一个 company-app:2.1.0 镜像
→ Pod 1
→ Pod 2
→ ...
→ Pod 10
```

### 9.2 一台服务器运行10个Pod，不等于10台服务器各运行1个Pod

| 对比 | 1台服务器10个Pod | 10台服务器各1个Pod |
|---|---|---|
| CPU、内存、磁盘、网卡 | 共同争抢单机资源 | 分散到多台机器 |
| 故障影响 | 单机故障导致10个Pod同时停止 | 一台故障通常只影响一个Pod |
| 可用性 | 存在单点 | 故障域更小 |
| 性能上限 | 单台服务器上限 | 多台服务器资源总和 |

容器不会创造硬件资源。生产环境应使用拓扑分布约束或 Pod 反亲和性，把相同应用副本分散到不同节点。

## 10. 滚动发布

### 10.1 普通虚拟机环境

推荐组合：

```text
Jenkins/GitLab CI + Ansible + Nginx + Spring Boot Actuator
```

发布过程：

1. 从 Nginx 摘除一批节点；
2. 等待旧请求处理完成；
3. 停止旧版本；
4. 部署并启动新版本；
5. 调用 `/actuator/health` 检查；
6. 健康后重新加入负载均衡；
7. 继续下一批，任何一批失败则停止。

Spring Boot应启用优雅停机：

```yaml
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s
```

### 10.2 Kubernetes 环境

使用 `Deployment` 的 `RollingUpdate`：

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 0
    maxSurge: 2
```

K8s启动新Pod，通过 Readiness Probe 后再接入流量，然后逐步停止旧Pod。

### 10.3 发布时的兼容性

滚动期间新旧版本会同时存在，必须保证：

- 数据库变更遵循“先扩展、再迁移、最后删除”；
- 新旧版本能够共同使用数据库结构；
- Redis Session 对象序列化兼容；
- 接口和消息格式向后兼容；
- 定时任务不会因为临时增加实例而重复执行；
- 保留可快速回滚的旧制品或旧镜像。

## 11. JDK、JRE、JVM、JAR 与 SDK

### 11.1 概念关系

传统概念可以表达为：

```text
JDK = JRE + Java开发工具
JRE = JVM + Java核心类库和运行组件
```

Java 9模块化以后，JRE不一定以单独目录或安装包存在，但现代JDK仍包含运行Java程序需要的JVM和核心类库。

| 名称 | 全称 | 用途 |
|---|---|---|
| JDK | Java Development Kit | 编译、调试、打包和运行Java程序 |
| JRE | Java Runtime Environment | 提供Java运行环境 |
| JVM | Java Virtual Machine | 执行Java字节码 |
| JAR | Java Archive | 打包`.class`、配置和资源 |
| SDK | Software Development Kit | 某个平台或服务的开发工具包统称 |

JDK本身就是Java平台的一种SDK；其他例子包括Android SDK、AWS SDK和微信支付SDK。一个SDK内部可以包含多个JAR依赖。

容器化构建链路：

```text
JDK编译Java源码
→ Maven/Gradle生成JAR
→ JAR与Java运行环境打入镜像
→ K8s根据镜像启动Pod
→ Pod中的JVM执行JAR字节码
```

## 12. 公司从0到壮大的Java架构演进

推荐路线：

```text
单体单实例
→ 模块化单体
→ Redis、独立数据库、对象存储
→ 单体多实例
→ 数据库优化、主从和读写分离
→ 消息队列与搜索系统
→ 按业务渐进拆分微服务
→ 容器化和Kubernetes
→ 业务拆库、分库分表
→ 平台化、多机房与容灾
```

### 12.1 各阶段参考体量

以下以普通电商/医药电商为例，仅供容量规划参考，并非硬性门槛。

| 阶段 | 注册用户 | DAU | 日订单 | 峰值下单TPS | 查询峰值QPS | 典型架构 |
|---|---:|---:|---:|---:|---:|---|
| 业务验证 | 0～1万 | 0～1千 | 0～500 | 1～5 | 10～100 | 单体单实例 |
| 初步增长 | 1万～10万 | 1千～1万 | 500～1万 | 5～30 | 100～1,000 | 单体+Redis+独立MySQL |
| 单体多实例 | 10万～100万 | 1万～10万 | 1万～10万 | 20～200 | 1,000～10,000 | Nginx+多个单体实例 |
| 数据优化 | 100万～500万 | 10万～50万 | 10万～100万 | 100～1,000 | 5,000～50,000 | 缓存、主从、读写分离 |
| 异步化 | 500万以上 | 30万以上 | 50万～数百万 | 500～数千 | 数万以上 | MQ、任务平台、搜索 |
| 微服务化 | 不能只由用户量决定 | 不能只由用户量决定 | 通常数十万以上 | 数百以上 | 数万以上 | 按业务边界拆分 |
| 数据分片 | 通常百万用户以上 | 通常数十万以上 | 百万级/日或海量历史数据 | 数千级写入 | 数万～十万级 | 分库分表/分布式数据库 |

### 12.2 为什么不能只看用户和日订单量

架构容量更应该关注：

- DAU，而不是只看注册用户；
- 峰值 QPS/TPS，而不是全天平均值；
- 每个订单产生的SQL、缓存和外部调用数量；
- P95、P99响应时间；
- CPU、内存、GC和线程池；
- 数据库CPU、IOPS、连接数、锁等待和慢SQL；
- Redis命中率、热Key、大Key；
- 消息生产速度、消费速度和积压量；
- 主从延迟；
- 单表数据增长速度；
- 团队数量、发布频率和业务边界。

### 12.3 日订单量与TPS

一天有86,400秒：

```text
100万订单 ÷ 86,400 ≈ 平均11.6订单/秒
```

但平均值会掩盖高峰。订单可能集中在少数时段，活动峰值可能是平时的数倍甚至数十倍，因此容量评估必须使用峰值TPS。

下单TPS也不等于数据库TPS。假设一个订单产生13条SQL：

```text
峰值500订单/秒 × 13条SQL
≈ 6,500次数据库操作/秒
```

这还不包含商品浏览、购物车和后台查询。

## 13. 各项技术什么时候引入

| 技术 | 应解决的真实问题 |
|---|---|
| Redis | 热点查询、共享Session、分布式协调 |
| 多实例 | 单机容量、单点故障、滚动发布 |
| 数据库主从 | 读多写少、主库查询压力 |
| Kafka/RocketMQ | 削峰、异步、解耦非核心流程 |
| Elasticsearch | 全文检索、复杂搜索与聚合 |
| 微服务 | 团队协作、独立发布、独立扩容、故障隔离 |
| Kubernetes | 大量实例的调度、部署、恢复和弹性管理 |
| 分库分表 | 单库写入、容量或单表规模达到真实上限 |

微服务没有固定用户门槛。日订单20万、20人的团队可能继续使用模块化单体；日订单同样是20万，但有200名开发和几十条业务线，就更需要服务化。

K8s也没有固定流量门槛：一个应用、几台机器通常不需要；几十个服务、上百个实例、多环境和频繁发布时价值明显。

## 14. 分库分表评估

在考虑分片前，应先完成：

1. 慢SQL和索引优化；
2. 缓存；
3. 数据归档和冷热分离；
4. 主从与读写分离；
5. 业务垂直拆库；
6. 数据库硬件和参数优化。

可以开始重点评估分片的参考信号：

- 单表达到数千万行，且查询性能持续下降；
- 单表接近亿级；
- 数据库达到数TB并持续高速增长；
- 日订单百万级、历史数据增长非常快；
- 主库持续数千级写TPS且优化后仍达上限。

分库分表会引入跨分片分页、排序、统计、事务、扩容迁移和分布式ID等复杂度，应当是靠后的选择。

## 15. 推荐的务实落地方案

对于“Java单体应用部署到十几台普通服务器”的公司，优先考虑：

```text
入口：Nginx
应用：Spring Boot单体多实例
会话：Spring Session Data Redis + Redis Sentinel
数据库：MySQL主从 + 明确的读写路由
文件：MinIO/S3，遗留目录型功能使用NFS/NAS
任务：XXL-JOB或分布式锁
发布：Jenkins/GitLab CI + Ansible + Actuator健康检查
监控：Prometheus + Grafana + 集中日志
```

如果公司已经拥有成熟Kubernetes平台，则改为：

```text
GitLab
→ Jenkins/GitLab CI构建和测试
→ Docker镜像
→ Harbor
→ Kubernetes Deployment滚动更新
```

不应仅仅为了滚动发布就引入K8s。普通虚拟机上的 Ansible + Nginx 已经能够可靠完成分批部署；当服务和实例数量增长到人工难以管理时，再让K8s接管应用运行和调度。

## 16. 总结

架构演进应该由真实问题驱动：

```text
Redis解决缓存和共享状态
多实例解决单机容量和可用性
数据库主从解决读压力
消息队列解决异步解耦和流量峰值
微服务解决组织协作与业务隔离
K8s解决大量容器实例的运行管理
分库分表解决单库、单表的真实上限
```

最重要的原则是：**先发现瓶颈，再引入能够解决该瓶颈的技术，并确认团队具备监控、运维和故障恢复能力。**
