import { describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/health/route";

describe("scaffold health check", () => {
  it("SCAFFOLD-AC1 responds ok, proving the Route Handler and test runner are wired", async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
  });
});
