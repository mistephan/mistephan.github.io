# 一小时不崩、720p 60 FPS、还能自己加剧情：LingBot-World 2.0 把世界模型推向“可生活”的下一步

**论文：** *Infinite Worlds with Versatile Interactions*  
**作者：** Zelin Gao、Qiuyu Wang、Jiapeng Zhu、Jingye Chen、Zichen Liu、Qingyan Bai、Jiahao Wang、Yufeng Yuan、Hanlin Wang、Yichong Lu、Ka Leong Cheng、Haojie Zhang、Jian Gao、Tianrui Feng、Yuzheng Liu、Yao Yao、Yinghao Xu、Xing Zhu、Yujun Shen、Hao Ouyang  
**团队 / 单位：** Robbyant，Ant Group  
**状态：** arXiv:2607.07534 v1，2026 年 7 月 8 日  
**链接：** [论文](https://arxiv.org/abs/2607.07534)｜[项目主页](https://technology.robbyant.com/lingbot-world-v2)｜[GitHub](https://github.com/robbyant/lingbot-world-v2)｜[模型权重](https://huggingface.co/robbyant/lingbot-world-v2)

## 先说结论

LingBot-World 2.0，也叫 LingBot-World-Infinity，试图把四件此前往往分散在不同项目里的能力放进同一个开放系统：

- 自回归生成超过一小时而不出现明显画质崩坏；
- 通过少步蒸馏、并行推理和时空增强输出 720p、60 FPS 视频流；
- 除 WASD 镜头导航外，还支持攻击、射箭、施法、射击、天气改变和实体生成；
- 用 VLM“导演”持续提出事件，再由视频生成器把事件渲染成下一段世界。

![LingBot-World-Infinity 展示的多种开放世界与交互场景](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1784040893/haptic/infinite_worlds_20260714/figure1_cover.png)

它最值得关注的地方，并不是“生成时间更长”，而是开始形成一套**可部署的 Agentic World Model 系统栈**：视频模型负责像素级动力学，视觉语言模型负责高层事件与因果常识，追踪模型负责绑定具体对象，流式系统负责把延迟藏在生成、解码和传输的流水线中。

但“无限世界”也最容易让人误解。论文证明的是**生成过程可以持续推进**，没有证明世界具有无限记忆，更没有证明它拥有可靠的物理状态。作者在限制部分明确承认：离开上下文窗口的区域再次访问时，往往是被重新生成，而不是被准确记住。

所以更准确的一句话是：**这是一个可以长时间连续幻化、可被动作和文本实时干预的视觉世界，而不是一个拥有持久地图、对象身份和物理定律的完整模拟器。**

## 为什么世界模型总活不过几分钟

交互式视频世界模型通常逐段生成：当前视频块依赖之前生成的内容，新的输出又会成为下一轮条件。只要某一步出现几何偏差、纹理错误或身份漂移，错误就会被送回模型并不断放大。几轮之后，墙体开始弯曲，人物变形，物体消失，整个世界偏离可解释状态。

这与普通文生视频不同。短视频只需要在几秒内看起来合理；交互世界必须同时满足：

1. 长时间自回归不崩；
2. 用户动作发生后立即响应；
3. 角色、镜头和环境变化可控；
4. 输出速度足够接近实时。

LingBot-World 2.0 的方法并不是靠一个模块解决所有问题，而是从数据、训练、蒸馏、缓存、解码和交互界面同时下手。

## 第一层：先把视频变成“状态转移数据”

训练数据来自三类来源：自采第一人称视频、游戏与 Unreal Engine 合成数据，以及大规模网络视频。三类数据各自承担不同角色：

- 第一人称视频提供真实手—物交互和自然视角；
- 合成数据提供精确的镜头、动作与场景几何信号；
- 网络视频负责开放域外观和长尾视觉分布。

![从多源视频到分块、多轨事件标注的数据引擎](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1784040894/haptic/infinite_worlds_20260714/figure2_data_engine.png)

原始视频先经过镜头切分、时长与分辨率过滤，再通过画质、亮度、OCR 文本占比和运动统计做技术评分，之后由 VLM 判断视角、活动类别、交互类型与语义质量。

真正关键的是标注粒度。普通视频数据往往只配一条全局 caption，但实时交互中的控制指令会随时间改变。论文因此同时构建：

- 描述场景和总体任务的全局语境；
- 与视频 chunk 对齐的局部描述；
- 分离的人物运动、交互状态、环境动态和静态场景轨道；
- 镜头、动作、操作等控制上下文。

这种设计让模型学习的不再只是“这段视频讲了什么”，而是“在某个时刻执行某项动作后，哪些可见状态应该发生改变”。

遗憾的是，论文没有披露最终训练数据的总时长、各来源占比、过滤保留率、动作类别分布和版权治理方式。数据引擎结构讲得很清楚，规模与构成却仍是黑箱。

## 第二层：把世界严格写成因果生成

系统从初始图像和背景描述出发，随后不断接收镜头动作与文本事件。第 t 个世界状态只允许依赖过去画面 x＜ₜ 和截至当前的动作 a≤ₜ：

> pθ(x₁:ₜ | a₁:ₜ) = ∏ₜ pθ(xₜ | x＜ₜ, a≤ₜ)

![LingBot-World-Infinity 的因果视频生成流程](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1784040895/haptic/infinite_worlds_20260714/figure3_causal_pipeline.png)

动作有两种形式。镜头姿态被编码为逐像素 Plücker ray，通过 AdaLN 注入 DiT；文本则按视频块分配 prompt，通过 cross-attention 控制某一段时间内发生的事件。这样，WASD 导航和“召唤暴风雪”本质上都成为因果条件，只是控制粒度不同。

### MoBA：一半学自回归，一半保住视频生成先验

纯 teacher forcing 会产生一个悖论：训练时模型总能看到干净历史，历史越长，它越容易依赖上下文复制，而不是学会从噪声中生成未来。一旦部署时历史变成模型自己的输出，训练—推理分布差距就会快速放大。

论文提出 Mixture of Bidirectional and Autoregressive Attention Mask（MoBA）。它在自回归 teacher-forcing mask 之外，加入一个完全双向注意力块：

- 自回归部分学习“未来不能偷看”的真实 rollout；
- 双向部分保留基础视频生成器的高保真先验，并像正则项一样抑制过度依赖历史；
- 对应的 cross-attention 让自回归块只能读取背景 prompt 和当前以前的 chunk prompt，避免未来事件泄露；
- 双向块则读取描述整段视频的 global prompt。

![DiT 中的镜头与文本注入，以及 MoBA 自注意力和交叉注意力掩码](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1784040896/haptic/infinite_worlds_20260714/figure4_moba_mask.png)

预训练仍使用 conditional flow matching。MoBA 的价值不在于改变生成目标，而在于让同一个网络在“高质量双向视频生成”与“严格因果 rollout”之间找到折中。

## 第三层：少步蒸馏不仅为了快，也为了抗漂移

多步扩散模型质量高，却难以实时交互。作者先用 consistency distillation 把教师模型的概率流 ODE 压缩到少数去噪步骤：同一条教师轨迹上的相邻噪声状态，应该被学生模型映射到一致结果。

只有一致性蒸馏还不够。少步学生容易损失细节，也会在长 rollout 中偏离训练分布，因此系统继续使用 Distribution Matching Distillation（DMD），让学生生成分布逼近真实数据分布。

这里最重要的细节是：DMD 不是只在教师强制状态上训练，而是在**学生自己的长时间自 rollout** 上优化。换句话说，模型被直接暴露给自己将来会制造的错误，再学习如何把这些偏差拉回数据流形。

这与机器人策略中的 on-policy 修正很相似：要解决部署时的复合误差，仅在完美历史上训练是不够的，必须进入模型自己诱导出的状态分布。

## 第四层：Director–Pilot 让像素生成器开始“演世界”

因果视频模型知道下一帧怎样看起来合理，却不一定知道一个世界接下来应该发生什么。LingBot-World 2.0 在生成器外加了一层 Agentic Interaction Harness：

- VLM 作为 Director / Brain，读取当前画面、理解对象和语境、提出后续事件；
- 视频生成器作为 Pilot / Cerebellum，把事件 proposal 渲染为连续画面；
- 新画面返回 Director，形成持续循环。

![Director–Pilot 智能体交互闭环](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1784040897/haptic/infinite_worlds_20260714/figure5_agentic_harness.png)

系统提供两种对象交互模式。

第一种是直接语义交互：VLM 看当前画面并生成“开门”“开灯”“离开”等事件卡，不要求精确对象 mask。

第二种是追踪辅助交互：VLM 发现可操作对象，SAM 持续追踪该对象，用户选择事件后，VLM 推断对象状态变化，再交给视频模型执行。这条链路把“操作哪一个对象”与“画面应该如何变化”分开处理。

![开门与旋转足球的追踪辅助对象交互](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1784040899/haptic/infinite_worlds_20260714/figure6_object_interaction.png)

此外，用户还可以直接注入世界级事件：昼夜切换、降雪、庆典、鸟群出现，甚至让椅子喷出火焰在冰面上竞速。

![施法、火焰、闪电和悬浮车辆等语义动作](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1784040900/haptic/infinite_worlds_20260714/figure7_spell_interactions.png)

![围绕同一把椅子持续注入角色、环境与动力事件](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1784040901/haptic/infinite_worlds_20260714/figure7_world_interactions.png)

这套 Harness 的意义不只是增加按钮。它把世界模型分成两个时间尺度：语言智能体负责低频的叙事和因果规划，视频模型负责高频的视觉动力学。与其要求一个 DiT 同时记住世界观、设计剧情、理解对象并生成每个像素，不如把高层“发生什么”和底层“看起来怎样发生”拆开。

但需要注意，Director 提出的只是语义事件，系统没有显式对象数据库或权威状态机。VLM 说“门打开了”之后，视频模型仍可能画出形似合理、几何却错误的开门过程。Agentic Harness 增强的是**语义可持续性**，不是对物理正确性的形式化保证。

## 60 FPS 是整条系统管线的成果，不只是模型速度

论文声称实时系统可驱动 720p、60 FPS 视频流。这个数字来自一套完整部署栈：

- 少步蒸馏降低 DiT 去噪成本；
- 编译器与高效 attention kernel 减少运行时开销；
- 混合并行把长视频推理分布到多张 GPU；
- latent 生成与 VAE 解码异步执行；
- 解码完成的帧立即流式传输，不等待整个 chunk；
- 轻量时空 refiner 负责空间放大与中间帧生成；
- TensorRT 与多 GPU 并行执行增强模块；
- dynamic KV cache 根据当前控制信号保留最相关历史。

![实时生成视窗、WASD/IJKL 控制与 VLM 事件面板](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1784040903/haptic/infinite_worlds_20260714/figure9_interface.png)

因此，“60 FPS”不能简单理解为 14B DiT 原生生成 60 个全新 720p 帧。论文明确使用时序增强合成中间帧，而且没有报告原始生成帧率、插帧倍率、GPU 型号、卡数、显存、去噪步数、首帧延迟和 steady-state latency。它证明了系统能输出 60 FPS 体验，但还不足以独立复现相同吞吐。

论文同时发布 14B 主模型和面向单 GPU 的 1.3B 版本。开放权重本身很有价值，但“大模型在服务器上达到 60 FPS”和“小模型可在单卡运行”也是两条不同主张，不能合并理解为“普通单卡可运行 14B、720p、60 FPS 完整系统”。

## “一小时不崩”究竟证明了什么

论文展示了一次连续 60 分钟 rollout，从竹林水道、城市、宫殿、温室一路变化到轨道空间，共抽取 20 个时间点。作者称整个过程中没有肉眼可见的质量衰减。

![一次连续 60 分钟生成中的 20 个采样时刻](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1784040904/haptic/infinite_worlds_20260714/figure10_hour_rollout.png)

在 60 秒定性对比中，HY-World 1.5、SANA-WM、Matrix-Game 3.0、DreamX-World 等模型逐渐出现噪声、几何崩坏或场景偏移，而 LingBot-World 2.0 保持了相对稳定的主体和画面结构。

![不同交互世界模型在 5—60 秒范围内的定性对比](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1784040905/haptic/infinite_worlds_20260714/figure11_comparison.png)

这些图像支持“长时间视觉稳定性显著改善”，却不足以严格支持“无限、无漂移”：

1. 一小时实验只有单条轨迹，缺少多随机种子和失败率；
2. 20 张采样图无法展示采样间隔内是否出现过短暂崩坏；
3. 没有 VBench、FVD、LPIPS、身份一致性、几何一致性或人类偏好评分；
4. 没有对动作跟随率、事件成功率、交互延迟和物理合理性做定量测量；
5. 对 Genie 3、HappyOyster 等闭源系统只能进行有限的外部定性比较，输入、分辨率和推理预算难以完全匹配。

论文的 Table 1 还把“无限语义交互”“高动态”“小时级无限生成”等属性直接作为功能项比较。这适合作为系统能力清单，不等同于可复核的科学指标。

## 最大的概念边界：无限生成不是持久世界

作者在限制部分给出了非常关键的澄清：模型可以持续生成，但没有真正的长期记忆。一个区域离开上下文窗口后，稍后返回时通常会被重新想象，而不是从存储状态中恢复。

这意味着 LingBot-World 2.0 目前拥有的是：

- **视觉连续性：** 最近的历史在画面上能延续；
- **语义连续性：** Director 可以让事件保持叙事合理；
- **有限上下文一致性：** KV cache 保留一部分相关历史。

它还没有：

- 可查询、可写入的持久世界状态；
- 跨长时间尺度稳定的对象身份；
- 可回访的地图和位置记忆；
- 显式几何、碰撞与守恒规律；
- 能验证事件是否真正完成的状态判定器。

作者也承认角色身份与画风会在超长 rollout 中缓慢漂移，模型可能让物体互相穿透。它从像素学习“看起来像物理”的变化，但没有显式三维结构或碰撞系统。

这正是“视频世界模型”与“可用于机器人或科学模拟的世界模型”之间仍然存在的距离。

## 它在 2026 世界模型版图中的位置

[LingBot-World 1.0](https://arxiv.org/abs/2601.20540) 已经实现分钟级、实时、开放的交互视频世界；[Matrix-Game 3.0](https://arxiv.org/abs/2604.08995) 强调长时记忆；[SANA-WM](https://arxiv.org/abs/2605.15178) 关注高效分钟级生成；[DreamX-World](https://arxiv.org/abs/2606.16993) 面向通用交互；[WorldDirector](https://arxiv.org/abs/2607.02517) 则把持久动态记忆作为重点。

LingBot-World 2.0 的贡献层级主要有三个：

- **训练范式：** MoBA 因果预训练与基于自 rollout 的 CD + DMD；
- **系统工程：** 少步生成、动态 KV cache、异步 VAE、时空 refiner 与流式传输；
- **交互框架：** VLM Director、视频 Pilot、SAM 对象追踪和事件卡界面。

它不是新的物理状态表示，也不是显式 3D 世界模型；它是一套围绕因果视频生成器搭建的开放交互系统。

## 论文最强的四点

第一，系统目标足够完整。它同时处理长时稳定、交互丰富度、实时部署和开放发布，而不是只优化单一视频指标。

第二，自 rollout DMD 直指部署分布。让学生在自己生成的历史上学习纠偏，比只在干净教师历史上蒸馏更符合长时自回归问题的本质。

第三，Director–Pilot 拆分合理。高层事件逻辑与低层视觉动力学使用不同模型和时间尺度，代表世界模型从单一神经网络走向“模型 + Agent + 工具 + 状态管理”的系统形态。

第四，开放权重和交互 Harness 使结果比闭源演示更可研究。即使完整 60 FPS 部署仍需要较强硬件，社区至少能检查模型、推理链路和失败模式。

## 最后：真正的下一步不是生成更久，而是记住发生过什么

LingBot-World 2.0 已经把交互视频从“几秒钟的惊艳演示”推进到“一小时的连续体验”。这一步很重要，因为只有当生成过程不再快速崩坏，世界模型才有资格讨论剧情、多人、智能体和开放探索。

但它同时暴露出下一阶段更难的问题：世界不能只是一直向前做梦，还必须记得房间在哪里、门是否已经打开、某个角色是谁，以及用户一个小时前做过什么。

当世界模型拥有可压缩的长期记忆、显式对象状态、可靠几何和可验证物理之后，“无限世界”才会从无限视频，真正变成无限世界。
