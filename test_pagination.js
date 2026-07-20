import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Helper for waiting
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Capture console logs
    page.on('console', (msg) => {
        console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    try {
        console.log("Navigating to login...");
        await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });

        console.log("Logging in...");
        await page.waitForSelector('input[type="email"]');
        await page.type('input[type="email"]', 'admin@portfillo.com');
        await page.type('input[type="password"]', 'portfillO');
        await page.click('button[type="submit"]');

        console.log("Waiting for navigation to templates page...");
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log("Current URL:", page.url());

        // Wait for templates to load
        await page.waitForSelector('button');
        
        // Find and click the first template (Developer ATS)
        console.log("Selecting Template 1...");
        const selectButtons = await page.$$('button');
        let selected = false;
        for (const button of selectButtons) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text.includes('Use Template') || text.includes('Select') || text.includes('Developer ATS')) {
                await button.click();
                selected = true;
                break;
            }
        }
        
        if (!selected) {
            console.log("Clicking first card in templates...");
            await page.click('.bg-white.rounded-3xl'); // click the first template card
        }

        console.log("Waiting for editor preview...");
        await delay(3000); // Wait for initial calibration and render
        console.log("Current URL after selection:", page.url());

        // Let's add a massive amount of text to the experience field
        console.log("Adding massive text to experience...");
        await page.focus('textarea[placeholder*="Acme"]');
        
        // Go to the end of the text area content
        await page.keyboard.down('Control');
        await page.keyboard.press('End');
        await page.keyboard.up('Control');

        await page.type(
            'textarea[placeholder*="Acme"]', 
            "\n\nTechnical Lead | Artium Academy | Online | Jan 2017 - May 2018\n- Designed and deployed scalable microservices-based architecture using Docker containers on AWS infrastructure to support online music learning workflows.\n- Implemented CI/CD pipelines for reliable application deployment and version control.\n- Automated data consolidation, reporting, and KPI dashboards for improved decision-making.\n- Supported AI-powered analytics platform enabling workflow automation and real-time insights.\n- Created secure authentication layers and API gateways for enterprise client integrations.\n- Led engineering team of 8 developers and optimized db queries, reducing loading latency by 35%.\n- Directed migration of legacy systems to modern cloud infrastructure with zero downtime."
        );

        // Wait for React to process the change into form state
        await delay(500);

        // Click "Update Resume Preview"
        console.log("Clicking Update Resume Preview...");
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const updateBtn = buttons.find(b => b.textContent.includes('Update Resume Preview') || b.textContent.includes('Fix Resume Preview'));
            if (updateBtn) {
                console.log("Found update button:", updateBtn.outerHTML);
                updateBtn.click();
            } else {
                console.log("Update button NOT found!");
            }
        });

        console.log("Waiting for pagination measurement...");
        await delay(3000);

        // Extract DOM rendering details
        const paginationDetails = await page.evaluate(() => {
            const pages = Array.from(document.querySelectorAll('.resume-page'));
            return pages.map((p, index) => {
                const name = p.querySelector('[data-block-key="header"]')?.textContent || 'No header';
                const blocks = Array.from(p.querySelectorAll('[data-block-key]')).map(el => el.getAttribute('data-block-key'));
                return { index, name, blocks, offsetHeight: p.offsetHeight };
            });
        });
        console.log("Rendered Pages in DOM:", JSON.stringify(paginationDetails, null, 2));

        // Take a screenshot of the preview
        console.log("Taking preview screenshot...");
        const screenshotPath = 'C:\\Users\\priya\\.gemini\\antigravity\\brain\\2244e756-cd58-47a6-94ae-4e07fdcc65c9\\scratch\\preview_test.png';
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log("Screenshot saved to:", screenshotPath);

    } catch (err) {
        console.error("Error during automation:", err);
    } finally {
        await browser.close();
        console.log("Browser closed.");
    }
}

run();
