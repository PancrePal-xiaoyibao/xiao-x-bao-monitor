export interface ReadmeSection {
  title: string;
  paragraphs: string[];
  bullets: string[];
  codeBlocks: string[];
  tables: ReadmeTable[];
}

export interface ParsedReadme {
  title: string;
  intro: string[];
  sections: ReadmeSection[];
}

export interface ReadmeTable {
  headers: string[];
  rows: string[][];
}

export function parseReadme(markdown: string): ParsedReadme {
  const lines = markdown.split(/\r?\n/);
  const title = lines.find((line) => line.startsWith("# "))?.replace(/^# /, "").trim() ?? "README";
  const intro: string[] = [];
  const sections: ReadmeSection[] = [];

  let currentSection: ReadmeSection | null = null;
  let paragraphBuffer: string[] = [];
  let bulletBuffer: string[] = [];
  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];
  let tableBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const text = normalizeMarkdownInline(paragraphBuffer.join(" "));
    if (!text) {
      paragraphBuffer = [];
      return;
    }

    if (currentSection) {
      currentSection.paragraphs.push(text);
    } else {
      intro.push(text);
    }

    paragraphBuffer = [];
  };

  const flushBullet = () => {
    if (bulletBuffer.length === 0) return;
    const text = normalizeMarkdownInline(bulletBuffer.join(" "));
    if (!text) {
      bulletBuffer = [];
      return;
    }

    if (currentSection) {
      currentSection.bullets.push(text);
    } else {
      intro.push(text);
    }

    bulletBuffer = [];
  };

  const flushCodeBlock = () => {
    if (!currentSection || codeBlockBuffer.length === 0) {
      codeBlockBuffer = [];
      return;
    }

    currentSection.codeBlocks.push(codeBlockBuffer.join("\n").trimEnd());
    codeBlockBuffer = [];
  };

  const flushTable = () => {
    if (!currentSection || tableBuffer.length < 2) {
      tableBuffer = [];
      return;
    }

    const rows = tableBuffer.map(parseTableLine).filter((row) => row.length > 0);
    if (rows.length < 2) {
      tableBuffer = [];
      return;
    }

    const headers = rows[0];
    const bodyRows = rows.slice(2);
    if (bodyRows.length > 0) {
      currentSection.tables.push({
        headers,
        rows: bodyRows,
      });
    }
    tableBuffer = [];
  };

  for (const line of lines) {
    if (line.startsWith("# ")) {
      flushBullet();
      flushParagraph();
      continue;
    }

    if (line.startsWith("```")) {
      flushBullet();
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        flushParagraph();
      }
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line);
      continue;
    }

    if (line.startsWith("|")) {
      flushBullet();
      flushParagraph();
      tableBuffer.push(line);
      continue;
    }

    flushTable();

    if (line.startsWith("## ")) {
      flushBullet();
      flushParagraph();
      currentSection = {
        title: line.replace(/^## /, "").trim(),
        paragraphs: [],
        bullets: [],
        codeBlocks: [],
        tables: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (/^\s+/.test(line) && bulletBuffer.length > 0) {
      bulletBuffer.push(line.trim());
      continue;
    }

    if (line.match(/^(-|\d+\.)\s+/)) {
      flushParagraph();
      flushBullet();
      bulletBuffer.push(line.replace(/^(-|\d+\.)\s+/, "").trim());
      continue;
    }

    if (line.trim().length === 0) {
      flushBullet();
      flushParagraph();
      continue;
    }

    if (line.startsWith("> ")) {
      flushBullet();
      continue;
    }

    if (line.startsWith("### ")) {
      flushBullet();
      flushParagraph();
      const heading = normalizeMarkdownInline(line.replace(/^### /, "").trim());
      if (heading && currentSection) {
        currentSection.paragraphs.push(heading);
      }
      continue;
    }

    paragraphBuffer.push(line.trim());
  }

  flushBullet();
  flushParagraph();
  flushTable();

  return {
    title,
    intro,
    sections,
  };
}

export function normalizeMarkdownInline(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();
}

export function parseTableLine(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
}
