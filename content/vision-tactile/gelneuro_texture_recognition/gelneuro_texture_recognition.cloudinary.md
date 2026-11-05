# GelNeuro：把触觉传感和片上计算接到一起

**论文**：GelNeuro: A Sensing-Computing Integrated Neuromorphic Tactile System for Texture Recognition  
**作者**：Luoyang Bian, Xinpan Meng, Zhenghua Ma, Houcheng Li, Long Cheng  
**单位**：中国科学院自动化研究所多模态人工智能系统全国重点实验室；中国科学院大学人工智能学院  
**版本**：arXiv:2607.05241，2026 年 7 月 6 日

![GelNeuro 封面图：端侧神经形态触觉系统。](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783692335/haptic/gelneuro_texture_recognition_20260710/cover_gelneuro_neuromorphic_tactile-887f779e65.png)

机器人触觉这几年越来越像一个“数据富矿”：GelSight、DIGIT、TacTip 这样的视觉触觉传感器能把接触形变拍成高分辨率图像，事件相机触觉又能把滑动、摩擦、微小形变变成高时间分辨率事件流。但一个老问题一直悬在中间：传感器很快，神经形态芯片也很省电，可很多系统仍然要先把事件读到主机上，由主机裁剪、累积、预处理，再转发给芯片推理。

GelNeuro 这篇论文瞄准的正是这段“中间搬运”。它把一个 GelSight Mini 风格的光学触觉前端，直接接到 Speck2f 神经形态 SoC 上：凝胶表面 marker 的运动由 DVS 事件相机捕获，事件流经过片上网络进入 spiking convolutional neural network（SCNN），最后在芯片上完成 15 类自然纹理识别。GelNeuro 展示了一条低功耗、低延迟、端侧事件触觉处理路径。它像是未来机器人触觉系统里的底层感知模块，而不是直接推进机器人操作能力的策略论文。

![GelNeuro 将光学触觉前端与 Speck2f 神经形态 SoC 直接连接。](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783692336/haptic/gelneuro_texture_recognition_20260710/paper_fig1_sensor_chip_pipeline-26daaf6542.png)

论文最值得注意的结果也很直接：在真实 Speck2f 硬件闭环测试中，GelNeuro 在 80 ms 推理窗口内达到 96.3% 的 15 类纹理分类准确率；整板 active power 为 19.6 mW，比同任务下的 CPU/GPU baseline 低三个数量级以上。换句话说，这不是只在软件里模拟 SNN，也不是只把触觉事件“搬”到芯片上做后处理，而是在验证一个更完整的 sensor-to-chip tactile perception loop。

## 1. 这篇论文解决的不是识别率，而是系统路径

如果只看任务表面，15 类纹理识别并不新。GelSight 早期工作已经能做纹理分类，NeuroTac 也已经把事件相机和神经形态触觉联系起来。GelNeuro 的差异在于它把问题从“分类模型能不能识别纹理”推进到“触觉事件能不能不经过主机预处理，直接进入片上 SNN 并稳定运行”。

论文把已有路线拆成三个瓶颈：

第一，传统视觉触觉通常依赖 RGB/frame camera，帧率固定、数据密集，滑动摩擦中的瞬态信息容易被压进 30-60 fps 的帧序列里。

第二，事件相机触觉虽然能产生稀疏、高时间分辨率事件，但许多系统仍然会把事件累积成 pseudo-frame，再交给 CNN 或主机侧流程处理。这样保留了事件相机前端，却没有真正保留端到端事件驱动计算的优势。

第三，SNN 从离线训练迁移到物理神经形态芯片时，会遇到 INT8 量化、芯片路由、非理想噪声和输出 spike 稀疏等工程问题。软件仿真接近满分，并不等于板上运行也稳定。

GelNeuro 的贡献可以概括成一句话：它把“事件触觉传感”和“片上脉冲推理”这两个本来都很适合低功耗边缘部署的环节，真正接成了一个没有主机预处理的系统。

## 2. 硬件：GelSight Mini 凝胶、Speck2f DVS 与片上 SCNN

系统前端沿用了 Evetac 式的光学布局：GelSight Mini marker gel、侧向 COB LED 光源、自定义 3D 打印外壳，以及 Speck2f 内置的 128 × 128 DVS 相机。接触发生时，凝胶里的 marker 产生微小位移，DVS 输出事件 `(x, y, p, t)`，其中包含像素位置、极性和时间戳。

![GelNeuro 的系统流程：传感器结构、机器人采样、SCNN 训练部署与分类可视化。](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783692337/haptic/gelneuro_texture_recognition_20260710/paper_fig2_system_workflow-59e5786b1a.png)

推理时，事件不再先经过主机。论文描述的路径是：DVS 输出进入片上 ROI cropping，稀疏事件流通过 network-on-chip 路由到 spiking convolutional cores，SCNN 在芯片上累计输出层 spike，最终选择 spike count 最高的类别。

训练仍然在 PC 上完成，这一点很重要。GelNeuro 不是片上在线学习系统，而是“离线训练、片上部署”的系统。为了训练，作者把事件裁到 100 × 100 ROI，并以 1 ms bin 累积成 `(2, T, 100, 100)` 张量，两个通道对应 ON/OFF 极性。网络由 5 个卷积层和 1 个全连接读出层组成，卷积核 4 × 4、stride 2、padding 1，通道数依次为 16、32、64、64、64，最后映射到 15 个输出神经元。

这套结构背后的约束很硬：Speck2f 只有有限的物理 processing cores，模型要能被 Sinabs/DynapCNN toolchain 映射到芯片；bias 被移除，层到核心的映射也要适配硬件图。

## 3. 数据集：15 类自然纹理，训练深度和测试深度刻意错开

论文构建了一个 15 类自然纹理数据集，包括 copper、PLA、A4 paper、non-woven fabric、silk、leather、fashion fabric、cotton、filmed acrylic、acrylic、fleece、piqué、lace、cardboard 和 burlap。

采集方式是让 Franka Emika 机械臂把 GelNeuro 传感器压到纹理表面，然后以 20 mm/s 滑动 1000 ms。作者把 0.5 mm 作为最大压入深度，因为更深的压入会损伤凝胶。

训练集覆盖 3 个压入深度：0.1、0.3、0.5 mm；每个深度又覆盖 0°、45°、90° 三个滑动角度。每个 texture-depth-angle 组合采 15 个样本，因此每类 135 个训练样本，总计 2025 个训练样本。

测试集分成两部分：

- ID 测试：仍使用 0.1、0.3、0.5 mm，共 405 个样本。
- OOD 测试：使用训练时没有见过的 0.2、0.4 mm，共 270 个样本。

这个划分比随机留出更有意义，因为接触深度会改变接触面积、应力传播和事件密度。换言之，OOD depth 不是简单的数据扰动，而是物理接触条件发生变化。

## 4. 时间窗口：80 ms 是一个关键平衡点

GelNeuro 的实验先问了一个很实际的问题：触觉事件要累计多久，片上 SCNN 才能稳定判断纹理？

![时间窗口实验：匹配训练/推理窗口，以及将 80 ms 模型提前读出的性能变化。](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783692338/haptic/gelneuro_texture_recognition_20260710/paper_fig3_temporal_windows-893de5ac49.png)

在 matched-window 设置里，作者从 20 ms 到 150 ms 训练并测试不同长度的模型。短窗口下，PC 仿真已经能捕捉一些早期触觉线索，但 Speck2f 上的固定点映射和有限积分时间让输出更难稳定。窗口增加后，板上准确率提升，在 80 ms 达到 96.3%。继续加到 120 或 150 ms 只带来很小收益，准确率大致在 97% 附近波动。

另一个实验更接近在线部署：模型按 80 ms 训练，但推理时提前在 20-80 ms 之间读出。20 ms 时，输出层经常还没有 decision spike，silent rate 为 19.8%，准确率只有 27.9%；60 ms 时准确率升到 85.4%，silent rate 降到 4.4%；80 ms 时准确率 96.3%，silent rate 只有 0.2%。

这个结果说明 GelNeuro 不是“越长越好”的离线识别器。它确实能随着事件流进入逐步积累证据，并在 80 ms 这个短窗口内形成稳定决策。

## 5. INT8 部署：权重裁剪比看起来更关键

SNN 从 PC 训练到 Speck2f 部署并不是简单保存权重。Speck2f 使用 signed 8-bit 权重范围 `[-128, 127]`，直接把 32-bit floating point 权重映射过去时，少数大权重会撑大缩放范围，使大量小权重在 INT8 中分辨率不足。

GelNeuro 使用 hardware-aware weight clamping：训练过程中，每次 BPTT 更新后都把权重裁剪到 `[-c, c]`，部署前再按阈值 `c` 缩放到 INT8。论文把 `c` 从 0.5 扫到 1.8，发现 PC 模型在 `c >= 0.6` 时基本接近 100%，但 Speck2f 上的准确率对 `c` 很敏感。

![权重裁剪实验：c=0.9 时 Speck2f 部署达到 96.3%，并给出 PC 与芯片混淆矩阵。](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783692339/haptic/gelneuro_texture_recognition_20260710/paper_fig4_weight_clamping_confusion-0b456f00a0.png)

过小的 `c` 会把有用的大权重裁掉，`c = 0.6` 时板上准确率掉到约 60%。过大的 `c` 又会让同样的 8-bit levels 覆盖过宽范围，使小权重分辨率变差。最终 `c = 0.9` 达到最好平衡：PC 仿真 99.0%，Speck2f 部署 96.3%。

这部分是论文很实在的工程贡献。它没有把“神经形态芯片低功耗”当成默认胜利，而是承认物理部署会损失精度，并用硬件感知的训练约束去减小 PC-to-chip gap。

## 6. 泛化：未见过的接触深度仍有可用性能，但不是满分

跨深度实验展示了 GelNeuro 的强项，也暴露了它的边界。

![跨深度泛化：0.1、0.3、0.5 mm 用于训练，0.2、0.4 mm 作为未见过深度测试。](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783692340/haptic/gelneuro_texture_recognition_20260710/paper_fig5_cross_depth_generalization-324549779d.png)

在训练见过的 0.1、0.3、0.5 mm 上，随着时间窗口增加，准确率整体保持较高。未见过的 0.2 和 0.4 mm 上，性能也随窗口增加而提升：在 120 ms 时，0.2 mm 达到 74.8%，0.4 mm 达到 85.2%。

这不能被解读成“跨深度问题已经解决”。更准确的说法是：GelNeuro 在未微调条件下保留了明显高于随机水平的纹理判别能力，但浅/中间接触深度带来的事件强度和几何变化仍会造成精度下降。对真实机器人来说，这恰好是下一步值得做的事情：把接触力、深度估计或自适应积分窗口纳入闭环，而不只是做固定窗口分类。

## 7. 功耗：19.6 mW 是系统价值最直观的证据

功耗实验是这篇论文最容易被记住的部分。Speck2f 板在 idle 时是 1.4 mW，80 ms 连续 tactile spike-stream inference 时为 19.6 mW。作为对比，同一任务下 Intel i9-14900KF CPU active inference 为 74.7 W，RTX 4090 GPU 为 87.4 W。

![Speck2f 与 CPU/GPU 的板级功耗对比。](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783692341/haptic/gelneuro_texture_recognition_20260710/paper_fig6_board_power-21452e4ae0.png)

论文给出的对比表也把 GelNeuro 放到更清楚的位置：NeuroTac + Loihi2 的纹理识别是 94%/154 ms/2.25 W，NeuroTac + Speck2f 相关工作是 87.33%/1000 ms/8.04 mW，但仍需要 host preprocessing；GelNeuro 则是 96.3%/80 ms/19.6 mW，并且是 direct sensor-to-chip。

![代表性触觉感知系统对比：GelNeuro 的突出点在于 direct sensor-to-chip path。](https://res.cloudinary.com/dkvhdqgbq/image/upload/v1783692342/haptic/gelneuro_texture_recognition_20260710/paper_table2_comparison-5e03177a2a.png)

这也是 GelNeuro 的真正卖点：它的准确率并不是表中最高，但它同时把 80 ms 延迟、片上 INT8 SCNN、19.6 mW active power 和无主机预处理路径放在同一个系统里成立。

## 8. 批判性看法：漂亮，但离机器人触觉主线还有距离

这篇论文的贡献层级可以定位为“系统与硬件部署贡献”，而不是“触觉表征基础模型”或“机器人策略学习贡献”。它证明了直接事件触觉到神经形态芯片的路径可行，并给出了相当完整的硬件闭环评估；但如果放进机器人触觉的大图景里，它更靠近 sensor/edge perception，而不是 manipulation intelligence。

它的强点主要有三点。

第一，系统链条完整。许多 neuromorphic tactile 工作停在仿真、host relay 或离线事件处理，GelNeuro 把 DVS 触觉前端、ROI、NoC、SCNN、INT8 部署和板级功耗连起来测。

第二，实验问题选得合理。纹理识别要求时空细节，15 类材料中有多个表面相近的类别；OOD depth 也让测试不只是普通随机划分。

第三，作者没有回避硬件部署损失。weight clamping、silent rate、PC/Speck accuracy gap、1 ms binning 与 BPTT 内存开销都被明确讨论。

局限也很清楚。

第一，任务仍然是固定采样协议下的纹理分类。机械臂以 20 mm/s 滑动，每个样本 1000 ms，推理只取前若干窗口。这和真实灵巧操作中的滑移检测、抓取调整、插入装配、接触状态切换还有明显距离。机器人里触觉最有价值的时刻，往往不是“识别材料类别”，而是“动作应该怎么立刻改”。

第二，数据规模较小。训练样本 2025 个、15 类纹理，对系统验证足够，但还不能证明大规模开放世界材质泛化。

第三，训练仍依赖离线 PC 和 1 ms binning。芯片推理是异步的，但训练阶段仍需要把事件离散成时间 bin 做 BPTT。作者也承认，0.5 ms bin 在 20 ms 窗口下能提升准确率，但会显著增加训练内存开销。

第四，OOD 深度性能还不稳定。0.2 mm 深度在 120 ms 为 74.8%，明显低于 ID 深度。这提示事件强度、接触面积和深度变化仍然是系统泛化的主要压力源。

因此，GelNeuro 不应被过度解读为“主流机器人触觉学习的新范式”。它更像一个硬件路径证明：如果未来 slip detection、防滑控制、接触状态监测或高速局部反射需要低功耗端侧推理，这类 direct sensor-to-chip 架构可能成为很好的底座。真正进入机器人触觉主战场，还需要把它接到闭环控制、策略学习和更复杂的真实操作任务里。

## 9. 为什么这篇论文仍然值得放进触觉机器人路线图

如果把触觉机器人分成三个层次，GelNeuro 位于第一层和第二层之间：

- 传感器层：把形变变成高时间分辨率事件。
- 边缘感知层：在低功耗芯片上完成快速接触状态识别。
- 策略控制层：用触觉反馈实时改变动作。

GelNeuro 目前主要完成前两层，而且更偏底层。它还没有把识别结果接进闭环控制策略，也没有处理机器人操作中最常见的动作-接触耦合问题。但它为这一步提供了一个很有说服力的硬件前提：触觉事件可以在毫瓦级功耗下，于几十毫秒尺度内在边缘端完成推理。

这对未来触觉 VLA、接触丰富操作和灵巧手控制都有启发。当前很多触觉大模型或 VLA 工作把触觉当作一个高维模态输入，重点在表征、token、融合或策略学习；GelNeuro 提醒我们，触觉系统最终还要跑在手指、末端执行器或移动机器人上。传感器到计算单元之间的路径越短，触觉越有机会从“离线观测”变成“实时反应”。

论文最后也把未来方向指向 slip detection 和实时防滑控制。这个方向比纹理分类更能体现 direct sensor-to-chip 的优势，因为滑移发生时，几十毫秒的延迟差异就可能决定抓取是否失败。

## 结语

GelNeuro 的价值不在于发明了一个新的触觉分类任务，而在于把一个长期看起来“应该可以”的系统命题做实了：光学触觉前端产生的事件流，可以不经过主机预处理，直接进入神经形态 SoC，在片上 SCNN 中完成低延迟、低功耗识别。

它仍然离通用触觉智能很远：数据规模有限，任务单一，训练仍依赖离线 BPTT，跨深度泛化也有下降。但作为 sensing-computing integrated tactile system，它给出了一个清晰的工程坐标：96.3% accuracy、80 ms inference、19.6 mW active power、direct sensor-to-chip path。

这几个数字合在一起，说明触觉感知的下一步不只是“更大的模型”，也可能是“更短的路径”。
