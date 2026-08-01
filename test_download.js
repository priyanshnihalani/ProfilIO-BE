import fetch from 'node-fetch'; // if available, otherwise just use global fetch if node > 18
const API_URL = "http://localhost:5000/api/cover-letter/generate-pdf";

async function run() {
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ html: "<h1>Test</h1>", filename: "test" })
        });
        if (!response.ok) {
            const text = await response.text();
            console.error("HTTP Error:", response.status, text);
        } else {
            console.log("Success! Status:", response.status);
        }
    } catch (error) {
        console.error("Request Failed:", error);
    }
}
run();
