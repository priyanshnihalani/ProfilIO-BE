import fs from "fs/promises";
import path from "path";
import os from "os";
import Tesseract from "tesseract.js";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function extractPdfTextWithOCR(pdfBuffer) {
    const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "resume-ocr-")
    );

    const pdfPath = path.join(tempDir, "resume.pdf");

    try {
        await fs.writeFile(pdfPath, pdfBuffer);

        console.log("[OCR] PDF saved:", pdfPath);
        console.log("[OCR] Converting PDF to images using native pdftoppm...");

        try {
            // Converts all pages of resume.pdf to page-1.png, page-2.png, etc. at 150 DPI
            await execFileAsync("pdftoppm", [
                "-png",
                "-r",
                "150",
                pdfPath,
                path.join(tempDir, "page")
            ]);
        } catch (err) {
            console.error("[OCR] pdftoppm execution failed:", err);
            if (process.platform === "win32" && err.code === "ENOENT") {
                throw new Error(
                    "pdftoppm was not found in your system PATH. " +
                    "For Windows development, please install poppler (e.g. via 'scoop install poppler' or 'choco install poppler') and verify pdftoppm.exe is in your environment variables."
                );
            }
            throw new Error(`Failed to convert PDF pages to images: ${err.message}`);
        }

        const files = await fs.readdir(tempDir);

        // Filter and sort page images numerically (natural sort) to avoid page ordering bugs (e.g., page-10 before page-2)
        const imageFiles = files
            .filter(
                (file) =>
                    file.endsWith(".png") &&
                    file.startsWith("page")
            )
            .sort((a, b) => {
                const numA = parseInt(a.replace(/[^\d]/g, ""), 10);
                const numB = parseInt(b.replace(/[^\d]/g, ""), 10);
                return numA - numB;
            });

        console.log(
            `[OCR] Generated ${imageFiles.length} image(s)`
        );

        if (!imageFiles.length) {
            throw new Error(
                "No images were generated from PDF."
            );
        }

        const worker = await Tesseract.createWorker("eng");

        const extractedTexts = [];

        try {
            for (const imageFile of imageFiles) {
                const imagePath = path.join(
                    tempDir,
                    imageFile
                );

                console.log(
                    `[OCR] Processing ${imageFile}`
                );

                const {
                    data: { text },
                } = await worker.recognize(
                    imagePath
                );

                if (text?.trim()) {
                    extractedTexts.push(text.trim());

                    console.log(
                        `[OCR] Extracted ${text.length} chars`
                    );
                }
            }
        } finally {
            await worker.terminate();
        }

        const finalText =
            extractedTexts.join("\n\n");

        console.log(
            `[OCR] Completed. Total chars: ${finalText.length}`
        );

        return finalText;
    } finally {
        try {
            await fs.rm(tempDir, {
                recursive: true,
                force: true,
            });
        } catch (error) {
            console.error(
                "[OCR] Cleanup error:",
                error
            );
        }
    }
}