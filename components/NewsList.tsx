import NewsCard from "./NewsCard";
import type { NewsArticle } from "@/lib/types";

interface NewsListProps {
  articles: NewsArticle[];
}

export default function NewsList({ articles }: NewsListProps) {
  return (
    <div className="space-y-3">
      {articles.map((article) => (
        <NewsCard key={article.id} article={article} />
      ))}
    </div>
  );
}
