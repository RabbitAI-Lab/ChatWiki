interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  suffix?: React.ReactNode;
}

export default function TabButton({ active, onClick, icon, label, suffix }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-1.5 h-full px-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
        active
          ? "bg-white text-blue-600 border-blue-600"
          : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100"
      }`}
    >
      {icon}
      {label}
      {suffix}
    </button>
  );
}
