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
          ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
          : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:bg-blue-50 dark:hover:bg-[#1E2845]"
      }`}
    >
      {icon}
      {label}
      {suffix}
    </button>
  );
}
