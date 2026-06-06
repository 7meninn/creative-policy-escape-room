import { describe, expect, it } from "vitest";
import { mapFoundryRetrieveResponse } from "./mapper";

describe("mapFoundryRetrieveResponse", () => {
  it("maps Foundry references back to synthetic policy citations", () => {
    const bundle = mapFoundryRetrieveResponse("mfa requirement", {
      activity: [{ type: "searchIndex", id: 0 }],
      references: [
        {
          id: "0",
          docKey: "SYN-POL-005#1.1",
          rerankerScore: 3.5,
          sourceData: {
            id: "SYN-POL-005#1.1",
            title: "SYN-POL-005 Password And MFA Policy",
            content:
              "## Section SYN-POL-005#1.1 - MFA Requirement\nSection ID: 1.1"
          }
        }
      ]
    });

    expect(bundle.retrievalMode).toBe("foundry_iq");
    expect(bundle.sources).toEqual(["SYN-POL-005"]);
    expect(bundle.citations[0]).toMatchObject({
      citationId: "FDRY-SYN-POL-005-1-1",
      sourceId: "SYN-POL-005",
      sectionId: "1.1",
      concept: "MFA requirement"
    });
    expect(bundle.safetyFlags).toContain("foundry_activity_present");
  });

  it("fails closed when references cannot resolve to source sections", () => {
    expect(() =>
      mapFoundryRetrieveResponse("unknown", {
        references: [
          {
            sourceData: {
              id: "unmapped",
              title: "Unmapped document",
              content: "No synthetic policy marker."
            }
          }
        ]
      })
    ).toThrow("resolvable synthetic policy citations");
  });
});
