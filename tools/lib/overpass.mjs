/**
 * One Overpass client for the build tools, with the backoff a shared free
 * service deserves.
 *
 * ⚠ **Build-time only.** The app never talks to Overpass — it ships the files
 * these tools produce (D-001). Nothing under `app/` may import this.
 *
 * ⚠ Three failure modes, all routine and none a bug in the query:
 *   - **406** to Node's default user agent. The request identifies itself
 *     below; an anonymous scraper is exactly what they are blocking.
 *   - **429 / 504** when the service is busy, which it often is.
 *   - **A 200 carrying an error in its body.** "The server is probably too
 *     busy" arrives that way as often as it arrives as a status code, and an
 *     HTML page parsed as JSON is a confusing way to find that out.
 */

const ENDPOINT = 'https://overpass-api.de/api/interpreter';

/**
 * Run one query and return the parsed JSON.
 *
 * `tool` names the caller in the user agent, so a rate limit can be traced to
 * whichever tool earned it.
 */
export async function overpass(query, { tool, attempts = 5 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': `madeira-explorer ${tool ?? 'build tool'} (contact via repository)`,
      },
      body: new URLSearchParams({ data: query }),
    });

    const body = await response.text();
    const busy =
      response.status === 429 ||
      response.status === 504 ||
      body.includes('too busy');

    if (response.ok && !busy) {
      return JSON.parse(body);
    }
    if (!busy) {
      throw new Error(`Overpass ${response.status}: ${body.slice(0, 300)}`);
    }
    if (attempt === attempts) {
      throw new Error(`Overpass stayed busy after ${attempts} attempts.`);
    }

    const waitMs = attempt * 8000;
    process.stdout.write(`(busy, retrying in ${waitMs / 1000}s) `);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  throw new Error('unreachable');
}
