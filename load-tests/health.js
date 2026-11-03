import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "1m", target: 10 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const res = http.get("http://localhost:4000/health");

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response contains service": (r) =>
      r.body.includes("pulseops-api"),
  });

  sleep(1);
}