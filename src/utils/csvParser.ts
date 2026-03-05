/**
 * RFC 4180-compliant CSV parser.
 * Handles quoted fields, embedded commas, and newlines within quotes.
 */

export interface ParsedViralEntry {
  order: number;
  contentType: 'video' | 'slideshow';
  uploaderHandle: string;
  followerCount: number;
  uploadDateISO: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  category: string;
  monetization: string;
  productBrand: string;
  hook: string;
  caption: string;
  tags: string[];
  url: string;
  thumbnail: string;
}

/**
 * Parse raw CSV text into rows of string arrays.
 */
function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(field.trim());
      field = '';
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      currentRow.push(field.trim());
      field = '';
      if (currentRow.length > 1) rows.push(currentRow);
      currentRow = [];
      if (ch === '\r') i++;
    } else {
      field += ch;
    }
  }

  // Flush the last row
  if (field || currentRow.length > 0) {
    currentRow.push(field.trim());
    if (currentRow.length > 1) rows.push(currentRow);
  }

  return rows;
}

/**
 * Parse hashtag string into array of individual tags.
 * Input format: "tag1, tag2, tag3" or "#tag1 #tag2 #tag3"
 */
function parseTags(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,#]+/)
    .map(t => t.trim().replace(/^#/, ''))
    .filter(Boolean);
}

/**
 * Safely parse a numeric string. Returns 0 for empty/invalid.
 */
function safeNumber(val: string): number {
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Parse the genviral CSV file content into structured entries.
 * Expects header row:
 *   #, Type, Creator, Followers, Date Posted, Views, Likes, Comments,
 *   Shares, Saves, Category, Monetization, Product/Brand, Hook,
 *   Caption, Hashtags, TikTok URL, Thumbnail URL
 */
export function parseViralCSV(csvText: string): ParsedViralEntry[] {
  const rows = parseCSVRows(csvText);
  if (rows.length < 2) return [];

  // Skip the header row (index 0)
  const dataRows = rows.slice(1);

  return dataRows.map((cols) => {
    const rawType = (cols[1] || '').toLowerCase();
    const creator = (cols[2] || '').replace(/^@/, '');

    return {
      order: safeNumber(cols[0]),
      contentType: rawType === 'slideshow' ? 'slideshow' : 'video',
      uploaderHandle: creator,
      followerCount: safeNumber(cols[3]),
      uploadDateISO: cols[4] || '',
      views: safeNumber(cols[5]),
      likes: safeNumber(cols[6]),
      comments: safeNumber(cols[7]),
      shares: safeNumber(cols[8]),
      saves: safeNumber(cols[9]),
      category: cols[10] || 'Uncategorized',
      monetization: cols[11] || '',
      productBrand: cols[12] || '',
      hook: cols[13] || '',
      caption: cols[14] || '',
      tags: parseTags(cols[15] || ''),
      url: cols[16] || '',
      thumbnail: cols[17] || '',
    };
  });
}
