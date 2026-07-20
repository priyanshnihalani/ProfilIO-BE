// Quick smoke test for the OCR utility
import { extractPdfTextWithOCR } from "./utils/extractPdfTextWithOCR.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Minimal blank image-based PDF (one blank page, no text stream)
const blankPdfB64 =
    "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSA+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDQgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjIxMApFT0Y=";

const buf = Buffer.from(blankPdfB64, "base64");

console.log("Running OCR on blank/image PDF...");
try {
    const text = await extractPdfTextWithOCR(buf);
    console.log("OCR result:", JSON.stringify(text));
} catch (err) {
    console.error("OCR error:", err.message);
    console.error(err.stack);
}
