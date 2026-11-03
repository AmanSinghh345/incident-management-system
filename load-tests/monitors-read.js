
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

const BASE_URL = "http://localhost:4000";

export default function () {
  const token = __ENV.TOKEN;

  const res = http.get(`${BASE_URL}/monitors`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  check(res, {
    "monitor list returns 200": (r) => r.status === 200,
    "response is JSON array": (r) => {
      try {
        return Array.isArray(r.json());
      } catch {
        return false;
      }
    },
  });

  sleep(1);
}
