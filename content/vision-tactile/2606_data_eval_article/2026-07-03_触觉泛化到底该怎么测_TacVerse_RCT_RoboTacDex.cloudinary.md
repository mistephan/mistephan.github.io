# 6 月底三篇最新触觉论文同时指向一个问题：触觉泛化到底该怎么测？

![封面图：触觉泛化评测三条线](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783076029/haptic/data_eval_20260703/cover_tactile_generalization_202606-d0c3282518.png)

如果只看标题，TacVerse、RCT、RoboTacDex 像是三篇不同类型的数据集论文。

一篇在做多传感器视觉触觉 benchmark，一篇在做 robot-collected touch-vision-language dataset，一篇在做人形机器人灵巧操作数据集。

但如果把它们放在一起看，会发现它们其实都在回答同一个更底层的问题：

**触觉模型到底有没有泛化能力，应该怎么测？**

这三篇论文都在 2026 年 6 月底发布在 arXiv 上。TacVerse 是 6 月 24 日，RCT 是 6 月 30 日，RoboTacDex 也是 6 月底的新工作。这个时间点很有意思：触觉不再只是“多采一点数据、多接一个传感器”，而是开始进入更严肃的阶段：**数据集本身要能测出模型是不是真的理解触觉，而不是记住某个传感器、某批材料、某段演示轨迹。**

今天这篇就不按“逐篇论文介绍”的方式写，而是用一个问题把三篇论文串起来：

**如果我们想训练触觉机器人基础模型，泛化评测至少要分成哪几层？**

## 三篇论文先放在一张地图里

| 论文 | 6 月底新论文定位 | 它主要测什么泛化 |
|---|---|---|
| TacVerse | 多传感器视觉触觉数据集与 benchmark | 换一个触觉传感器，模型还能不能工作 |
| RCT | 机器人采集的触觉-视觉-语言数据集 | 换材料、换 contact sequence，模型是否还真会识别 |
| RoboTacDex | 人形机器人灵巧操作数据集 | 换任务、换技能、换视角和操作场景，策略是否还能学 |

这三层刚好从低到高：

1. **传感器层**：同一个接触，换传感器之后 tactile image 分布变了。
2. **材料和交互层**：同一个材料类别里，具体材料、按压深度、接触序列都可能变。
3. **机器人任务层**：真实操作里，视觉、深度、触觉、动作、语义标注一起变化。

如果未来真的要做 tactile foundation model，这三层都绕不开。

## 论文一：TacVerse，先把“换传感器”这件事测清楚

**论文**：TacVerse: A Multi-Sensor Dataset and Benchmark for Cross-Sensor Vision-Based Tactile Perception  
**作者**：Lan Wei, Gurmeher Khurana, Sirine Bhouri, Wenhao Hong, Zeyuan Xin, Qingzheng Cong, Wen Fan, Yanzheng Xiang, Dandan Zhang  
**作者单位**：Imperial College London, Queen Mary University of London, King’s College London  
**arXiv**：2606.25877，2026 年 6 月 24 日

![TacVerse 七种视觉触觉传感器](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783076035/haptic/data_eval_20260703/tacverse_fig1_sensors_overview-31d0e1c47b.png)

TacVerse 的核心问题很直接：**同样是 vision-based tactile sensor，为什么一个传感器上训练好的模型，换到另一个传感器就不行了？**

它收集了 7 种视觉触觉传感器的数据，包括 GelSightNoMarker、GelSightMarker、MagicGripper、MagicTac、TacTip、ViTac、ViTacTip，总共 106,800 张触觉图像。

论文没有只做一个笼统的分类任务，而是把 benchmark 拆成三类：

1. **shape classification**：9 类形状分类。
2. **grating classification**：30 类纹理/栅格分类。
3. **force regression**：连续力回归。

![TacVerse 三类任务：形状、纹理、力回归](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783076036/haptic/data_eval_20260703/tacverse_fig2_three_tasks-179c1d962f.png)

它真正有价值的地方，是评测协议设计得很清楚：

1. **within-sensor training**：同一个传感器内训练和测试。
2. **zero-shot cross-sensor transfer**：在源传感器训练，直接迁移到目标传感器。
3. **few-shot adaptation**：给目标传感器少量标注，看能补回来多少。

结果也很符合直觉，但以前缺少这样统一的 benchmark 来量化：

同传感器内学得不错，但直接跨传感器会明显掉点。形状分类相对更稳，因为几何轮廓在不同传感器间还有一定共性；纹理分类和力回归更脆弱，因为它们高度依赖传感器的成像方式、弹性材料、标记点、光照结构和接触响应。

更关键的是，few-shot adaptation 能缓解力回归上的跨传感器 gap，但不能完全补上 within-sensor 的上限。这说明传感器差异不是简单加几张标注图就能抹平的。

**我的理解**：TacVerse 最重要的贡献不是“又多了一个触觉数据集”，而是把 sensor shift 变成了一个可测量的问题。以后如果有人说自己的 tactile encoder 能跨传感器泛化，最好别只在一个 DIGIT 或一个 GelSight 上测，应该用类似 TacVerse 的协议说明：源传感器是谁，目标传感器是谁，zero-shot 掉多少，few-shot 能恢复多少。

## 论文二：RCT，触觉评测不能再随机切帧了

**论文**：RCT: A Robot-Collected Touch-Vision-Language Dataset for Tactile Generalization  
**作者**：Jingbo He, Michael Färber, Roberto Calandra  
**作者单位**：ScaDS.AI, TU Dresden；LASR Lab, TU Dresden  
**arXiv**：2606.31694，2026 年 6 月 30 日

![RCT 数据集概览](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783076030/haptic/data_eval_20260703/rct_fig1_dataset_overview-86ac58e3c5.png)

RCT 这篇论文更像一记提醒：**触觉数据如果按 frame random split 随机切训练集和测试集，评测结果很可能被高估。**

为什么？

因为触觉数据和普通图像不一样。一个 robot press 过程中，传感器从刚接触材料，到逐渐压入，再到力变大，会产生一串连续 tactile frames。这些帧不是独立样本，它们属于同一次 contact sequence。

![RCT 中一次 robot press 的 contact sequence](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783076393/haptic/data_eval_20260703/rct_fig2_contact_sequence-f5851d7582.png)

如果你把同一次按压里的第 3 帧放进训练集，第 4 帧放进测试集，模型看起来可能很强，但它学到的未必是材料属性，而是记住了相邻帧的近重复模式。

RCT 的数据规模是 29,279 个触觉帧，来自 122 种工业参考材料，覆盖 7 个材料类别，用 3 个 DIGIT 传感器采集。它保留完整 robot press，并提供材料、类别、传感器、接触位置、contact sequence 等 metadata。

论文最有传播力的数字有三个：

1. 去掉 contact-sequence overlap 后，tactile-to-text Recall@1 下降 **17.7 个百分点**。
2. 在 held-out material 设置下，Recall@1 只有 **25.1 ± 6.1%**。
3. 对公开 TVL/HCT split 做检查时，raw-pixel nearest neighbor 能以 **98.3%** 的 top-1 准确率找回同一 contact sequence。

这几个数字说明一件事：触觉模型的“泛化”不能只看随机切分下的指标。

如果测试集里有训练时见过的同一次接触序列，模型可能并没有学会新材料，只是在熟悉的接触轨迹附近做检索。

**我的理解**：RCT 的价值不只是数据集，而是给触觉-视觉-语言模型补了一条评测底线。以后做 tactile-language alignment，至少应该报告 held-out contact sequence 和 held-out material，而不是只报告 frame-random split。

这对公众号读者很值得强调：在触觉里，**样本独立性比图像任务更容易被破坏**。因为触觉数据天然有时间连续性、按压深度连续性和接触状态连续性。

## 论文三：RoboTacDex，把触觉泛化拉回真实机器人操作

**论文**：RoboTacDex: A Dexterous Visual-Tactile-Action Dataset for Humanoid Manipulation  
**作者**：Xinyi Wang, Donghan Li, Zi’Ang Chen, Chong Yu, Chen Xin, Peng Ye, Yingkai Sun, Tao Chen  
**作者单位**：Fudan University, ByteDance Intelligent Creation, Shanghai AI Laboratory, The Chinese University of Hong Kong  
**arXiv**：2606.31836，2026 年 6 月底

前两篇更偏感知和表征评测，RoboTacDex 则把问题推到机器人操作：**有了视觉、深度、触觉和动作数据之后，人形机器人真的能学会灵巧操作吗？**

![RoboTacDex 系统概览](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783076032/haptic/data_eval_20260703/robotacdex_fig1_system_overview-386ad7704c.png)

RoboTacDex 使用 Unitree G1 人形机器人，采集了超过 6k 条轨迹，总时长约 25 小时，覆盖 19 个任务、23 种技能、22 个物体。数据包括多视角 RGB、depth、tactile feedback、动作，以及语义标注。

这和前两篇的区别在于，它不只是问“触觉图像能不能分类”，而是在问：

1. 触觉能不能帮助 imitation learning？
2. 多视角、深度、触觉同时存在时，模型到底会不会用？
3. 人形机器人灵巧手的失败模式，能不能通过触觉反馈暴露出来？

![RoboTacDex 中的灵巧操作技能](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783076033/haptic/data_eval_20260703/robotacdex_fig2_skills-185f9b41d5.png)

论文评测了 ACT、Diffusion Policy 和 GROOT N1.5 等模型。在四个任务上，GROOT N1.5 平均成功率达到 6/10，高于 ACT 和 DP 的 3/10。

但更值得注意的是：**简单拼接更多模态并不一定自动提升。**

论文里多视角实验和触觉消融都透露了这个信号。对于 ACT、DP、GROOT 这类模型，把多视角图像、深度、触觉都喂进去，不等于模型就能自动学会跨视角几何关系和接触状态。

![RoboTacDex 数据分布与实验片段](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783076034/haptic/data_eval_20260703/robotacdex_fig3_distribution_and_results-6463036d73.png)

触觉消融里比较有意思的一点是，加入 tactile feedback 后，UnscrewBottle 任务的失败模式发生变化：没有触觉时更容易出现 idle spinning，加入触觉后会转向 stuck / adjust 类失败。这说明触觉可能没有立刻把成功率拉满，但它改变了策略对接触状态的感知方式，让模型更接近“知道自己卡在哪里”。

**我的理解**：RoboTacDex 的价值在于提醒我们，触觉泛化最终不能停留在 sensor benchmark 或 material recognition 上。机器人操作中的触觉要面对更复杂的耦合：手的姿态、物体几何、接触力、动作延迟、视觉遮挡、示教质量、任务语义，全都混在一起。

所以它不是 TacVerse 或 RCT 的替代，而是第三层问题：**触觉数据如何进入真实 manipulation policy。**

## 三篇放一起看：触觉泛化至少要测这六件事

如果把 TacVerse、RCT、RoboTacDex 合起来看，我觉得触觉数据集和触觉模型评测至少应该报告六类指标。

### 1. 传感器泛化

训练传感器和测试传感器是否一致？如果不一致，zero-shot 掉多少？few-shot 能恢复多少？

TacVerse 正是在测这个问题。对于 tactile foundation model 来说，这是最基础的一关。

### 2. 接触序列泛化

训练集和测试集是否共享同一次 robot press 或同一段 contact sequence？

RCT 告诉我们，不能再把 tactile frames 当作独立图片随便随机切分。contact sequence 应该成为 split 的基本单位。

### 3. 材料泛化

测试材料是否在训练时出现过？如果只是同一批材料的不同帧，不能证明模型学会了新材料。

RCT 的 held-out material 结果说明，新材料识别仍然很难。

### 4. 接触条件泛化

接触位置、压入深度、力大小、传感器实例是否变化？这些因素都会改变触觉图像。

很多触觉模型在固定按压条件下表现好，但一旦换接触位置或力度，分布就变了。

### 5. 任务和技能泛化

模型是否只会一个 isolated tactile perception task，还是能进入 pick、insert、wipe、unscrew、align 这类真实技能？

RoboTacDex 把触觉数据推进到 humanoid dexterous manipulation，这一层更接近机器人基础模型真正需要的评测。

### 6. 多模态利用能力

模型不是“输入越多越好”。关键是它是否真的利用了触觉，而不是被视觉主导，或者把触觉当噪声。

RoboTacDex 的实验说明，多视角、深度、触觉一起出现时，模型结构必须能处理跨模态对齐和接触状态建模，否则数据加了也未必有效。

## 一个更直接的判断

这三篇 6 月底新论文共同说明：

**触觉数据集正在从“规模竞赛”进入“泛化评测竞赛”。**

过去我们容易问：

“这个数据集有多少帧？”

“有多少物体？”

“有没有触觉？”

但现在更应该问：

“训练和测试是不是同一个传感器？”

“是不是同一次 contact sequence 的相邻帧？”

“材料是不是见过？”

“接触位置和力是不是变了？”

“触觉有没有真正改变策略的失败模式？”

“模型是在做感知分类，还是能进入真实操作？”

这些问题比单纯的数据规模更重要。

## 对后续触觉基础模型的启发

如果未来要把触觉接进 VLA、diffusion policy、world model 或更大的机器人 foundation model，我觉得这三篇给出的启发是：

第一，触觉模型不能只在单一传感器上讲泛化。TacVerse 已经说明，传感器 shift 是真实存在的，而且不同任务敏感程度不同。

第二，触觉-语言对齐不能只看随机帧切分。RCT 说明，contact sequence overlap 会让指标变漂亮，但未必代表材料泛化。

第三，触觉进入操作策略后，成功率不是唯一指标。RoboTacDex 里失败模式的变化同样重要，因为触觉最擅长提供的是接触状态、滑移、卡滞、对准失败这些视觉不容易稳定看到的信息。

所以，今天这三篇可以合成一个主题：

**触觉泛化到底该怎么测？**

答案不是一个 benchmark，而是一组层次：

**从传感器泛化，到材料和接触序列泛化，再到机器人操作泛化。**

这也是触觉从“多一路输入”走向机器人基础模型必须补上的评测地基。

## 参考论文

1. TacVerse: A Multi-Sensor Dataset and Benchmark for Cross-Sensor Vision-Based Tactile Perception  
   https://arxiv.org/abs/2606.25877

2. RCT: A Robot-Collected Touch-Vision-Language Dataset for Tactile Generalization  
   https://arxiv.org/abs/2606.31694

3. RoboTacDex: A Dexterous Visual-Tactile-Action Dataset for Humanoid Manipulation  
   https://arxiv.org/abs/2606.31836
