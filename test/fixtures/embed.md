---
title: 图片内联自检
category: 测试
status: 通过
type: 组件自检
conclusion: 图片内联按预期工作
lead: 这份文件只用于验证 --embed 的行为，不是给人读的文档。
---

# 图片内联自检

## 同一张图引用两次

![点](assets/dot.png)

再引用一次同一张：

![点 再来一次](assets/dot.png)

## 不同格式

![SVG 图](assets/diagram.svg)

![JPG 假图](assets/photo.jpg)

## 应当跳过的

外链图片（按设计不内联，避免引入网络依赖）：

![远程](https://example.com/remote.png)

文件不存在（保留原链接，不静默删除作者内容）：

![缺失](assets/missing.png)

不支持的扩展名（保留原链接，不内联成打不开的图）：

![未知](assets/weird.bin)
