interface JsonLdProps {
  data: Record<string, unknown>;
}

/**
 * 注入 JSON-LD 结构化数据
 * 使用 dangerouslySetInnerHTML 是此处合规做法 - 内容由服务端静态生成
 */
export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
