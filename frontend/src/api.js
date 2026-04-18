const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function analyzeCode(code, language = "java", targetVersion = "21", fileName = "Unknown", retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, targetVersion, fileName })
      });

      const contentType = response.headers.get("content-type");
      let data;
      
      try {
        if (contentType && contentType.includes("application/json")) {
          data = await response.json();
        } else {
          const text = await response.text();
          throw new Error(`Server returned a non-JSON response (Status: ${response.status}). Details: ${text.slice(0, 50)}`);
        }
      } catch (err) {
        throw new Error(err.message || "Failed to parse API response");
      }

      if (!response.ok) {
        const msg = data?.details || data?.error || "Request failed";
        throw new Error(msg);
      }

      return data;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`Analysis failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${1000 * (attempt + 1)}ms...`);
      await sleep(1000 * (attempt + 1));
    }
  }
}
