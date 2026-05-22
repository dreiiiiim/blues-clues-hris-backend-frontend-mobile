import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  const res = http.get(`${BASE_URL}/api/tribeX/auth/v1/health`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'apiCenter is reachable': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.checks && body.checks.apiCenter === true;
      } catch {
        return false;
      }
    },
  });
  sleep(1);
}
