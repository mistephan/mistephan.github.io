# FELT 详解：当机器人没有触觉传感器，它能不能先“看”出触觉？

原论文作者单位：University of Southern California Viterbi School of Engineering；Columbia University；Starpilot

原论文：[FELT: Generating Tactile Signals from Vision for Visuo-Tactile Manipulation](https://arxiv.org/abs/2607.20683)  
本地原文：`2607FELT- Generating Tactile Signals from Vision for Visuo-Tactile Manipulation.pdf`  
发布时间：2026 年 7 月 22 日（arXiv v1）

![FELT 封面图](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1785045420/haptic/felt_visuo_tactile_manipulation_20260726/cover_felt_20260725.png)

触觉在机器人操作里并不是“有更好、没有也行”的模态。很多接触丰富任务里，视觉只能告诉你物体大概在哪里，却很难告诉你此刻到底压住了哪里、左右手指受力是否平衡、接触是否已经开始滑移。问题在于，真正高质量的触觉数据一直很贵：传感器脆弱、标定麻烦、采集速度慢，而且一换硬件形态，数据和策略往往都要重来。

FELT 这篇论文切入得很直接：既然很多接触状态在 wrist camera 里其实已经露出了线索，能不能先从视觉里合成出一份足够好用的触觉图，再把这份生成触觉送给策略学习和部署？作者给出的答案是可以，而且不是停留在“重建图像更像了”这个层面，而是拿真实机器人任务成功率来证明。

## 一、这篇论文到底在做什么

FELT 全称是 **Feature-Extracted Latent Tactile**。它学习一个从 RGB 观测到每根手指触觉压力图的映射，把原本缺失触觉的视觉演示变成“伪视触觉”演示。对作者使用的 FlexiTac 传感器来说，每根手指对应一个 `12×32` 网格，因此整幅触觉图可以视为左右双指拼接后的 `12×64` 压力图。

这篇工作的系统位置非常清晰：

1. 先用成对的 RGB-触觉数据训练 tactile generator。
2. 再用 generator 给 vision-only 数据补出触觉通道。
3. 最后把这些生成触觉图，或者其 latent tactile features，喂给下游 visuo-tactile policy。

所以 FELT 的贡献重点，不是提出一个新的大策略模型，而是把“触觉稀缺”问题改写成一个可训练的中间模态生成问题。

![Figure 1：论文原图，任务设定与部署方式](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1785045421/haptic/felt_visuo_tactile_manipulation_20260726/paper1_fig1_overview.png)

Figure 1 基本概括了整篇论文的目标：左边是现有 paired visuo-tactile data，中间是 FELT 生成器，右边是生成出来的触觉图；下方则展示了没有物理触觉传感器时，如何把生成触觉接入 Tube Insertion 和 Cup Nesting 这样的接触丰富任务。

## 二、方法设计：为什么它不是简单回归一张图

论文的方法部分比摘要里扎实得多。FELT 并不是把 RGB 编码后接一个回归头，而是显式把双指传感器的物理拓扑写进了网络。

### 1. 视觉编码器

输入 RGB 先 resize 到 `224×224`，再送入**冻结的 DINOv2-B/14**。作者不是只取最后一层，而是平均使用第 `3、7、11` 层的 patch tokens，得到 `256×768` 的视觉特征。这个选择的目的很明确：低层特征保留纹理和边缘，高层特征保留物体和接触语义。

### 2. 双分支 tactile query decoder

左右手指是两个分离的受力表面，因此论文没有共享一套 query，而是为左右手指各自设置 `12×32=384` 个 learnable tactile queries，并加入因子化的行列位置编码。每个分支都通过 self-attention 和 cross-attention 去读取视觉 token。

更关键的是，作者在每层 decoder 后都加入了 **gated cross-panel exchange**。这意味着左右手指不是完全独立生成，而是允许彼此交换信息，从而建模“夹持时一侧加压、另一侧配合”“擦拭时左右受力不对称”这类双指协同接触。

### 3. panel-aware convolutional readout

解码后的 queries 不直接线性回归成像素，而是先 reshape 回 2D tactile grid，再送入带有 side embedding 的卷积 readout head。补充材料里给出的配置是：

1. 两层 pre-norm decoder。
2. 8 个 attention heads。
3. hidden dim 为 `768`。
4. readout trunk 先做 `1×1` 投影到 `256` channels。
5. 然后经过 `3` 个卷积 blocks。

输出被拆成两头：

1. `contact logits`，判断哪里接触了。
2. `pressure intensity`，预测接触强度。

因此 FELT 不是普通的 image regression，而是把触觉拆成“有没有接触”和“接触有多强”两个子问题去学。

![Figure 2：论文原图，FELT framework](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1785045422/haptic/felt_visuo_tactile_manipulation_20260726/paper1_fig2_method.png)

Figure 2 是整篇方法的浓缩版。真正让这篇工作成立的，不只是 DINOv2，而是“左右分支 + gated panel exchange + panel-aware convolutional readout”这三件事。这也是作者强调自己是 **sensor-topology-aware** 方法，而不是通用 decoder 的原因。

## 三、训练数据和实验平台到底是什么规模

这一块原稿写得不够细，这里按论文正文和补充材料补全。

### 1. 生成器训练数据

FELT 的 generator 训练并不是小样本。论文使用 Zhu et al. 的 paired visuo-tactile dataset，规模是：

1. `2700+` 条 handheld UMI-style demonstrations。
2. `2.6M+` 个 RGB-tactile frame pairs。
3. 使用 `80/20` 的 train/eval split。

此外，作者专门采了一个独立的 xArm test set 来测 generator 的 out-of-distribution 能力：

1. `30` 条 GELLO demonstrations。
2. 大约 `72K` 个 visuo-tactile frames。
3. 对象、任务场景和机器人 embodiment 都独立于 generator 训练集。

### 2. 下游策略数据

下游 policy 训练数据来自作者自己采集的 xArm demonstrations：

1. 四个任务各 `60` 条 demonstration。
2. 总共 `240` 条 demonstrations。
3. 大约 `520K` 个同步后的 RGB、tactile 和 action frames。

### 3. 硬件与同步

实验平台包括：

1. `xArm7` 机械臂。
2. `UMI-style gripper`。
3. 两个 `FlexiTac` 触觉垫，每个手指一个，单指分辨率 `12×32`。
4. `GoPro Hero 9 + Ultra Wide Lens Mod` 的 wrist camera。

补充材料里还给了很实的同步细节：

1. RGB 为 `60Hz`，触觉为 `23Hz`，机器人状态为 `60Hz`。
2. RGB 时间戳减去 `0.315s` 的 GoPro-HDMI 采集延迟。
3. tactile 时间戳校正 `20ms`，robot state 校正 `1ms`。
4. 如果 RGB 和 tactile 的最大匹配间隔超过 `100ms`，这个 episode 直接丢弃。

这些细节很关键，因为 FELT 的可信度很大程度上依赖 paired visuo-tactile 对齐质量。

## 四、它到底测了什么任务

论文不是在一个单一 benchmark 上报数字，而是做了四个真实机器人接触丰富任务：

1. **Tube Insertion**：抓取、重定位、插入试管。
2. **Cup Nesting**：四个塑料杯逐个套叠。
3. **Eraser Wiping**：抓起橡皮擦，在有限 wipe 次数内擦掉 marker 文本。
4. **Triangle Peg Insertion**：抓取三角 peg，重定向后插入三角孔。

每个任务都按阶段成功率统计，而不是只报一个最终成功率。这一点很重要，因为它能看出触觉到底是在帮抓取，还是在帮接触后的调整和修正。

## 五、核心结果：FELT 不是“更像”，而是“真的能帮策略”

### 1. 先看 tactile prediction

论文用四个指标评估生成触觉质量：

1. `LPIPS`：感知相似度，越低越好。
2. `Energy Ratio`：预测总压力 / 真值总压力，越接近 1 越好。
3. `Frame Accuracy`：按 finger panel 判断是否接触的准确率，越高越好。
4. `Panel Asymmetry Error`：左右手指压力能量比例误差，越低越好。

对比对象包括：

1. **Nearest Neighbor**：在冻结 DINOv2 特征空间找最近 RGB，再取对应 tactile。
2. **MAE baseline**：沿用 Zhu et al. 的 visuo-tactile MAE，但把 tactile tokens 全 mask，逼它从 RGB 重建 tactile。

Table 1 的关键信息很清楚：

1. FELT 的 `LPIPS=0.191`，优于 MAE 的 `0.199` 和 nearest neighbor 的 `0.342`。
2. FELT 的 `Energy Ratio=1.123`，最接近理想值 1；MAE 却达到 `4.597`，说明它严重高估压力强度。
3. FELT 的 `Frame Accuracy=0.816`，同样是最佳。
4. MAE 虽然在 `Panel Asymmetry Error=0.431` 上更低，但这是建立在总压力严重失真的前提上。

换句话说，MAE 在某些局部比例上像是学到了一点，但整体物理量级是飘的；而 FELT 在“接触有没有、总压力对不对、左右手指是否平衡”这几件事上更稳。

![Figure 3：论文原图，预测质量与消融结果](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1785045423/haptic/felt_visuo_tactile_manipulation_20260726/paper1_fig3_results.png)

Figure 3 也直接说明了各模块的作用：

1. 去掉 panel exchange，会明显破坏左右手指受力平衡。
2. 去掉 dual-branch decoder，会严重低估触觉幅值。
3. 去掉 conv readout，局部空间结构变差。

### 2. 再看下游策略成功率

作者比较了四种输入方式：

1. `Vision Only`
2. `+ Real Tactile`
3. `+ FELT Tactile`
4. `+ FELT Features`

其中 `+FELT Features` 是最值得注意的设置：策略训练和部署都不需要真实 tactile sensor，而是直接消费 FELT 生成器的 latent tactile features。

论文正文的结论可以概括成四点：

1. **Vision + Real Tactile** 在所有任务上都优于纯视觉。
2. **Vision + FELT Tactile** 在所有最终任务指标上都优于纯视觉。
3. 在 **Cup Nesting** 和 **Triangle Peg Insertion** 上，FELT tactile 达到了与真实触觉相当的最终成功率。
4. **Vision + FELT Features** 在低数据设置下表现非常有竞争力，尤其在 Triangle Peg Insertion 上最强。

几个最值得点名的数字：

1. Triangle Peg Insertion 最终插入成功率：Vision Only `50%`，Real Tactile `70%`，FELT Tactile `70%`，FELT Features `90%`。
2. Eraser Wiping 最终成功率：Vision Only `65%`，Real Tactile `90%`，FELT Tactile `75%`，FELT Features `85%`。
3. Tube Insertion 最终插入成功率：Vision Only `40%`，Real Tactile `55%`，FELT Tactile `50%`，FELT Features `50%`。

这说明 FELT 至少已经不是“生成几张触觉图看看”的论文，而是真的能把策略从 vision-only 拉起来。

论文还提到，FELT generator 在单张 `RTX 4090` 上延迟大约 `20ms`，足以支撑实时闭环控制。

## 六、为什么 latent tactile features 这么值得注意

很多人读到 FELT，第一反应会停在“它能生成 tactile image”。但我认为真正更有潜力的是 `FELT Features`。

原因有三点：

1. 显式 tactile image 仍然是一种 noisy observation，还要再交给 tactile encoder 消化。
2. latent features 等于把大规模 paired visuo-tactile 数据压成了更平滑、更稳定的接触表征。
3. 在每个任务只有 `60` 条 demonstration 的低数据设置下，这种 feature 可能比 raw tactile image 更容易被 policy 学到。

作者在正文里也很克制地说，这个解释目前还只是 hypothesis，需要更多实验验证。但至少从现有结果看，它为“没有真实触觉硬件也先做触觉策略”提供了更现实的路径。

## 七、和本地参考论文相比，FELT 处在什么位置

如果把本地已有论文按贡献层级拆开，大致可以这样看：

1. 数据集层：HapTile、RCT、RoboTacDex。
2. 表征层：TactX、HTT、TacVerse。
3. VLA 融合层：Tactile-VLA、TAP-VLA、UniTacVLA。
4. 世界模型层：OmniVTA、Tactile-WAM、VT-WAM、TouchWorld。
5. 想象触觉 / 触觉补全层：TacImag、FELT。

FELT 最接近的是 TacImag，但两者并不完全一样：

1. TacImag 更偏 imagined tactile representation。
2. FELT 更显式地输出 tactile image 和 latent features。
3. FELT 用真实机器人任务成功率证明，这份生成信号可以直接被 policy 消费。

所以 FELT 的真正价值在于：**它把昂贵真实触觉从“必须采满”的输入模态，改写成了可以由视觉估计出来的中间表征。**

## 八、论文的边界也很清楚

这篇论文不错，但不应该被理解成“视觉已经替代了触觉”。

作者自己承认了三类限制：

1. FELT 仍依赖大量 paired visuo-tactile 数据做 generator 训练。
2. 它依赖可见接触区域；重遮挡会让生成失效。
3. 它目前只验证了 pressure-based tactile sensors，对 magnetic、gel-based 等其他触觉形态还没覆盖。

我认为还有ç两个更现实的边界：

1. 这篇论文更强的是“可见接触 + 双指抓持 + 接触后修正”，而不是不可见内部接触或材料摩擦主导问题。
2. 虽然任务是真机器人任务，但目前只有四个任务，还谈不上已经证明跨任务、跨场景、跨手型的稳健泛化。

## 九、结论

FELT 值得读，不是因为它做了一个更复杂的多模态模型，而是因为它非常务实地回答了一个现实问题：**当触觉硬件和触觉数据都不够时，我们还能怎么把“触觉”带回机器人学习系统？**

这篇论文给出的路径是：

1. 用大规模成对视触觉数据学一个 topology-aware tactile generator。
2. 用这个 generator 给 vision-only 数据补触觉。
3. 再把补出来的 tactile image 或 latent tactile features 喂给下游策略。

从结果看，这条路是成立的。尤其是 `FELT Features` 的表现，已经不仅仅是“数据补全”，而更像是在为未来的 tactile VLA、触觉世界模型和低成本灵巧操作系统准备一个可规模化的中间层。

如果只用一句话概括 FELT，我会写成：

**它不是在证明视觉能完全替代触觉，而是在证明触觉可以先被视觉近似出来，并且这种近似已经足够开始改变真实机器人的操作表现。**
