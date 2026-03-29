import { useParams } from 'react-router-dom';
import { PageHero } from '../components/PageHero';
import { articles } from '../data/siteContent';

export function NewsArticlePage() {
  const { slug } = useParams();
  const article = articles.find((item) => item.slug === slug) || articles[0];

  return (
    <div>
      <PageHero eyebrow={article.category} title={article.title} description={article.excerpt} />
      <section className="section">
        <article className="article-card">
          <p>
            Nội dung chi tiết bài viết đang dùng dữ liệu mẫu. Khi nối CMS hoặc backend, phần này có thể thay bằng rich content mà không đổi cấu trúc trình bày.
          </p>
          <p>
            Bố cục bài viết hiện được tối ưu cho việc đọc lâu: chiều rộng hợp lý, độ tương phản tốt và đủ khoảng trắng để nội dung y tế không gây mệt.
          </p>
        </article>
      </section>
    </div>
  );
}
