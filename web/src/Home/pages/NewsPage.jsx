import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { MarketingPageShell } from './MarketingPageShell';
import { getArticleBySlug, NEWS_ARTICLES, NEWS_CATEGORIES } from './newsData';

const PAGE_SIZE = 4;

function formatCategoryLabel(categoryId) {
  return NEWS_CATEGORIES.find((item) => item.id === categoryId)?.label || 'Tin tức';
}

export function NewsPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredArticles = useMemo(() => {
    if (activeFilter === 'all') return NEWS_ARTICLES;
    return NEWS_ARTICLES.filter((item) => item.category === activeFilter);
  }, [activeFilter]);

  const sidebarTopics = ['#VaccineSafety', '#Longevity', '#Microbiome', '#MedTech', '#AIHealthcare'];
  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE));
  const paginatedArticles = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredArticles.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredArticles, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  const heroArticle = NEWS_ARTICLES[0];

  const hero = {
    kicker: 'Tòa soạn y khoa Healthcare Plus+',
    title: (
      <>
        Tin tức y khoa
        <span> được biên tập</span>
        <em> để dễ đọc, rõ trọng tâm và hữu ích hơn.</em>
      </>
    ),
    lead: 'Theo dõi 14 bài viết biên tập riêng theo các chủ đề dinh dưỡng, tâm lý, công nghệ và phục hồi. Chúng tôi chọn lọc nội dung để người đọc nắm được điều quan trọng nhất mà không bị quá tải.',
    footer: (
      <>
        <div className="news-feature-summary">
          <div className="news-author news-author--featured">
            <span className="news-author__avatar news-author__avatar--photo" />
            <div className="news-author__meta">
              <strong>Ban biên tập Healthcare Plus+</strong>
              <span>14 bài viết chuyên đề · 4 nhóm chủ đề · cập nhật theo chuyên mục</span>
            </div>
          </div>
          <div className="news-author-row__highlights news-author-row__highlights--featured">
            <span>14 bài biên tập</span>
            <span>4 bài mỗi trang</span>
            <span>Trang đọc chi tiết riêng</span>
          </div>
        </div>

        <div className="news-feature-metrics">
          <article>
            <strong>14</strong>
            <span>bài viết được biên tập riêng để đọc liền mạch và dễ theo dõi</span>
          </article>
          <article>
            <strong>04</strong>
            <span>bài viết hiển thị trên mỗi trang để bố cục gọn, sạch và dễ đọc hơn</span>
          </article>
          <article>
            <strong>04</strong>
            <span>chuyên mục chính để người đọc lọc theo đúng mối quan tâm của mình</span>
          </article>
        </div>
      </>
    ),
    panel: (
      <div
        className="news-hero-visual"
        style={{ '--news-hero-image': `url(${heroArticle.image})` }}
      >
        <div className="news-hero-visual__badge">{heroArticle.tag}</div>
        <div className="news-hero-visual__panel">
          <span>Bài mở đầu</span>
          <strong>{heroArticle.title}</strong>
          <Link to={`/news/${heroArticle.slug}`}>Đọc bài này ↗</Link>
        </div>
      </div>
    ),
  };

  return (
    <MarketingPageShell activeKey="news" hero={hero}>
      <section className="home-section site-page-section news-page-section news-page-section--static">
        <div className="news-content-layout">
          <div className="news-archive">
            <div className="news-page__heading">
              <div>
                <h2>Thư viện bài viết</h2>
                <p className="news-page__subhead">
                  Tổng cộng {NEWS_ARTICLES.length} bài viết, hiển thị {PAGE_SIZE} bài mỗi trang.
                </p>
              </div>
              <div className="news-page__filters">
                {NEWS_CATEGORIES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === activeFilter ? 'is-active' : ''}
                    onClick={() => setActiveFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="news-archive__panel">
              <div className="news-archive__meta">
                <span>{formatCategoryLabel(activeFilter)}</span>
                <strong>Trang {currentPage}/{totalPages}</strong>
              </div>

              <div className="news-grid news-grid--archive">
                {paginatedArticles.map((item) => (
                  <article key={item.slug} className="news-article-card news-article-card--archive">
                    <div
                      className="news-article-card__visual news-article-card__visual--live"
                      style={{ backgroundImage: `url(${item.image})` }}
                    />
                    <div className="news-article-card__meta">
                      <span className="news-article-card__tag">{item.tag}</span>
                      <span>{item.readTime}</span>
                      <span>{item.publishedAt}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.excerpt}</p>
                    <div className="news-article-card__actions">
                      <Link to={`/news/${item.slug}`}>Mở bài viết</Link>
                    </div>
                  </article>
                ))}
              </div>

              <div className="news-pagination">
                <button
                  type="button"
                  onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                  disabled={currentPage === 1}
                >
                  ← Trước
                </button>

                <div className="news-pagination__pages">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      className={page === currentPage ? 'is-active' : ''}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
                  disabled={currentPage === totalPages}
                >
                  Sau →
                </button>
              </div>
            </div>
          </div>

          <aside className="news-magazine__sidebar">
            <article className="news-tip-card news-tip-card--editorial">
              <span className="news-topics-card__kicker">Lời khuyên mỗi ngày</span>
              <div className="news-brief-list">
                <div>
                  <strong>Hydrat hóa đúng cách</strong>
                  <p>Uống đủ nước trong ngày giúp cơ thể giữ năng lượng và hỗ trợ tuần hoàn hiệu quả hơn.</p>
                </div>
                <div>
                  <strong>Tối ưu giấc ngủ</strong>
                  <p>Giảm ánh sáng xanh ít nhất 60 phút trước giờ ngủ để cải thiện chất lượng nghỉ ngơi.</p>
                </div>
                <div>
                  <strong>Vận động ngắn</strong>
                  <p>Thực hiện vài phút vận động nhẹ sau mỗi 2 giờ làm việc để giảm căng cứng cơ thể.</p>
                </div>
              </div>
            </article>

            <article className="news-signup-card news-signup-card--editorial">
              <h3>Nhận thông tin y khoa tinh tuyển.</h3>
              <p>Cập nhật nghiên cứu, xu hướng chăm sóc và những bài viết đáng đọc mỗi tuần.</p>
              <input type="email" placeholder="Địa chỉ email của bạn" />
              <button type="button">Đăng ký ngay</button>
            </article>

            <article className="news-topics-card news-topics-card--editorial">
              <span className="news-topics-card__kicker">Chủ đề thịnh hành</span>
              <div className="news-topic-tags">
                {sidebarTopics.map((topic) => (
                  <span key={topic}>{topic}</span>
                ))}
              </div>
            </article>
          </aside>
        </div>
      </section>
    </MarketingPageShell>
  );
}

export function NewsArticlePage() {
  const { slug } = useParams();
  const article = getArticleBySlug(slug);

  if (!article) {
    return <Navigate to="/news" replace />;
  }

  const relatedArticles = NEWS_ARTICLES.filter((item) => item.slug !== article.slug).slice(0, 3);

  const hero = {
    kicker: article.tag,
    title: (
      <>
        {article.title}
        <em>{article.author} · {article.role}</em>
      </>
    ),
    lead: article.excerpt,
    footer: (
      <div className="news-feature-summary">
        <div className="news-author news-author--featured">
          <span className="news-author__avatar news-author__avatar--photo" />
          <div className="news-author__meta">
            <strong>{article.author}</strong>
            <span>{article.role}</span>
          </div>
        </div>
        <div className="news-author-row__highlights news-author-row__highlights--featured">
          <span>{article.publishedAt}</span>
          <span>{article.readTime}</span>
          <span>{formatCategoryLabel(article.category)}</span>
        </div>
      </div>
    ),
    panel: (
      <div
        className="news-hero-visual"
        style={{ '--news-hero-image': `url(${article.image})` }}
      >
        <div className="news-hero-visual__badge">Healthcare Plus+ Editorial</div>
        <div className="news-hero-visual__panel">
          <span>Bài đọc chuyên đề</span>
          <strong>{article.excerpt}</strong>
          <Link to="/news">← Quay lại trang tin tức</Link>
        </div>
      </div>
    ),
  };

  return (
    <MarketingPageShell activeKey="news" hero={hero}>
      <section className="home-section site-page-section news-article-page">
        <div className="news-article-layout">
          <article className="news-article-content">
            {article.sections.map((section) => (
              <section key={section.heading} className="news-article-content__section">
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ))}
          </article>

          <aside className="news-article-sidebar">
            <div className="news-article-sidebar__card">
              <span className="news-topics-card__kicker">Thông tin bài viết</span>
              <div className="news-article-sidebar__facts">
                <div>
                  <strong>Chuyên mục</strong>
                  <span>{formatCategoryLabel(article.category)}</span>
                </div>
                <div>
                  <strong>Tác giả</strong>
                  <span>{article.author}</span>
                </div>
                <div>
                  <strong>Ngày đăng</strong>
                  <span>{article.publishedAt}</span>
                </div>
                <div>
                  <strong>Thời lượng đọc</strong>
                  <span>{article.readTime}</span>
                </div>
              </div>
            </div>

            <div className="news-article-sidebar__card">
              <span className="news-topics-card__kicker">Đọc tiếp</span>
              <div className="news-hot-list">
                {relatedArticles.map((item, index) => (
                  <Link key={item.slug} className="news-hot-list__item news-hot-list__item--link" to={`/news/${item.slug}`}>
                    <span className="news-hot-list__rank">{String(index + 1).padStart(2, '0')}</span>
                    <span className="news-hot-list__content">
                      <strong>{item.title}</strong>
                      <small>{item.tag} · {item.readTime}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </MarketingPageShell>
  );
}
