import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Database,
  FileText,
  Gauge,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { chatbotAdminGet, chatbotAdminPatch, chatbotAdminPost } from './chatbotAdminApi'

const TABS = [
  ['dashboard', 'Dashboard', Gauge],
  ['conversations', 'Hội thoại', MessageSquare],
  ['training', 'Training', BrainCircuit],
  ['knowledge', 'Knowledge Base', Database],
  ['fallbacks', 'Fallback', AlertTriangle],
  ['playground', 'Playground', Play],
]

function formatValue(value) {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Bật' : 'Tắt'
  if (typeof value === 'number') return value.toLocaleString('vi-VN')
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
    return new Date(value).toLocaleString('vi-VN')
  }
  if (Array.isArray(value)) return value.join(', ')
  return String(value).replace(/_/g, ' ')
}

function StatusBadge({ value }) {
  const text = String(value || 'unknown')
  const tone =
    ['active', 'published', 'low', 'resolved', 'true'].includes(text) ? 'success'
      : ['emergency', 'urgent', 'high', 'false'].includes(text) ? 'danger'
        : ['handoff', 'medium', 'draft', 'waiting_staff'].includes(text) ? 'warning'
          : 'info'
  return <span className={`scm-badge scm-badge--${tone}`}>{formatValue(text)}</span>
}

function Kpi({ label, value, tone = 'info', icon: Icon = Gauge }) {
  return (
    <article className={`scm-kpi scm-kpi--${tone}`}>
      <div className="scm-kpi__icon"><Icon size={18} /></div>
      <div>
        <span>{label}</span>
        <strong>{formatValue(value ?? 0)}</strong>
      </div>
    </article>
  )
}

function JsonBlock({ value }) {
  return <pre className="scm-json">{JSON.stringify(value || {}, null, 2)}</pre>
}

function EmptyState({ title = 'Chưa có dữ liệu' }) {
  return (
    <div className="scm-empty">
      <Bot size={28} />
      <strong>{title}</strong>
      <span>Dữ liệu sẽ xuất hiện khi chatbot có hội thoại hoặc training item phù hợp.</span>
    </div>
  )
}

function DashboardView({ dashboard }) {
  const kpis = dashboard?.kpis || {}
  return (
    <>
      <section className="scm-kpi-strip">
        <Kpi label="Phiên hôm nay" value={kpis.today_sessions} icon={MessageSquare} />
        <Kpi label="Tin nhắn hôm nay" value={kpis.messages_today} icon={Send} />
        <Kpi label="Tự xử lý" value={`${kpis.self_service_rate ?? 100}%`} tone="success" icon={CheckCircle2} />
        <Kpi label="Chuyển nhân viên" value={kpis.handoff_today} tone="warning" icon={UserRound} />
        <Kpi label="Cấp cứu" value={kpis.emergency_today} tone="danger" icon={ShieldCheck} />
        <Kpi label="Fallback mở" value={kpis.open_fallbacks} tone="warning" icon={AlertTriangle} />
        <Kpi label="Intent bật" value={kpis.active_intents} icon={BrainCircuit} />
        <Kpi label="KB published" value={kpis.published_articles} icon={Database} />
      </section>

      <main className="chatbot-admin-grid">
        <section className="scm-main-panel chatbot-admin-panel">
          <h2>Top intent 24h</h2>
          <div className="chatbot-admin-bars">
            {(dashboard?.top_intents || []).map((item) => (
              <div key={item.intent}>
                <span>{item.intent}</span>
                <strong>{item.count}</strong>
                <em style={{ width: `${Math.min(item.count * 12, 100)}%` }} />
              </div>
            ))}
            {dashboard?.top_intents?.length ? null : <EmptyState title="Chưa có intent trong 24h" />}
          </div>
        </section>
        <aside className="scm-side-panel">
          <section>
            <h2>Sức khỏe chatbot</h2>
            {Object.entries(dashboard?.health || {}).map(([key, value]) => (
              <div key={key} className="scm-health-row">
                <span>{key.replace(/_/g, ' ')}</span>
                <StatusBadge value={String(value)} />
              </div>
            ))}
          </section>
        </aside>
      </main>
    </>
  )
}

function ConversationsView({ rows, onOpen }) {
  return (
    <div className="scm-table-wrap">
      <table className="scm-table">
        <thead>
          <tr>
            <th>Session</th>
            <th>Intent</th>
            <th>Step</th>
            <th>Risk</th>
            <th>Trạng thái</th>
            <th>Queue</th>
            <th>Tin cuối</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || row._id}>
              <td>{row.anonymous_id || row.id || row._id}</td>
              <td>{formatValue(row.current_intent)}</td>
              <td>{formatValue(row.current_step)}</td>
              <td><StatusBadge value={row.risk_level} /></td>
              <td><StatusBadge value={row.status} /></td>
              <td>{formatValue(row.assigned_queue)}</td>
              <td>{formatValue(row.last_message_at || row.created_at)}</td>
              <td><button className="scm-action" type="button" onClick={() => onOpen(row)}>Xem</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <EmptyState /> : null}
    </div>
  )
}

function TrainingView({ intents, entities, onSeedIntent, onSeedEntity }) {
  const [intentForm, setIntentForm] = useState({ code: '', name: '', examples: '' })
  const [entityForm, setEntityForm] = useState({ entity_type: 'department', canonical_value: '', synonyms: '' })

  return (
    <main className="chatbot-admin-grid">
      <section className="scm-main-panel chatbot-admin-panel">
        <h2>Intent training</h2>
        <form className="chatbot-admin-form" onSubmit={(event) => {
          event.preventDefault()
          onSeedIntent({
            code: intentForm.code,
            name: intentForm.name,
            examples: intentForm.examples.split('\n').map((item) => item.trim()).filter(Boolean),
          })
          setIntentForm({ code: '', name: '', examples: '' })
        }}>
          <input placeholder="intent code" value={intentForm.code} onChange={(event) => setIntentForm((current) => ({ ...current, code: event.target.value }))} />
          <input placeholder="Tên intent" value={intentForm.name} onChange={(event) => setIntentForm((current) => ({ ...current, name: event.target.value }))} />
          <textarea placeholder="Câu mẫu, mỗi dòng một câu" value={intentForm.examples} onChange={(event) => setIntentForm((current) => ({ ...current, examples: event.target.value }))} />
          <button type="submit"><Sparkles size={15} /> Thêm intent</button>
        </form>
        <div className="chatbot-admin-list">
          {intents.map((intent) => (
            <article key={intent.id || intent._id}>
              <strong>{intent.code}</strong>
              <span>{intent.name}</span>
              <StatusBadge value={intent.enabled ? 'active' : 'disabled'} />
              <small>{(intent.examples || []).slice(0, 3).join(' · ')}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="scm-main-panel chatbot-admin-panel">
        <h2>Entity dictionary</h2>
        <form className="chatbot-admin-form" onSubmit={(event) => {
          event.preventDefault()
          onSeedEntity({
            entity_type: entityForm.entity_type,
            canonical_value: entityForm.canonical_value,
            synonyms: entityForm.synonyms.split('\n').map((item) => item.trim()).filter(Boolean),
          })
          setEntityForm({ entity_type: 'department', canonical_value: '', synonyms: '' })
        }}>
          <select value={entityForm.entity_type} onChange={(event) => setEntityForm((current) => ({ ...current, entity_type: event.target.value }))}>
            <option value="department">department</option>
            <option value="service">service</option>
            <option value="branch">branch</option>
            <option value="symptom">symptom</option>
          </select>
          <input placeholder="Canonical value" value={entityForm.canonical_value} onChange={(event) => setEntityForm((current) => ({ ...current, canonical_value: event.target.value }))} />
          <textarea placeholder="Synonyms, mỗi dòng một từ/cụm" value={entityForm.synonyms} onChange={(event) => setEntityForm((current) => ({ ...current, synonyms: event.target.value }))} />
          <button type="submit"><Stethoscope size={15} /> Thêm entity</button>
        </form>
        <div className="chatbot-admin-list">
          {entities.map((entity) => (
            <article key={entity.id || entity._id}>
              <strong>{entity.canonical_value}</strong>
              <span>{entity.entity_type}</span>
              <StatusBadge value={entity.enabled ? 'active' : 'disabled'} />
              <small>{(entity.synonyms || []).join(', ')}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function KnowledgeView({ articles, onCreate, onReindex, onPublish, onArchive }) {
  const [form, setForm] = useState({ title: '', category: 'procedure', content: '', keywords: '' })

  return (
    <main className="chatbot-admin-grid">
      <section className="scm-main-panel chatbot-admin-panel">
        <h2>Tạo knowledge article</h2>
        <form className="chatbot-admin-form" onSubmit={(event) => {
          event.preventDefault()
          onCreate({
            title: form.title,
            category: form.category,
            content: form.content,
            keywords: form.keywords.split(',').map((item) => item.trim()).filter(Boolean),
            status: 'published',
          })
          setForm({ title: '', category: 'procedure', content: '', keywords: '' })
        }}>
          <input placeholder="Tiêu đề" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
            <option value="procedure">procedure</option>
            <option value="payment">payment</option>
            <option value="insurance">insurance</option>
            <option value="portal">portal</option>
            <option value="pricing">pricing</option>
            <option value="medical_safety">medical_safety</option>
          </select>
          <input placeholder="Từ khóa, phân cách bằng dấu phẩy" value={form.keywords} onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))} />
          <textarea placeholder="Nội dung trả lời chuẩn" value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} />
          <button type="submit"><FileText size={15} /> Tạo bài</button>
        </form>
        <button className="scm-action" type="button" onClick={onReindex}><RefreshCw size={15} /> Re-index KB</button>
      </section>

      <section className="scm-main-panel chatbot-admin-panel">
        <h2>Knowledge base</h2>
        <div className="chatbot-admin-list">
          {articles.map((article) => (
            <article key={article.id || article._id}>
              <strong>{article.title}</strong>
              <span>{article.category}</span>
              <StatusBadge value={article.status} />
              <small>{(article.keywords || []).join(', ')}</small>
              <div>
                {article.status !== 'published' ? <button type="button" onClick={() => onPublish(article)}>Publish</button> : null}
                {article.status !== 'archived' ? <button type="button" onClick={() => onArchive(article)}>Archive</button> : null}
              </div>
            </article>
          ))}
          {articles.length === 0 ? <EmptyState title="Chưa có knowledge article" /> : null}
        </div>
      </section>
    </main>
  )
}

function FallbackView({ fallbacks, onResolve }) {
  return (
    <div className="chatbot-admin-list chatbot-admin-list--wide">
      {fallbacks.map((fallback) => (
        <article key={fallback.id || fallback._id}>
          <strong>{fallback.user_text}</strong>
          <span>{fallback.predicted_intent} · confidence {fallback.confidence}</span>
          <StatusBadge value={fallback.resolved_at ? 'resolved' : 'needs_review'} />
          <button type="button" onClick={() => onResolve(fallback)}>Gán book_appointment</button>
        </article>
      ))}
      {fallbacks.length === 0 ? <EmptyState title="Không có fallback cần rà soát" /> : null}
    </div>
  )
}

function PlaygroundView({ onTest, result }) {
  const [text, setText] = useState('Tôi muốn khám da liễu chiều mai')
  return (
    <main className="chatbot-admin-grid">
      <section className="scm-main-panel chatbot-admin-panel">
        <h2>Test playground</h2>
        <form className="chatbot-admin-form" onSubmit={(event) => {
          event.preventDefault()
          onTest(text)
        }}>
          <textarea value={text} onChange={(event) => setText(event.target.value)} />
          <button type="submit"><Play size={15} /> Phân tích thử</button>
        </form>
      </section>
      <section className="scm-main-panel chatbot-admin-panel">
        <h2>Kết quả</h2>
        <JsonBlock value={result} />
      </section>
    </main>
  )
}

export function ChatbotAdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [conversations, setConversations] = useState([])
  const [intents, setIntents] = useState([])
  const [entities, setEntities] = useState([])
  const [articles, setArticles] = useState([])
  const [fallbacks, setFallbacks] = useState([])
  const [conversationDetail, setConversationDetail] = useState(null)
  const [playgroundResult, setPlaygroundResult] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const query = useMemo(() => ({ search, limit: 30 }), [search])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dashboardData, conversationData, intentData, entityData, articleData, fallbackData] = await Promise.all([
        chatbotAdminGet('/dashboard'),
        chatbotAdminGet('/conversations', query),
        chatbotAdminGet('/intents', { limit: 100 }),
        chatbotAdminGet('/entities', { limit: 100 }),
        chatbotAdminGet('/knowledge/articles', { limit: 100 }),
        chatbotAdminGet('/fallbacks', { resolved: 'false', limit: 60 }),
      ])
      setDashboard(dashboardData)
      setConversations(conversationData?.items || [])
      setIntents(intentData?.items || [])
      setEntities(entityData?.items || [])
      setArticles(articleData?.items || [])
      setFallbacks(fallbackData?.items || [])
    } catch (err) {
      setError(err.message || 'Không thể tải chatbot admin.')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function runMutation(action, success = 'Thao tác đã hoàn tất.') {
    setNotice('')
    setError('')
    try {
      const result = await action()
      setNotice(success)
      await loadData()
      return result
    } catch (err) {
      setError(err.message || 'Thao tác thất bại.')
      return null
    }
  }

  async function openConversation(row) {
    const id = row.id || row._id
    setConversationDetail(await chatbotAdminGet(`/conversations/${id}`))
  }

  const content = (() => {
    if (activeTab === 'dashboard') return <DashboardView dashboard={dashboard} />
    if (activeTab === 'conversations') return <ConversationsView rows={conversations} onOpen={openConversation} />
    if (activeTab === 'training') {
      return (
        <TrainingView
          intents={intents}
          entities={entities}
          onSeedIntent={(body) => runMutation(() => chatbotAdminPost('/intents', body), 'Đã thêm intent.')}
          onSeedEntity={(body) => runMutation(() => chatbotAdminPost('/entities', body), 'Đã thêm entity.')}
        />
      )
    }
    if (activeTab === 'knowledge') {
      return (
        <KnowledgeView
          articles={articles}
          onCreate={(body) => runMutation(() => chatbotAdminPost('/knowledge/articles', body), 'Đã tạo knowledge article.')}
          onReindex={() => runMutation(() => chatbotAdminPost('/knowledge/reindex'), 'Đã re-index knowledge base.')}
          onPublish={(article) => runMutation(() => chatbotAdminPost(`/knowledge/articles/${article.id || article._id}/publish`), 'Đã publish article.')}
          onArchive={(article) => runMutation(() => chatbotAdminPost(`/knowledge/articles/${article.id || article._id}/archive`), 'Đã archive article.')}
        />
      )
    }
    if (activeTab === 'fallbacks') {
      return (
        <FallbackView
          fallbacks={fallbacks}
          onResolve={(fallback) => runMutation(() => chatbotAdminPatch(`/fallbacks/${fallback.id || fallback._id}/resolve`, {
            corrected_intent: 'book_appointment',
            corrected_entities: {},
            added_to_training: true,
          }), 'Đã resolve fallback.')}
        />
      )
    }
    return <PlaygroundView onTest={(text) => runMutation(async () => {
      const result = await chatbotAdminPost('/test', { text })
      setPlaygroundResult(result)
      return result
    }, 'Đã chạy playground.')} result={playgroundResult} />
  })()

  return (
    <div className="scm-page chatbot-admin-page">
      <header className="scm-hero">
        <div className="scm-hero__icon"><Bot size={28} /></div>
        <div className="scm-hero__copy">
          <span>Quản trị hệ thống / Hỗ trợ & Truyền thông</span>
          <h1>AI Chatbot</h1>
          <p>Vận hành trợ lý tư vấn & đặt lịch: safety y tế, intent/entity training, knowledge base, fallback review và test playground.</p>
          <div className="scm-hero__badges">
            <StatusBadge value={error ? 'degraded' : 'active'} />
            <span>Admin API: /api/admin/chatbot</span>
            <span>Public API: /api/chat</span>
          </div>
        </div>
        <div className="scm-hero__actions">
          <button className="scm-action" type="button" onClick={loadData} disabled={loading}>
            <RefreshCw size={16} />
            Làm mới
          </button>
        </div>
      </header>

      <nav className="scm-nav">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} type="button" className={`scm-nav__item${activeTab === key ? ' is-active' : ''}`} onClick={() => setActiveTab(key)}>
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <section className="scm-command chatbot-admin-command">
        <label className="scm-search">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm session, intent, fallback..." />
        </label>
        <button type="button" onClick={loadData}>Áp dụng</button>
      </section>

      {error ? <div className="scm-alert"><AlertTriangle size={18} />{error}</div> : null}
      {notice ? <div className="scm-result"><CheckCircle2 size={18} />{notice}</div> : null}
      {loading ? <div className="scm-result"><RefreshCw size={18} />Đang tải dữ liệu...</div> : null}

      {content}

      {conversationDetail ? (
        <aside className="scm-drawer">
          <div className="scm-drawer__header">
            <div>
              <span>Hội thoại chatbot</span>
              <strong>{conversationDetail.session?.anonymous_id || conversationDetail.session?.id}</strong>
            </div>
            <button type="button" onClick={() => setConversationDetail(null)}>×</button>
          </div>
          <section className="scm-drawer-card">
            <h3>Tin nhắn</h3>
            <div className="scm-message-stream scm-message-stream--tall">
              {(conversationDetail.messages || []).map((message) => (
                <div key={message.id || message._id} className="scm-message">
                  <span>{message.sender_type} · {formatValue(message.created_at)}</span>
                  <p>{message.content}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="scm-drawer-card">
            <h3>Context</h3>
            <JsonBlock value={conversationDetail.session?.context} />
          </section>
        </aside>
      ) : null}
    </div>
  )
}
