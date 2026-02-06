## 2026-02-06 - [Critical] SSRF in Content Fetcher
**Vulnerability:** The `ContentFetcher` service allowed unvalidated access to internal IP addresses (SSRF), enabling access to local services or metadata endpoints.
**Learning:** `page.goto` in Puppeteer follows redirects, and validating only the initial URL is insufficient. Navigation requests must also be intercepted and validated.
**Prevention:** Always use a `validateUrl` helper that resolves DNS and checks for private IP ranges (using `ipaddr.js`). Integrate this check in both the initial call and `page.on('request')` handler for navigation requests.
