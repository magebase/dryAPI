import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlanTierClaritySlot } from "@/components/site/plan-tier-clarity-slot";

vi.mock("@/components/site/clarity-init", () => ({
  ClarityInit: ({ projectId }: { projectId: string }) => (
    <div data-testid="clarity-init" data-project-id={projectId} />
  ),
}));

describe("PlanTierClaritySlot", () => {
  it("does not render ClarityInit on basic tier", () => {
    render(<PlanTierClaritySlot planTier="basic" clarityProjectId="clarity-id" />);
    expect(screen.queryByTestId("clarity-init")).toBeNull();
  });

  it("renders ClarityInit for growth tier with project id", () => {
    render(<PlanTierClaritySlot planTier="growth" clarityProjectId="clarity-id" />);
    expect(screen.getByTestId("clarity-init")).toBeInTheDocument();
  });

  it("renders ClarityInit for pro tier with project id", () => {
    render(<PlanTierClaritySlot planTier="pro" clarityProjectId="clarity-id" />);
    expect(screen.getByTestId("clarity-init")).toBeInTheDocument();
  });

  it("trims project id before passing it to ClarityInit", () => {
    render(<PlanTierClaritySlot planTier="growth" clarityProjectId="  project-123  " />);
    expect(screen.getByTestId("clarity-init")).toHaveAttribute("data-project-id", "project-123");
  });

  it("does not render ClarityInit when project id is missing", () => {
    render(<PlanTierClaritySlot planTier="growth" clarityProjectId="   " />);
    expect(screen.queryByTestId("clarity-init")).toBeNull();
  });

  it("fails closed for unknown tiers", () => {
    render(<PlanTierClaritySlot planTier="enterprise" clarityProjectId="clarity-id" />);
    expect(screen.queryByTestId("clarity-init")).toBeNull();
  });
});
