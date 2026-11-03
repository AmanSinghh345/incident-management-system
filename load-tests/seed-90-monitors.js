const BASE_URL = "http://localhost:4000";
const TOKEN = process.env.TOKEN;

async function main() {
  if (!TOKEN) throw new Error("TOKEN is missing");

  for (let i = 11; i <= 100; i++) {
    const response = await fetch(`${BASE_URL}/monitors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        name: `Worker Benchmark ${i}`,
        url: "http://localhost:4000/health",
        intervalSeconds: 3600,
        failureThreshold: 3,
        timeoutSeconds: 5,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Monitor ${i} failed: ${JSON.stringify(data)}`);
    }

    console.log(`Created ${i}/100: ${data.id}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});