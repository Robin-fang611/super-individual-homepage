import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { parseStarMarkdown, sortStarsByDate } from "../src/star-content.mjs";

const manifestPath = join("content", "stars", "index.json");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const files = await readJson(manifestPath);
  const manifestDir = dirname(manifestPath);
  const stars = [];

  for (const file of files) {
    const markdown = await readFile(join(manifestDir, file), "utf8");
    const star = parseStarMarkdown(markdown, file);
    if (star.visibility === "public") {
      stars.push(star);
    }
  }

  const sortedStars = sortStarsByDate(stars);
  const currentStars = sortedStars.filter((star) => star.current);

  if (currentStars.length !== 1) {
    throw new Error(`Expected exactly one current star, found ${currentStars.length}`);
  }

  console.log(`Validated ${sortedStars.length} public star nodes.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
