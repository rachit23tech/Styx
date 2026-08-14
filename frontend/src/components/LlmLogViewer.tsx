import React, { useEffect, useState } from 'react';
import { LlmFallbackLog, CategorizationRule } from '../types';
import { fetchLlmLogs, fetchRules } from '../api/client';
import { X, Activity, Cpu, ShieldCheck, RefreshCw } from 'lucide-react';

interface LlmLogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LlmLogViewer: React.FC<LlmLogViewerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LlmFallbackLog[]>([]);
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'rules'>('logs');

  const loadData = async () => {
    try {
      setLoading(true);
      const [logsData, rulesData] = await Promise.all([fetchLlmLogs(), fetchRules()]);
      setLogs(logsData);
      setRules(rulesData);
    } catch (err) {
      console.error('Failed to load LLM logs or rules', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalTokens = logs.reduce((acc, l) => acc + (l.prompt_tokens || 0), 0);
  const avgLatency = logs.length > 0 ? Math.round(logs.reduce((acc, l) => acc + l.latency_ms, 0) / logs.length) : 0;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '750px', width: '90%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={20} color="var(--primary-teal)" />
            <h2 className="modal-title">AI & Rule Observability Audit</h2>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Stats summary bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total LLM Fallbacks</div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: '#0f172a' }}>{logs.length}</div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Prompt Tokens Used</div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: '#0284c7' }}>{totalTokens}</div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Avg Latency</div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: '#10b981' }}>{avgLatency} ms</div>
          </div>
        </div>

        {/* Tabs & Refresh */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn ${activeTab === 'logs' ? 'btn-teal' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '13px' }}
              onClick={() => setActiveTab('logs')}
            >
              <Activity size={14} style={{ marginRight: '6px' }} />
              LLM Fallback Audit Logs ({logs.length})
            </button>
            <button
              className={`btn ${activeTab === 'rules' ? 'btn-teal' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '13px' }}
              onClick={() => setActiveTab('rules')}
            >
              <ShieldCheck size={14} style={{ marginRight: '6px' }} />
              Promoted Rules ({rules.length})
            </button>
          </div>
          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
          {activeTab === 'logs' ? (
            logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '14px' }}>
                No LLM fallback logs recorded yet. Create an expense without a matching rule to trigger Gemini Fallback.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px' }}>Timestamp</th>
                    <th style={{ padding: '8px' }}>Result Category</th>
                    <th style={{ padding: '8px' }}>Tokens</th>
                    <th style={{ padding: '8px' }}>Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px', color: 'var(--text-muted)' }}>
                        {new Date(log.created_at).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '8px', fontWeight: 600, color: '#0f172a' }}>{log.response_category}</td>
                      <td style={{ padding: '8px', color: '#0284c7', fontWeight: 600 }}>{log.prompt_tokens}</td>
                      <td style={{ padding: '8px', color: '#10b981', fontWeight: 600 }}>{log.latency_ms} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : rules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '14px' }}>
              No automated rules promoted yet. Correct transactions 3 times to promote a pattern automatically!
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px' }}>Pattern</th>
                  <th style={{ padding: '8px' }}>Target Category</th>
                  <th style={{ padding: '8px' }}>Confidence / Weight</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const catName = typeof rule.category_id === 'object' ? rule.category_id.name : 'Category';
                  return (
                    <tr key={rule._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px', fontWeight: 700, color: 'var(--primary-teal)' }}>
                        {rule.pattern}
                      </td>
                      <td style={{ padding: '8px', color: '#0f172a', fontWeight: 500 }}>{catName}</td>
                      <td style={{ padding: '8px', color: '#10b981', fontWeight: 600 }}>Score: {rule.confidence_score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
