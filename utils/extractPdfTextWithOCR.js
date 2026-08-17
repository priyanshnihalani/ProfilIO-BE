import fs from "fs/promises";
import path from "path";
import os from "os";
import Canvas from "canvas";
import Tesseract from "tesseract.js";
import { execFile } from "child_process";
import { promisify } from "util";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";

const execFileAsync = promisify(execFile);

async function extractEmbeddedImagesWithPdfJs(pdfBuffer) {
    const data = new Uint8Array(pdfBuffer);
    const pdfDocument = await pdfjsLib.getDocument({ data }).promise;
    const imageBuffers = [];

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const opList = await page.getOperatorList();

        for (let i = 0; i < opList.fnArray.length; i++) {
            const fn = opList.fnArray[i];
            const args = opList.argsArray[i];

            if (
                fn === pdfjsLib.OPS.paintImageXObject ||
                fn === pdfjsLib.OPS.paintInlineImageXObject ||
                fn === pdfjsLib.OPS.paintImageMaskXObject
            ) {
                const imgName = args[0];
                await new Promise((resolve) => {
                    page.objs.get(imgName, (img) => {
                        if (!img || !img.width || !img.height || !img.data) {
                            resolve();
                            return;
                        }
                        const canvas = Canvas.createCanvas(img.width, img.height);
                        const ctx = canvas.getContext("2d");
                        const imgData = ctx.createImageData(img.width, img.height);
                        const src = img.data;
                        const dest = imgData.data;

                        if (src.length === img.width * img.height * 4) {
                            dest.set(src);
                        } else if (src.length === img.width * img.height * 3) {
                            for (let s = 0, d = 0; s < src.length; s += 3, d += 4) {
                                dest[d] = src[s];
                                dest[d + 1] = src[s + 1];
                                dest[d + 2] = src[s + 2];
                                dest[d + 3] = 255;
                            }
                        } else if (src.length === img.width * img.height) {
                            for (let s = 0, d = 0; s < src.length; s++, d += 4) {
                                const val = src[s];
                                dest[d] = val;
                                dest[d + 1] = val;
                                dest[d + 2] = val;
                                dest[d + 3] = 255;
                            }
                        }
                        ctx.putImageData(imgData, 0, 0);
                        imageBuffers.push(canvas.toBuffer("image/png"));
                        resolve();
                    });
                });
            }
        }
    }
    return imageBuffers;
}

export async function extractPdfTextWithOCR(pdfBuffer) {
    const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "resume-ocr-")
    );

    const pdfPath = path.join(tempDir, "resume.pdf");

    try {
        await fs.writeFile(pdfPath, pdfBuffer);

        console.log("[OCR] PDF saved:", pdfPath);
        let imageBuffers = [];

        try {
            console.log("[OCR] Converting PDF to images using native pdftoppm...");
            await execFileAsync("pdftoppm", [
                "-png",
                "-r",
                "150",
                pdfPath,
                path.join(tempDir, "page")
            ]);

            const files = await fs.readdir(tempDir);
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

            for (const file of imageFiles) {
                const buf = await fs.readFile(path.join(tempDir, file));
                imageBuffers.push(buf);
            }
        } catch (pdftoppmErr) {
            console.warn("[OCR] pdftoppm unavailable or failed, falling back to pdfjs in-memory extraction:", pdftoppmErr.message);
            imageBuffers = await extractEmbeddedImagesWithPdfJs(pdfBuffer);
        }

        console.log(`[OCR] Total ${imageBuffers.length} image buffer(s) ready for OCR`);

        if (!imageBuffers.length) {
            throw new Error("No readable images could be extracted from PDF.");
        }

        const worker = await Tesseract.createWorker("eng");
        const extractedTexts = [];

        try {
            for (let i = 0; i < imageBuffers.length; i++) {
                const imgBuf = imageBuffers[i];
                console.log(`[OCR] Processing image ${i + 1}/${imageBuffers.length} (${imgBuf.length} bytes)`);

                const {
                    data: { text },
                } = await worker.recognize(imgBuf);

                if (text?.trim()) {
                    extractedTexts.push(text.trim());
                    console.log(`[OCR] Extracted ${text.length} chars from image ${i + 1}`);
                }
            }
        } finally {
            await worker.terminate();
        }

        const finalText = extractedTexts.join("\n\n");
        console.log(`[OCR] Completed. Total chars: ${finalText.length}`);
        return finalText;
    } finally {
        try {
            await fs.rm(tempDir, {
                recursive: true,
                force: true,
            });
        } catch (error) {
            console.error("[OCR] Cleanup error:", error);
        }
    }
}