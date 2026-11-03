
const BASE_URL = "http://localhost:4000";
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  throw new Error("TOKEN environment variable is missing");
}

async function main() {
  for (let i = 1; i <= 100; i++) {
    const response = await fetch(`${BASE_URL}/monitors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        name: `Load Test Monitor ${i}`,
        url: "http://localhost:4000/health",
        intervalSeconds: 3600,
        failureThreshold: 3,
      }),
    });

    if (!response.ok) {
      console.error(`Failed at monitor ${i}:`, response.status, await response.text());
      process.exitCode = 1;
      return;
    }

    console.log(`Created monitor ${i}/100`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
