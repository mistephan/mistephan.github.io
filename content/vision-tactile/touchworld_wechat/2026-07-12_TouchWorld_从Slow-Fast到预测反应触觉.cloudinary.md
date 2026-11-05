# TouchWorld：Slow-Fast 之后，触觉策略为什么开始长出“世界模型”

作者：Jianyi Zhou, Feiyang Hong, Yunhao Li, Yicheng Zhao, Yongjue Cen, Zirui Liu, Jiakang Huang, Zirui Chen, Ruiyang Zhang, Weizhuo Zhu, Xuhua Song, Shuo Yang  
机构：Harbin Institute of Technology, Shenzhen；PHANES AI  
论文：TouchWorld: A Predictive and Reactive Tactile Foundation Model for Dexterous Manipulation  
arXiv：https://arxiv.org/abs/2607.07287  
版本：v2，2026-07-09
![TouchWorld 封面图](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783870169/haptic/touchworld_wechat_20260712/cover_touchworld_20260712.png)

如果你已经看过 `Slow-Fast Policy`、`Reactive Diffusion Policy` 这一路工作，那 TouchWorld 最值得追问的问题其实不是“它是不是也在做快慢分层”，因为答案显然是是的。真正值得问的是：

> 当大家都已经接受触觉控制需要 slow-fast 结构之后，下一步还缺什么？

TouchWorld 给出的回答是：**缺一个可预测的接触目标层。**

也就是说，这篇论文和前一代 reactive tactile policy 最关键的差别，不在于它也有一个慢层和一个快层，而在于它试图在两者之间再插入一层 `Tactile World Model`。这层不是拿来直接出动作的，而是拿来预测“当前子任务理想的未来触觉/接触状态应该长什么样”，然后让中层 nominal policy 朝这个目标走，最后再由高速触觉反馈层做局部纠偏。

所以如果只把 TouchWorld 概括成“未来接触预测 + 高频纠偏”，其实很容易把它写平，因为 `Reactive Diffusion` 读者会立刻问：这不还是那个 slow-fast 逻辑吗？更准确的说法应该是：

> TouchWorld 想做的，不只是把反应层做快，而是给反应层和主动作层之间，补上一层可以被预测、被条件化的 tactile subgoal。

这才是它和之前工作的真正分界线。过去很多方法已经知道局部触觉反馈必须快，但它们往往默认 fast layer 的职责只是“出了偏差就拉回来”；TouchWorld 则进一步问，**拉回来的参照系从哪来**。它的答案不是当前观测，也不只是语言指令，而是一个由高层模块提前预测出来的 future visual-tactile subgoal。

## 先说结论：它和 RDP 的 Slow-Fast 到底差在哪

这里所说的“之前的 slow-fast 策略”，具体指 RSS 2025 的 **Reactive Diffusion Policy（RDP）**。两者都认同同一个基本判断：复杂轨迹应该慢慢规划，而接触误差必须快速闭环。但它们对“慢层应该产出什么”以及“快层依据什么修正”给出了不同答案。

| 对比维度 | RDP：Reactive Diffusion Policy | TouchWorld |
|---|---|---|
| 核心层级 | 两级 slow-fast | 三个运行频率、四类功能模块 |
| 慢侧输出 | 1–2 Hz 的 latent action chunk | 1 Hz 的可执行子任务 + 未来视觉-触觉 subgoal |
| 中间动作层 | 没有独立的 goal-conditioned 中层 | 10 Hz 视触觉 goal-conditioned policy 生成 nominal action chunk |
| 快侧机制 | 20–30 Hz asymmetric tokenizer 根据触觉/力反馈修正 latent action chunk | 30 Hz Tactile Residual Transformer 根据触觉、本体历史和 nominal lookahead 输出 residual correction |
| 触觉的主要角色 | 高频闭环反馈 | 既是未来接触目标，也是高频反馈信号 |
| 世界模型 | 没有显式预测未来触觉目标 | 显式 Tactile World Model，预测 17 帧未来视觉-触觉目标片段 |
| 高层语义规划 | 面向单项技能的慢策略，不单列语言子任务规划器 | Qwen3-VL 子任务规划器，面向长时程、多阶段任务 |
| 实验范围 | 3 项接触丰富任务，强调反应控制和跨触觉/力传感器适用性 | 6 项双手灵巧任务，同时测 clean 与 human perturbation |

可以把 RDP 理解为：**先给一段动作意图，执行中再靠触觉高速修正。**

TouchWorld 则变成：**先判断当前子任务，再想象这一步理想的未来接触状态，中层朝这个目标生成动作，底层继续做高速纠偏。**

因此，TouchWorld 并没有推翻 slow-fast，而是在它上面补了两个接口：一个是语言驱动的 subtask interface，另一个是可预测的 tactile goal interface。它把“快反馈”推进成“预测目标 + 名义动作 + 快速残差”的闭环。

但这里必须守住证据边界：TouchWorld 的主结果表只比较了 π0.5、FTP-1 和 GR00T N1.7，**没有与 RDP 做同平台、同任务的直接对照**。

## 一、论文讲了什么

作者提出了一套三层结构：

- `High-Level Planning Layer`：1 Hz，负责长程任务分解和触觉子目标预测。
- `Visuo-Tactile Goal-Conditioned Policy`：10 Hz，负责生成 nominal action chunk。
- `Tactile-Conditioned Refinement Policy`：30 Hz，负责根据最近触觉与本体历史做 residual correction。

其中最关键的是高层里不仅有 `Subtask Planner`，还有一个 `Tactile World Model`。后者不是简单看当前触觉，而是预测“这个子任务接下来应该达到什么视觉-触觉目标”。这意味着触觉第一次被明确拿来做 **未来接触参考**，而不只是当前观测。

![TouchWorld 总体结构与任务设置（论文 Figure 1）](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783870171/haptic/touchworld_wechat_20260712/paper_fig1_overview.png)

如果把这套结构翻成更直白的话，可以理解为：

- 高层先判断“当前到底在执行哪一步”；
- 再预测“这一步理想接触应该发展到哪里”；
- 中层按这个目标生成动作；
- 底层在真正接触时，利用高速触觉反馈随时把动作掰回来。

这也是 TouchWorld 和很多“给 VLA 加 tactile token”的工作最本质的区别。它不是把 tactile 当额外模态，而是把 tactile 当成两种不同控制职责的载体：**predictive reference** 和 **reactive feedback**。

## 二、方法上真正新的点在哪里

论文的方法结构其实很清楚。

`Subtask Planner` 初始化自 `Qwen3-VL-4B-Instruct`，输出的是当前可执行子任务，而不是直接动作。这个设计很克制，也很合理，因为高层模块如果直接伸手控制动作细节，反而容易和下层策略抢职责。

`Tactile World Model` 初始化自 `Wan2.2-TI2V-5B`，输入当前观测和当前子任务，输出未来视觉-触觉子目标。它做的不是动作预测，而是接触结果预测。

下层 nominal policy 是一个 `Visuo-Tactile Goal-Conditioned Policy`。作者把 tactile 统一转成 image-form representation，让它可以和视觉一起进入 VLA 风格主干。

再往下，`Tactile-Conditioned Refinement Policy` 用的是 `Tactile Residual Transformer`。这里很重要的一点是，它只学 residual，不从头生成动作。这样做的好处是，高频层只负责修局部接触误差，不去接管全局语义和几何推进。

![TouchWorld 三时间尺度架构（论文 Figure 2）](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783870172/haptic/touchworld_wechat_20260712/paper_fig2_method.png)

从论文脉络上看，TouchWorld 更像是把 `VTAM`、`OmniVTA/OmniVTLA`、`Tactile-WAM`、`VT-WAM` 那条“视触觉联合建模 + 未来预测”路线，进一步推进到 **层级控制结构**。

## 三、训练流程透露出作者真正的判断

TouchWorld 不是端到端一把训完，而是四阶段训练：

1. 训练 `Subtask Planner`
2. 训练 `Tactile World Model`
3. 训练 nominal 的 `Visuo-Tactile Goal-Conditioned Policy`
4. 最后再接上 `TRT` 训练高频 residual correction

其中几个数字值得记住：

- `Subtask Planner` 监督样本：**128,866** 条
- `Tactile World Model`：先在大规模 `EgoTouch` 人类交互数据上预训练
- 再在 **10 小时机器人演示** 上微调
- 约 **108 万帧机器人数据**
- 每个任务 **200 条训练轨迹**
- 每个任务 **100 次真实机器人评测 rollout**

这套训练方式的潜台词其实很明确：作者不相信一个统一模型能顺滑地同时学会语义规划、未来接触预测、chunk 动作生成和毫秒级局部纠偏，所以选择先分开训，再在部署接口上拼起来。

![硬件系统与训练流程（论文 Figure 3）](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783870173/haptic/touchworld_wechat_20260712/paper_fig3_hardware_training.png)

这是一个很工程化、也很现实的选择。

## 四、结果最能说明什么

TouchWorld 在六项真实机器人任务上做评测，任务包括：

- Water Flower
- Tabletop Clearing
- Cup Insertion
- Power Plug Insertion
- Pot Wiping
- Tissue Pulling

作者还专门加了 `human perturbation` 设置，也就是执行过程中人为加入目标位移、接触干扰、抓取扰动等情况。这一点很重要，因为如果论文声称自己擅长 reactive tactile control，却只在理想环境下测试，结论其实站不住。

主结果是：

- `clean setting` 平均成功率：**65.0%**
- `human perturbation` 平均成功率：**53.7%**

相对最强基线，分别提升：

- **+15.7 points**
- **+18.5 points**

作者还单独评估了 `Tactile World Model` 的预测质量。在 held-out subgoal segments 上：

- Temporal Contact Accuracy：**86.3**
- Contact IoU：**52.7**
- Volumetric IoU：**43.8**

这些结果至少说明一件事：高层的 tactile prediction 不是装饰，它确实提供了比“直接复制当前触觉状态”或“从训练集检索相似子目标”更好的未来接触参考。

![真实机器人任务与实验结果（论文 Figure 4、Table 1–2）](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783870174/haptic/touchworld_wechat_20260712/paper_fig4_results.png)

从任务表现看，提升最明显的主要是 `Power Plug Insertion`、`Pot Wiping` 和 `Tissue Pulling`。这些任务的共同点很直接：都更依赖精细接触、局部力调节，以及执行过程中对接触偏差的快速修正。

## 五、这篇论文最强和最弱的地方

这篇论文最强的地方有三个。

第一，它不是泛泛地说“触觉很重要”，而是明确区分了触觉的两种职责：**未来接触预测** 和 **在线执行纠偏**。

第二，它的层级设计是讲得通的。高层、中层、底层分别对应不同时间尺度，结构和物理问题是对齐的。

第三，它做的是六任务真实机器人评测，而且有 human perturbation 条件，这让 reactive tactile 这条主张更有说服力。

但它也有明显边界。

首先，“foundation model” 这个表述比现有证据走得更快。六个任务、一个感知布局、一类手部系统，足以支撑一篇很强的系统论文，但还不足以完全撑起通用 foundation 的广义叙事。

其次，它没有真正证明跨传感器、跨手型、跨 embodiment 的可迁移性。作者自己也承认，换不同 tactile sensor 或手型，仍然需要 calibration、normalization 和适配数据。

第三，统计报告还可以更强。结果已经不错，但如果能补充更完整的不确定性分析和调度超参数敏感性，论文会更扎实。

## 六、怎么理解它在当前触觉研究里的位置

如果把它放回近一年的触觉机器人脉络里，TouchWorld 的定位很清楚：

- 相比 `FTP-1` 这类 monolithic tactile policy，它最大的变化是把触觉拆成预测路径和反应路径。
- 相比 `VTAM`、`OmniVTA/OmniVTLA`，它更强调层级部署和时间尺度分工。
- 相比 `Tactile-WAM`、`VT-WAM`，它同样在推动触觉进入未来预测，但没有把所有能力再次塞回一个统一 world action model。

所以更准确地说，它不是“最终答案”，而是一篇很有代表性的过渡论文：

> 触觉策略正在从“多模态输入融合”阶段，走向“分层预测与高频反馈闭环”阶段。

## 结语

TouchWorld 最值得记住的判断是：

> 触觉不应该只被看成一个观测模态，而应该被放进机器人策略里最适合它的两个位置：一个负责预判理想接触，一个负责纠正现实偏差。

这也是它为什么值得单独分析。因为它讨论的已经不是“要不要加触觉”，而是“触觉到底该放在机器人智能系统的哪一层、以什么节奏参与控制”。

参考论文：TouchWorld（arXiv:2607.07287）；Reactive Diffusion Policy（arXiv:2503.02881，RSS 2025）。
