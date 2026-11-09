type BrandLogoProps = {
  variant?: "hero" | "nav" | "mark";
  className?: string;
};

const SRC = "/brand/fuerza-elite.png";

export default function BrandLogo({ variant = "nav", className = "" }: BrandLogoProps) {
  if (variant === "hero") {
    return (
      <div className={`brand-hero ${className}`} aria-hidden={false}>
        <img src={SRC} alt="Fuerza Élite" className="brand-hero-img" />
        <span className="brand-shine" aria-hidden="true" />
      </div>
    );
  }
  if (variant === "mark") {
    return (
      <img
        src={SRC}
        alt=""
        className={`h-full w-full object-cover object-[center_8%] ${className}`}
      />
    );
  }
  return (
    <img
      src={SRC}
      alt="Fuerza Élite"
      className={`h-full w-auto object-contain ${className}`}
    />
  );
}
