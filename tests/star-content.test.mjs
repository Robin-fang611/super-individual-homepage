import test from "node:test";
import assert from "node:assert/strict";

import {
  parseFrontmatterValue,
  parseStarMarkdown,
  sortStarsByDate,
  validateStar,
} from "../src/star-content.mjs";

test("parses strings, numbers, and booleans from frontmatter values", () => {
  assert.equal(parseFrontmatterValue('"星辰，进化之路"'), "星辰，进化之路");
  assert.equal(parseFrontmatterValue("2026"), 2026);
  assert.equal(parseFrontmatterValue("true"), true);
  assert.equal(parseFrontmatterValue("false"), false);
});

test("parses a public star markdown document with body content", () => {
  const star = parseStarMarkdown(
    `---
title: "开始搭建个人星路"
date: "2026-06-09"
year: 2026
type: "now"
summary: "建立一个以星路为核心的个人主页。"
visibility: "public"
current: true
---

这里是正文。`,
    "2026-06-09-current.md",
  );

  assert.deepEqual(star, {
    file: "2026-06-09-current.md",
    title: "开始搭建个人星路",
    date: "2026-06-09",
    year: 2026,
    type: "now",
    summary: "建立一个以星路为核心的个人主页。",
    visibility: "public",
    current: true,
    body: "这里是正文。",
  });
});

test("rejects markdown without required frontmatter fields", () => {
  assert.throws(
    () =>
      validateStar({
        title: "缺字段",
        date: "2026-06-09",
        year: 2026,
        type: "milestone",
        visibility: "public",
      }),
    /Missing required star field: summary/,
  );
});

test("sorts stars newest first and keeps current stars at the front", () => {
  const stars = [
    {
      title: "Old",
      date: "2024-01-01",
      year: 2024,
      type: "milestone",
      summary: "old",
      visibility: "public",
    },
    {
      title: "Current",
      date: "2026-06-09",
      year: 2026,
      type: "now",
      summary: "current",
      visibility: "public",
      current: true,
    },
    {
      title: "Middle",
      date: "2025-01-01",
      year: 2025,
      type: "milestone",
      summary: "middle",
      visibility: "public",
    },
  ];

  assert.deepEqual(
    sortStarsByDate(stars).map((star) => star.title),
    ["Current", "Middle", "Old"],
  );
});
