import puppeteer from "puppeteer";

const GOOGLE_FONTS =
    "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Mono:wght@400;500&display=swap";

function buildHtmlDocument(html, css) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${GOOGLE_FONTS}" rel="stylesheet" />
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: white; }
  .visual-page-break { display: none !important; }

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

export async function generatePdfFromHtml(html, css = "") {
    const browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
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
        await page.setContent(buildHtmlDocument(html, css), {
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
