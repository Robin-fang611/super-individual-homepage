const REQUIRED_FIELDS = ["title", "date", "year", "type", "summary", "visibility"];

export function parseFrontmatterValue(value) {
  const trimmed = String(value).trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return trimmed;
}

export function validateStar(star) {
  for (const field of REQUIRED_FIELDS) {
    if (star[field] === undefined || star[field] === null || star[field] === "") {
      throw new Error(`Missing required star field: ${field}`);
    }
  }

  if (!Number.isInteger(star.year)) {
    throw new Error(`Invalid star year: ${star.year}`);
  }

  if (Number.isNaN(Date.parse(star.date))) {
    throw new Error(`Invalid star date: ${star.date}`);
  }

  return star;
}

export function parseStarMarkdown(markdown, file = "inline.md") {
  const source = String(markdown).replace(/^\uFEFF/, "");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!match) {
    throw new Error(`Missing frontmatter in ${file}`);
  }

  const [, frontmatter, body] = match;
  const fields = {};

  for (const line of frontmatter.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) {
      throw new Error(`Invalid frontmatter line in ${file}: ${line}`);
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);
    fields[key] = parseFrontmatterValue(value);
  }

  return validateStar({
    file,
    ...fields,
    current: fields.current === true,
    body: body.trim(),
  });
}

export function sortStarsByDate(stars) {
  return [...stars].sort((left, right) => {
    if (left.current && !right.current) {
      return -1;
    }

    if (!left.current && right.current) {
      return 1;
    }

    return Date.parse(right.date) - Date.parse(left.date);
  });
}

export async function loadStars(manifestUrl = "/content/stars/index.json") {
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok) {
    throw new Error(`Failed to load star manifest: ${manifestResponse.status}`);
  }

  const files = await manifestResponse.json();
  const baseUrl = manifestUrl.slice(0, manifestUrl.lastIndexOf("/") + 1);
  const stars = [];

  for (const file of files) {
    const response = await fetch(`${baseUrl}${file}`);
    if (!response.ok) {
      throw new Error(`Failed to load star file ${file}: ${response.status}`);
    }

    const star = parseStarMarkdown(await response.text(), file);
    if (star.visibility === "public") {
      stars.push(star);
    }
  }

  return sortStarsByDate(stars);
}
