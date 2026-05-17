import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, QrCode, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { API_BASE_URL } from '../lib/api';
import './bankQrTest.css';

const DEFAULT_FORM = {
  amount: '500000',
  patient_name: 'Nguyen Van Test',
  bank_bin: '',
  account_no: '',
  account_name: '',
  template: 'compact2',
};

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(status) {
  const labels = {
    pending: 'Chờ xác nhận',
    expired: 'Hết hạn',
    confirmed: 'Đã xác nhận',
    paid: 'Đã thanh toán',
    failed: 'Từ chối',
    cancelled: 'Đã hủy',
    manual_review: 'Cần rà soát',
  };
  return labels[status] || status;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/dev/bank-qr${path}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error?.message || 'Không gọi được API bank QR test.');
  }
  return payload?.data;
}

function nowInputValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function BankQrTestPage() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [config, setConfig] = useState(null);
  const [intents, setIntents] = useState([]);
  const [activeIntent, setActiveIntent] = useState(null);
  const [confirmForm, setConfirmForm] = useState({
    transaction_ref: '',
    received_amount: DEFAULT_FORM.amount,
    received_at: nowInputValue(),
    note: 'Đã nhận tiền trong app ngân hàng',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedIntent = useMemo(() => {
    if (!activeIntent) return null;
    return intents.find((item) => item.id === activeIntent.id || item._id === activeIntent._id) || activeIntent;
  }, [activeIntent, intents]);

  async function loadConfig() {
    const data = await api('/config');
    setConfig(data);
  }

  async function loadIntents() {
    const data = await api('/intents?status=all&limit=50');
    setIntents(data?.items || []);
  }

  useEffect(() => {
    Promise.all([loadConfig(), loadIntents()]).catch((apiError) => setError(apiError.message));
  }, []);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectIntent(intent) {
    setActiveIntent(intent);
    setConfirmForm((current) => ({
      ...current,
      received_amount: String(intent.amount || current.received_amount),
    }));
  }

  async function createIntent(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await api('/intents', {
        method: 'POST',
        body: {
          ...form,
          amount: Number(form.amount),
        },
      });
      const intent = data.payment_intent;
      setActiveIntent(intent);
      setConfirmForm((current) => ({
        ...current,
        received_amount: String(intent.amount),
      }));
      setMessage(`Đã tạo QR ${intent.intent_code}.`);
      await loadIntents();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmIntent() {
    if (!selectedIntent) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await api(`/intents/${selectedIntent.id || selectedIntent._id}/confirm`, {
        method: 'POST',
        body: {
          transaction_ref: confirmForm.transaction_ref,
          received_amount: Number(confirmForm.received_amount),
          received_at: new Date(confirmForm.received_at).toISOString(),
          note: confirmForm.note,
        },
      });
      const nextIntent = data.payment_intent;
      setActiveIntent(nextIntent);
      setMessage(data.manual_review ? `Đã chuyển ${nextIntent.intent_code} sang rà soát.` : `Đã xác nhận ${nextIntent.intent_code}.`);
      await loadIntents();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }

  async function rejectIntent() {
    if (!selectedIntent) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await api(`/intents/${selectedIntent.id || selectedIntent._id}/reject`, {
        method: 'POST',
        body: {
          reason: confirmForm.note || 'Không tìm thấy giao dịch khớp trong app ngân hàng',
          transaction_ref: confirmForm.transaction_ref,
          received_amount: Number(confirmForm.received_amount || 0),
        },
      });
      setActiveIntent(data.payment_intent);
      setMessage(`Đã từ chối ${data.payment_intent.intent_code}.`);
      await loadIntents();
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyIntentCode() {
    if (!selectedIntent?.intent_code) return;
    await navigator.clipboard.writeText(selectedIntent.intent_code);
    setMessage('Đã copy nội dung chuyển khoản.');
  }

  return (
    <main className="bank-qr-test">
      <section className="bank-qr-test__topbar">
        <div>
          <h1>Bank QR Test</h1>
          <p>VietQR chuyển khoản thủ công cho invoice test.</p>
        </div>
        <button className="bank-qr-test__icon-button" type="button" onClick={loadIntents} disabled={loading} title="Tải lại">
          <RefreshCw size={18} />
        </button>
      </section>

      {(message || error) && (
        <div className={`bank-qr-test__alert ${error ? 'is-error' : 'is-success'}`}>
          {error || message}
        </div>
      )}

      <section className="bank-qr-test__grid">
        <form className="bank-qr-test__panel bank-qr-test__form" onSubmit={createIntent}>
          <div className="bank-qr-test__panel-title">
            <QrCode size={18} />
            <h2>Tạo QR</h2>
          </div>
          <label>
            Số tiền VND
            <input value={form.amount} onChange={(event) => updateForm('amount', event.target.value)} inputMode="numeric" />
          </label>
          <label>
            Tên bệnh nhân test
            <input value={form.patient_name} onChange={(event) => updateForm('patient_name', event.target.value)} />
          </label>
          <div className="bank-qr-test__split">
            <label>
              Bank BIN
              <input value={form.bank_bin} onChange={(event) => updateForm('bank_bin', event.target.value)} placeholder={config?.bank_bin || '970436'} />
            </label>
            <label>
              Template
              <select value={form.template} onChange={(event) => updateForm('template', event.target.value)}>
                <option value="compact2">compact2</option>
                <option value="compact">compact</option>
                <option value="qr_only">qr_only</option>
              </select>
            </label>
          </div>
          <label>
            Số tài khoản nhận
            <input value={form.account_no} onChange={(event) => updateForm('account_no', event.target.value)} placeholder={config?.account_no_masked || 'Nhập STK thật'} />
          </label>
          <label>
            Tên tài khoản nhận
            <input value={form.account_name} onChange={(event) => updateForm('account_name', event.target.value)} placeholder={config?.account_name || 'PHUONG HAN'} />
          </label>
          <button className="bank-qr-test__primary" type="submit" disabled={loading}>
            <QrCode size={18} />
            Tạo QR test
          </button>
        </form>

        <section className="bank-qr-test__panel bank-qr-test__checkout">
          <div className="bank-qr-test__panel-title">
            <ShieldCheck size={18} />
            <h2>Checkout</h2>
          </div>
          {selectedIntent ? (
            <>
              <div className="bank-qr-test__qr-frame">
                <img src={selectedIntent.qr_image_url} alt={`QR ${selectedIntent.intent_code}`} />
              </div>
              <dl className="bank-qr-test__summary">
                <div>
                  <dt>Số tiền</dt>
                  <dd>{formatMoney(selectedIntent.amount)}</dd>
                </div>
                <div>
                  <dt>Nội dung CK</dt>
                  <dd>
                    <span>{selectedIntent.intent_code}</span>
                    <button type="button" onClick={copyIntentCode} title="Copy nội dung chuyển khoản">
                      <Copy size={16} />
                    </button>
                  </dd>
                </div>
                <div>
                  <dt>Trạng thái</dt>
                  <dd>{statusLabel(selectedIntent.derived_status || selectedIntent.status)}</dd>
                </div>
                <div>
                  <dt>Hết hạn</dt>
                  <dd>{formatDateTime(selectedIntent.expires_at)}</dd>
                </div>
              </dl>
              <a className="bank-qr-test__link" href={selectedIntent.checkout_url} target="_blank" rel="noreferrer">
                Mở ảnh QR gốc
              </a>
            </>
          ) : (
            <div className="bank-qr-test__empty">Chưa có QR nào được chọn.</div>
          )}
        </section>

        <section className="bank-qr-test__panel bank-qr-test__cashier">
          <div className="bank-qr-test__panel-title">
            <CheckCircle2 size={18} />
            <h2>Cashier</h2>
          </div>
          <label>
            Mã giao dịch ngân hàng
            <input
              value={confirmForm.transaction_ref}
              onChange={(event) => setConfirmForm((current) => ({ ...current, transaction_ref: event.target.value }))}
              placeholder="MBVCB123456789"
            />
          </label>
          <label>
            Số tiền nhận
            <input
              value={confirmForm.received_amount}
              onChange={(event) => setConfirmForm((current) => ({ ...current, received_amount: event.target.value }))}
              inputMode="numeric"
            />
          </label>
          <label>
            Thời điểm nhận
            <input
              type="datetime-local"
              value={confirmForm.received_at}
              onChange={(event) => setConfirmForm((current) => ({ ...current, received_at: event.target.value }))}
            />
          </label>
          <label>
            Ghi chú
            <textarea
              value={confirmForm.note}
              onChange={(event) => setConfirmForm((current) => ({ ...current, note: event.target.value }))}
              rows={3}
            />
          </label>
          <div className="bank-qr-test__actions">
            <button type="button" className="bank-qr-test__primary" onClick={confirmIntent} disabled={!selectedIntent || loading}>
              <CheckCircle2 size={18} />
              Xác nhận
            </button>
            <button type="button" className="bank-qr-test__danger" onClick={rejectIntent} disabled={!selectedIntent || loading}>
              <XCircle size={18} />
              Từ chối
            </button>
          </div>
        </section>
      </section>

      <section className="bank-qr-test__panel bank-qr-test__list">
        <div className="bank-qr-test__panel-title">
          <RefreshCw size={18} />
          <h2>Thanh toán test gần đây</h2>
        </div>
        <div className="bank-qr-test__table">
          {intents.map((intent) => (
            <button
              type="button"
              className={`bank-qr-test__row ${selectedIntent && (selectedIntent.id || selectedIntent._id) === (intent.id || intent._id) ? 'is-active' : ''}`}
              key={intent.id || intent._id}
              onClick={() => selectIntent(intent)}
            >
              <span>{intent.invoice_id?.invoice_no || '-'}</span>
              <strong>{intent.intent_code}</strong>
              <span>{formatMoney(intent.amount)}</span>
              <span>{statusLabel(intent.derived_status || intent.status)}</span>
              <time>{formatDateTime(intent.created_at)}</time>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

export default BankQrTestPage;
