const REQUIRED_FIELDS = ["title", "date", "visibility"];

export function parseFrontmatterValue(value) {
  const trimmed = String(value).trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return trimmed;
}

export function validateRecord(record) {
  for (const field of REQUIRED_FIELDS) {
    if (record[field] === undefined || record[field] === null || record[field] === "") {
      throw new Error(`Missing required record field: ${field}`);
    }
  }

  if (Number.isNaN(Date.parse(record.date))) {
    throw new Error(`Invalid record date: ${record.date}`);
  }

  if (!String(record.body ?? "").trim()) {
    throw new Error("Missing required record body");
  }

  return record;
}

export function parseRecordMarkdown(markdown, file = "inline.md") {
  const source = String(markdown).replace(/^\uFEFF/, "");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!match) {
    throw new Error(`Missing frontmatter in ${file}`);
  }

  const [, frontmatter, body] = match;
  const fields = {};

  for (const line of frontmatter.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) {
      throw new Error(`Invalid frontmatter line in ${file}: ${line}`);
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);
    fields[key] = parseFrontmatterValue(value);
  }

  const importance = Number(fields.importance ?? 0.5);

  return validateRecord({
    id: file,
    file,
    title: fields.title,
    date: fields.date,
    type: fields.type ?? "",
    summary: fields.summary ?? "",
    importance: Number.isFinite(importance) ? Math.min(Math.max(importance, 0), 1) : 0.5,
    visibility: fields.visibility,
    current: fields.current === true,
    body: body.trim(),
  });
}

export function sortRecordsByDate(records) {
  return [...records].sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
}

export async function loadRecords(manifestUrl = "/content/records/index.json") {
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok) {
    throw new Error(`Failed to load record manifest: ${manifestResponse.status}`);
  }

  const files = await manifestResponse.json();
  const baseUrl = manifestUrl.slice(0, manifestUrl.lastIndexOf("/") + 1);
  const records = [];

  for (const file of files) {
    const response = await fetch(`${baseUrl}${file}`);
    if (!response.ok) {
      throw new Error(`Failed to load record file ${file}: ${response.status}`);
    }

    const record = parseRecordMarkdown(await response.text(), file);
    if (record.visibility === "public") {
      records.push(record);
    }
  }

  return sortRecordsByDate(records);
}
