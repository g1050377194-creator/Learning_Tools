# 循迹

循迹是一个可以真正拿来学的网站：定学习路线、读一篇材料、做英语练习，再用同一套牌组按 FSRS 复习。

卡片、路线和复习记录写在浏览器的 IndexedDB 里，刷新还在。模型密钥只写在这台浏览器的 localStorage 里。没有账号，也没有单独的数据库。

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

开发服务器监听 `0.0.0.0:43127`。在本机打开 [http://127.0.0.1:43127](http://127.0.0.1:43127)。

```bash
npm run lint
npm run build
npm start
```

`npm start` 同样使用 43127 端口。

## 可以做的事

1. **学习路线**：填写目标、当前水平和每周时间。有模型就生成路线，没有密钥就生成本机草案。每个阶段可以新建牌组，或关联已有牌组。
2. **辅助阅读**：贴进文章，得到摘要、分段说明、难句和词汇。一个词可以收入牌组，或做成完形卡。
3. **英语练习**：认词、回忆、完形、短译，以及一道英语短文写作。题目和反馈是英语，按钮是中文。客观题会自动评分并写入复习；写作看完反馈后，由你给目标词打分。
4. **复习**：Again / Hard / Good / Easy，对应界面上的重来、困难、良好、简单。间隔用 [`ts-fsrs` 4.7.1](https://github.com/open-spaced-repetition/ts-fsrs) 的 **FSRS-5** 计算，不是自写的 SM-2。每张卡保存到期时间、稳定度、难度、复习次数、遗忘次数、状态、已过天数、计划天数和上次复习时间。

今日页有一条统计：今日到期、今日已复习、近期保持率。设置里可以改期望保持率，默认 `0.9`。它只影响之后的评分。

## 离线模式

没填可用密钥时，界面会标明离线模式，功能仍然能走完：

- 路线：按目标和每周时间套用本机模板
- 阅读：摘录式摘要、按句长标出的难句、词表里的释义
- 写作反馈：按词数和目标词是否出现生成的英语检查清单

模型请求失败时，可以改用离线结果。

## 添加模型

打开「设置」。可以保存多套配置，并指定当前使用的一套。全局只用这一套。

预设：OpenAI、Anthropic、Google Gemini、DeepSeek，以及自定义的 OpenAI 兼容地址。

每套要填：显示名称、服务商、接口地址、模型名称、API 密钥。

地址示例：

- OpenAI / DeepSeek / 兼容接口：`https://api.openai.com/v1`，应用会请求 `{地址}/chat/completions`
- Anthropic：`https://api.anthropic.com/v1`，请求 `{地址}/messages`
- Gemini：`https://generativelanguage.googleapis.com/v1beta`，请求 `{地址}/models/{模型}:generateContent`

密钥不会写进服务器磁盘，路由日志也不会记录它。浏览器把密钥交给本机的 `/api/ai`，由这个接口转发到你填写的服务商，请求结束后不保留。请不要把密钥提交到仓库。

## 技术栈

Next.js（App Router）、TypeScript、Tailwind CSS、shadcn/ui、Dexie、ts-fsrs 4.7.1（FSRS-5）。
