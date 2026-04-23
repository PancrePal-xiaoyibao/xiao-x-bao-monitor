import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMarkdownInline,
  parseReadme,
  parseTableLine,
} from "../src/lib/readme-parser.js";

test("parseReadme extracts title, intro, sections, bullets, code blocks, and tables", () => {
  const markdown = `# Demo README

开场 **说明**。

## 第一部分

- 第一条
  继续补充
1. 第二条

### 小标题

这是一段正文。

\`\`\`bash
npm run dev
\`\`\`

| 字段 | 含义 |
| --- | --- |
| tokenUsage | Token 用量 |
| provider | 来源 |
`;

  const parsed = parseReadme(markdown);

  assert.equal(parsed.title, "Demo README");
  assert.deepEqual(parsed.intro, ["开场 说明。"]);
  assert.equal(parsed.sections.length, 1);
  assert.equal(parsed.sections[0]?.title, "第一部分");
  assert.deepEqual(parsed.sections[0]?.bullets, ["第一条 继续补充", "第二条"]);
  assert.deepEqual(parsed.sections[0]?.paragraphs, ["小标题", "这是一段正文。"]);
  assert.deepEqual(parsed.sections[0]?.codeBlocks, ["npm run dev"]);
  assert.deepEqual(parsed.sections[0]?.tables, [
    {
      headers: ["字段", "含义"],
      rows: [
        ["tokenUsage", "Token 用量"],
        ["provider", "来源"],
      ],
    },
  ]);
});

test("parseReadme ignores blockquotes and keeps list content readable", () => {
  const markdown = `# Title

## Notes

> 这是一段引用

- 要点一
- 要点二
`;

  const parsed = parseReadme(markdown);

  assert.deepEqual(parsed.sections[0]?.paragraphs, []);
  assert.deepEqual(parsed.sections[0]?.bullets, ["要点一", "要点二"]);
});

test("normalizeMarkdownInline removes bold markers and trims whitespace", () => {
  assert.equal(normalizeMarkdownInline("  **重点** 内容  "), "重点 内容");
});

test("parseTableLine splits markdown table rows into trimmed cells", () => {
  assert.deepEqual(parseTableLine("| 字段 | 值 |"), ["字段", "值"]);
});
