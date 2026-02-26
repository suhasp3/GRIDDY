import { cn } from "@/lib/utils";
import React from "react";

interface FlexContainerProps {
  wrap?: "wrap" | "wrap-reverse" | "nowrap";
  gap?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "none";
  variant?:
    | "row-center"
    | "column-center"
    | "row-start"
    | "column-start"
    | "row-end"
    | "column-end"
    | "row-between"
    | "column-between";
  isContainer?: boolean;
  className?: string;
  children: React.ReactNode;
}

const getVariantClass = (variant: FlexContainerProps["variant"]) => {
  switch (variant) {
    case "row-center":
      return "flex-row justify-center items-center";
    case "column-center":
      return "flex-col justify-center items-center";
    case "row-start":
      return "flex-row justify-start items-start";
    case "column-start":
      return "flex-col justify-start items-start *:w-full";
    case "row-end":
      return "flex-row justify-end items-end";
    case "column-end":
      return "flex-col justify-end items-end";
    case "row-between":
      return "flex-row justify-between items-between";
    case "column-between":
      return "flex-col justify-between items-between";
    default:
      return "flex-row justify-start items-start";
  }
};

const getWrapClass = (wrap: FlexContainerProps["wrap"]) => {
  switch (wrap) {
    case "wrap":
      return "flex-wrap";
    case "wrap-reverse":
      return "flex-wrap-reverse";
    case "nowrap":
      return "flex-nowrap";
    default:
      return "flex-wrap";
  }
};

const getGapClass = (gap: FlexContainerProps["gap"]) => {
  switch (gap) {
    case "xs":
      return "gap-1";
    case "sm":
      return "gap-2";
    case "md":
      return "gap-3";
    case "lg":
      return "gap-4";
    case "xl":
      return "gap-5";
    case "2xl":
      return "gap-6";
    case "3xl":
      return "gap-7";
    case "none":
      return "gap-0";
    default:
      return "gap-3";
  }
};

const FlexContainer = ({
  wrap = "nowrap",
  gap = "md",
  variant = "row-start",
  isContainer = false,
  className,
  children,
}: FlexContainerProps) => {
  const variantClass = getVariantClass(variant);
  const gapClass = getGapClass(gap);
  const wrapClass = getWrapClass(wrap);
  return (
    <div
      className={cn(
        "flex",
        isContainer && "p-4 pb-4 rounded-xl border",
        variantClass,
        wrapClass,
        gapClass,
        className,
      )}
    >
      {children}
    </div>
  );
};

export default FlexContainer;
