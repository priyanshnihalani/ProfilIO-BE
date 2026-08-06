import puppeteer from "puppeteer";

const GOOGLE_FONTS =
    "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Mono:wght@400;500&display=swap";

function buildHtmlDocument(html, css, isCoverLetter = false) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${GOOGLE_FONTS}" rel="stylesheet" />
<script src="https://cdn.tailwindcss.com"></script>
<style>
  @page { size: A4; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; }
  
  ${isCoverLetter ? `
  html, body { margin: 0; padding: 0; background: white; width: 794px; height: 1122px; overflow: hidden; }
  .visual-page-break { display: none !important; }

  /* Ensure top-level containers inside body fit within single A4 page */
  body > div {
    max-height: 1122px;
    box-sizing: border-box;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  ` : `
  html, body { margin: 0; padding: 0; background: white; width: 794px; }
  .visual-page-break { display: none !important; }

  /* Ensure top-level containers inside body flow naturally */
  body > div {
    box-sizing: border-box;
  }
  `}

  /* Tailwind is not loaded in Puppeteer — these rules replicate the
     critical classes used on .resume-page and .resume-document */
  .resume-page {
    position: relative;
    width: 794px;
    height: 1122px;
    background: white;
    overflow: hidden;        /* clips content exactly to A4 — key for PDF */
    box-sizing: border-box;
    flex-shrink: 0;
    page-break-after: always;
    break-after: page;
  }
  .resume-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .resume-document {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    background: transparent;
    padding: 0;
  }
  ${css || ""}
</style>
</head>
<body>${html}</body>
</html>`;
}

export async function generatePdfFromHtml(html, css = "", isCoverLetter = false) {
    let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    
    // If we're on Windows, ignore the Linux chromium path from .env and use the bundled browser
    if (process.platform === 'win32') {
        delete process.env.PUPPETEER_EXECUTABLE_PATH; // Prevent Puppeteer from forcefully reading this!
        executablePath = await puppeteer.executablePath();
    }

    const browser = await puppeteer.launch({
        executablePath,
        headless: "shell",
        args: [
            "--no-sandbox", 
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote"
        ],
    });

    try {
        const page = await browser.newPage();
        await page.setContent(buildHtmlDocument(html, css, isCoverLetter), {
            waitUntil: "networkidle0",
        });

        return await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            preferCSSPageSize: true,
        });
    } finally {
        await browser.close();
    }
}
