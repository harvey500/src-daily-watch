# src-daily-watch / 公开 SRC 机会巡查

## 中文

公开试用版 v0.1，MIT 许可。仓库：https://github.com/harvey500/src-daily-watch

只读查看官方 SRC 和漏洞赏金项目，核对现金奖励、允许资产、排除项、测试规则与资格限制，比较前后公开信息变化。默认优先国内项目，不把积分或礼品当现金，也不把项目机会当作已发现漏洞。

本 skill 不扫描、不攻击、不注册账号、不提交报告、不保证收益。它不能在 agent 关闭时运行、监听第一次消息、唤醒应用或自动创建定时器；每天检查仅在宿主加载相关指令并开始实际工作时尽力执行。

### 安装与调用

将仓库克隆到宿主支持的技能目录，保留目录内文件。没有技能发现功能的 agent 可直接阅读 SKILL.md。各宿主路径不同，GitHub 上传不等于本机安装。

示例：使用 $src-daily-watch 检查今天国内公开现金 SRC 项目。只读官方规则，列出最多三个适合的项目和未核实前提，不测试任何资产。

需要已有只读网页访问工具。状态助手需要 Node.js 20+，无第三方依赖。用 --timezone 指定用户的 IANA 时区；默认 Asia/Shanghai。

    node scripts/daily-state.mjs status --state <absolute-state-path> --timezone Asia/Shanghai
    node scripts/daily-state.mjs complete --state <absolute-state-path> --observations <absolute-observations-path> --timezone Asia/Shanghai

观测 JSON 结构与完成流程见 SKILL.md。状态放任务目录，不提交运行状态或凭据。助手只记录调用者提供的观测，不自行核验网页真实性；失败或没有有效观测时不能标记完成。移除观测不等于项目已关闭。

### 验证与限制

    node --test scripts/daily-state.test.mjs

测试覆盖时区日界线、观测校验、变化比较、同日去重和损坏状态保护。它不证明实际赏金资格、网站可访问性或 agent 判断正确；仍需读取当前官方完整规则。公开版保留本地安装状态，不自动改变全局配置。

## English

Public trial v0.1, MIT licensed. Repository: https://github.com/harvey500/src-daily-watch

Survey official public SRC and bounty programs read-only, distinguishing cash from gifts or points and checking scope, exclusions, automation rules and eligibility. Compare observations over time. A program opportunity is not a discovered vulnerability or guaranteed income.

Clone into your host's supported skill directory or read SKILL.md directly. Invocation example: use $src-daily-watch to check today's public cash-paying programs, report at most three candidates and verification gaps, and do not test assets.

Existing read-only web tools and Node.js 20+ are required for the state helper; no third-party Node packages. Pass the user's IANA timezone with --timezone. This is an active-turn workflow, not a timer, listener, wakeup service or cross-chat first-message guarantee.

The helper validates supplied observations, compares meaningful changes and records a successful day. It cannot validate source truth. Keep runtime state outside the repository; do not mark failed or empty surveys complete. Run node --test scripts/daily-state.test.mjs for deterministic helper tests. These do not establish real bounty eligibility or agent behavioral quality.
