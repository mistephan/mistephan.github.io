# 6 月底两篇触觉新论文：不同触觉传感器数据能不能进入同一个 shared tactile latent space？

![封面图：多种触觉传感器汇入共享表征空间](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783133159/haptic/shared_tactile_latent_20260704/cover_shared_tactile_latent_202606-0d53bc7109.png)

昨天我们讲的是触觉数据集和评测：TacVerse、RCT、RoboTacDex 都在追问一个问题，**触觉泛化到底该怎么测？**

今天往前走一步：如果触觉模型真的要泛化，光有评测还不够，还要回答一个更基础的问题：

**不同触觉传感器数据，能不能进入同一个 shared tactile latent space？**

这也是 2026 年 6 月底连续两篇新论文共同指向的问题。

一篇是 6 月 29 日的 **Heterogeneous Tactile Transformer, HTT**，来自 NUS、CMU 等团队；另一篇是 6 月 30 日的 **TactX: Learning Shared Tactile Representations Across Diverse Sensors**，来自 UC San Diego、Seoul National University、Amazon FAR 等团队。

这两篇都不满足于“给每个传感器单独训练一个 encoder”。它们真正想做的是：让 GelSight / 9DTact / Xela / TAC-02 / Daimon / eFlesh / FlexiTac 这些输出形式完全不同的触觉传感器，最后能映射到某个可复用的共同表征空间里。

如果用一句话概括今天的主题：

**触觉基础模型的第一道门槛，不是把触觉接进 VLA，而是先让不同触觉传感器说同一种语言。**

## 为什么触觉比视觉更难做“通用编码器”？

视觉模型能走向 ImageNet、CLIP、DINO、SAM，一个重要前提是相机之间虽然有差异，但输出形式大体一致：都是二维图像。

触觉不是这样。

不同触觉传感器之间，差异不只是分辨率、噪声、标定方式，而是**物理测量原理就不同**：

1. vision-based tactile sensor 看的是弹性体表面的光学形变。
2. magnetic tactile sensor 看的是磁场变化。
3. resistive tactile sensor 看的是压力导致的电阻变化。
4. taxel array sensor 看的是分布式触觉单元的时序信号。

也就是说，触觉传感器之间不是“不同相机”，更像是“相机、麦克风、压力板、磁力计”之间要互相对齐。

这就带来一个很现实的问题：

如果机器人 A 用 GelSight 训练了一个策略，机器人 B 换成 Xela 或 FlexiTac，还能不能复用这个策略？  
如果实验室 A 采了很多 optical tactile data，实验室 B 采了很多 array tactile data，这些数据能不能汇入一个共同触觉模型？

HTT 和 TactX 就是在回答这个问题。

## 两篇论文先放在一张表里

| 论文 | 发布时间 | 核心路线 | 传感器范围 | 主要目标 |
|---|---:|---|---|---|
| HTT | 2026-06-29 | sensor-specific encoders + shared transformer trunk | optical + array-based | 训练一个异构触觉 backbone |
| TactX | 2026-06-30 | modality-specific encoder/decoder + shared 16-D latent | vision-based + magnetic + resistive | 让策略跨传感器 zero-shot transfer |

二者很像，但侧重点不同：

**HTT 更像“触觉版 backbone”路线**：它用大规模 paired tactile data 预训练，目标是得到一个可以服务感知任务和操作任务的共享触觉表征。

**TactX 更像“触觉传感器适配层”路线**：它把不同物理原理的传感器压进一个低维 latent，让同一个 tactile-conditioned policy 可以换传感器部署。

## 论文一：HTT，想做异构触觉传感器的 backbone

**论文**：Heterogeneous Tactile Transformer  
**作者**：Jianxin Bi, Qiang Wang, Jayaram Reddy, Kelvin Lin, Soibkhon Khajikhanov, Ruihan Gao, Harold Soh  
**作者单位**：National University of Singapore；Carnegie Mellon University；Smart Systems Institute, NUS  
**arXiv**：2606.29948，2026 年 6 月 29 日

![HTT 框架图](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783133160/haptic/shared_tactile_latent_20260704/htt_fig1_framework-2ca88f3967.png)

HTT 的出发点很明确：触觉传感器天然异构，一个传感器上训练出来的模型不能直接用到另一个传感器上，这限制了触觉数据的大规模复用。

它提出了一个 **Heterogeneous Paired Tactile Dataset, HPT**，包含 1.6M 个同步 paired tactile frames，覆盖四种传感器：

1. GelSight Mini
2. 9DTact
3. Xela
4. TAC-02

其中 GelSight Mini 和 9DTact 更偏 optical tactile sensor，Xela 和 TAC-02 更偏 array-based / taxel sensor。

![HTT 数据采集与数据统计](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783133161/haptic/shared_tactile_latent_20260704/htt_fig2_dataset_stats-af85d882dd.png)

HTT 的模型设计可以拆成三层：

第一层是 **sensor-specific encoders**。  
不同传感器的原始数据结构差异很大，图像类传感器和 taxel array 不能用同一个输入头硬吃，所以先用各自的 encoder 处理。

第二层是 **shared transformer trunk**。  
不同传感器经过各自 encoder 后，进入共享 transformer trunk，在这里形成共同表征。

第三层是 **双重自监督目标**。  
HTT 一边做 per-modality masked reconstruction，让模型学会重建每个传感器自己的信号；另一边做 cross-modal alignment，用 paired sensors 的同步观测把不同传感器拉到共同 latent space。

这个设计的直觉很好理解：

**重建任务保证每个传感器的细节别丢，跨模态对齐保证不同传感器能说同一种语言。**

HTT 的实验覆盖 object classification、force estimation、slip detection，以及真实机器人操作。几个关键数字比较值得记：

1. object classification overall accuracy 达到 **66.20%**。
2. force estimation overall 3D MAE 为 **0.636**。
3. slip detection overall macro-F1 为 **56.35**。
4. 在真实机器人上，HTT embeddings 让 Toy Screw 成功率达到 **95%**，Grasp Tofu 达到 **55%**，明显高于 qpos-only 和 wrench baseline。

![HTT 真实机器人实验](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783133162/haptic/shared_tactile_latent_20260704/htt_fig3_real_robot_results-0df6d32df6.png)

HTT 的价值在于，它不是只在“两个相似 optical tactile sensors”之间做迁移，而是把 optical sensor 和 array sensor 放进同一个 paired pretraining 框架里。

我的理解是：HTT 解决的是**触觉预训练的数据汇聚问题**。

如果未来触觉基础模型要吃掉不同实验室、不同硬件、不同采集方式的数据，那么每个传感器各训各的是不够的。HTT 这类方法想做的是：保留传感器个性，同时在中间层形成可共享的 tactile backbone。

## 论文二：TactX，把不同物理原理的触觉传感器压到同一个 16 维 latent

**论文**：TactX: Learning Shared Tactile Representations Across Diverse Sensors  
**作者**：Junsung Park, Sachin Bhadang, Carmelo Sferrazza, Sha Yi, Xiaolong Wang  
**作者单位**：UC San Diego；Seoul National University；Amazon FAR  
**arXiv**：2606.31236，2026 年 6 月 30 日

TactX 的问题更激进一些。

HTT 主要覆盖 optical + array-based tactile sensors；TactX 则直接把三种物理原理放在一起：

1. **Daimon**：vision-based tactile sensor。
2. **eFlesh**：magnetic tactile sensor。
3. **FlexiTac**：resistive tactile sensor。

![TactX 零样本跨传感器策略迁移概览](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783133163/haptic/shared_tactile_latent_20260704/tactx_fig1_zero_shot_overview-22d8befa5d.png)

TactX 不是把所有传感器转换成统一图像，也不是把磁信号、压力图、视觉触觉图像硬拼在一起。它采用的是更干净的路线：

**每个传感器保留自己的 encoder 和 decoder，但所有传感器都映射到同一个 16 维 shared latent space。**

方法上，TactX 用 paired contact data 做监督。两个不同传感器装在同一个 gripper 的两侧，接触同一个物体时，虽然读数形式不同，但它们对应的是同一个物理接触事件。

![TactX shared latent 方法框架](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783133163/haptic/shared_tactile_latent_20260704/tactx_fig2_shared_latent_method-4405d523a2.png)

训练目标主要有三类：

第一，**contrastive alignment**。  
同一个接触事件下，不同传感器的 latent 应该靠近；不同接触事件应该拉开。论文里使用的是 InfoNCE / NT-Xent 这类对比学习目标。

第二，**self-reconstruction**。  
某个传感器自己的 latent 要能重建自己的原始信号，避免 encoder 只学到过度压缩的空洞表征。

第三，**cross-reconstruction**。  
一个传感器的 latent 要能通过另一个传感器的 decoder 重建对应信号。这一点很关键，因为它迫使 latent 保留“跨传感器共享的接触信息”，而不是只保留某个传感器自己的纹理。

TactX 还专门检查了一个很重要的问题：

**如果 latent 完全去掉了传感器身份，它还保不保留接触语义？**

这其实是 shared representation 里最微妙的平衡。太 sensor-specific，就不能迁移；太 sensor-invariant，又可能把任务真正需要的接触细节也抹掉。

![TactX 的传感器不变性与语义保留](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783133164/haptic/shared_tactile_latent_20260704/tactx_fig4_sensor_invariance-3a0199c66f.png)

论文用 sensor prediction accuracy 来衡量 latent 里是否还保留传感器身份。越接近 33.3% 的随机水平，说明越难从 latent 判断传感器类型，也就是 sensor invariance 越强。

同时，它又用 object classification 和 reconstruction 来判断 latent 是否还保留了接触内容。论文报告 TactX 在 object classification 中达到 **60.8%** 的 self-sensor accuracy，并且 cross-reconstruction 能保留主要接触结构。

![TactX 从 shared latent 做自重建和交叉重建](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783133165/haptic/shared_tactile_latent_20260704/tactx_fig5_reconstruction-6bf219878b.png)

但真正把 shared latent 和机器人策略连接起来的，是策略迁移实验。

它在四个 contact-rich manipulation tasks 上评估：

1. plug insertion
2. board wiping
3. pick-and-place
4. object reorientation

![TactX 下游操作任务](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783133166/haptic/shared_tactile_latent_20260704/tactx_fig6_tasks-72f542d23b.png)

结果是：通过 shared latent 做 zero-shot cross-sensor policy transfer，平均成功率从 vision-only 的 **27.5%** 提升到 **45.9%**。

这句话很重要，因为它说明 shared tactile latent 不只是表征空间里好看，而是真的能让策略换传感器部署。

我的理解是：TactX 解决的是**触觉策略的硬件解耦问题**。

如果一个策略训练时用的是 Daimon，部署时换成 eFlesh 或 FlexiTac，传统做法往往要重新采数据、重新训练。TactX 想让策略看到的是一个统一 tactile latent，而不是某个传感器的原始读数。这样传感器换了，策略接口可以不变。

## HTT 和 TactX 的关键区别

这两篇论文放在一起看，很像是在回答同一个问题的两个版本。

| 维度 | HTT | TactX |
|---|---|---|
| 更像什么 | tactile backbone | tactile adapter / shared latent interface |
| 数据规模 | 1.6M paired frames | 规模较小，但覆盖不同物理原理 |
| 传感器类型 | optical + array-based | vision-based + magnetic + resistive |
| 结构 | sensor-specific encoder + shared transformer trunk | modality-specific encoder/decoder + 16-D latent |
| 训练信号 | masked reconstruction + cross-modal alignment | InfoNCE + self/cross reconstruction + KL |
| 主要验证 | perception + real robot manipulation | zero-shot cross-sensor policy transfer |
| 核心价值 | 让不同 tactile data 能预训练成通用 backbone | 让策略和具体触觉硬件解耦 |

如果要用更直白的话说：

**HTT 更关心“不同触觉数据能不能一起训练一个大模型”。**

**TactX 更关心“换一个触觉传感器，机器人策略还能不能继续用”。**

## 它们和 FTP-1 的区别：三种 shared tactile token space 路线

如果你前面看过 FTP-1，可能会觉得这几篇都在讲“跨触觉传感器”，那它们到底差在哪里？

你这个直觉是对的：**FTP-1 也做了统一触觉 token / latent space**。它提出的 MTTS，也就是 Morphology-Aware Tactile Token Space，本质上也是在把不同触觉传感器映射到一个统一空间里。

**HTT 和 TactX 更聚焦 shared tactile representation 本身怎么学。**

**FTP-1 则把 shared tactile token space 和 foundation policy 训练绑在了一起。**

也就是说，三者都在处理触觉异构性，但目标层级不同：

| 维度 | HTT | TactX | FTP-1 |
|---|---|---|---|
| 核心问题 | 光学触觉和阵列触觉能否训练共享 backbone | 不同物理原理的触觉传感器能否映射到同一个 latent | 多传感器触觉 token 能否支撑通用操作策略 |
| 共享空间形式 | shared transformer trunk / tactile representation | shared 16-D tactile latent | MTTS: morphology-aware tactile token space |
| 模型位置 | tactile encoder / backbone | tactile latent adapter | tactile token space + tactile expert + action policy |
| 主要产物 | Heterogeneous Tactile Transformer | sensor-agnostic shared latent | Generalist Foundation Tactile Policy |
| 触觉的角色 | 被预训练成可迁移表征 | 被压缩成策略可复用的统一接口 | 被映射成功能区域 token，再由 tactile expert 建模 |
| 下游目标 | 感知任务 + 操作任务增益 | 换传感器后的 zero-shot policy transfer | 直接执行跨任务、跨传感器的接触丰富操作 |

用 LLM 类比会更清楚：

**HTT 更像是在训练触觉 backbone。**

它关心的是：不同 optical / array tactile sensors 的数据，能不能通过 paired pretraining 形成一个通用触觉表征。

**TactX 更像是在训练触觉 adapter / embedding interface。**

它关心的是：Daimon、eFlesh、FlexiTac 这些物理原理不同的传感器，能不能映射到同一个低维 latent，让策略换传感器还能用。

**FTP-1 更像是在训练“触觉 token space + 策略专家”的完整系统。**

它也做统一触觉 token，只是这个 token space 不是独立停在 representation 层，而是直接服务于 generalist tactile policy。FTP-1 先用 sensor-specific encoders 把不同触觉输入投影到 MTTS 功能区域 token，再用独立 tactile expert 学习可迁移接触表示，最后让 action expert 调用这些触觉信息生成动作。

所以 FTP-1 的重点比 HTT / TactX 更靠后一步：它不是只问“触觉空间能不能统一”，而是问“统一后的触觉 token 能不能预训练出可迁移的操作策略”。

所以这篇 HTT + TactX 其实适合放在 FTP-1 前面讲：

先讲**触觉传感器怎么统一**，再讲**统一后的触觉怎么进入 foundation policy**。

## Shared tactile latent space 到底应该学什么？

这两篇共同给了一个答案：

shared tactile latent space 不能只是把不同传感器信号压成同一个向量。它至少要同时满足三个条件。

### 1. 它要对传感器身份不敏感

如果 latent 一眼就能看出来自 Daimon、eFlesh 还是 FlexiTac，那它仍然高度绑定硬件。

这类表征也许在单传感器任务上表现很好，但换传感器就容易崩。

### 2. 它要保留接触语义

如果为了去掉传感器身份，把接触形状、压力分布、滑移、纹理、力变化也一起抹掉，那这个 latent 对机器人没有用。

触觉表征真正有价值的地方，恰恰是它能告诉模型：现在是轻触、按压、滑动、卡住、对准，还是即将失稳。

### 3. 它要能服务下游策略

表征空间 t-SNE 好看不够。最后还是要问：它能不能让策略更稳定？能不能跨传感器迁移？能不能少采新数据？

HTT 用 real-world Toy Screw / Grasp Tofu 验证了 embedding 对操作有帮助；TactX 则直接用 zero-shot cross-sensor policy transfer 证明 shared latent 能改善策略迁移。

这也是两篇论文最值得放在一起讲的原因：一篇偏 backbone，一篇偏 policy interface，刚好把“共享触觉表征”的上游和下游都覆盖了。

## 但这条路线还没完全解决

shared tactile latent space 很诱人，但也有明显限制。

第一，**paired contact data 仍然是成本**。  
HTT 和 TactX 都很依赖 paired data，也就是不同传感器要在相同或可比接触条件下同步观测。真实世界里，两个触觉传感器很难保证接触位置、姿态、受力完全一致。

第二，**跨传感器迁移不一定对称**。  
TactX 里就提到，从低维磁信号 eFlesh 迁移到更高空间结构的 FlexiTac 比较困难。这说明 shared latent 不是魔法，如果源传感器本身缺少某些信息，策略可能学不到目标传感器能提供的细节。

第三，**静态接触和动态操作还有距离**。  
很多 paired contact 数据来自 quasi-static grasp 或较受控的交互。真实机器人操作里有持续滑动、剪切、冲击、接触转移，这些动态触觉信号更难对齐。

第四，**低维 latent 可能牺牲细节**。  
TactX 使用 16 维 latent，优点是接口简洁，适合策略使用；缺点是可能压掉某些高频细节。未来 tactile VLA 或 tactile world model 可能需要更丰富的 token-level tactile representation。

## 对触觉基础模型的启发

如果把这两篇论文放到更大的机器人基础模型脉络里，我觉得它们给出三个启发。

第一，触觉不应该被理解为“多一路输入”。  
它首先是一个硬件异构非常严重的模态。没有 shared representation，不同实验室采到的数据很难汇入同一个模型。

第二，触觉模型需要“传感器适配层”。  
视觉模型可以默认输入是图像，语言模型可以默认输入是 token，但触觉模型不能默认传感器一致。未来可能需要像 tokenizer 一样的 tactile adapter，把不同触觉硬件映射到统一空间。

第三，触觉进入 VLA 之前，最好先解决 latent space。  
如果每个触觉传感器都要为 VLA 单独设计输入头，那么模型很难规模化。HTT 和 TactX 的意义就在于，它们试图把触觉先变成一种更标准的中间表示。

## 一个判断

这两篇 6 月底新论文说明，触觉领域正在从“单个传感器做任务”走向“跨传感器共享表征”。

HTT 给出的路径是：

**用大规模 paired heterogeneous tactile data 训练一个通用 tactile backbone。**

TactX 给出的路径是：

**用 paired contact data 把不同物理原理的传感器压进同一个 shared latent，让策略可以 zero-shot 换传感器。**

所以今天这篇的核心问题可以这样回答：

**不同触觉传感器可以进入同一个 shared tactile latent space，但这个 latent 必须同时做到三件事：去掉传感器身份、保留接触语义、真正服务下游操作。**

这件事一旦做成，触觉才有可能像视觉和语言一样，成为机器人基础模型里可以规模化复用的模态。

## 参考论文

1. Heterogeneous Tactile Transformer  
   https://arxiv.org/abs/2606.29948

2. TactX: Learning Shared Tactile Representations Across Diverse Sensors  
   https://arxiv.org/abs/2606.31236

3. FTP-1: A Generalist Foundation Tactile Policy Across Tactile Sensors for Contact-Rich Manipulation  
   https://arxiv.org/abs/2606.13102
