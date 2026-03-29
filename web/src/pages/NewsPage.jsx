import { Link } from 'react-router-dom';
import { PageHero } from '../components/PageHero';
import { articles } from '../data/siteContent';

export function NewsPage() {
  return (
    <div>
      <PageHero eyebrow="Tin tức sức khỏe" title="Một khu nội dung gọn, sáng và dễ đọc cho bài viết y tế." description="Danh mục bài viết được tối ưu cho đọc nhanh trên di động và dẫn tới bài chi tiết tự nhiên." />
      <section className="section">
        <div className="card-grid card-grid--three">
          {articles.map((article) => (
            <Link key={article.slug} to={`/tin-tuc/${article.slug}`} className="news-card">
              <span>{article.category}</span>
              <h3>{article.title}</h3>
              <p>{article.excerpt}</p>
              <strong>{article.readTime}</strong>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
