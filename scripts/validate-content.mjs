import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { parseRecordMarkdown, sortRecordsByDate } from "../src/record-content.mjs";

const manifestPath = join("content", "records", "index.json");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const files = await readJson(manifestPath);
  const manifestDir = dirname(manifestPath);
  const records = [];

  for (const file of files) {
    const markdown = await readFile(join(manifestDir, file), "utf8");
    const record = parseRecordMarkdown(markdown, file);
    if (record.visibility === "public") {
      records.push(record);
    }
  }

  const sortedRecords = sortRecordsByDate(records);
  const currentRecords = sortedRecords.filter((record) => record.current);

  if (currentRecords.length !== 1) {
    throw new Error(`Expected exactly one current record, found ${currentRecords.length}`);
  }

  console.log(`Validated ${sortedRecords.length} public records.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
