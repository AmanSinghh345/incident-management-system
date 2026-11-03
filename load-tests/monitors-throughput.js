
import http from "k6/http";
import { check } from "k6";

export const options = {
  stages: [
    { duration: "20s", target: 10 },
    { duration: "20s", target: 25 },
    { duration: "20s", target: 50 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const res = http.get("http://localhost:4000/monitors", {
    headers: {
      Authorization: `Bearer ${__ENV.TOKEN}`,
    },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
    "valid JSON array": (r) => {
      try {
        return Array.isArray(r.json());
      } catch {
        return false;
      }
    },
  });
}
