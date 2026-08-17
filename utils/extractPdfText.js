import pdfParse from "pdf-parse-fork";
import { extractPdfTextWithOCR } from "./extractPdfTextWithOCR.js";

export function fixSpacedOutText(str) {
    if (!str || typeof str !== "string") return str;
    return str.replace(/\b(?:[A-Za-z]\s+){2,}[A-Za-z]\b/g, (match) => {
        return match
            .split(/\s{2,}/)
            .map(word => word.replace(/\s+/g, ''))
            .join(' ');
    });
}

function isLikelyImageBasedPdf(text, numPages) {
    const trimmed = text.trim();

    if (!trimmed) {
        return true
    }

    const pages = Math.max(numPages, 1);
    const charsPerPage = trimmed.length / pages;

    // Scanned PDFs typically yield almost no selectable text per page
    if (charsPerPage < 25) {
        return true;
    }

    const alphaCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
    if (alphaCount / trimmed.length < 0.25) {
        return true;
    }

    return false;
}

/**
 * Extract text from a PDF buffer.
 * Uses direct text extraction for text-based PDFs; falls back to OCR for scanned/image PDFs.
 */
export async function extractPdfText(buffer) {
    const pdfData = await pdfParse(buffer);
    const directText = fixSpacedOutText((pdfData.text || "").trim());
    const numPages = pdfData.numpages || 1;

    if (!isLikelyImageBasedPdf(directText, numPages)) {
        console.log(
            `[Extract] Text-based PDF — ${directText.length} chars via pdf-parse (${numPages} page(s))`
        );
        return { text: directText, method: "pdf-parse" };
    }

    console.log(
        `[Extract] Image-based PDF detected (${directText.length} chars, ${numPages} page(s)). Running OCR…`
    );

    const ocrRaw = (await extractPdfTextWithOCR(buffer)).trim();
    const ocrText = fixSpacedOutText(ocrRaw);

    if (!ocrText) {
        if (directText) {
            console.log("[Extract] OCR empty — falling back to pdf-parse text");
            return { text: directText, method: "pdf-parse" };
        }

        throw new Error(
            "OCR could not extract readable text from this PDF."
        );
    }

    console.log(`[Extract] OCR extracted ${ocrText.length} chars`);
    return { text: ocrText, method: "ocr" };
}

