import { describe, it, expect } from "vitest";
import { sanitizeEmbeddedDataField } from "./qualtricsExport";

describe("sanitizeEmbeddedDataField", () => {
  it("passes through a clean alphanumeric name unchanged", () => {
    expect(sanitizeEmbeddedDataField("GridAssignments", "field")).toBe(
      "GridAssignments",
    );
  });

  it("replaces spaces with underscores", () => {
    expect(sanitizeEmbeddedDataField("My Field Name", "field")).toBe(
      "My_Field_Name",
    );
  });

  it("collapses multiple consecutive special chars into one underscore", () => {
    expect(sanitizeEmbeddedDataField("hello!!world", "field")).toBe(
      "hello_world",
    );
  });

  it("strips leading and trailing underscores", () => {
    expect(sanitizeEmbeddedDataField("__hello__", "field")).toBe("hello");
  });

  it("prepends fallback when name starts with a digit", () => {
    expect(sanitizeEmbeddedDataField("1Field", "grid")).toBe("grid_1Field");
  });

  it("returns fallback with trailing underscore when name is empty", () => {
    // cleaned="" fails the letter/underscore prefix check, so fallback+"_"+cleaned="fallback_"
    expect(sanitizeEmbeddedDataField("", "fallback")).toBe("fallback_");
  });

  it("returns fallback with trailing underscore when name is only special characters", () => {
    // special chars collapse to "" after stripping → same path as empty name
    expect(sanitizeEmbeddedDataField("!!!@@@", "fallback")).toBe("fallback_");
  });

  it("truncates to 64 characters", () => {
    const long = "A".repeat(80);
    const result = sanitizeEmbeddedDataField(long, "field");
    expect(result.length).toBe(64);
    expect(result).toBe("A".repeat(64));
  });

  it("handles underscores in name without modification", () => {
    expect(sanitizeEmbeddedDataField("Grid_Assignments_2024", "field")).toBe(
      "Grid_Assignments_2024",
    );
  });

  it("handles name starting with underscore by prepending fallback", () => {
    // Leading underscores get stripped, leaving a valid identifier
    expect(sanitizeEmbeddedDataField("_ValidName", "field")).toBe("ValidName");
  });
});
