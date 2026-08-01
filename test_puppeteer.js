import { generatePdfFromHtml } from './utils/generatePdfWithPuppeteer.js';

async function test() {
    try {
        console.log("Generating PDF...");
        const pdf = await generatePdfFromHtml('<h1>Hello</h1>');
        console.log("Success! PDF length:", pdf.length);
    } catch (error) {
        console.error("Puppeteer Failed:", error);
    }
}

test();
