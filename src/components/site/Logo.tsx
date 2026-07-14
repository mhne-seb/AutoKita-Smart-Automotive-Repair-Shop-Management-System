const autokitaLogo = "/assets/autokita-logo.png"; 

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={autokitaLogo}
        alt="Autokita Logo"
        className="h-25 w-auto object-contain"
      />
    </div>
  );
}
