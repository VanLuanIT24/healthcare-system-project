import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cpu,
  FileText,
  HeartPulse,
  Mail,
  Newspaper,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { MarketingPageShell } from './MarketingPageShell';
import { getArticleBySlug, NEWS_ARTICLES, NEWS_CATEGORIES } from './newsData';

const PAGE_SIZE = 4;

const categoryIcons = {
  all: Newspaper,
  nutrition: HeartPulse,
  psychology: Brain,
  technology: Cpu,
  recovery: Activity,
};

const editorialMetrics = [
  {
    icon: Newspaper,
    value: '14',
    label: 'bài viết chuyên đề',
    description: 'Biên tập thành các chủ đề dễ đọc, dễ tra cứu và ít gây quá tải.',
  },
  {
    icon: ShieldCheck,
    value: '04',
    label: 'lớp kiểm duyệt',
    description: 'Chọn chủ đề, rà nội dung, chỉnh ngôn ngữ và liên kết với hành trình chăm sóc.',
  },
  {
    icon: BookOpen,
    value: '08',
    label: 'phút đọc trung bình',
    description: 'Mỗi bài ưu tiên trọng tâm thực hành, tránh giật tít hoặc thông tin rời rạc.',
  },
];

const newsroomSignals = [
  { icon: ShieldCheck, label: 'Fact-checked' },
  { icon: CalendarDays, label: 'Cập nhật theo chuyên mục' },
  { icon: FileText, label: 'Có trang đọc chi tiết' },
];

const dailyBriefs = [
  {
    icon: HeartPulse,
    title: 'Hydrat hóa đúng cách',
    description: 'Uống đủ nước trong ngày giúp cơ thể giữ năng lượng và hỗ trợ tuần hoàn hiệu quả hơn.',
  },
  {
    icon: Brain,
    title: 'Tối ưu giấc ngủ',
    description: 'Giảm ánh sáng xanh ít nhất 60 phút trước giờ ngủ để cải thiện chất lượng nghỉ ngơi.',
  },
  {
    icon: Activity,
    title: 'Vận động ngắn',
    description: 'Thực hiện vài phút vận động nhẹ sau mỗi 2 giờ làm việc để giảm căng cứng cơ thể.',
  },
];

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

  const sidebarTopics = [
    { label: '#VaccineSafety', detail: 'An toàn tiêm chủng' },
    { label: '#Longevity', detail: 'Sống khỏe dài hạn' },
    { label: '#Microbiome', detail: 'Hệ vi sinh' },
    { label: '#MedTech', detail: 'Công nghệ y tế' },
    { label: '#AIYTe', detail: 'AI trong lâm sàng' },
  ];
  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE));
  const paginatedArticles = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredArticles.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredArticles, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  const heroArticle = NEWS_ARTICLES[0];
  const featuredArticles = NEWS_ARTICLES.slice(1, 4);

  const hero = {
    kicker: 'Ban biên tập Bộ Y tế',
    title: (
      <>
        Newsroom y khoa
        <span> chính xác</span>
        <em>đọc nhanh, hiểu đúng và đáng tin hơn.</em>
      </>
    ),
    lead: 'Theo dõi các bài viết y khoa được chọn lọc theo dinh dưỡng, tâm lý, công nghệ và phục hồi. Mỗi nội dung được thiết kế để người đọc nắm ý chính, hiểu bối cảnh và biết bước tiếp theo nên hỏi bác sĩ.',
    footer: (
      <>
        <div className="news-feature-summary">
          <div className="news-author news-author--featured">
            <span className="news-author__avatar news-author__avatar--editorial">
              <Newspaper size={24} strokeWidth={2.35} aria-hidden="true" />
            </span>
            <div className="news-author__meta">
              <strong>Ban biên tập Bộ Y tế</strong>
              <span>14 bài viết chuyên đề · 4 nhóm chủ đề · ưu tiên tính ứng dụng</span>
            </div>
          </div>
          <div className="news-author-row__highlights news-author-row__highlights--featured">
            {newsroomSignals.map((item) => (
              <span key={item.label}>
                <item.icon size={15} strokeWidth={2.4} aria-hidden="true" />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="news-feature-metrics">
          {editorialMetrics.map((item) => (
            <article key={item.label}>
              <span className="news-feature-metrics__icon">
                <item.icon size={21} strokeWidth={2.35} aria-hidden="true" />
              </span>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </>
    ),
    panel: (
      <div
        className="news-hero-visual"
        style={{ '--news-hero-image': `url(${heroArticle.image})` }}
      >
        <div className="news-hero-visual__badge">
          <Sparkles size={16} strokeWidth={2.4} aria-hidden="true" />
          {heroArticle.tag}
        </div>
        <div className="news-hero-visual__status">
          <span>Editorial quality</span>
          <strong>Reviewed</strong>
        </div>
        <div className="news-hero-visual__panel">
          <span>Bài mở đầu</span>
          <strong>{heroArticle.title}</strong>
          <div className="news-hero-visual__facts">
            <span>
              <Clock3 size={15} strokeWidth={2.4} aria-hidden="true" />
              {heroArticle.readTime}
            </span>
            <span>
              <CalendarDays size={15} strokeWidth={2.4} aria-hidden="true" />
              {heroArticle.publishedAt}
            </span>
          </div>
          <Link to={`/news/${heroArticle.slug}`}>
            <span>Đọc bài này</span>
            <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" />
          </Link>
        </div>
      </div>
    ),
  };

  return (
    <MarketingPageShell activeKey="news" hero={hero}>
      <section className="home-section site-page-section news-page-section news-page-section--static">
        <div className="news-editorial-strip">
          <div className="news-editorial-strip__lead">
            <span>
              <TrendingUp size={16} strokeWidth={2.4} aria-hidden="true" />
              Đáng chú ý tuần này
            </span>
            <h2>Ba góc nhìn nổi bật để bắt đầu đọc nhanh trong hôm nay</h2>
          </div>
          <div className="news-editorial-strip__items">
            {featuredArticles.map((item, index) => (
              <Link key={item.slug} to={`/news/${item.slug}`}>
                <small>{String(index + 1).padStart(2, '0')}</small>
                <strong>{item.title}</strong>
                <span>{item.tag} · {item.readTime}</span>
              </Link>
            ))}
          </div>
        </div>

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
                  (() => {
                    const CategoryIcon = categoryIcons[item.id] || Newspaper;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={item.id === activeFilter ? 'is-active' : ''}
                        onClick={() => setActiveFilter(item.id)}
                        aria-pressed={item.id === activeFilter}
                      >
                        <CategoryIcon size={16} strokeWidth={2.4} aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })()
                ))}
              </div>
            </div>

            <div className="news-archive__panel">
              <div className="news-archive__meta">
                <span>
                  <Search size={15} strokeWidth={2.4} aria-hidden="true" />
                  {formatCategoryLabel(activeFilter)}
                </span>
                <strong>Trang {currentPage}/{totalPages}</strong>
              </div>

              <div className="news-grid news-grid--archive">
                {paginatedArticles.map((item) => (
                  <article key={item.slug} className="news-article-card news-article-card--archive">
                    <div
                      className="news-article-card__visual news-article-card__visual--live"
                      style={{ backgroundImage: `url(${item.image})` }}
                    >
                      <span>{item.tag}</span>
                    </div>
                    <div className="news-article-card__meta">
                      <span className="news-article-card__tag">
                        <FileText size={13} strokeWidth={2.5} aria-hidden="true" />
                        {item.tag}
                      </span>
                      <span>
                        <Clock3 size={14} strokeWidth={2.4} aria-hidden="true" />
                        {item.readTime}
                      </span>
                      <span>
                        <CalendarDays size={14} strokeWidth={2.4} aria-hidden="true" />
                        {item.publishedAt}
                      </span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.excerpt}</p>
                    <div className="news-article-card__actions">
                      <span>Ban biên tập Bộ Y tế</span>
                      <Link to={`/news/${item.slug}`}>
                        <span>Mở bài viết</span>
                        <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
                      </Link>
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
                  <ChevronLeft size={17} strokeWidth={2.5} aria-hidden="true" />
                  <span>Trước</span>
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
                  <span>Sau</span>
                  <ChevronRight size={17} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <aside className="news-magazine__sidebar">
            <article className="news-tip-card news-tip-card--editorial">
              <span className="news-topics-card__kicker">
                <Sparkles size={15} strokeWidth={2.4} aria-hidden="true" />
                Lời khuyên mỗi ngày
              </span>
              <div className="news-brief-list">
                {dailyBriefs.map((item) => (
                  <div key={item.title}>
                    <span className="news-brief-list__icon">
                      <item.icon size={18} strokeWidth={2.4} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <form className="news-signup-card news-signup-card--editorial" onSubmit={(event) => event.preventDefault()}>
              <span className="news-signup-card__icon">
                <Mail size={23} strokeWidth={2.35} aria-hidden="true" />
              </span>
              <h3>Nhận thông tin y khoa tinh tuyển.</h3>
              <p>Cập nhật nghiên cứu, xu hướng chăm sóc và những bài viết đáng đọc mỗi tuần.</p>
              <input type="email" placeholder="Địa chỉ email của bạn" />
              <button type="submit">
                <span>Đăng ký ngay</span>
                <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </form>

            <article className="news-topics-card news-topics-card--editorial">
              <span className="news-topics-card__kicker">
                <TrendingUp size={15} strokeWidth={2.4} aria-hidden="true" />
                Chủ đề thịnh hành
              </span>
              <div className="news-topic-tags">
                {sidebarTopics.map((topic) => (
                  <span key={topic.label}>
                    <strong>{topic.label}</strong>
                    <small>{topic.detail}</small>
                  </span>
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
        <div className="news-hero-visual__badge">Ban biên tập Bộ Y tế</div>
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
