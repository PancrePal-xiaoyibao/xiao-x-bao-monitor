import rawReadme from "../../README.md?raw";
export type { ParsedReadme, ReadmeSection, ReadmeTable } from "@/lib/readme-parser";
export { normalizeMarkdownInline, parseReadme, parseTableLine } from "@/lib/readme-parser";
import { parseReadme } from "@/lib/readme-parser";

export const parsedReadme = parseReadme(rawReadme);
