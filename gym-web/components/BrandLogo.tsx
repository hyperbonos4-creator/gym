"use client";

import { publicBrand } from "../lib/brand";

type BrandLogoProps = {
  variant?: "hero" | "nav" | "mark";
  className?: string;
};

export default function BrandLogo({ variant = "nav", className = "" }: BrandLogoProps) {
  const brand = publicBrand();
  if (variant === "hero") {
    return (
      <div className={`brand-hero ${className}`} aria-hidden={false}>
        <img src={brand.logoHorizontal} alt={brand.name} className="brand-hero-img" />
        <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-gym-muted">
          {brand.tagline}
        </p>
        <span className="brand-shine" aria-hidden="true" />
      </div>
    );
  }
  if (variant === "mark") {
    return (
      <img
        src={brand.logoMark}
        alt=""
        className={`h-full w-full object-contain ${className}`}
      />
    );
  }
  return (
    <img
      src={brand.logoHorizontal}
      alt={brand.name}
      className={`h-full w-auto object-contain ${className}`}
    />
  );
}