import test from "node:test";
import assert from "node:assert/strict";

import {
  parseRecordMarkdown,
  sortRecordsByDate,
  validateRecord,
} from "../src/record-content.mjs";

test("parses a flexible markdown record with frontmatter", () => {
  const record = parseRecordMarkdown(
    `---
title: "测试星体"
date: "2026-06-15"
type: "thought"
summary: "用于验证阅读模式的测试记录。"
importance: 0.9
visibility: "public"
---

这里是正文。`,
    "2026-06-15-test-signal.md",
  );

  assert.equal(record.id, "2026-06-15-test-signal.md");
  assert.equal(record.title, "测试星体");
  assert.equal(record.date, "2026-06-15");
  assert.equal(record.type, "thought");
  assert.equal(record.summary, "用于验证阅读模式的测试记录。");
  assert.equal(record.importance, 0.9);
  assert.equal(record.visibility, "public");
  assert.equal(record.body, "这里是正文。");
});

test("allows optional fields without producing empty template values", () => {
  const record = parseRecordMarkdown(
    `---
title: "只有正文"
date: "2025-01-01"
visibility: "public"
---

自由记录正文。`,
    "2025-01-01-test-memory.md",
  );

  assert.equal(record.type, "");
  assert.equal(record.summary, "");
  assert.equal(record.importance, 0.5);
  assert.equal(record.body, "自由记录正文。");
});

test("rejects records missing title, date, visibility, or body", () => {
  assert.throws(
    () => validateRecord({ title: "缺日期", visibility: "public", body: "x" }),
    /Missing required record field: date/,
  );

  assert.throws(
    () => validateRecord({ title: "缺正文", date: "2026-01-01", visibility: "public", body: "" }),
    /Missing required record body/,
  );
});

test("sorts records newest first", () => {
  const records = [
    { title: "old", date: "2024-01-01", visibility: "public", body: "old" },
    { title: "new", date: "2026-01-01", visibility: "public", body: "new" },
    { title: "mid", date: "2025-01-01", visibility: "public", body: "mid" },
  ];

  assert.deepEqual(
    sortRecordsByDate(records).map((record) => record.title),
    ["new", "mid", "old"],
  );
});
