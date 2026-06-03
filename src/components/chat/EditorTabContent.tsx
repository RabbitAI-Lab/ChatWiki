import dynamic from "next/dynamic";

const CherryEditor = dynamic(() => import("@/components/editor/CherryEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-gray-400">
      <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-600 mr-2" />
      <span className="text-sm">Loading...</span>
    </div>
  ),
});

interface EditorTabContentProps {
  filePath: string;
  loaded: boolean;
  content: string;
  onChange: (markdown: string) => void;
  onSave: () => void;
}

export default function EditorTabContent({ filePath, loaded, content, onChange, onSave }: EditorTabContentProps) {
  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-600 mr-2" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <CherryEditor
      key={filePath}
      editorId={"cherry-" + filePath.replace(/\//g, "-")}
      initialValue={content}
      onChange={onChange}
      onSave={onSave}
      defaultModel="editOnly"
    />
  );
}
